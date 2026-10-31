import {signedInput} from './integration.mjs';
import {handoverSteps} from './studio-access.mjs';
import {fail,id} from './protocol.mjs';

// A machine capability for an accepted first publication, not an Admin session.
// The browser cannot supply one: the existing purpose-bound Academy signature
// protects both the immutable registration and each guarded checkpoint command.
export async function coursePublication(request,env,store){
 if(env.AUTHORITY_MODE!=='ACADEMY')throw fail('Course publication integration is unavailable.',503);
 const input=await signedInput(request,env),r=input.registration||{},command=input.command||{};
 const offer=id(r.offeringId),registration=id(r.registrationId),activity=id(r.activityKey),run=id(r.runId),publication=id(r.publicationId);
 if(activity!=='COURSE:'+offer||!['FREE','PAID'].includes(r.accessModel))throw fail('Invalid first Course publication.');
 const actorId='ACADEMY_PUBLICATION',baseSQL='EXISTS(SELECT 1 FROM course_publications WHERE offering_id=? AND registration_id=? AND activity_key=? AND run_id=? AND publication_id=? AND access_model=?)',baseArgs=[offer,registration,activity,run,publication,r.accessModel];
 const mutate=async(offering,input,statements,result,{expectedSQL='1',expectedArgs=[]}={})=>{
  const hash=await store.requestHash(offering,input),old=await store.replay(actorId,input.operationId,hash);if(old)return old;
  const guard=crypto.randomUUID();
  try{await store.batch([
   store.statement(`INSERT INTO guards VALUES(?,(${baseSQL}) AND (${expectedSQL}))`,[guard,...baseArgs,...expectedArgs]),...statements,
   store.statement('INSERT INTO operations VALUES(?,?,?,?,?)',[input.operationId,actorId,hash,JSON.stringify(result),Date.now()]),
   store.statement('INSERT INTO audit VALUES(?,?,?,?,?,?)',[crypto.randomUUID(),actorId,input.action,offer,Date.now(),JSON.stringify({registrationId:registration,transferId:input.transferId})]),store.statement('DELETE FROM guards WHERE guard_id=?',[guard])
  ]);}catch(error){const saved=await store.replay(actorId,input.operationId,hash);if(saved)return saved;throw fail('Publication setup checkpoint changed. Resume setup.',409,'CHANGE_CONFLICT');}return result;
 };
 const saved=await store.first('SELECT * FROM course_publications WHERE offering_id=?',[offer]);
 if(command.action==='register'){
  if(saved){if(saved.registration_id!==registration||saved.activity_key!==activity||saved.run_id!==run||saved.publication_id!==publication||saved.access_model!==r.accessModel)throw fail('A different first publication already owns this registration.',409,'REGISTRATION_CONFLICT');return {registered:true,replayed:true};}
  const guard=crypto.randomUUID();
  try{await store.batch([
   store.statement("INSERT INTO guards VALUES(?,NOT EXISTS(SELECT 1 FROM course_publications WHERE offering_id=?) AND NOT EXISTS(SELECT 1 FROM offerings WHERE offering_id=? AND kind<>'COURSE') AND NOT EXISTS(SELECT 1 FROM access_handovers WHERE offering_id=?) AND NOT EXISTS(SELECT 1 FROM source_access_scopes WHERE offering_id=? AND authority<>'ACADEMY') AND NOT EXISTS(SELECT 1 FROM course_access_models WHERE offering_id=? AND access_model<>?))",[guard,offer,offer,offer,offer,offer,r.accessModel]),
   store.statement("INSERT INTO offerings VALUES(?,'COURSE',?,1,0) ON CONFLICT DO NOTHING",[offer,offer]),
   store.statement('INSERT INTO course_publications VALUES(?,?,?,?,?,?,?)',[offer,registration,activity,run,publication,r.accessModel,Date.now()]),
   store.statement('INSERT INTO course_access_models VALUES(?,?) ON CONFLICT DO NOTHING',[offer,r.accessModel]),store.statement('DELETE FROM guards WHERE guard_id=?',[guard])
  ]);}catch(error){throw fail('This offering cannot accept a new first publication registration.',409,'REGISTRATION_CONFLICT');}return {registered:true};
 }
 if(!saved||saved.registration_id!==registration||saved.activity_key!==activity||saved.run_id!==run||saved.publication_id!==publication||saved.access_model!==r.accessModel)throw fail('Register the accepted first publication before handing over.',409,'REGISTRATION_REQUIRED');
 if(!['handover-status','handover-begin','handover-page','handover-commit','handover-abort'].includes(command.action))throw fail('Choose a publication setup step.');
 return handoverSteps(store,offer,command,{actorId,mutate});
}
