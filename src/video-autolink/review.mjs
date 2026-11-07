import {mediaAdmin} from '../media-attribution.mjs';
import {fail,id,sha256} from '../protocol.mjs';
import {nativeProcessingSource} from './native-source.mjs';
import {parseTimestampedTranscript} from './transcript.mjs';
import {learnerCompanion,seconds} from '../../public/shared/learner-companion.mjs';
const encoder=new TextEncoder(),error=code=>fail('Review the current recording and private candidate.',409,code);
const enabled=env=>{if(env.VIDEO_AUTOLINK_ENABLED!=='1'||!env.VIDEO_PROCESSING_PRIVATE)throw error('PROCESSOR_DISABLED');};
function ttl(env){const value=env.VIDEO_AI_PRIVATE_REVIEW_TTL_HOURS;if(typeof value!=='string'||!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)<1||Number(value)>720)throw error('PRIVATE_REVIEW_RETENTION_UNCONFIGURED');return Number(value)*3600000;}
async function immutableObject(bucket,key,value,expiresAt,contentType='application/json'){
 const hash=await sha256(value);
 await bucket.put(key,value,{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{objectHash:hash,privateExpiresAt:String(expiresAt)},httpMetadata:{contentType,cacheControl:'private, no-store'}});
 const stored=await bucket.get(key);if(!stored||stored.size>600000||await sha256(await stored.arrayBuffer())!==hash)throw error('PRIVATE_OBJECT_NOT_CONFIRMED');return hash;
}
export async function saveProcessingSource(env,store,actor,offer,input){
 enabled(env);offer=id(offer);const operationId=id(input.operationId),attachmentId=id(input.attachmentId);
 await mediaAdmin(store,actor,offer);const canonical={action:'video-processing-source',operationId,attachmentId,format:input.format,durationSeconds:input.durationSeconds,transcript:input.transcript};
 const prior=await store.replay(actor.account_id,operationId,await store.requestHash(offer,canonical));if(prior)return prior;
 if(typeof input.transcript!=='string')throw error('TIMESTAMPED_TRANSCRIPT_REQUIRED');
 // Timestamp coverage is explicit evidence, not audio/transcript completeness
 // or quotation verification. No YouTube/Zoom scraping is performed.
 parseTimestampedTranscript(input.transcript,{format:input.format,durationSeconds:input.durationSeconds});
 const native=await nativeProcessingSource(env,store,actor,offer,{attachmentId}),now=Date.now(),privateExpiresAt=now+ttl(env),hash=await sha256(input.transcript),sourceId=crypto.randomUUID();
 const key='video-processing-private/sources/'+sourceId+'/transcript-'+hash+'.'+input.format.toLowerCase();
 await immutableObject(env.VIDEO_PROCESSING_PRIVATE,key,input.transcript,privateExpiresAt,input.format==='VTT'?'text/vtt; charset=utf-8':'application/x-subrip; charset=utf-8');
 if(privateExpiresAt<=Date.now())throw error('PRIVATE_CANDIDATE_EXPIRED');
 const statement=store.statement("INSERT INTO video_processing_sources VALUES(?,?,?,?,?,?,?,?,?,'PERMANENT_STUDIO_RETAINED',NULL,?,?)",[sourceId,offer,attachmentId,native.assetId,native.sourceRevision,key,hash,input.format,input.durationSeconds,privateExpiresAt,now]);
 return store.mutate(actor,offer,canonical,[statement],{sourceId,attachmentId,style:native.style,privateExpiresAt},{studio:true,...native.fence});
}
async function reviewJob(env,store,actor,jobId){
 enabled(env);const job=await store.first('SELECT * FROM video_processing_jobs WHERE job_id=?',[id(jobId)]);if(!job)throw error('PRIVATE_CANDIDATE_UNAVAILABLE');
 await mediaAdmin(store,actor,job.offering_id);
 const source=await store.first('SELECT * FROM video_processing_sources WHERE source_id=?',[job.source_id]);
 if(!source||source.private_expires_at<=Date.now()||job.private_expires_at<=Date.now())throw error('PRIVATE_CANDIDATE_EXPIRED');
 const native=await nativeProcessingSource(env,store,actor,job.offering_id,{attachmentId:source.attachment_id});
 if(native.assetId!==source.asset_id||native.sourceRevision!==source.source_revision)throw error('PROCESSING_SOURCE_CHANGED');
 return {job,source,native};
}
async function privateObject(env,store,job){
 if(!['CANDIDATE','ACCEPTED'].includes(job.state))throw error('PRIVATE_CANDIDATE_UNAVAILABLE');
 const record=await store.first('SELECT * FROM video_processing_candidates WHERE job_id=?',[job.job_id]),prefix='video-processing-private/'+job.job_id+'/'+job.attempt_id+'/candidate-';
 if(!record||record.attempt_id!==job.attempt_id||record.expires_at<=Date.now()||!(/^[a-f0-9]{64}$/.test(record.object_hash))||record.object_key!==prefix+record.object_hash+'.json')throw error('PRIVATE_CANDIDATE_UNAVAILABLE');
 const object=await env.VIDEO_PROCESSING_PRIVATE.get(record.object_key);if(!object||object.size>400000)throw error('PRIVATE_CANDIDATE_UNAVAILABLE');
 const bytes=await object.arrayBuffer();if(await sha256(bytes)!==record.object_hash)throw error('PRIVATE_CANDIDATE_UNAVAILABLE');
 let value;try{value=JSON.parse(new TextDecoder().decode(bytes));}catch{throw error('PRIVATE_CANDIDATE_UNAVAILABLE');}
 if(value?.schema!=='VIDEO_PROCESSING_PRIVATE_CANDIDATE_V1'||value.style!==job.style||value.reviewRequired!==true)throw error('PRIVATE_CANDIDATE_UNAVAILABLE');return {record,value};
}
export async function readProcessingCandidate(env,store,actor,jobId){
 const {job,native}=await reviewJob(env,store,actor,jobId),{record,value}=await privateObject(env,store,job);
 // Deliberately private Admin output, never a Workflow step return or learner
 // projection. The HTTP adapter must retain no-store and current account guards.
 return {jobId:job.job_id,state:job.state,candidateHash:record.object_hash,candidate:value,stale:native.materialFingerprint!==job.material_fingerprint,baseCompanionRevision:job.base_companion_revision,currentCompanionRevision:native.companionRevision};
}
function plain(value,max){if(typeof value!=='string'||value.length>max||/[\uD800-\uDFFF]/u.test(value)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)||/<\/?[A-Za-z][^>]*>/.test(value))throw error('REVIEWED_COMPANION_INVALID');return value;}
function array(value,max){if(!Array.isArray(value)||value.length>max)throw error('REVIEWED_COMPANION_INVALID');return value;}
function clock(value,duration){if(typeof value!=='string'||!/^\d{1,3}:[0-5]\d(?::[0-5]\d)?$/.test(value)||seconds(value)>=duration)throw error('REVIEWED_COMPANION_INVALID');return value;}
function reviewedCompanion(input,{style,duration}){
 const c=input.companion;
 const allowed=['schema','summary','summaryFormat','lessonReference','application','assignmentLabel','topics','topicNotes','references','quotations'];
 if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!allowed.includes(k)))throw error('REVIEWED_COMPANION_INVALID');
 const summary=plain(c.summary,20000),lessonReference=plain(c.lessonReference||'',2000),application=plain(c.application||'',20000),assignmentLabel=plain(c.assignmentLabel||'',80);
 if(lessonReference&&input.confirmLessonReference!==true)throw error('CONFIRM_LESSON_REFERENCE');
 if(style==='ACADEMIC'&&application&&input.confirmAssignedHomework!==true)throw error('CONFIRM_ASSIGNED_HOMEWORK');
 const topics=array(c.topics||[],100).map(t=>({time:clock(t.time,duration),title:plain(t.title,500)}));
 if(topics.some((t,i)=>i>0&&seconds(t.time)<seconds(topics[i-1].time)))throw error('REVIEWED_COMPANION_INVALID');
 const topicNotes=array(c.topicNotes||[],100).map(t=>({time:clock(t.time,duration),title:plain(t.title,500),chapter:plain(t.chapter||'',2000),reflection:plain(t.reflection||'',20000),practice:plain(t.practice||'',20000)}));
 if(style==='ACADEMIC'&&topicNotes.length)throw error('REVIEWED_COMPANION_INVALID');
 const references=array(c.references||[],100).map(r=>({time:clock(r.time,duration),arabic:plain(r.arabic||'',4000),meaning:plain(r.meaning||'',4000)}));
 const quotations=array(c.quotations||[],style==='ACADEMIC'?1:8).map(q=>({time:clock(q.time,duration),text:plain(q.text,2000),speaker:plain(q.speaker||'',240)}));
 if(references.length&&input.confirmReferences!==true)throw error('CONFIRM_REFERENCES');
 if(quotations.length&&input.confirmAudioQuotations!==true)throw error('CONFIRM_AUDIO_QUOTATIONS');
 // Only the server selects the canonical schema after explicit current Admin
 // review. Model candidate reference/quotation flags cannot select it.
 const value=learnerCompanion({schema:'LEARNER_COMPANION_V1',summary,summaryFormat:style==='ACADEMIC'?'bullets':'paragraph',lessonReference,application,assignmentLabel,topics,topicNotes,references,quotations},{academic:style==='ACADEMIC'});
 const encoded=JSON.stringify(value);if(encoder.encode(encoded).length>300000)throw error('REVIEWED_COMPANION_TOO_LARGE');return encoded;
}
export async function acceptProcessingCandidate(env,store,actor,input){
 enabled(env);const job=await store.first('SELECT * FROM video_processing_jobs WHERE job_id=?',[id(input.jobId)]);if(!job)throw error('PRIVATE_CANDIDATE_UNAVAILABLE');
 await mediaAdmin(store,actor,job.offering_id);
 const operationId=id(input.operationId),canonical={...input,operationId,action:'video-processing-accept'};
 const prior=await store.replay(actor.account_id,operationId,await store.requestHash(job.offering_id,canonical));if(prior)return prior;
 if(input.reviewed!==true)throw error('EXPLICIT_CANDIDATE_REVIEW_REQUIRED');
 const {source,native}=await reviewJob(env,store,actor,job.job_id),{record}=await privateObject(env,store,job);
 if(job.state!=='CANDIDATE'||input.candidateHash!==record.object_hash||input.revision!==job.base_companion_revision||native.materialFingerprint!==job.material_fingerprint)throw error('PROCESSING_CANDIDATE_STALE');
 const encoded=reviewedCompanion(input,{style:job.style,duration:source.duration_seconds}),hash=await sha256(encoded),key='video-autolink-native-v1/'+job.job_id+'/'+operationId+'/companion-'+hash+'.json';
 const preparationId='video-accept-prepare:'+await sha256(JSON.stringify([job.job_id,operationId])),prepareInput={action:'video-processing-prepare-accept',operationId:preparationId,jobId:job.job_id,acceptOperationId:operationId,candidateHash:record.object_hash,reviewHash:hash};
 await store.mutate(actor,job.offering_id,prepareInput,[store.statement("UPDATE video_processing_candidates SET prepared_native_key=?,prepared_native_hash=?,prepared_operation_id=?,cleanup_state='PREPARED' WHERE job_id=?",[key,hash,operationId,job.job_id])],{jobId:job.job_id,prepared:true},{studio:true,...native.fence,
 expectedSQL:native.fence.expectedSQL+" AND EXISTS(SELECT 1 FROM video_processing_jobs j JOIN video_processing_candidates c USING(job_id) WHERE j.job_id=? AND j.state='CANDIDATE' AND j.private_expires_at>? AND c.object_hash=? AND (c.cleanup_state IS NULL OR c.cleanup_state='PREPARED' AND c.prepared_operation_id=? AND c.prepared_native_hash=?))",
 expectedArgs:[...native.fence.expectedArgs,job.job_id,Date.now(),record.object_hash,operationId,hash]});
 // Prepare the compatible native draft before its pointer transaction. The old
 // published key/index and all existing Admin edits remain until guarded save.
 await immutableObject(env.CONTENT,key,encoded,job.private_expires_at);
 const statements=[
 store.statement('INSERT INTO recording_companions VALUES(?,?,1,?,NULL,NULL,?) ON CONFLICT(attachment_id) DO UPDATE SET source_revision=excluded.source_revision,revision=recording_companions.revision+1,draft_key=excluded.draft_key,duration_seconds=excluded.duration_seconds',[native.attachmentId,native.sourceRevision,key,source.duration_seconds]),
 store.statement('INSERT INTO video_processing_committed_objects VALUES(?,?,?,?)',[key,hash,native.attachmentId,Date.now()]),
 store.statement("UPDATE video_processing_jobs SET state='ACCEPTED' WHERE job_id=?",[job.job_id])];
 const now=Date.now();
 return store.mutate(actor,job.offering_id,canonical,statements,{jobId:job.job_id,state:'ACCEPTED',attachmentId:native.attachmentId,revision:job.base_companion_revision+1,published:false},{studio:true,...native.fence,
 expectedSQL:native.fence.expectedSQL+" AND EXISTS(SELECT 1 FROM video_processing_jobs j JOIN video_processing_candidates c USING(job_id) WHERE j.job_id=? AND j.state='CANDIDATE' AND j.material_fingerprint=? AND j.private_expires_at>? AND c.object_hash=? AND c.cleanup_state='PREPARED' AND c.prepared_operation_id=? AND c.prepared_native_key=? AND c.prepared_native_hash=?)",
 expectedArgs:[...native.fence.expectedArgs,job.job_id,job.material_fingerprint,now,record.object_hash,operationId,key,hash]});
}
