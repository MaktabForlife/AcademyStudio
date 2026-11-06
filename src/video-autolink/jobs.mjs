import {Store} from '../database.mjs';
import {mediaAdmin} from '../media-attribution.mjs';
import {fail,id,sha256,boundedAge} from '../protocol.mjs';
import {nativeProcessingSource} from './native-source.mjs';
import {generatePrivateCandidate} from './provider.mjs';
const encoder=new TextEncoder();
const error=(code,status=409)=>fail('Review the current processing request before continuing.',status,code);
const enabled=env=>{if(env.VIDEO_AUTOLINK_ENABLED!=='1')throw error('PROCESSOR_DISABLED',404);};
function settings(env){
 const number=(v,min,max)=>typeof v==='string'&&/^\d+$/.test(v)&&Number.isSafeInteger(Number(v))&&Number(v)>=min&&Number(v)<=max?Number(v):null;
 const result={model:env.VIDEO_AI_MODEL,profile:env.VIDEO_AI_AUTHORISATION_PROFILE,maxOutputTokens:number(env.VIDEO_AI_MAX_OUTPUT_TOKENS,1,32000),maxRequestBytes:number(env.VIDEO_AI_MAX_REQUEST_BYTES,1000,1000000),timeoutMs:number(env.VIDEO_AI_TIMEOUT_MS,1,50000)};
 if(!/^[-A-Za-z0-9_.]{1,120}$/.test(result.model||'')||!/^[-A-Za-z0-9_.]{1,120}$/.test(result.profile||'')||!result.maxOutputTokens||!result.maxRequestBytes||!result.timeoutMs||!env.OPENAI_API_KEY||!env.VIDEO_PROCESSING_PRIVATE)throw error('PROCESSOR_UNCONFIGURED',503);
 return result;
}
function publicJob(job){return {jobId:job.job_id,state:job.state,code:job.outcome_code||null};}
async function sourceRow(store,sourceId,now=Date.now()){
 const row=await store.first('SELECT * FROM video_processing_sources WHERE source_id=?',[id(sourceId)]);
 if(!row||row.private_expires_at<=now||row.retention_policy!=='PERMANENT_STUDIO_RETAINED'||row.original_ingested_at!==null||!(/^[a-f0-9]{64}$/.test(row.transcript_hash||''))||row.transcript_key!=='video-processing-private/sources/'+row.source_id+'/transcript-'+row.transcript_hash+'.'+row.transcript_format.toLowerCase())throw error('PROCESSING_SOURCE_UNAVAILABLE');
 return row;
}
async function checkedSource(env,store,actor,source){
 const native=await nativeProcessingSource(env,store,actor,source.offering_id,{attachmentId:source.attachment_id});
 if(native.assetId!==source.asset_id||native.sourceRevision!==source.source_revision||native.retentionPolicy!==source.retention_policy)throw error('PROCESSING_SOURCE_CHANGED');
 return native;
}
async function quote(env,source,native){
 const limits=settings(env),quoteHash=await sha256(JSON.stringify({schema:'VIDEO_PROCESSING_QUOTE_V1',sourceId:source.source_id,sourceRevision:source.source_revision,transcriptHash:source.transcript_hash,privateExpiresAt:source.private_expires_at,nativeFingerprint:native.nativeDBFingerprint,...limits}));
 return {...limits,quoteHash};
}
export async function processingQuote(env,store,actor,sourceId){
 enabled(env);const source=await sourceRow(store,sourceId),native=await checkedSource(env,store,actor,source),q=await quote(env,source,native);
 // This is a limit/profile confirmation, never a verified monetary estimate.
 return {sourceId:source.source_id,attachmentId:native.attachmentId,style:native.style,...q};
}
export async function authoriseProcessingJob(env,store,actor,input){
 enabled(env);const source=await sourceRow(store,input.sourceId);await mediaAdmin(store,actor,source.offering_id);
 const operationId=id(input.operationId),canonical={action:'video-processing-authorise',operationId,sourceId:source.source_id,quoteHash:input.quoteHash,authorise:input.authorise};
 if(input.authorise!==true||!(/^[a-f0-9]{64}$/.test(input.quoteHash||'')))throw error('EXPLICIT_PROCESSING_AUTHORISATION_REQUIRED');
 const old=await store.replay(actor.account_id,operationId,await store.requestHash(source.offering_id,canonical));if(old)return old;
 const native=await checkedSource(env,store,actor,source),q=await quote(env,source,native);if(q.quoteHash!==input.quoteHash)throw error('PROCESSING_QUOTE_CHANGED');
 const now=Date.now(),expires=Math.min(now+60000,source.private_expires_at,actor.expires_at,actor.verified_at+boundedAge(env,true));
 if(!Number.isSafeInteger(expires)||expires<=now)throw error('PROCESSING_AUTHORISATION_EXPIRED');
 const jobId=crypto.randomUUID();
 const statement=store.statement("INSERT INTO video_processing_jobs(job_id,source_id,offering_id,actor_id,actor_token_hash,actor_epoch,actor_source_ref,authorised_at,authorisation_expires_at,private_expires_at,quote_hash,native_fingerprint,material_fingerprint,base_companion_revision,attribution_revision,style,model,profile,max_output_tokens,max_request_bytes,timeout_ms,state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'QUEUED')",
 [jobId,source.source_id,source.offering_id,actor.account_id,actor.token_hash,actor.epoch,actor.source_ref??null,now,expires,source.private_expires_at,q.quoteHash,native.nativeDBFingerprint,native.materialFingerprint,native.companionRevision,native.attributionRevision,native.style,q.model,q.profile,q.maxOutputTokens,q.maxRequestBytes,q.timeoutMs]);
 return store.mutate(actor,source.offering_id,canonical,[statement],{jobId,state:'QUEUED',authorisationExpiresAt:expires},{studio:true,...native.fence,
  expectedSQL:native.fence.expectedSQL+' AND EXISTS(SELECT 1 FROM video_processing_sources WHERE source_id=? AND private_expires_at=?)',
  expectedArgs:[...native.fence.expectedArgs,source.source_id,source.private_expires_at]});
}
async function execution(env,store,job){
 const now=Date.now();if(job.authorisation_expires_at<=now||job.private_expires_at<=now)throw error('PROCESSING_AUTHORISATION_EXPIRED');
 const actor=await store.actor(job.actor_token_hash,now);
 if(actor.account_id!==job.actor_id||actor.epoch!==job.actor_epoch||(actor.source_ref??null)!==job.actor_source_ref)throw error('PROCESSING_ACTOR_CHANGED');
 const source=await sourceRow(store,job.source_id,now),native=await checkedSource(env,store,actor,source),q=await quote(env,source,native);
 if(q.quoteHash!==job.quote_hash||native.nativeDBFingerprint!==job.native_fingerprint)throw error('PROCESSING_SOURCE_OR_DRAFT_CHANGED');
 return {actor,source,native};
}
export async function claimProcessingJob(env,store,jobId,prepared){
 enabled(env);const job=await store.first('SELECT * FROM video_processing_jobs WHERE job_id=?',[id(jobId)]);
 if(!job||job.state!=='QUEUED')throw error('PROCESSING_CLAIM_UNAVAILABLE');
 const {actor,native}=await execution(env,store,job);
 if(!/^[a-f0-9]{64}$/.test(prepared.requestHash||'')||prepared.model!==job.model||prepared.maxOutputTokens!==job.max_output_tokens||prepared.maxRequestBytes!==job.max_request_bytes)throw error('PROCESSING_REQUEST_CHANGED');
 const attemptId=crypto.randomUUID(),now=Date.now(),g=store.guard(actor,job.offering_id,{studio:true,
  expectedSQL:native.fence.expectedSQL+" AND EXISTS(SELECT 1 FROM video_processing_jobs WHERE job_id=? AND state='QUEUED' AND quote_hash=? AND authorisation_expires_at>? AND private_expires_at>?)",
  expectedArgs:[...native.fence.expectedArgs,job.job_id,job.quote_hash,now,now]});
 // Do NOT use replayable Store.mutate receipts for a paid-call grant. Only this
 // invocation's successful owning batch ACK can grant a fetch. Unknown ACK,
 // Workflow resumption or duplicate delivery never reconstructs a grant.
 try{await store.batch([g.statement,
  store.statement("UPDATE video_processing_jobs SET state='RUNNING',attempt_id=?,request_hash=? WHERE job_id=?",[attemptId,prepared.requestHash,job.job_id]),
  store.statement('INSERT INTO audit VALUES(?,?,?,?,?,?)',[crypto.randomUUID(),actor.account_id,'video-processing-claim',job.offering_id,now,JSON.stringify({jobId:job.job_id,sourceId:job.source_id})]),g.cleanup]);}
 catch{throw error('PROCESSING_CLAIM_NOT_CONFIRMED');}
 return {attemptId,requestHash:prepared.requestHash,expiresAt:job.authorisation_expires_at};
}
const allowedCodes=new Set(['PROCESSING_INPUT_BUDGET_EXCEEDED','PROCESSING_SOURCE_INVALID','AUTHORISATION_NOT_CONFIRMED','AUTHORISATION_NOT_CLAIMED','AUTHORISATION_EXPIRED','PROVIDER_OUTCOME_UNKNOWN','PROVIDER_REJECTED','PROVIDER_NO_COMPLETE_CANDIDATE','PROVIDER_OUTPUT_INVALID','PROCESSING_CONTEXT_CHANGED','PRIVATE_CANDIDATE_UNAVAILABLE']);
function safeReceipt(value){
 const out={usage:{}};for(const [k,p]of [['responseId','resp_'],['requestId','req_']])if(typeof value?.[k]==='string'&&value[k].startsWith(p)&&/^[-A-Za-z0-9_]{1,200}$/.test(value[k]))out[k]=value[k];
 for(const k of ['input_tokens','output_tokens','total_tokens'])if(Number.isSafeInteger(value?.usage?.[k])&&value.usage[k]>=0)out.usage[k]=value.usage[k];return out;
}
async function failedOutcome(store,job,attemptId,code,receipt){
 const safe=allowedCodes.has(code)?code:'PROCESSING_CONTEXT_CHANGED';
 // Operational terminal metadata only: cannot grant authority or change native
 // material, requeue a claim, write learner content or publish.
 if(attemptId)await store.run("UPDATE video_processing_jobs SET state='REVIEW_REQUIRED',outcome_code=?,provider_receipt_json=? WHERE job_id=? AND state='RUNNING' AND attempt_id=?",[safe,JSON.stringify(safeReceipt(receipt)),job.job_id,attemptId]);
 else await store.run("UPDATE video_processing_jobs SET state='REVIEW_REQUIRED',outcome_code=? WHERE job_id=? AND source_id=? AND state='QUEUED'",[safe,job.job_id,job.source_id]);
 const current=await store.first('SELECT job_id,state,outcome_code FROM video_processing_jobs WHERE job_id=?',[job.job_id]);
 return current?{...publicJob(current),reviewRequired:true}:{jobId:job.job_id,state:'REVIEW_REQUIRED',code:safe};
}
export async function completeProcessingJob(env,store,jobId,attemptId,object,receipt){
 enabled(env);const job=await store.first('SELECT * FROM video_processing_jobs WHERE job_id=?',[id(jobId)]);
 if(!job||job.state!=='RUNNING'||job.attempt_id!==attemptId)throw error('PROCESSING_CLAIM_UNAVAILABLE');
 const {actor,native}=await execution(env,store,job),prefix='video-processing-private/'+job.job_id+'/'+attemptId+'/candidate-';
 if(!object?.key?.startsWith(prefix)||!(/^[a-f0-9]{64}$/.test(object.hash||''))||object.key!==prefix+object.hash+'.json')throw error('PRIVATE_CANDIDATE_UNAVAILABLE');
 const candidate=await env.VIDEO_PROCESSING_PRIVATE.get(object.key);
 if(!candidate||candidate.size>400000)throw error('PRIVATE_CANDIDATE_UNAVAILABLE');
 const bytes=await candidate.arrayBuffer();if(await sha256(bytes)!==object.hash)throw error('PRIVATE_CANDIDATE_UNAVAILABLE');
 let value;try{value=JSON.parse(new TextDecoder().decode(bytes));}catch{throw error('PRIVATE_CANDIDATE_UNAVAILABLE');}
 if(!value||value.schema!=='VIDEO_PROCESSING_PRIVATE_CANDIDATE_V1'||value.style!==job.style||value.reviewRequired!==true||Object.keys(value).length!==5||value.learnerPreview?.schema!=='LEARNER_COMPANION_V1')throw error('PRIVATE_CANDIDATE_UNAVAILABLE');
 const now=Date.now(),operationId='candidate-'+attemptId;
 return store.mutate(actor,job.offering_id,{action:'video-processing-candidate',operationId,jobId:job.job_id,attemptId,objectHash:object.hash},
 [store.statement('INSERT INTO video_processing_candidates(job_id,attempt_id,object_key,object_hash,created_at,expires_at) VALUES(?,?,?,?,?,?)',[job.job_id,attemptId,object.key,object.hash,now,job.private_expires_at]),
  store.statement("UPDATE video_processing_jobs SET state='CANDIDATE',outcome_code=NULL,provider_receipt_json=? WHERE job_id=?",[JSON.stringify(safeReceipt(receipt)),job.job_id])],
 {jobId:job.job_id,state:'CANDIDATE'},{studio:true,...native.fence,
 expectedSQL:native.fence.expectedSQL+" AND EXISTS(SELECT 1 FROM video_processing_jobs WHERE job_id=? AND state='RUNNING' AND attempt_id=? AND authorisation_expires_at>? AND private_expires_at>?)",
 expectedArgs:[...native.fence.expectedArgs,job.job_id,attemptId,now,now]});
}
export async function processingStatus(env,store,actor,jobId){
 enabled(env);const job=await store.first('SELECT * FROM video_processing_jobs WHERE job_id=?',[id(jobId)]);
 if(!job||job.private_expires_at<=Date.now())throw error('PROCESSING_JOB_UNAVAILABLE',404);
 await mediaAdmin(store,actor,job.offering_id,{readOnly:true});
 await nativeProcessingSource(env,store,actor,job.offering_id,{attachmentId:(await sourceRow(store,job.source_id)).attachment_id});
 return publicJob(job);
}
export async function runProcessingJob(env,jobId,{fetcher=fetch}={}){
 let store,job,attemptId;
 try{
  enabled(env);id(jobId);store=new Store(env);job=await store.first('SELECT * FROM video_processing_jobs WHERE job_id=?',[jobId]);
  if(!job)return {jobId,state:'REVIEW_REQUIRED',code:'PROCESSING_CLAIM_UNAVAILABLE'};
  if(job.state!=='QUEUED')return {...publicJob(job),...(job.state==='RUNNING'?{reviewRequired:true,code:'PROCESSING_CLAIM_UNAVAILABLE'}:{})};
  const {source,native}=await execution(env,store,job),bucket=env.VIDEO_PROCESSING_PRIVATE,transcript=await bucket.get(source.transcript_key);
  if(!transcript||transcript.size>512*1024)throw error('PRIVATE_CANDIDATE_UNAVAILABLE');
  const raw=await transcript.arrayBuffer();if(await sha256(raw)!==source.transcript_hash)throw error('PRIVATE_CANDIDATE_UNAVAILABLE');
  const result=await generatePrivateCandidate({env,transcript:new Uint8Array(raw),format:source.transcript_format,durationSeconds:source.duration_seconds,style:native.style,fetcher,
   reserve:async prepared=>{const grant=await claimProcessingJob(env,new Store(env),jobId,prepared);attemptId=grant.attemptId;return grant;}});
  if(result.kind!=='private-candidate')return await failedOutcome(store,job,attemptId,result.code,result.receipt);
  const current=await new Store(env).first('SELECT * FROM video_processing_jobs WHERE job_id=?',[jobId]);
  if(!current||current.state!=='RUNNING'||current.attempt_id!==attemptId)return await failedOutcome(store,job,attemptId,'PROCESSING_CONTEXT_CHANGED');
  await execution(env,new Store(env),current); // No cancelled job/stale Admin/source can stage a candidate.
  const encoded=JSON.stringify(result.candidate);if(encoder.encode(encoded).length>400000)throw error('PRIVATE_CANDIDATE_UNAVAILABLE');
  const hash=await sha256(encoded),key='video-processing-private/'+jobId+'/'+attemptId+'/candidate-'+hash+'.json';
  // Unique owned immutable key, prepared before DB pointer commit. A failed
  // later guard leaves a private bounded orphan, never replaces the saved draft.
  await bucket.put(key,encoded,{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{processingJobId:jobId,privateExpiresAt:String(job.private_expires_at),objectHash:hash},httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}});
  return await completeProcessingJob(env,new Store(env),jobId,attemptId,{key,hash},result.receipt);
 }catch{
  try{if(store&&job)return await failedOutcome(store,job,attemptId,'PROCESSING_CONTEXT_CHANGED');}catch{}
  return {jobId:typeof jobId==='string'&&/^[-A-Za-z0-9_:]{1,180}$/.test(jobId)?jobId:null,state:'REVIEW_REQUIRED',code:'PROCESSING_CONTEXT_CHANGED'};
 }
}
