import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {fixture} from './fixture.mjs';import {Store} from '../src/database.mjs';import {sha256} from '../src/protocol.mjs';
import {nativeProcessingSource} from '../src/video-autolink/native-source.mjs';
import {processingQuote,authoriseProcessingJob,claimProcessingJob,runProcessingJob,processingStatus} from '../src/video-autolink/jobs.mjs';
const raw='WEBVTT\n\n00:00.000 --> 00:02.000\nSynthetic evidence: read the assigned page.\n\n00:02.000 --> 00:04.000\nA source-grounded second point.';
const generated=()=>({summary:'- A synthetic point.',lessonReference:'PRIVATE uncertain book',application:'',taskAssigned:false,topics:[{time:'00:00',title:'Synthetic topic',sourceCueIndex:0}],topicNotes:[],referenceCandidates:[],quotationCandidates:[],assignmentEvidence:[],reviewNotes:['PRIVATE review marker']});
const response=()=>Response.json({id:'resp_synthetic',status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(generated())}]}],usage:{input_tokens:100,output_tokens:50,total_tokens:150}},{headers:{'x-request-id':'req_synthetic'}});
async function setup(){
 const f=await fixture();
 await f.run("INSERT INTO objects VALUES('processing-asset',NULL,'video/youtube','Synthetic recording',0,NULL,'abcdefghijk')");
 await f.run("INSERT INTO asset_owners VALUES('processing-asset','course')");
 await f.run("INSERT INTO attachments VALUES('processing-attachment','course','site-course','processing-asset','processing-lesson','2026-11-06','','Synthetic recording','RECORDING',0)");
 await f.run("INSERT INTO media_attributions VALUES('processing-attachment',1,?,NULL)",JSON.stringify({teacherIds:['teacher'],recordingTitle:'Synthetic recording'}));
 let statement='';for(const part of readFileSync(new URL('./fixtures/video-autolink-proposed.sql',import.meta.url),'utf8').replace(/--[^\n]*/g,'').split(';')){statement+=part+';';if(/CREATE TRIGGER/i.test(statement)&&!/\sEND;\s*$/.test(statement))continue;if(statement.trim()!==';')await f.db.prepare(statement).run();statement='';}
 const login=await f.login('admin'),hash=await sha256(login.cookie.split('=')[1]);await f.run('UPDATE sessions SET source_ref=? WHERE token_hash=?','synthetic-native-source-session',hash);
 await f.run("INSERT INTO source_access_scopes(offering_id,generation,version,enabled,live_enabled,timezone,classes_json,authority) VALUES('course',1,1,1,0,'UTC','[]','WEBSITE')");
 await f.run("INSERT INTO access_handovers(offering_id,transfer_id,phase,generation,source_version,revision,cursor,checked,created_at) VALUES('course','synthetic-transfer','COMMITTED',1,1,0,'',0,?)",Date.now());
 await f.run("INSERT INTO source_access_people VALUES('admin','course',1,1,?,1,'[]',0,1)",Date.now());
 const env={...f.env,AUTHORITY_MODE:'ACADEMY',DB:f.db,VIDEO_AUTOLINK_ENABLED:'1',OPENAI_API_KEY:'synthetic-key-NOT-REAL',VIDEO_AI_MODEL:'synthetic-reviewed-model',VIDEO_AI_AUTHORISATION_PROFILE:'synthetic-reviewed-profile',VIDEO_AI_MAX_OUTPUT_TOKENS:'2000',VIDEO_AI_MAX_REQUEST_BYTES:'64000',VIDEO_AI_TIMEOUT_MS:'5000',VIDEO_PROCESSING_PRIVATE:f.content};
 const store=()=>new Store(env),actor=await store().actor(hash),native=await nativeProcessingSource(env,store(),actor,'course',{attachmentId:'processing-attachment'}),transcriptHash=await sha256(raw),transcriptKey='video-processing-private/sources/synthetic-source/transcript-'+transcriptHash+'.vtt',privateExpiresAt=Date.now()+3600000;
 await f.content.put(transcriptKey,raw);await f.run("INSERT INTO video_processing_sources VALUES('synthetic-source','course','processing-attachment','processing-asset',?,?,?,?,4,'PERMANENT_STUDIO_RETAINED',NULL,?,?)",native.sourceRevision,transcriptKey,transcriptHash,'VTT',privateExpiresAt,Date.now());
 const q=await processingQuote(env,store(),actor,'synthetic-source');
 const authorise=async()=>{const jobId=crypto.randomUUID(),input={operationId:jobId,sourceId:'synthetic-source',quoteHash:q.quoteHash,authorise:true};const result=await authoriseProcessingJob(env,store(),actor,input);return {jobId,input,result};};
 return {...f,env,store,actor,q,authorise,transcriptKey};
}
const prepared=f=>({requestHash:'a'.repeat(64),model:f.q.model,maxOutputTokens:f.q.maxOutputTokens,maxRequestBytes:f.q.maxRequestBytes});
const row=(f,id)=>f.db.prepare('SELECT * FROM video_processing_jobs WHERE job_id=?').bind(id).first();
test('job methods stay default-disabled and explicit authorisation/quote changes cannot create a job',async()=>{
 let reads=0;await assert.rejects(authoriseProcessingJob({},new Proxy({},{get(){reads++;throw Error('No query');}}),{},{}),e=>e.code==='PROCESSOR_DISABLED');assert.equal(reads,0);
 const f=await setup();try{
  await assert.rejects(authoriseProcessingJob(f.env,f.store(),f.actor,{operationId:crypto.randomUUID(),sourceId:'synthetic-source',quoteHash:f.q.quoteHash,authorise:false}),e=>e.code==='EXPLICIT_PROCESSING_AUTHORISATION_REQUIRED');
  f.env.VIDEO_AI_MODEL='synthetic-different-model';await assert.rejects(authoriseProcessingJob(f.env,f.store(),f.actor,{operationId:crypto.randomUUID(),sourceId:'synthetic-source',quoteHash:f.q.quoteHash,authorise:true}),e=>e.code==='PROCESSING_QUOTE_CHANGED');
  assert.equal((await f.db.prepare('SELECT count(*) n FROM video_processing_jobs').first()).n,0);
 }finally{await f.close();}
});
test('owning explicit authorisation replay preserves its exact immutable original deadline',async()=>{
 const f=await setup();try{
  const a=await f.authorise(),saved=await row(f,a.jobId),again=await authoriseProcessingJob(f.env,f.store(),f.actor,a.input);assert(again.replayed);assert.equal(again.authorisationExpiresAt,a.result.authorisationExpiresAt);
  assert(saved.authorisation_expires_at<=saved.authorised_at+60000);assert.equal(saved.state,'QUEUED');
  await assert.rejects(f.run('UPDATE video_processing_jobs SET authorisation_expires_at=authorisation_expires_at+60000 WHERE job_id=?',a.jobId));
  await assert.rejects(f.run('UPDATE video_processing_sources SET private_expires_at=private_expires_at+60000'));
  assert.equal((await f.db.prepare('SELECT count(*) n FROM recording_companions').first()).n,0);
 }finally{await f.close();}
});
test('concurrent actual native owning claims grant exactly one invocation and never reconstruct a replay grant',async()=>{
 const f=await setup();try{
  const a=await f.authorise(),claims=await Promise.allSettled([claimProcessingJob(f.env,f.store(),a.jobId,prepared(f)),claimProcessingJob(f.env,f.store(),a.jobId,prepared(f))]);
  assert.equal(claims.filter(x=>x.status==='fulfilled').length,1);assert.equal(claims.filter(x=>x.status==='rejected').length,1);
  assert.equal((await row(f,a.jobId)).state,'RUNNING');await assert.rejects(claimProcessingJob(f.env,f.store(),a.jobId,prepared(f)));
  assert.equal((await f.db.prepare("SELECT count(*) n FROM audit WHERE action='video-processing-claim'").first()).n,1);
 }finally{await f.close();}
});
test('unknown owning claim ACK cannot grant a fetch or recover another paid claim',async()=>{
 const f=await setup();try{
  const a=await f.authorise(),store=f.store(),batch=store.batch.bind(store);store.batch=async statements=>{await batch(statements);throw Error('PRIVATE commit ACK lost');};
  await assert.rejects(claimProcessingJob(f.env,store,a.jobId,prepared(f)),e=>e.code==='PROCESSING_CLAIM_NOT_CONFIRMED');assert.equal((await row(f,a.jobId)).state,'RUNNING');
  let calls=0;const replay=await runProcessingJob(f.env,a.jobId,{fetcher:async()=>{calls++;return response();}});assert.equal(calls,0);assert.equal(replay.state,'RUNNING');assert(replay.reviewRequired);
 }finally{await f.close();}
});
test('audit failure atomically rolls the real native paid claim back without a grant',async()=>{
 const f=await setup();try{
  const a=await f.authorise();await f.db.prepare("CREATE TRIGGER synthetic_fail_paid_audit BEFORE INSERT ON audit WHEN NEW.action='video-processing-claim' BEGIN SELECT RAISE(ABORT,'synthetic audit unavailable'); END;").run();
  await assert.rejects(claimProcessingJob(f.env,f.store(),a.jobId,prepared(f)));assert.equal((await row(f,a.jobId)).state,'QUEUED');assert.equal((await row(f,a.jobId)).attempt_id,null);
  assert.equal((await f.db.prepare("SELECT count(*) n FROM audit WHERE action='video-processing-claim'").first()).n,0);
 }finally{await f.close();}
});
test('native Source generation/credential/cancel/draft changes and equality expiry prevent any mocked provider fetch',async t=>{
 for(const [name,change]of [
  ['Source generation',f=>f.run("UPDATE source_access_scopes SET generation=2 WHERE offering_id='course'")],
  ['saved companion',f=>f.run("INSERT INTO recording_companions VALUES('processing-attachment',?,1,'existing-private-draft',NULL,NULL,4)",'b'.repeat(64))],
  ['native cancellation',f=>f.run("UPDATE sessions SET revoked=1 WHERE token_hash=?",f.actor.token_hash)],
  ['epoch',f=>f.run("UPDATE accounts SET epoch=epoch+1 WHERE account_id='admin'")],
  ['master floor',f=>f.run("INSERT INTO source_access_master_fences VALUES('admin','course',1,1,1,1)")],
  ['changed configuration',async f=>{f.env.VIDEO_AI_AUTHORISATION_PROFILE='synthetic-new-profile';}]
 ]){
  await t.test(name,async()=>{const f=await setup();try{const a=await f.authorise();await change(f);let calls=0;const result=await runProcessingJob(f.env,a.jobId,{fetcher:async()=>{calls++;return response();}});assert.equal(calls,0);assert.notEqual(result.state,'CANDIDATE');assert.equal((await f.db.prepare('SELECT count(*) n FROM video_processing_candidates').first()).n,0);}finally{await f.close();}});
 }
 const f=await setup();let originalNow;try{
  const a=await f.authorise(),saved=await row(f,a.jobId);await f.run('UPDATE sessions SET expires_at=? WHERE token_hash=?',saved.authorisation_expires_at+60000,f.actor.token_hash);await f.run("UPDATE accounts SET verified_at=? WHERE account_id='admin'",saved.authorisation_expires_at);
  originalNow=Date.now;Date.now=()=>saved.authorisation_expires_at;let calls=0;const result=await runProcessingJob(f.env,a.jobId,{fetcher:async()=>{calls++;return response();}});assert.equal(calls,0);assert.notEqual(result.state,'CANDIDATE');assert.equal((await row(f,a.jobId)).authorisation_expires_at,saved.authorisation_expires_at);
 }finally{if(originalNow)Date.now=originalNow;await f.close();}
});
test('actual local DB/R2 runner delivers one private candidate under duplicate delivery, with saved learner publication untouched',async()=>{
 const f=await setup();try{
  const a=await f.authorise();let calls=0;const fetcher=async()=>{calls++;return response();};
  const results=await Promise.all([runProcessingJob(f.env,a.jobId,{fetcher}),runProcessingJob(f.env,a.jobId,{fetcher})]);assert.equal(calls,1);assert(results.some(r=>r.state==='CANDIDATE'));assert.equal((await row(f,a.jobId)).state,'CANDIDATE');
  const candidate=await f.db.prepare('SELECT * FROM video_processing_candidates WHERE job_id=?').bind(a.jobId).first(),object=await f.content.get(candidate.object_key),value=await object.json();assert(value.privateEvidence.reviewNotes.includes('PRIVATE review marker'));assert.equal(value.learnerPreview.transcript,undefined);
  assert(!JSON.stringify(results).includes('PRIVATE'));assert(!JSON.stringify(results).includes('synthetic-key'));assert(!JSON.stringify(results).includes('object_key'));assert(!JSON.stringify(results).includes('actor_token_hash'));
  assert.equal((await f.db.prepare('SELECT count(*) n FROM recording_companions').first()).n,0);assert.equal((await f.db.prepare("SELECT published FROM attachments WHERE attachment_id='processing-attachment'").first()).published,0);
  const status=await processingStatus(f.env,f.store(),f.actor,a.jobId);assert.deepEqual(Object.keys(status).sort(),['code','jobId','state']);assert.equal(status.state,'CANDIDATE');await runProcessingJob(f.env,a.jobId,{fetcher});assert.equal(calls,1);
 }finally{await f.close();}
});
test('provider unknown outcome and changed current Admin after paid claim never requeue, leak errors or install a candidate',async t=>{
 for(const [name,fetcher]of [
  ['network unknown',()=>{throw Error('PRIVATE transcript/cookie/provider-key exception');}],
  ['Admin cancelled during provider',async f=>{await f.run('UPDATE sessions SET revoked=1 WHERE token_hash=?',f.actor.token_hash);return response();}]
 ]){
  await t.test(name,async()=>{const f=await setup();try{
   const a=await f.authorise();let calls=0;const result=await runProcessingJob(f.env,a.jobId,{fetcher:async()=>{calls++;return fetcher(f);}});assert.equal(calls,1);assert.equal((await row(f,a.jobId)).state,'REVIEW_REQUIRED');assert(!JSON.stringify(result).includes('PRIVATE'));assert.equal((await f.db.prepare('SELECT count(*) n FROM video_processing_candidates').first()).n,0);
   await runProcessingJob(f.env,a.jobId,{fetcher:async()=>{calls++;return response();}});assert.equal(calls,1);
  }finally{await f.close();}});
 }
});
