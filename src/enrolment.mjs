import {fail,id,text,sha256,signedHeaders,bodyJSON} from './protocol.mjs';
import {receive} from './integration.mjs';
export async function requestEnrolment(store,actor,offeringId,input){
 const offering=await store.scope(actor,offeringId);if(offering.kind==='ACADEMY')throw fail('Enrol in this programme through Academy.');
 return store.mutate(actor,offeringId,input,[store.statement('INSERT INTO enrolment_requests VALUES(?,?,?, ?,\'PENDING\',NULL,?)',[id(input.requestId),offeringId,actor.account_id,text(input.note||'',2000),Date.now()])],{requested:true},{admin:false});
}
export async function beginProvision(store,actor,offeringId,input){
 const scope=await store.scope(actor,offeringId,{admin:true});
 if(!actor.global_admin&&!scope.can_create_account)throw fail('Your current scope cannot create or link master accounts.',403);
 if(input.accountId&&!actor.global_admin)throw fail('Only Global Admin can link an existing Academy master account.',403);
 const command={operationId:id(input.operationId),offeringId,actorId:actor.account_id,actorEpoch:actor.epoch,...(input.accountId?{accountId:id(input.accountId)}:{displayName:text(input.displayName),create:true})},hash=await sha256(JSON.stringify(command));
 const old=await store.first('SELECT actor_id,payload_hash,state,account_id FROM provisioning WHERE operation_id=?',[input.operationId]);
 if(old){if(old.actor_id!==actor.account_id||old.payload_hash!==hash)throw fail('This enrolment retry has different details.',409);return {state:old.state,accountId:old.account_id};}
 await store.mutate(actor,offeringId,{...input,action:'provision'},[store.statement("INSERT INTO provisioning VALUES(?,?,?,?,?,'PENDING_IDENTITY',NULL,0,?,NULL,NULL)",[input.operationId,offeringId,actor.account_id,hash,JSON.stringify(command),Date.now()])],{state:'PENDING_IDENTITY'});
 return {state:'PENDING_IDENTITY'};
}
export async function resumeProvision(env,store,actor,offeringId,input,fetcher){
 await store.scope(actor,offeringId,{admin:true});let job=await store.first('SELECT * FROM provisioning WHERE operation_id=? AND offering_id=?',[id(input.jobId),offeringId]);
 if(!job||job.actor_id!==actor.account_id)throw fail('This pending enrolment belongs to another administrator.',403);
 if(job.state==='COMPLETE')return {state:'COMPLETE',accountId:job.account_id,loginPath:job.login_path};
 if(job.state==='PENDING_IDENTITY'){
  if(job.next_attempt>Date.now())throw fail('This enrolment is waiting for its retry time.',429);
  const path='/internal/website/identity',origin=new URL(env.ACADEMY_ORIGIN);if(origin.origin!==env.ACADEMY_ORIGIN||origin.protocol!=='https:')throw fail('Academy connection is unavailable.',503);
  const signed=await signedHeaders(env.WEBSITE_TO_ACADEMY_SECRET,path,{...JSON.parse(job.command_json),sourceRef:actor.source_ref,issuedAt:Date.now()});
  try{
   const response=await fetcher(origin.origin+path,{method:'POST',headers:signed.headers,body:signed.payload,redirect:'manual',signal:AbortSignal.timeout(8000)});
   if(!response.ok){const rejection=await bodyJSON(response.body,4096);throw fail(rejection.error||'Academy could not confirm this account.',[401,403].includes(response.status)?response.status:503,'ACADEMY_IDENTITY_REJECTED');}
   const received=await bodyJSON(response.body,16384);await receive(new Request(env.WEBSITE_ORIGIN+'/internal/academy/events',{method:'POST',headers:{'X-Maktab-Signature':received.signature},body:JSON.stringify(received.delivery)}),env,store);
  }catch(error){await store.run('UPDATE provisioning SET attempts=attempts+1,next_attempt=?,last_error=? WHERE operation_id=?',[Date.now()+Math.min(3600_000,5000*2**Math.min(job.attempts,9)),[401,403].includes(error.status)?'Academy rejected the current account authority.':'Academy acknowledgement is pending.',job.operation_id]);if([401,403].includes(error.status))throw error;throw fail('The master-account result is pending. Retry this enrolment later.',503,'IDENTITY_PENDING');}
  job=await store.first('SELECT * FROM provisioning WHERE operation_id=?',[job.operation_id]);
 }
 if(job.state!=='IDENTITY_LINKED'||!job.account_id)throw fail('Academy has not confirmed the account.',503);
 const completion={operationId:'complete:'+job.operation_id,action:'complete-enrolment',accountId:job.account_id};
 await store.mutate(actor,offeringId,completion,[store.statement("INSERT INTO participation VALUES(?,?,1,0,0,'') ON CONFLICT(account_id,offering_id) DO UPDATE SET enrolled=1",[job.account_id,offeringId]),store.statement("UPDATE provisioning SET state='COMPLETE' WHERE operation_id=?",[job.operation_id])],{state:'COMPLETE',accountId:job.account_id});
 return {state:'COMPLETE',accountId:job.account_id,loginPath:job.login_path};
}
