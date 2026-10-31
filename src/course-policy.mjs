import {fail} from './protocol.mjs';

export async function coursePolicy(store,offeringId){
 const row=await store.first('SELECT m.access_model,r.revision FROM course_access_models m JOIN course_policy_revisions r USING(offering_id) WHERE m.offering_id=?',[offeringId]);
 return row?{offeringId,model:row.access_model,revision:row.revision}:null;
}
export async function coursePolicyEpoch(store){
 return store.coursePolicyEpoch??=Number((await store.first('SELECT revision FROM course_policy_state WHERE singleton=1'))?.revision||0);
}
export async function changeCoursePolicy(store,actor,offeringId,input,options={}){
 const scope=await store.scope(actor,offeringId,{admin:true});if(scope.kind!=='COURSE'||!['FREE','PAID'].includes(input.accessModel))throw fail('Choose the reviewed Course FREE/PAID setting.');
 const previous=await coursePolicy(store,offeringId);if(!previous)throw fail('Confirm the initial Course policy before changing it.',409,'COURSE_POLICY_REQUIRED');
 const revision=previous.revision+Number(previous.model!==input.accessModel),policy={offeringId,model:input.accessModel,revision};
 return store.mutate(actor,offeringId,input,[store.statement('UPDATE course_access_models SET access_model=? WHERE offering_id=?',[input.accessModel,offeringId])],{saved:true,coursePolicy:policy},{...options,studio:true,expectedSQL:`(${options.expectedSQL||'1'}) AND EXISTS(SELECT 1 FROM course_policy_revisions WHERE offering_id=? AND revision=?)`,expectedArgs:[...(options.expectedArgs||[]),offeringId,previous.revision]});
}
