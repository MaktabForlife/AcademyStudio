import test from 'node:test';
import assert from 'node:assert/strict';
import {academyCommand} from '../src/academy-client.mjs';
import {dashboardSnapshot} from '../src/dashboard.mjs';

const env={ACADEMY_API_ORIGIN:'https://source-api.test',ACADEMY_ORIGIN:'https://academy.test',WEBSITE_ORIGIN:'https://website.test',WEBSITE_TO_ACADEMY_SECRET:'synthetic-dashboard-command-secret'};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

test('only dashboard assembly receives the longer deadline; other commands and acknowledgement are unchanged',async t=>{
 const deadlines=[],timeout=AbortSignal.timeout.bind(AbortSignal);t.mock.method(AbortSignal,'timeout',milliseconds=>{deadlines.push(milliseconds);return timeout(milliseconds);});
 const calls=[],fetcher=async(url,options)=>{calls.push({url,options});return Response.json(url.endsWith('/dashboard')?{dashboard:{mode:'admin'},acknowledge:['synthetic-delivery']}:{done:true});};
 await academyCommand(env,{},'/internal/website/dashboard',{sourceRef:'synthetic-reference'},fetcher);
 for(const path of ['/internal/website/sign-in','/internal/website/status','/internal/website/open-academy'])await academyCommand(env,{},path,{},fetcher);
 assert.deepEqual(deadlines,[20000,5000,8000,8000,8000]);assert(calls.every(c=>c.url.startsWith(env.ACADEMY_API_ORIGIN)));assert(calls.every(c=>c.options.redirect==='manual'));
 let failed=0;await assert.rejects(academyCommand(env,{},'/internal/website/dashboard',{},async()=>{failed++;throw new DOMException('Timed out','TimeoutError');}),e=>e.name==='TimeoutError');assert.equal(failed,1,'A timeout does not retry Source');
});

test('a delayed first dashboard result still rechecks actor, permission proof and policy before caching',async()=>{
 for(const change of ['epoch','proof','policy','revoked','source-denied']){
  const now=Date.now(),actor={account_id:'one',token_hash:'one-token',source_ref:'synthetic-reference',epoch:1},state={epoch:1,proof:now,policy:1},started=deferred(),reply=deferred(),writes=[];
  const store={
   async first(sql){if(sql.includes('circles_navigation'))return {epoch:1,verified_at:state.proof,programmes_json:'[]'};if(sql.includes('course_policy_state'))return {revision:state.policy};assert.fail('Unexpected query');},
   async actor(){if(state.revoked)throw Object.assign(Error('Signed out'),{status:401});return {...actor,epoch:state.epoch};}
  };
  const runtime={...env,ACCOUNT_MAX_AGE_SECONDS:'43200',CONTENT:{get:async()=>null,put:async(...args)=>writes.push(args)}};
  const request=dashboardSnapshot(runtime,store,actor,{},async()=>{started.resolve();return reply.promise;});await started.promise;
  if(change==='epoch')state.epoch=2;else if(change==='proof')state.proof=now+1;else if(change==='policy')state.policy=2;else if(change==='revoked')state.revoked=true;
  reply.resolve(change==='source-denied'?Response.json({error:'Denied'},{status:403}):Response.json({dashboard:{mode:'admin',availableModes:['admin'],activities:[]}}));
  await assert.rejects(request,error=>error.status===(change==='revoked'?401:change==='source-denied'?403:409));assert.equal(writes.length,0,change+' cannot cache a delayed summary');
 }
});
