import test from 'node:test';import assert from 'node:assert/strict';
import {setup,raw,response} from './video-autolink-job-fixture.mjs';
import {processingQuote,authoriseProcessingJob,runProcessingJob} from '../src/video-autolink/jobs.mjs';
import {saveProcessingSource,readProcessingCandidate,acceptProcessingCandidate} from '../src/video-autolink/review.mjs';
import {cleanupProcessing} from '../src/video-autolink/cleanup.mjs';
async function ready(f){
 const q=await processingQuote(f.env,f.store(),f.actor,'synthetic-source'),grant=await authoriseProcessingJob(f.env,f.store(),f.actor,{operationId:crypto.randomUUID(),sourceId:'synthetic-source',quoteHash:q.quoteHash,authorise:true});
 const result=await runProcessingJob(f.env,grant.jobId,{fetcher:async()=>response()});assert.equal(result.state,'CANDIDATE');
 const detail=await readProcessingCandidate(f.env,f.store(),f.actor,grant.jobId);
 return {jobId:grant.jobId,detail,input:{operationId:crypto.randomUUID(),jobId:grant.jobId,candidateHash:detail.candidateHash,revision:detail.baseCompanionRevision,reviewed:true,companion:structuredClone(detail.candidate.learnerPreview)}};
}
const count=(f,table)=>f.db.prepare('SELECT count(*) n FROM '+table).first().then(r=>r.n);
test('source admission uses a server UUID, preserves exact replay/private expiry and never guesses original native ingestion',async()=>{
 const f=await setup();try{
  const operationId=crypto.randomUUID(),input={operationId,attachmentId:'processing-attachment',format:'VTT',durationSeconds:4,transcript:raw,policy:'TEMPORARY_ACADEMIC',originalIngestedAt:Date.now()};
  const saved=await saveProcessingSource(f.env,f.store(),f.actor,'course',input),again=await saveProcessingSource(f.env,f.store(),f.actor,'course',input);
  assert.notEqual(saved.sourceId,operationId);assert.equal(again.sourceId,saved.sourceId);assert.equal(again.privateExpiresAt,saved.privateExpiresAt);assert(again.replayed);
  const source=await f.db.prepare('SELECT * FROM video_processing_sources WHERE source_id=?').bind(saved.sourceId).first();assert.equal(source.retention_policy,'PERMANENT_STUDIO_RETAINED');assert.equal(source.original_ingested_at,null);
  const object=await f.content.head(source.transcript_key);assert.equal(object.httpMetadata.contentType,'text/vtt; charset=utf-8');assert.equal(Number(object.customMetadata.privateExpiresAt),saved.privateExpiresAt);
  assert.equal(await count(f,'video_processing_jobs'),0);assert.equal(await count(f,'recording_companions'),0);
  await assert.rejects(saveProcessingSource(f.env,f.store(),f.actor,'course',{...input,operationId:crypto.randomUUID(),transcript:'No timestamps'}));assert.equal(await count(f,'video_processing_sources'),2);
 }finally{await f.close();}
});
test('source admission native guard rejects an account change after private PUT; the bounded orphan is later removed',async()=>{
 const f=await setup();try{
  const bucket=f.content,env={...f.env,VIDEO_PROCESSING_PRIVATE:{get:bucket.get.bind(bucket),put:async(...args)=>{const r=await bucket.put(...args);await f.run("UPDATE accounts SET epoch=epoch+1 WHERE account_id='admin'");return r;}}};
  await assert.rejects(saveProcessingSource(env,f.store(),f.actor,'course',{operationId:crypto.randomUUID(),attachmentId:'processing-attachment',format:'VTT',durationSeconds:4,transcript:raw}));
  assert.equal(await count(f,'video_processing_sources'),1);const before=await bucket.list({prefix:'video-processing-private/sources/',include:['customMetadata']});assert(before.objects.some(o=>o.customMetadata?.privateExpiresAt));
  const expiry=Math.max(...before.objects.map(o=>Number(o.customMetadata?.privateExpiresAt)||0));
  await cleanupProcessing(f.env,f.store(),{now:expiry});const after=await bucket.list({prefix:'video-processing-private/sources/'});assert.equal(after.objects.length,0);
 }finally{await f.close();}
});
test('explicit current Admin accepts an edited private candidate as native draft, preserving prior publication and private evidence exclusion',async()=>{
 const f=await setup();try{
  const old='websites/site-course/recordings/processing-asset/companions/existing-published.json';await f.content.put(old,JSON.stringify({schema:'LEARNER_COMPANION_V1',summary:'Existing learner publication'}));
  await f.run("INSERT INTO recording_companions VALUES('processing-attachment',?,5,?,?,?,4)",'b'.repeat(64),old,old,'{"summary":"Existing learner publication"}');
  const a=await ready(f);a.input.companion.summary='Human-reviewed correction';const saved=await acceptProcessingCandidate(f.env,f.store(),f.actor,a.input);assert.equal(saved.published,false);assert.equal(saved.revision,6);
  const current=await f.db.prepare("SELECT * FROM recording_companions WHERE attachment_id='processing-attachment'").first();assert.equal(current.published_key,old);assert.equal(current.index_json,'{"summary":"Existing learner publication"}');assert.notEqual(current.draft_key,old);
  const value=await (await f.content.get(current.draft_key)).json();assert.equal(value.summary,'Human-reviewed correction');assert(!JSON.stringify(value).includes('PRIVATE'));assert.equal(value.transcript,undefined);assert.equal(value.privateEvidence,undefined);
  assert.equal(await count(f,'video_processing_committed_objects'),1);const replay=await acceptProcessingCandidate(f.env,f.store(),f.actor,a.input);assert(replay.replayed);assert.equal(replay.revision,6);
  assert.equal((await f.db.prepare("SELECT published FROM attachments WHERE attachment_id='processing-attachment'").first()).published,0);
 }finally{await f.close();}
});
test('candidate review permits renewed current proof while paid grant stays consumed; stale saved edits and unverified additions never overwrite',async()=>{
 const f=await setup();try{
  const a=await ready(f);await f.run("UPDATE source_access_people SET verified_at=verified_at+1 WHERE account_id='admin' AND offering_id='course'");
  const detail=await readProcessingCandidate(f.env,f.store(),f.actor,a.jobId);assert.equal(detail.stale,false);
  await assert.rejects(acceptProcessingCandidate(f.env,f.store(),f.actor,{...a.input,reviewed:false}),e=>e.code==='EXPLICIT_CANDIDATE_REVIEW_REQUIRED');
  await assert.rejects(acceptProcessingCandidate(f.env,f.store(),f.actor,{...a.input,companion:{...a.input.companion,lessonReference:'Unverified book'}}),e=>e.code==='CONFIRM_LESSON_REFERENCE');
  await assert.rejects(acceptProcessingCandidate(f.env,f.store(),f.actor,{...a.input,companion:{...a.input.companion,quotations:[{time:'00:00',text:'Needs audio verification',speaker:'Synthetic'}]}}),e=>e.code==='CONFIRM_AUDIO_QUOTATIONS');
  await f.run("INSERT INTO recording_companions VALUES('processing-attachment',?,1,'new-manual-draft',NULL,NULL,4)",'c'.repeat(64));
  assert.equal((await readProcessingCandidate(f.env,f.store(),f.actor,a.jobId)).stale,true);await assert.rejects(acceptProcessingCandidate(f.env,f.store(),f.actor,a.input),e=>e.code==='PROCESSING_CANDIDATE_STALE');
  assert.equal((await f.db.prepare("SELECT draft_key FROM recording_companions WHERE attachment_id='processing-attachment'").first()).draft_key,'new-manual-draft');assert.equal(await count(f,'video_processing_committed_objects'),0);
 }finally{await f.close();}
});
test('failed final native CAS leaves only owned staged output; bounded cleanup deletes it without touching unrelated native content or old publication',async()=>{
 const f=await setup();try{
  const a=await ready(f),bucket=f.content,unrelated='retained/course/do-not-touch.mp4';await bucket.put(unrelated,'Existing source',{customMetadata:{privateExpiresAt:'1'}});
  let changed=false;const env={...f.env,CONTENT:{get:bucket.get.bind(bucket),put:async(...args)=>{const r=await bucket.put(...args);if(!changed){changed=true;await f.run("INSERT INTO recording_companions VALUES('processing-attachment',?,1,'manual-edit-survives',NULL,NULL,4)",'d'.repeat(64));}return r;}}};
  await assert.rejects(acceptProcessingCandidate(env,f.store(),f.actor,a.input));assert.equal(await count(f,'video_processing_committed_objects'),0);
  const prepared=await f.db.prepare('SELECT * FROM video_processing_candidates WHERE job_id=?').bind(a.jobId).first();assert(prepared.prepared_native_key.startsWith('video-autolink-native-v1/'));assert(await bucket.head(prepared.prepared_native_key));
  const job=await f.db.prepare('SELECT private_expires_at FROM video_processing_jobs WHERE job_id=?').bind(a.jobId).first(),clean=await cleanupProcessing(f.env,f.store(),{now:job.private_expires_at});assert(clean.nativeOrphansDeleted>0);assert.equal(await bucket.head(prepared.prepared_native_key),null);assert(await bucket.head(unrelated));
  assert.equal((await f.db.prepare("SELECT draft_key FROM recording_companions WHERE attachment_id='processing-attachment'").first()).draft_key,'manual-edit-survives');
  // Simulate a late PUT completion after expired metadata was pruned.
  await bucket.put(prepared.prepared_native_key,'Late synthetic orphan',{customMetadata:{objectHash:prepared.prepared_native_hash,privateExpiresAt:String(job.private_expires_at)}});
  await cleanupProcessing(f.env,f.store(),{now:job.private_expires_at+1});assert.equal(await bucket.head(prepared.prepared_native_key),null);assert(await bucket.head(unrelated));
 }finally{await f.close();}
});
test('expired private jobs/transcripts are removed while the minimal committed receipt preserves accepted native content permanently',async()=>{
 const f=await setup();try{
  const a=await ready(f);await acceptProcessingCandidate(f.env,f.store(),f.actor,a.input);const saved=await f.db.prepare("SELECT draft_key FROM recording_companions WHERE attachment_id='processing-attachment'").first(),job=await f.db.prepare('SELECT private_expires_at FROM video_processing_jobs WHERE job_id=?').bind(a.jobId).first();
  await cleanupProcessing(f.env,f.store(),{now:job.private_expires_at});
  assert.equal(await count(f,'video_processing_jobs'),0);assert.equal(await count(f,'video_processing_candidates'),0);assert.equal(await count(f,'video_processing_sources'),0);assert.equal(await count(f,'video_processing_committed_objects'),1);assert(await f.content.head(saved.draft_key));
  await cleanupProcessing(f.env,f.store(),{now:job.private_expires_at+86400000});assert(await f.content.head(saved.draft_key));
 }finally{await f.close();}
});
test('maintenance is default-off, bounded and uses the new indexed prefixes only',async()=>{
 let calls=0;assert.deepEqual(await cleanupProcessing({},new Proxy({},{get(){calls++;throw Error('No query');}})),{disabled:true});assert.equal(calls,0);
 const f=await setup();try{await assert.rejects(cleanupProcessing(f.env,f.store(),{limit:26}));await assert.rejects(cleanupProcessing(f.env,f.store(),{limit:0}));const result=await cleanupProcessing(f.env,f.store(),{limit:1});assert.equal(result.jobsPruned,0);assert.equal(result.privateCursor===null||typeof result.privateCursor==='string',true);}finally{await f.close();}
});

test('new processing metadata does not add a foreign-key hold to native attachment removal; missing source then fails closed',async()=>{
 const f=await setup();try{
  const grant=await f.authorise();await f.run("DELETE FROM media_attributions WHERE attachment_id='processing-attachment'");await f.run("DELETE FROM attachments WHERE attachment_id='processing-attachment'");
  let calls=0;const result=await runProcessingJob(f.env,grant.jobId,{fetcher:async()=>{calls++;return response();}});assert.equal(calls,0);assert.notEqual(result.state,'CANDIDATE');assert.equal(await count(f,'video_processing_committed_objects'),0);
 }finally{await f.close();}
});
