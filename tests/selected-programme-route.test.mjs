import test from 'node:test';import assert from 'node:assert/strict';
import {dashboardProgrammeChoice} from '../public/shared/circles-block-navigation.mjs';
import {fixture} from './fixture.mjs';import {circlesFixture} from './circles-fixture.mjs';import {signIn,ok} from './access-fixture.mjs';import {random,challenge,sha256} from '../src/protocol.mjs';import {checkedProgrammeNavigation} from '../src/dashboard.mjs';
const row={activityKey:'PROGRAM:native-one',navigationKey:'alimiyah'};
test('programme cards carry the selected checked mode and exact unique native mapping, never legacy fallback',()=>{
 for(const mode of ['learn','teach','admin'])assert.deepEqual(dashboardProgrammeChoice('alimiyah',mode,{mode,availableModes:['learn','teach','admin'],programmeNavigation:[row]}),{mode,tool:'activity',activityKey:row.activityKey});
 for(const [key,mode,summary] of [['alimiyah','teach',{mode:'learn',availableModes:['learn','teach'],programmeNavigation:[row]}],['alimiyah','teach',{mode:'teach',availableModes:['learn'],programmeNavigation:[row]}],['alimiyah','teach',{mode:'teach',availableModes:['teach'],programmeNavigation:[]}],['alimiyah','teach',{mode:'teach',availableModes:['teach'],programmeNavigation:[row,row]}],['alimiyah','teach',{mode:'teach',availableModes:['teach'],programmeNavigation:[{...row,activityKey:'https://evil.test'}]}],['hifz','teach',{mode:'teach',availableModes:['teach'],programmeNavigation:[row]}],['https://evil.test','admin',{}]])assert.throws(()=>dashboardProgrammeChoice(key,mode,summary));
});
test('the bounded native mapping validates exact configured keys and unique programme identities',()=>{
 assert.deepEqual(checkedProgrammeNavigation([row],['alimiyah']),[row]);assert.deepEqual(checkedProgrammeNavigation([],[]),[]);
 for(const [value,allowed]of [[undefined,['alimiyah']],[[row],[]],[[row,row],['alimiyah']],[[row,{...row,navigationKey:'reboot'}],['alimiyah','reboot']],[[{...row,activityKey:'COURSE:native-one'}],['alimiyah']],[[{...row,url:'https://evil.test'}],['alimiyah']],[[{...row,navigationKey:'hifz'}],['hifz']]])assert.throws(()=>checkedProgrammeNavigation(value,allowed));
});

test('current programme-card mapping opens native personal or inherited Admin views and retains checked Home mode',async()=>{
 const f=await fixture({academy:true,dashboard:true,authorityMode:'ACADEMY',navigation:{alimiyah:'programA',hifz:'programB'},verification:{accountSeconds:43200,adminSeconds:60,liveSeconds:43200}});
 try{
  const x=await circlesFixture(f),cookies=new Map();
  for(const [actor,mode,base,role] of [['teacherA','teach','/academy/','TEACHER'],['studentA','learn','/academy/','STUDENT'],['global','learn','/academy/admin/','GLOBAL_ADMIN'],['global','teach','/academy/admin/','GLOBAL_ADMIN'],['global','admin','/academy/admin/','GLOBAL_ADMIN']]){
   const cookie=await signIn(f,actor),summary=ok(await f.request('/api/circles/dashboard',{cookie,method:'POST',body:{mode}}));
   cookies.set(actor+':'+mode,cookie);assert(summary.programmeNavigation.some(row=>row.navigationKey==='alimiyah'),JSON.stringify({actor,mode,programmeNavigation:summary.programmeNavigation}));
   const dashboard=dashboardProgrammeChoice('alimiyah',mode,summary),state=random(),verifier=random();
   const ticket=ok(await f.request('/auth/academy',{cookie,method:'POST',body:{state,challenge:await challenge(verifier),dashboard}}));
   const response=await f.runtime.dispatchFetch('https://academy.test/api/website-platform/exchange',{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json'},body:JSON.stringify({code:ticket.code,state,verifier})}),session=await response.json();
   assert.equal(response.status,200,session.error);assert.equal(session.destination,base+'#activity/PROGRAM/'+x.programA.slice(8)+(mode==='admin'?'':'/'+mode));assert.deepEqual(session.circles,{mode,returnUrl:'https://website.test/?workspace='+mode});
   const native=await f.runtime.dispatchFetch('https://academy.test/api/account/session',{method:'POST',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json'},body:'{}'});assert.equal(native.status,200);assert.equal((await native.json()).context.role,role);
  }
  const admin=cookies.get('global:learn'),cacheKey='private/dashboard/'+await sha256(f.source.f.actors.global)+'/learn.json';ok(await f.request('/api/circles/dashboard',{cookie:admin,method:'POST',body:{mode:'learn'}}));assert(ok(await f.request('/api/circles/dashboard',{cookie:admin,method:'POST',body:{mode:'learn'}})).cached);const saved=await (await f.content.get(cacheKey)).json();delete saved.dashboard.programmeNavigation;await f.content.put(cacheKey,JSON.stringify(saved));assert.equal(ok(await f.request('/api/circles/dashboard',{cookie:admin,method:'POST',body:{mode:'learn'}})).cached,false,'Old snapshots rebuild once for this active account');f.source.resetMetrics();assert(ok(await f.request('/api/circles/dashboard',{cookie:admin,method:'POST',body:{mode:'learn'}})).cached);assert.equal(f.source.metrics.queries,0,'Subsequent returns retain the existing cached proof');
  const cookie=cookies.get('teacherA:teach'),summary=ok(await f.request('/api/circles/dashboard',{cookie,method:'POST',body:{mode:'teach'}})),dashboard=dashboardProgrammeChoice('alimiyah','teach',summary),state=random(),verifier=random(),ticket=ok(await f.request('/auth/academy',{cookie,method:'POST',body:{state,challenge:await challenge(verifier),dashboard}}));
  await x.run("UPDATE role_assignments SET active=0 WHERE account_id=? AND activity_key=? AND role='TEACHER'",f.source.f.actors.teacherA,x.programA);
  const revoked=await f.runtime.dispatchFetch('https://academy.test/api/website-platform/exchange',{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json'},body:JSON.stringify({code:ticket.code,state,verifier})});assert.equal(revoked.status,403,'An already-issued card code must not retain removed teaching authority');
 }finally{await f.close();}
});
