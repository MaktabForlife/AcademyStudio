// Proposed fixed-scope maintenance only. No current schedule/binding/HTTP route
// enables it. Current native content is preserved by a same-transaction minimal
// committed-object receipt, independent of expiring private processing metadata.
const privatePrefix='video-processing-private/',nativePrefix='video-autolink-native-v1/';
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),id=v=>typeof v==='string'&&/^[-A-Za-z0-9_:]{1,180}$/.test(v),uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
function expiry(object){const v=object.customMetadata?.privateExpiresAt;return typeof v==='string'&&/^\d+$/.test(v)&&Number.isSafeInteger(Number(v))?Number(v):null;}
function sourceKey(row){return id(row.source_id)&&hash(row.transcript_hash)&&['VTT','SRT'].includes(row.transcript_format)&&row.transcript_key===privatePrefix+'sources/'+row.source_id+'/transcript-'+row.transcript_hash+'.'+row.transcript_format.toLowerCase();}
function candidateKey(row){return id(row.job_id)&&id(row.attempt_id)&&hash(row.object_hash)&&row.object_key===privatePrefix+row.job_id+'/'+row.attempt_id+'/candidate-'+row.object_hash+'.json';}
function nativeKey(key){const m=typeof key==='string'&&key.match(/^video-autolink-native-v1\/([^/]+)\/([^/]+)\/companion-([a-f0-9]{64})\.json$/);return m&&uuid(m[1])&&id(m[2])?{jobId:m[1],operationId:m[2],hash:m[3]}:null;}
async function metadataBatch(store,sql,args,statements){
 const guardId=crypto.randomUUID();await store.batch([store.statement('INSERT INTO guards(guard_id,accepted) SELECT ?,EXISTS('+sql+')',[guardId,...args]),...statements,store.statement('DELETE FROM guards WHERE guard_id=?',[guardId])]);
}
async function cancelExpired(store,jobId,now){
 await metadataBatch(store,"SELECT 1 FROM video_processing_jobs WHERE job_id=? AND private_expires_at<=? AND state<>'ACCEPTED'",[jobId,now],[
 store.statement("UPDATE video_processing_jobs SET state='CANCELLED' WHERE job_id=?",[jobId]),
 store.statement("UPDATE video_processing_candidates SET cleanup_state='DELETING' WHERE job_id=?",[jobId])]);
}
export async function cleanupProcessing(env,store,{privateCursor,nativeCursor,limit=25,now=Date.now()}={}){
 if(env.VIDEO_AUTOLINK_ENABLED!=='1'||env.VIDEO_AI_CLEANUP_ENABLED!=='1')return {disabled:true};
 if(!Number.isSafeInteger(limit)||limit<1||limit>25||!Number.isSafeInteger(now)||now<0||!env.VIDEO_PROCESSING_PRIVATE||!env.CONTENT)throw new Error('PROCESSING_CLEANUP_UNCONFIGURED');
 const result={jobsPruned:0,sourcesPruned:0,privateObjectsDeleted:0,nativeOrphansDeleted:0,committedObjectsPreserved:0,retryRequired:0};
 const jobs=await store.all('SELECT * FROM video_processing_jobs INDEXED BY video_processing_jobs_expiry WHERE private_expires_at<=? ORDER BY private_expires_at,job_id LIMIT ?',[now,limit]);
 for(const job of jobs){
  try{
   const candidate=await store.first('SELECT * FROM video_processing_candidates WHERE job_id=?',[job.job_id]),source=await store.first('SELECT * FROM video_processing_sources WHERE source_id=?',[job.source_id]);
   if(!source||!sourceKey(source)||candidate&&!candidateKey(candidate)){result.retryRequired++;continue;}
   const committed=candidate?.prepared_native_key?await store.first('SELECT object_key FROM video_processing_committed_objects WHERE object_key=?',[candidate.prepared_native_key]):null;
   if(job.state==='ACCEPTED'){
    if(!committed){result.retryRequired++;continue;}result.committedObjectsPreserved++;
   }else{await cancelExpired(store,job.job_id,now);}
   if(candidate){await env.VIDEO_PROCESSING_PRIVATE.delete(candidate.object_key);result.privateObjectsDeleted++;}
   if(source.private_expires_at<=now){await env.VIDEO_PROCESSING_PRIVATE.delete(source.transcript_key);result.privateObjectsDeleted++;}
   if(candidate?.prepared_native_key&&!committed){
    const key=nativeKey(candidate.prepared_native_key);if(!key||key.jobId!==job.job_id||key.hash!==candidate.prepared_native_hash||key.operationId!==candidate.prepared_operation_id){result.retryRequired++;continue;}
    await env.CONTENT.delete(candidate.prepared_native_key);result.nativeOrphansDeleted++;
   }
   await metadataBatch(store,"SELECT 1 FROM video_processing_jobs WHERE job_id=? AND private_expires_at<=? AND state=?",[job.job_id,now,job.state==='ACCEPTED'?'ACCEPTED':'CANCELLED'],[
    store.statement('DELETE FROM video_processing_candidates WHERE job_id=?',[job.job_id]),
    store.statement('DELETE FROM video_processing_jobs WHERE job_id=?',[job.job_id]),
    store.statement('DELETE FROM video_processing_sources WHERE source_id=? AND private_expires_at<=? AND NOT EXISTS(SELECT 1 FROM video_processing_jobs WHERE source_id=?)',[job.source_id,now,job.source_id])]);
   result.jobsPruned++;
  }catch{result.retryRequired++;}
 }
 const sources=await store.all('SELECT * FROM video_processing_sources INDEXED BY video_processing_sources_expiry WHERE private_expires_at<=? AND NOT EXISTS(SELECT 1 FROM video_processing_jobs WHERE source_id=video_processing_sources.source_id) ORDER BY private_expires_at,source_id LIMIT ?',[now,limit]);
 for(const source of sources){
  if(!sourceKey(source)){result.retryRequired++;continue;}
  try{
   await env.VIDEO_PROCESSING_PRIVATE.delete(source.transcript_key);result.privateObjectsDeleted++;
   await metadataBatch(store,'SELECT 1 FROM video_processing_sources WHERE source_id=? AND private_expires_at<=? AND NOT EXISTS(SELECT 1 FROM video_processing_jobs WHERE source_id=?)',[source.source_id,now,source.source_id],[store.statement('DELETE FROM video_processing_sources WHERE source_id=?',[source.source_id])]);result.sourcesPruned++;
  }catch{result.retryRequired++;}
 }
 // Each list is bounded. Caller persists the returned opaque cursor; no scan of
 // old/native prefixes or unindexed whole-catalogue reference search is used.
 // Server-generated source/job UUIDs are never recreated from caller ids after
 // metadata expiry. The only native-prefix pointer writer commits its receipt
 // atomically with that pointer, so late orphan PUTs remain safely discoverable.
 const p=await env.VIDEO_PROCESSING_PRIVATE.list({prefix:privatePrefix,limit,...(privateCursor?{cursor:privateCursor}:{}),include:['customMetadata']});
 for(const object of p.objects){
  const end=expiry(object);if(end===null||end>now||!object.key.startsWith(privatePrefix))continue;
  try{
   const live=await store.first('SELECT private_expires_at expires_at FROM video_processing_sources WHERE transcript_key=? UNION ALL SELECT expires_at FROM video_processing_candidates WHERE object_key=?',[object.key,object.key]);
   if(live?.expires_at>now)continue;await env.VIDEO_PROCESSING_PRIVATE.delete(object.key);result.privateObjectsDeleted++;
  }catch{result.retryRequired++;}
 }
 const n=await env.CONTENT.list({prefix:nativePrefix,limit,...(nativeCursor?{cursor:nativeCursor}:{}),include:['customMetadata']});
 for(const object of n.objects){
  const end=expiry(object),key=nativeKey(object.key);if(end===null||end>now||!key||object.customMetadata?.objectHash!==key.hash)continue;
  try{
   if(await store.first('SELECT object_key FROM video_processing_committed_objects WHERE object_key=?',[object.key])){result.committedObjectsPreserved++;continue;}
   const job=await store.first('SELECT job_id,state,private_expires_at FROM video_processing_jobs WHERE job_id=?',[key.jobId]);
   if(job?.state==='ACCEPTED'||job?.private_expires_at>now)continue;
   if(job)await cancelExpired(store,key.jobId,now);
   await env.CONTENT.delete(object.key);result.nativeOrphansDeleted++;
  }catch{result.retryRequired++;}
 }
 return {...result,privateCursor:p.truncated?p.cursor:null,nativeCursor:n.truncated?n.cursor:null};
}
