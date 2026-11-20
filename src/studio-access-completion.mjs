import {v2Context} from './v111-native-context.mjs';
import {fail,id} from './protocol.mjs';
export const studioAccessCompletionSchemaSQL=`CREATE TABLE IF NOT EXISTS studio_access_operation_receipts(operation_id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,offering_id TEXT NOT NULL,editor TEXT NOT NULL,account_id TEXT,job_id TEXT,payload_hash TEXT NOT NULL,resource_json TEXT NOT NULL);CREATE TRIGGER IF NOT EXISTS studio_access_receipt_immutable BEFORE UPDATE ON studio_access_operation_receipts BEGIN SELECT RAISE(ABORT,'STUDIO_ACCESS_RECEIPT_IMMUTABLE');END;`;
function facts(store,actor,offer,input,resource){
 if(!resource||!v2Context(store,actor))return null;
 if(Object.keys(resource).sort().join(',')!=='accountId,editor,jobId'||!['course-policy','participant','provision'].includes(resource.editor)||resource.editor==='course-policy'&&(resource.accountId!==null||resource.jobId!==null)||resource.editor==='participant'&&(!resource.accountId||resource.jobId!==null)||resource.editor==='provision'&&(resource.accountId!==null||resource.jobId!==input.operationId))throw fail('Invalid native completion resource.',400);
 return {operationId:id(input.operationId),actorId:id(actor.account_id),offeringId:id(offer),resource:{editor:resource.editor,accountId:resource.accountId===null?null:id(resource.accountId),jobId:resource.jobId===null?null:id(resource.jobId)}};
}
export async function studioAccessCompletionPlan(store,actor,offer,input,resource,hash,{replay=false}={}){
 const f=facts(store,actor,offer,input,resource);if(!f)return [];
 const canonical=JSON.stringify(f.resource),old=await store.first('SELECT * FROM studio_access_operation_receipts WHERE operation_id=?',[f.operationId]);
 if(old&&(old.actor_id!==f.actorId||old.offering_id!==f.offeringId||old.resource_json!==canonical||old.payload_hash!==hash))throw fail('This retry belongs to another native resource.',409,'RETRY_CONFLICT');
 if(replay)return [];return [store.statement('INSERT INTO studio_access_operation_receipts VALUES(?,?,?,?,?,?,?,?)',[f.operationId,f.actorId,f.offeringId,f.resource.editor,f.resource.accountId,f.resource.jobId,hash,canonical])];
}
export async function studioAccessCompletionStatus(store,actor,offer,input){
 if(!v2Context(store,actor))throw fail('Current native authority is required.',403);
 const r=input.resource;if(!r||r.type!=='academy-studio-access'||!['course-policy','participant','provision'].includes(r.editor))throw fail('Choose a supported access operation.',400);
 const row=await store.first('SELECT c.actor_id,c.offering_id,c.editor,c.account_id,c.job_id FROM studio_access_operation_receipts c JOIN operations o ON o.operation_id=c.operation_id AND o.actor_id=c.actor_id AND o.payload_hash=c.payload_hash WHERE c.operation_id=?',[id(input.operationId)]);
 if(row&&(row.actor_id!==actor.account_id||row.offering_id!==offer||row.editor!==r.editor||row.account_id!==r.accountId||row.job_id!==r.jobId))throw fail('This operation belongs to another native resource.',403,'NATIVE_OPERATION_RESOURCE_MISMATCH');
 return {operationId:input.operationId,committed:Boolean(row),acceptedChange:null,head:null,published:false};
}
