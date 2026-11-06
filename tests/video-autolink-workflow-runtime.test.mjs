import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
import {setup,response} from './video-autolink-job-fixture.mjs';import {processingCommand} from '../src/video-autolink/commands.mjs';
async function configured({outcome='candidate'}={}){
 const modulePath=process.env.VIDEO_CURRENT_MINIFLARE;if(!modulePath)throw Error('Set the pinned runner-only current Miniflare module.');
 const version=JSON.parse(readFileSync(new URL('../../package.json',pathToFileURL(modulePath)),'utf8'));assert.equal(version.version,'5.20261103.0-beta');
 let providerCalls=0;
 const bindings={VIDEO_AUTOLINK_HTTP_ENABLED:'1',VIDEO_AUTOLINK_ENABLED:'1',OPENAI_API_KEY:'synthetic-key-NOT-REAL',VIDEO_AI_MODEL:'synthetic-reviewed-model',VIDEO_AI_AUTHORISATION_PROFILE:'synthetic-reviewed-profile',VIDEO_AI_MAX_OUTPUT_TOKENS:'2000',VIDEO_AI_MAX_REQUEST_BYTES:'64000',VIDEO_AI_TIMEOUT_MS:'5000',VIDEO_AI_PRIVATE_REVIEW_TTL_HOURS:'1',VIDEO_AI_WORKFLOW_RETENTION_HOURS:'1'};
 const outboundService=async request=>{console.log('SYNTHETIC_OUTBOUND',JSON.stringify({url:request.url,method:request.method}));
  assert.equal(request.url,'https://api.openai.com/v1/responses');assert.equal(request.method,'POST');const body=await request.json();assert.equal(body.store,false);assert.equal(body.model,bindings.VIDEO_AI_MODEL);providerCalls++;
  return outcome==='candidate'?response():new Response('PRIVATE synthetic provider failure: transcript/key must not enter history',{status:503});
 };
 const f=await setup({fixtureOptions:{authorityMode:'ACADEMY',verification:{accountSeconds:43200,adminSeconds:60},workflowRuntime:{modulePath,bindings,outboundService}}});
 const all=await f.runtime.getBindings('platform'),workflow=all.VIDEO_PROCESSING_WORKFLOW;assert.equal(typeof workflow.create,'function');
 const env={...f.env,VIDEO_AI_WORKFLOW_RETENTION_HOURS:'1',VIDEO_PROCESSING_WORKFLOW:workflow};
 return {...f,env,workflow,providerCalls:()=>providerCalls,modulePath,runtimeVersion:version.version,workerdVersion:version.dependencies.workerd};
}
async function complete(instance){
 for(let i=0;i<200;i++){const status=await instance.status();if(['complete','errored','terminated'].includes(status.status)){assert.equal(status.status,'complete',JSON.stringify(status));return status;}await new Promise(done=>setTimeout(done,50));}
 throw Error('Local Workflow did not reach a terminal state.');
}
test('real current workerd Workflow dispatch executes the guarded native paid step once and returns only safe state/id metadata',async()=>{
 const f=await configured();try{
  const {jobId,input}=await f.authorise();
  const dispatched=await processingCommand(f.env,f.store(),f.actor,'course',{action:'video-processing-authorise',...input});assert.equal(dispatched.jobId,jobId);assert.equal(dispatched.dispatch,'QUEUED');
  const instance=await f.workflow.get(jobId),status=await complete(instance);console.log('SYNTHETIC_STATUS',JSON.stringify(status.output),JSON.stringify(await f.db.prepare('SELECT state,outcome_code FROM video_processing_jobs WHERE job_id=?').bind(jobId).first()));assert.equal(status.output.state,'CANDIDATE');assert.equal(status.output.jobId,jobId);assert.equal(f.providerCalls(),1);
  const serial=JSON.stringify(status);for(const forbidden of ['PRIVATE','Synthetic evidence:','synthetic-key-NOT-REAL','video-processing-private/','learnerPreview','privateEvidence'])assert(!serial.includes(forbidden),forbidden);
  assert.equal((await f.db.prepare('SELECT state FROM video_processing_jobs WHERE job_id=?').bind(jobId).first()).state,'CANDIDATE');
  const retried=await processingCommand(f.env,f.store(),f.actor,'course',{action:'video-processing-authorise',...input});assert.equal(retried.dispatch,'NOT_NEEDED');assert.equal(retried.jobId,jobId);assert.equal(f.providerCalls(),1);
  console.log(JSON.stringify({workerCompatibilityDate:'2026-10-28',runtimeVersion:f.runtimeVersion,workerdVersion:f.workerdVersion,workflow:'real local SDK/engine',provider:'mocked fixed endpoint',providerCalls:1,hostedCalls:0,outputKeys:Object.keys(status.output).sort()}));
 }finally{await f.close();}
});
test('real Workflow provider-503 outcome is review-required without retry or private durable output',async()=>{
 const f=await configured({outcome:'unknown'});try{
  const {jobId,input}=await f.authorise();await processingCommand(f.env,f.store(),f.actor,'course',{action:'video-processing-authorise',...input});
  const status=await complete(await f.workflow.get(jobId));console.log('SYNTHETIC_STATUS',JSON.stringify(status.output),JSON.stringify(await f.db.prepare('SELECT state,outcome_code FROM video_processing_jobs WHERE job_id=?').bind(jobId).first()));assert.equal(status.output.state,'REVIEW_REQUIRED');assert.equal(f.providerCalls(),1);assert(!JSON.stringify(status).includes('PRIVATE'));
  await new Promise(done=>setTimeout(done,150));assert.equal(f.providerCalls(),1);const row=await f.db.prepare('SELECT state,outcome_code FROM video_processing_jobs WHERE job_id=?').bind(jobId).first();assert.equal(row.state,'REVIEW_REQUIRED');assert.equal(row.outcome_code,'PROVIDER_OUTCOME_UNKNOWN');
  const retry=await processingCommand(f.env,f.store(),f.actor,'course',{action:'video-processing-authorise',...input});assert.equal(retry.dispatch,'NOT_NEEDED');assert.equal(f.providerCalls(),1);
 }finally{await f.close();}
});
test('real Workflow malformed opaque parameters fail before any paid request',async()=>{
 const f=await configured();try{
  const id=crypto.randomUUID(),instance=await f.workflow.create({id,params:{jobId:'synthetic-opaque-only',unexpected:true},retention:{successRetention:'1 hour',errorRetention:'1 hour'}});
  const status=await complete(instance);assert.equal(status.output.state,'REVIEW_REQUIRED');assert.equal(status.output.code,'PROCESSING_CONTEXT_CHANGED');assert.equal(f.providerCalls(),0);
 }finally{await f.close();}
});
