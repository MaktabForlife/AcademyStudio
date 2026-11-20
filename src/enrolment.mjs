import {academyCommand} from './academy-client.mjs';
import {v2Context} from './v111-native-context.mjs';
import {rejectAuthorityWrite} from './access.mjs';
import {fail,id,text,sha256,signedHeaders,bodyJSON} from './protocol.mjs';
import {receive} from './integration.mjs';
export async function requestEnrolment(store,actor,offeringId,input){
 await rejectAuthorityWrite(store,offeringId);
 const offering=await store.scope(actor,offeringId);if(offering.kind==='ACADEMY')throw fail('Enrol in this programme through Academy.');
 return store.mutate(actor,offeringId,input,[store.statement('INSERT INTO enrolment_requests VALUES(?,?,?, ?,\'PENDING\',NULL,?)',[id(input.requestId),offeringId,actor.account_id,text(input.note||'',2000),Date.now()])],{requested:true},{admin:false,studio:true});
}
export async function provisioningPermissions(store,actor,offeringId,{readOnly=false}={}){
 await rejectAuthorityWrite(store,offeringId);
 const scope=await store.scope(actor,offeringId,{admin:true,readOnly});
 return {canProvision:Boolean(actor.global_admin||scope.can_create_account),canLinkAccount:Boolean(actor.global_admin)};
}
export async function beginProvision(store,actor,offeringId,input){
 const permission=await provisioningPermissions(store,actor,offeringId);
 if(!permission.canProvision)throw fail('Your current scope cannot create or link master accounts.',403);
 if(input.accountId&&!permission.canLinkAccount)throw fail('Only Global Admin can link an existing Academy master account.',403);
 const selectedV2=Boolean(v2Context(store));if(selectedV2&&!input.accountId&&!String(input.displayName||'').trim())throw fail('Enter an account name.');
 const command={operationId:id(input.operationId),offeringId,actorId:actor.account_id,actorEpoch:actor.epoch,...(input.accountId?{accountId:id(input.accountId)}:{displayName:text(input.displayName,selectedV2?160:240),create:true})},hash=await sha256(JSON.stringify(command));
 const old=await store.first('SELECT actor_id,payload_hash,state,account_id FROM provisioning WHERE operation_id=?',[input.operationId]);
 if(old){if(old.actor_id!==actor.account_id||old.payload_hash!==hash)throw fail('This enrolment retry has different details.',409);return {state:old.state,accountId:old.account_id};}
 await store.mutate(actor,offeringId,{...input,action:'provision'},[store.statement("INSERT INTO provisioning VALUES(?,?,?,?,?,'PENDING_IDENTITY',NULL,0,?,NULL,NULL)",[input.operationId,offeringId,actor.account_id,hash,JSON.stringify(command),Date.now()])],{state:'PENDING_IDENTITY'},{studio:true,...selectedV2?{completionResource:{editor:'provision',accountId:null,jobId:input.operationId}}:{}});
 return {state:'PENDING_IDENTITY'};
}
export async function resumeProvision(env,store,actor,offeringId,input,fetcher){
 await rejectAuthorityWrite(store,offeringId);
 await store.scope(actor,offeringId,{admin:true});let job=await store.first('SELECT * FROM provisioning WHERE operation_id=? AND offering_id=?',[id(input.jobId),offeringId]);
 if(!job||job.actor_id!==actor.account_id)throw fail('This pending enrolment belongs to another administrator.',403);
 if(job.state==='COMPLETE')return {state:'COMPLETE',accountId:job.account_id,loginPath:job.login_path};
 if(job.state==='PENDING_IDENTITY'){
  if(job.next_attempt>Date.now())throw fail('This enrolment is waiting for its retry time.',429);
  const path='/internal/website/identity',origin=new URL(env.ACADEMY_API_ORIGIN||env.ACADEMY_ORIGIN);if(origin.origin!==(env.ACADEMY_API_ORIGIN||env.ACADEMY_ORIGIN)||origin.protocol!=='https:')throw fail('Academy connection is unavailable.',503);
  const selectedV2=v2Context(store),signed=selectedV2?null:await signedHeaders(env.WEBSITE_TO_ACADEMY_SECRET,path,{...JSON.parse(job.command_json),sourceRef:actor.source_ref,issuedAt:Date.now()});
  try{
   if(selectedV2){
    const received=await academyCommand(env,store,path,JSON.parse(job.command_json),fetcher),a=received.account;
    if(received.schema!=='NATIVE_IDENTITY_V2'||received.operationId!==job.operation_id||!a||typeof a.accountId!=='string'||typeof a.displayName!=='string'||!Number.isSafeInteger(a.epoch)||a.epoch<1||typeof a.active!=='boolean'||typeof a.admitted!=='boolean'||typeof a.globalAdmin!=='boolean'||!Number.isSafeInteger(a.sourceContactAtMs)||typeof received.loginPath!=='string'||!received.loginPath.startsWith('/account/'))throw fail('Academy returned an invalid master-account result.',503);
    await store.mutate(actor,offeringId,{operationId:'identity-v2:'+job.operation_id,action:'identity-linked'},[store.statement('INSERT INTO accounts(account_id,display_name,active,admitted,epoch,verified_at,global_admin) VALUES(?,?,?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET display_name=excluded.display_name,active=excluded.active,admitted=excluded.admitted,epoch=excluded.epoch,verified_at=excluded.verified_at,global_admin=excluded.global_admin WHERE accounts.epoch<=excluded.epoch',[a.accountId,a.displayName,Number(a.active),Number(a.admitted),a.epoch,a.sourceContactAtMs,Number(a.globalAdmin)]),store.statement("UPDATE provisioning SET state='IDENTITY_LINKED',account_id=?,login_path=? WHERE operation_id=? AND state='PENDING_IDENTITY'",[a.accountId,received.loginPath,job.operation_id])],{identityLinked:true},{studio:true});
   }else{
   const response=await fetcher(origin.origin+path,{method:'POST',headers:signed.headers,body:signed.payload,redirect:'manual',signal:AbortSignal.timeout(8000)});
   if(!response.ok){const rejection=await bodyJSON(response.body,4096);throw fail(rejection.error||'Academy could not confirm this account.',[401,403].includes(response.status)?response.status:503,'ACADEMY_IDENTITY_REJECTED');}
   const received=await bodyJSON(response.body,16384);await receive(new Request(env.WEBSITE_ORIGIN+'/internal/academy/events',{method:'POST',headers:{'X-Maktab-Signature':received.signature},body:JSON.stringify(received.delivery)}),env,store);
   }
  }catch(error){await store.run('UPDATE provisioning SET attempts=attempts+1,next_attempt=?,last_error=? WHERE operation_id=?',[Date.now()+Math.min(3600_000,5000*2**Math.min(job.attempts,9)),[401,403].includes(error.status)?'Academy rejected the current account authority.':'Academy acknowledgement is pending.',job.operation_id]);if([401,403].includes(error.status))throw error;throw fail('The master-account result is pending. Retry this enrolment later.',503,'IDENTITY_PENDING');}
  job=await store.first('SELECT * FROM provisioning WHERE operation_id=?',[job.operation_id]);
 }
 if(job.state!=='IDENTITY_LINKED'||!job.account_id)throw fail('Academy has not confirmed the account.',503);
 const completion={operationId:'complete:'+job.operation_id,action:'complete-enrolment',accountId:job.account_id};
 await store.mutate(actor,offeringId,completion,[store.statement("INSERT INTO participation VALUES(?,?,1,0,0,'') ON CONFLICT(account_id,offering_id) DO UPDATE SET enrolled=1",[job.account_id,offeringId]),store.statement("UPDATE provisioning SET state='COMPLETE' WHERE operation_id=?",[job.operation_id])],{state:'COMPLETE',accountId:job.account_id},{studio:true});
 return {state:'COMPLETE',accountId:job.account_id,loginPath:job.login_path};
}
