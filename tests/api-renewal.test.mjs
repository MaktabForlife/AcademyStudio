import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/api.mjs',import.meta.url),'utf8').replace(/\bexport\s+/g,'')+'\nglobalThis.testAPI={api,changed,identity};';
function client(fetcher){const window=new EventTarget(),context=vm.createContext({window,fetch:fetcher,Response,Blob,DOMException,CustomEvent,Event,URL,setTimeout,console});vm.runInContext(source,context);return {...context.testAPI,window};}
const error=(code,status=409,offeringId)=>Response.json({error:code,code,...(offeringId?{offeringId}:{})},{status});
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};

test('active account and exact scope renewal coalesce and do not mistake a fresh master proof for fresh sensitive scope facts',async()=>{
 let master=false,scope=false;const calls=[];const c=client(async(path,options)=>{calls.push({path,body:options.body&&JSON.parse(options.body)});if(path==='/auth/refresh'){master=true;return Response.json({verifiedAt:Date.now()});}if(path==='/auth/access'){assert(master);scope=true;return Response.json({verifiedAt:Date.now()});}if(!master)return error('STATUS_EXPIRED',401);if(!scope)return error('ACCESS_REFRESH_REQUIRED',409,'course-a');return Response.json({opened:true});});
 c.changed({accountId:'actor-a'});const [a,b]=await Promise.all([c.api('/private'),c.api('/private')]);assert(a.opened&&b.opened);assert.equal(calls.filter(x=>x.path==='/auth/refresh').length,1);assert.equal(calls.filter(x=>x.path==='/auth/access').length,1);assert.equal(calls.find(x=>x.path==='/auth/access').body.offeringId,'course-a');assert.equal(c.identity.account.accountId,'actor-a');
});
test('different scopes queue active renewal instead of racing the account-wide claim, and each scope renews only once',async()=>{
 let active=0,max=0;const ready=new Set(),calls=[];const c=client(async(path,options)=>{if(path==='/auth/access'){const id=JSON.parse(options.body).offeringId;calls.push(id);max=Math.max(max,++active);await new Promise(r=>setImmediate(r));ready.add(id);active--;return Response.json({verifiedAt:Date.now()});}const id=path.slice(1);return ready.has(id)?Response.json({opened:id}):error('ACCESS_REFRESH_REQUIRED',409,id);});
 c.changed({accountId:'actor-a'});await Promise.all([c.api('/a'),c.api('/b'),c.api('/a')]);assert.deepEqual(calls,['a','b']);assert.equal(max,1);
});
test('account changes abort queued old-account renewal and never reuse old policy display epochs',async()=>{
 let release;const calls=[];let epoch=1;const c=client(async(path,options)=>{if(path==='/state')return Response.json({coursePolicyEpoch:epoch});if(path==='/auth/access'){calls.push(JSON.parse(options.body).offeringId);return new Promise(r=>release=()=>r(Response.json({verifiedAt:Date.now()})));}return error('ACCESS_REFRESH_REQUIRED',409,path.slice(1));});
 let events=0;c.window.addEventListener('website-course-policy-changed',()=>events++);c.changed({accountId:'actor-a'});await c.api('/state');epoch=2;await c.api('/state');assert.equal(events,1);
 const a=c.api('/a'),b=c.api('/b'),all=Promise.allSettled([a,b]);await settle();assert.deepEqual(calls,['a']);c.changed({accountId:'actor-b'});release();const results=await all;assert(results.every(r=>r.status==='rejected'&&r.reason.name==='AbortError'));assert.deepEqual(calls,['a']);await c.api('/state');assert.equal(events,1);
});
