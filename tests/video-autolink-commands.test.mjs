import test from 'node:test';import assert from 'node:assert/strict';
import {setup,raw,response} from './video-autolink-job-fixture.mjs';
import {processingCommand} from '../src/video-autolink/commands.mjs';
import {runProcessingJob} from '../src/video-autolink/jobs.mjs';
import {readProcessingCandidate,acceptProcessingCandidate} from '../src/video-autolink/review.mjs';
function configured(f,create=async()=>({})){return {...f.env,VIDEO_AI_WORKFLOW_RETENTION_HOURS:'1',VIDEO_PROCESSING_WORKFLOW:{create}};}
test('default-disabled command surface performs no new DB/R2/Workflow calls',async()=>{
 let reads=0;const store=new Proxy({},{get(){reads++;throw Error('No query');}});
 assert.deepEqual(await processingCommand({},store,{},'course',{action:'video-processing-capabilities'}),{available:false});
 await assert.rejects(processingCommand({},store,{},'course',{action:'video-processing-authorise'}),e=>e.code==='PROCESSOR_DISABLED');assert.equal(reads,0);
});
test('only narrow bounded commands and the exact current offering are accepted',async()=>{
 const f=await setup();try{
  const env=configured(f);await assert.rejects(processingCommand(env,f.store(),f.actor,'course',{action:'save',change:{action:'staff'}}),e=>e.code==='PROCESSING_COMMAND_INVALID');
  await assert.rejects(processingCommand(env,f.store(),f.actor,'course',{action:'video-processing-source',operationId:crypto.randomUUID(),attachmentId:'processing-attachment',format:'VTT',durationSeconds:4,transcript:'x'.repeat(512*1024+1)}),e=>e.code==='PROCESSING_INPUT_TOO_LARGE'&&e.status===413);
  await assert.rejects(processingCommand(env,f.store(),f.actor,'course',{action:'video-processing-source',operationId:crypto.randomUUID(),attachmentId:'processing-attachment',format:'VTT',durationSeconds:4,transcript:raw,actor:{globalAdmin:true}}),e=>e.code==='PROCESSING_COMMAND_INVALID');
  const standalone={...env,AUTHORITY_MODE:'WEBSITE'},store=f.store();store.env.AUTHORITY_MODE='WEBSITE';
  await assert.rejects(processingCommand(standalone,store,f.actor,'tafseer',{action:'video-processing-quote',sourceId:'synthetic-source'}),e=>e.code==='PROCESSING_OFFERING_MISMATCH');
 }finally{await f.close();}
});
test('explicit authorisation queues only jobId; an unknown dispatcher ACK reuses the original job/deadline and never exposes SDK text',async()=>{
 const f=await setup();try{
  const calls=[],env=configured(f,async options=>{calls.push(structuredClone(options));throw Error('PRIVATE Workflow SDK cookie/transcript/key error');}),q=await processingCommand(env,f.store(),f.actor,'course',{action:'video-processing-quote',sourceId:'synthetic-source'});
  const input={action:'video-processing-authorise',operationId:crypto.randomUUID(),sourceId:'synthetic-source',quoteHash:q.quoteHash,authorise:true};
  const first=await processingCommand(env,f.store(),f.actor,'course',input),retry=await processingCommand(env,f.store(),f.actor,'course',input);assert.equal(first.dispatch,'UNCONFIRMED');assert.equal(retry.jobId,first.jobId);assert.equal(retry.authorisationExpiresAt,first.authorisationExpiresAt);assert.notEqual(first.jobId,input.operationId);
  assert.deepEqual(calls.map(c=>c.id),[first.jobId,first.jobId]);for(const c of calls){assert.deepEqual(c.params,{jobId:first.jobId});assert.deepEqual(Object.keys(c).sort(),['id','params','retention']);assert.deepEqual(c.retention,{successRetention:'1 hours',errorRetention:'1 hours'});}assert(!JSON.stringify([first,retry,calls]).includes('PRIVATE'));assert(!JSON.stringify(calls).includes('synthetic-key'));
  let provider=0;assert.equal((await runProcessingJob(env,first.jobId,{fetcher:async()=>{provider++;return response();}})).state,'CANDIDATE');
  const again=await processingCommand(env,f.store(),f.actor,'course',input);assert.equal(again.state,'CANDIDATE');assert.equal(calls.length,2);assert.equal(provider,1);
 }finally{await f.close();}
});
test('async private storage errors are sanitised before crossing the proposed HTTP/Workflow boundary',async()=>{
 const f=await setup();try{
  const env=configured(f);env.VIDEO_PROCESSING_PRIVATE={get:f.content.get.bind(f.content),put:async()=>{throw Object.assign(Error('PRIVATE transcript/cookie/key SDK body'),{status:400,code:'PRIVATE_UNTRUSTED_CODE'});}};
  await assert.rejects(processingCommand(env,f.store(),f.actor,'course',{action:'video-processing-source',operationId:crypto.randomUUID(),attachmentId:'processing-attachment',format:'VTT',durationSeconds:4,transcript:raw}),e=>e.code==='PROCESSING_UNAVAILABLE'&&e.status===503&&!e.message.includes('PRIVATE'));
 }finally{await f.close();}
});
test('manual cancel during a paid mock discards its late output; accepted native content is never cancelled by a job command',async()=>{
 const f=await setup();try{
  const env=configured(f),q=await processingCommand(env,f.store(),f.actor,'course',{action:'video-processing-quote',sourceId:'synthetic-source'}),grant=await processingCommand(env,f.store(),f.actor,'course',{action:'video-processing-authorise',operationId:crypto.randomUUID(),sourceId:'synthetic-source',quoteHash:q.quoteHash,authorise:true});
  let calls=0;const result=await runProcessingJob(env,grant.jobId,{fetcher:async()=>{calls++;await processingCommand(env,f.store(),f.actor,'course',{action:'video-processing-cancel',operationId:crypto.randomUUID(),jobId:grant.jobId,cancel:true});return response();}});
  assert.equal(result.state,'CANCELLED');assert.equal(calls,1);assert.equal((await f.db.prepare('SELECT count(*) n FROM video_processing_candidates').first()).n,0);
  assert.equal((await f.content.list({prefix:'video-processing-private/'+grant.jobId+'/'})).objects.length,0);
  const next=await processingCommand(env,f.store(),f.actor,'course',{action:'video-processing-authorise',operationId:crypto.randomUUID(),sourceId:'synthetic-source',quoteHash:q.quoteHash,authorise:true});assert.notEqual(next.jobId,grant.jobId);await runProcessingJob(env,next.jobId,{fetcher:async()=>response()});
  const candidate=await readProcessingCandidate(env,f.store(),f.actor,next.jobId);await acceptProcessingCandidate(env,f.store(),f.actor,{operationId:crypto.randomUUID(),jobId:next.jobId,candidateHash:candidate.candidateHash,revision:candidate.baseCompanionRevision,reviewed:true,companion:candidate.candidate.learnerPreview});
  await assert.rejects(processingCommand(env,f.store(),f.actor,'course',{action:'video-processing-cancel',operationId:crypto.randomUUID(),jobId:next.jobId,cancel:true}),e=>e.code==='ACCEPTED_NATIVE_DRAFT_PRESERVED');
  assert.equal((await f.db.prepare("SELECT count(*) n FROM recording_companions").first()).n,1);
 }finally{await f.close();}
});

test('private history reopens an existing job by exact attachment; its indexed page is bounded before filtering expired rows',async()=>{
 const f=await setup();try{
  const env=configured(f),{jobId}=await f.authorise();await runProcessingJob(env,jobId,{fetcher:async()=>response()});
  const first=await processingCommand(env,f.store(),f.actor,'course',{action:'video-processing-history',attachmentId:'processing-attachment'});assert.equal(first.jobs[0].jobId,jobId);assert.equal(first.jobs[0].sourceId,'synthetic-source');assert(!JSON.stringify(first).includes(f.actor.token_hash));assert(!JSON.stringify(first).includes('transcript_key'));assert(!JSON.stringify(first).includes('SELECT'));
  const original=await f.db.prepare('SELECT * FROM video_processing_jobs WHERE job_id=?').bind(jobId).first();
  const now=Date.now();for(let i=0;i<30;i++){const row={...original,job_id:'expired-history-'+String(i).padStart(3,'0'),state:'REVIEW_REQUIRED',authorised_at:now-7200000,authorisation_expires_at:now-7140000,private_expires_at:now-3600000};const keys=Object.keys(row);await f.run('INSERT INTO video_processing_jobs('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')',...Object.values(row));}
  const page=await processingCommand(env,f.store(),f.actor,'course',{action:'video-processing-history',attachmentId:'processing-attachment',after:'expired-history-'});assert.equal(page.jobs.length,0);assert.equal(page.more,true);assert.equal(page.next,'expired-history-024');
  const last=await processingCommand(env,f.store(),f.actor,'course',{action:'video-processing-history',attachmentId:'processing-attachment',after:page.next});assert.equal(last.more,false);
  await assert.rejects(processingCommand(env,f.store(),f.actor,'tafseer',{action:'video-processing-history',attachmentId:'processing-attachment'}));
 }finally{await f.close();}
});
