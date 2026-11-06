import assert from 'node:assert/strict';

// Accept only the recorded recovery of the same compatible paired release.
export function recoveredBaseline(receipt,record,version){
 assert.equal(record.schema,1);assert.equal(record.releaseVersion,version);
 assert.equal(receipt.version,record.baselineVersion);
 for(const [actual,expected]of [
  [receipt.source.commit,record.sourceCommit],[receipt.source.workerVersion,record.sourceWorkerVersion],
  [receipt.studio.commit,record.studioCommit],[receipt.studio.workerVersion,record.studioWorkerVersion],
  [receipt.coordinatorVersion,record.coordinatorVersion],[receipt.source.pages.id,record.receiptPagesId]
 ])assert.equal(actual,expected,'Recovery record does not match the verified paired receipt');
 return {...structuredClone(receipt),source:{...structuredClone(receipt.source),pages:{id:record.recoveredPagesId,url:'https://'+record.recoveredPagesId.split('-')[0]+'.academy-maktab4life.pages.dev'}}};
}
export function assertProductionPages(project,baseline,branch='development'){
 assert.equal(project.production_branch,branch,'Production Pages branch changed');
 const page=project.canonical_deployment;
 assert.equal(page.id,baseline.source.pages.id,'Production Pages baseline changed');
 assert.equal(page.environment,'production','Rollback target must be production');
 assert.equal(page.latest_stage.status,'success','Rollback target must be successful');
 assert.equal(page.deployment_trigger.metadata.commit_hash,baseline.source.commit,'Rollback Pages source changed');
}
// Attempt all recovery operations; report success only after verification.
export async function recoverPair({restoreWorker,restorePages,verify,checkpoint=async()=>{}}){
 const errors=[];
 for(const side of ['source','target']){
  try{await restoreWorker(side);}catch(error){errors.push({side,error:error.message});}
  await checkpoint({errors:structuredClone(errors)});
 }
 try{await restorePages();}catch(error){errors.push({side:'pages',error:error.message});}
 await checkpoint({errors:structuredClone(errors)});
 let verified=false;
 try{await verify();verified=true;}catch(error){errors.push({side:'verification',error:error.message});}
 const result={status:errors.length?'RECOVERY_NEEDS_ATTENTION':'PREVIOUS_COMPATIBLE_PAIR_RESTORED',verified,errors};
 await checkpoint(result);return result;
}
