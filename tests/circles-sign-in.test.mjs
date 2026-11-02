import test from 'node:test';
import assert from 'node:assert/strict';
import {signInFromCircles,accessArea,learningDestination,openAcademyFromCircles} from '../public/shared/circles-sign-in.mjs';
import {fixture} from './fixture.mjs';
import {circlesFixture} from './circles-fixture.mjs';
import {createHash} from 'node:crypto';

test('Circles signs in through native Academy and Studio with a one-use PKCE handoff; wrong PIN and tampered verifier fail',async()=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY'});let cookie;const calls=[];
 const request=async(path,options={})=>{
  calls.push({path,body:options.body});const result=await f.request(path,{method:options.body?'POST':'GET',body:options.body,cookie});
  if(result.status>=400)throw Object.assign(Error(result.body.error),{code:result.body.code,status:result.status});
  const set=result.response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return result.body;
 };
 try{
  const x=await circlesFixture(f);await x.recover(8);
  await assert.rejects(signInFromCircles(request,{uniqueid:'separation-global',pin:'9999'}));assert(!cookie);
  const me=await signInFromCircles(request,{uniqueid:'separation-global',pin:'1234'});
  assert(me.accountId&&me.globalAdmin);assert(cookie.startsWith('__Host-maktab_web='));
  const exchange=calls.findLast(x=>x.path==='/auth/exchange'),login=calls.findLast(x=>x.path==='/auth/login');
  assert.equal(createHash('sha256').update(exchange.body.verifier).digest('base64url'),login.body.challenge);
  assert.equal(exchange.body.state,login.body.state);assert(!('pin' in exchange.body));
  const studio=await f.request('/api/admin/offerings',{cookie});assert.equal(studio.status,200);assert(studio.body.offerings.every(o=>['COURSE','TAFSEER'].includes(o.kind)),'Retained Academy programmes must not be selected as Studio websites');
  assert.equal((await f.request('/api/admin/course',{cookie})).status,200,'The actual Studio workspace uses the same signed-in account');
  assert.equal((await f.request('/auth/exchange',{method:'POST',body:exchange.body})).status,401);
  assert.equal((await f.request('/auth/exchange',{method:'POST',body:{...exchange.body,verifier:'x'.repeat(43)}})).status,401);
  await request('/auth/logout',{body:{}});assert.equal((await f.request('/api/me',{cookie})).status,401);
  const learner=await signInFromCircles(request,{uniqueid:'separation-studentA',pin:'1234'});assert.equal(learner.globalAdmin,false);
  assert.deepEqual((await f.request('/api/admin/offerings',{cookie})).body.offerings,[]);
  assert.equal((await f.request('/api/admin/course',{cookie})).status,403,'Circles login does not promote a learner to Studio administrator');
 }finally{await f.close();}
});

test('selected destination is an allowlist; cancelled login does not exchange its code',async()=>{
 assert.equal(learningDestination('studio'),'/studio/?manage=1');assert.equal(learningDestination('tafseer'),'/studio/?view=collections&collection=tafseer');
 for(const area of ['https://outside.test','//outside.test','admin','mothers','hifz'])assert.equal(learningDestination(area),null);
 assert.equal(accessArea('https://outside.test'),'general');
 assert.equal(accessArea('arabic-adventures'),'arabic-adventures');
 assert.equal(learningDestination('arabic-adventures'),null,'The new display area must not invent a course destination or authority');
 const paths=[];await assert.rejects(signInFromCircles(async path=>{paths.push(path);return {code:'not-used'};},{uniqueid:'synthetic',pin:'1234'},{current:()=>false}),{name:'AbortError'});assert.deepEqual(paths,['/auth/login']);
});

test('Academy continuation rejects spoofed origins/windows and duplicate challenges; popup failure sends no command',async()=>{
 const listeners=new Map(),sent=[],requests=[],child={closed:false,postMessage:(...args)=>sent.push(args)},window={open:()=>child,addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k),setTimeout:()=>1,setInterval:()=>2,clearTimeout(){},clearInterval(){}};
 const handoff=openAcademyFromCircles({academyOrigin:'https://academy.test',window,request:async(...args)=>{requests.push(args);return {code:'one-use-code'};}}),receive=listeners.get('message');
 const challenge={source:child,origin:'https://academy.test',data:{type:'ACADEMY_WEBSITE_CHALLENGE',state:'s'.repeat(43),challenge:'c'.repeat(43)}};
 await receive({...challenge,origin:'https://outside.test'});await receive({...challenge,source:{}});await receive({...challenge,data:{...challenge.data,state:'invalid'}});assert.equal(requests.length,0);
 await receive(challenge);await receive(challenge);assert.equal(requests.length,1);assert.equal(sent.length,1);assert.equal(sent[0][1],'https://academy.test');assert.equal(sent[0][0].state,challenge.data.state);assert(!listeners.has('message'));handoff.close();
 let error;openAcademyFromCircles({academyOrigin:'https://academy.test',window:{open:()=>null},request:()=>assert.fail('Blocked popup must not create a code'),onError:v=>error=v});assert.match(error,/Allow/);
});
test('homepage sign-in uses the combined checked bootstrap instead of separate profile/menu/dashboard reads',async()=>{const calls=[],events=[],value={account:{accountId:'checked'},navigation:{},dashboard:{mode:'learn'}};const reply=await signInFromCircles(async(path,options)=>{calls.push({path,options});if(path==='/auth/login')return {code:'issued'};if(path==='/auth/exchange')return {signedIn:true};assert.equal(path,'/api/circles/bootstrap');return value;},{uniqueid:'synthetic',pin:'1234'},{bootstrap:true,onExchange:()=>events.push('old-account-cleared')});assert.equal(reply,value);assert.deepEqual(calls.map(c=>c.path),['/auth/login','/auth/exchange','/api/circles/bootstrap']);assert.deepEqual(events,['old-account-cleared']);assert(!('pin' in calls[1].options.body));});
