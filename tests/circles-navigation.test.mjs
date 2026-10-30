import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {circlesFixture} from './circles-fixture.mjs';
import {signIn,ok} from './access-fixture.mjs';
import {random,challenge} from '../src/protocol.mjs';
import {circleBlockChoices} from '../public/shared/circles-block-navigation.mjs';

const make=configuration=>fixture({academy:true,authorityMode:'ACADEMY',navigation:configuration,verification:{accountSeconds:43200,liveSeconds:43200,adminSeconds:60}});
const exchange=async(f,body)=>{const response=await f.runtime.dispatchFetch('https://academy.test/api/website-platform/exchange',{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
const continuation=async(f,cookie,navigation)=>{const verifier=random(),state=random(),result=await f.request('/auth/academy',{cookie,method:'POST',body:{challenge:await challenge(verifier),state,navigation}});return {...result,verifier,state};};

test('native programme membership filters circle menus independently of short Course purchases, without per-click source calls',async()=>{
 const f=await make({mothers:'programA',alimiyah:'programB'});
 try{
  const x=await circlesFixture(f),cookie=await signIn(f),other=await signIn(f,'studentB'),admin=await signIn(f,'global');
  const mine=ok(await f.request('/api/circles/navigation',{cookie}));assert.equal(mine.mothers,true);assert.deepEqual(mine.academia,[]);assert.equal(mine.hifz,null);assert.equal(mine.shortCourses.length,1);assert.equal(mine.shortCourses[0].href,'/studio/?website=site-course');assert.equal(mine.tafseer,'/studio/?view=collections&collection=tafseer');
  const theirs=ok(await f.request('/api/circles/navigation',{cookie:other}));assert.equal(theirs.mothers,false);assert.deepEqual(theirs.academia,[{key:'alimiyah',label:'Aalimiyah'}]);assert.deepEqual(theirs.shortCourses,[]);
  assert.equal((await f.request('/api/circles/classrooms/mothers',{cookie:other})).status,403);assert.equal(ok(await f.request('/api/circles/classrooms/mothers',{cookie})).materialsConnected,false);
  const inherited=ok(await f.request('/api/circles/navigation',{cookie:admin}));assert(inherited.mothers);assert.equal(inherited.academia.length,1);
  await f.run('UPDATE accounts SET verified_at=? WHERE account_id=?',Date.now()-61_000,f.source.f.actors.global);await f.run('UPDATE source_access_people SET verified_at=? WHERE account_id=?',Date.now()-61_000,f.source.f.actors.global);f.source.resetMetrics();ok(await f.request('/api/circles/navigation',{cookie:admin}));assert.equal(f.source.metrics.queries,0,'An ordinary staff menu is not a sensitive Admin operation');assert.notEqual((await f.request('/api/websites/site-course/edit',{cookie:admin})).status,200,'The destination retains the sensitive Admin freshness check');
  f.source.resetMetrics();for(let i=0;i<3;i++)ok(await f.request('/api/circles/navigation',{cookie}));assert.equal(f.source.metrics.queries,0,'Navigation reuses local signed evidence for twelve hours');
  const menu=circleBlockChoices('mothers',mine);assert.match(menu,/Mothers of the Ummah/);assert.match(menu,/Synthetic Circles Course/);assert.doesNotMatch(circleBlockChoices('academy',mine),/data-programme-key/);assert(!menu.includes('must-not-leak'));
  assert.equal((await f.request('/api/circles/navigation')).status,401);
 }finally{await f.close();}
});

test('a known membership removal invalidates the signed navigation immediately and refresh never grants another programme',async()=>{
 const f=await make({mothers:'programA',alimiyah:'programB'});
 try{
  const x=await circlesFixture(f),cookie=await signIn(f);assert(ok(await f.request('/api/circles/navigation',{cookie})).mothers);
  await x.run("UPDATE role_assignments SET active=0 WHERE account_id=? AND activity_key=? AND role='STUDENT'",x.student,x.programA);await x.recover(4);
  assert.equal((await f.request('/api/circles/navigation',{cookie})).body.code,'ACCESS_REFRESH_REQUIRED');assert.equal((await f.request('/api/circles/classrooms/mothers',{cookie})).body.code,'ACCESS_REFRESH_REQUIRED');
  ok(await f.request('/auth/access',{cookie,method:'POST',body:{}}));const next=ok(await f.request('/api/circles/navigation',{cookie}));assert.equal(next.mothers,false);assert.deepEqual(next.academia,[]);assert.equal(next.shortCourses.length,1,'Independent Course purchase survives Mothers membership removal');assert.equal((await f.request('/api/circles/classrooms/mothers',{cookie})).status,403);
  assert.equal((await f.request('/api/websites/site-surah',{cookie})).status,200,'Retained Tafseer months are independent of programme navigation membership');
  const before=f.source.metrics.queries;await f.run('UPDATE circles_navigation SET verified_at=? WHERE account_id=?',Date.now()-43200_001,x.student);assert.equal((await f.request('/api/circles/navigation',{cookie})).body.code,'ACCESS_REFRESH_REQUIRED');assert.equal(f.source.metrics.queries,before,'An expired local proof requests an active renewal without background polling');
 }finally{await f.close();}
});

test('programme continuation checks current native contexts at issuance and exchange, and Hifz uses its existing domain',async()=>{
 const f=await make({alimiyah:'programA',hifz:'programB'});
 try{
  const x=await circlesFixture(f),cookie=await signIn(f),other=await signIn(f,'studentB');
  assert.equal((await continuation(f,cookie,'https://outside.test')).status,403);assert.equal((await continuation(f,cookie,'hifz')).status,403);
  const handoff=await continuation(f,cookie,'alimiyah');ok(handoff);const input={code:handoff.body.code,state:handoff.state,verifier:handoff.verifier},result=await exchange(f,input);ok(result);assert.equal(result.body.destination,'/academy/#activity/PROGRAM/'+x.programA.slice(8)+'/learn');assert(result.body.token);
  for(const [actor,path,role] of [['studentA','/academy/','STUDENT'],['teacherA','/academy/','TEACHER'],['adminA','/academy/admin/','PROGRAM_ADMIN'],['global','/academy/admin/','GLOBAL_ADMIN']]){
   const actorCookie=actor==='studentA'?cookie:await signIn(f,actor),code=await continuation(f,actorCookie,'alimiyah');ok(code);const session=ok(await exchange(f,{code:code.body.code,state:code.state,verifier:code.verifier}));assert.equal(session.destination,path+'#activity/PROGRAM/'+x.programA.slice(8)+(role==='STUDENT'?'/learn':role==='TEACHER'?'/teach':''));
   const actual=await f.runtime.dispatchFetch('https://academy.test/api/account/session',{method:'POST',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json'},body:'{}'});const nativeSession=await actual.json();assert.equal(actual.status,200,nativeSession.error);assert.equal(nativeSession.context.role,role,'The returned token must be accepted by the actual native runtime');
  }assert.equal((await exchange(f,input)).status,401);
  const hifz=await continuation(f,other,'hifz');ok(hifz);assert.equal(ok(await exchange(f,{code:hifz.body.code,state:hifz.state,verifier:hifz.verifier})).destination,'https://hifz.maktab4life.org/');
  const pending=await continuation(f,cookie,'alimiyah');ok(pending);await x.run("UPDATE role_assignments SET active=0 WHERE account_id=? AND activity_key=? AND role='STUDENT'",x.student,x.programA);assert.equal((await exchange(f,{code:pending.body.code,state:pending.state,verifier:pending.verifier})).status,403,'A previously issued code cannot retain removed membership');
 }finally{await f.close();}
});

test('navigation presentation cannot change media authority; invalid keys and stale epochs fail closed',async()=>{
 const f=await fixture();try{
  const account={accountId:'outsider',displayName:'Synthetic outsider',active:true,admitted:true,globalAdmin:false,epoch:1,verifiedAt:Date.now()};
  assert.equal((await f.deliver({type:'account',account,navigation:{programmes:['admin']}})).response.status,400);
  assert.equal((await f.deliver({type:'account',account,navigation:{programmes:['mothers']}})).response.status,200);
  const {cookie}=await f.login('outsider');assert.equal((await f.request('/api/websites/site-course',{cookie})).status,403);assert.equal((await f.request('/api/websites/site-surah',{cookie})).status,403);
  await f.deliver({type:'account',account:{...account,epoch:2},navigation:{programmes:[]}});assert.equal((await f.request('/api/circles/navigation',{cookie})).status,401);
 }finally{await f.close();}
});
