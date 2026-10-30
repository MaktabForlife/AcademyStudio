import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture} from './fixture.mjs';
import {accessFixture,signIn,ok} from './access-fixture.mjs';
import {accessGate} from '../src/access.mjs';
import {boundedAge} from '../src/protocol.mjs';

const {vars}=JSON.parse(readFileSync(new URL('../wrangler.parallel.jsonc',import.meta.url),'utf8'));
const verification={accountSeconds:vars.ACCOUNT_MAX_AGE_SECONDS,adminSeconds:vars.ADMIN_MAX_AGE_SECONDS,liveSeconds:vars.LIVE_ACCESS_MAX_AGE_SECONDS};
const TWELVE_HOURS=12*3600_000;

test('learner and live verification use twelve hours while staff retain the shorter bound',async()=>{
 assert.equal(boundedAge(vars),TWELVE_HOURS);assert.equal(boundedAge(vars,true),60_000);
 const actor={account_id:'learner',source_ref:'source-session'},row={enabled:1,ready:1,generation:1,person_generation:1,verified_at:Date.now()-TWELVE_HOURS+60_000};
 const store={env:vars,first:async()=>row};
 assert.equal(await accessGate(store,actor,'course',{live:true}),row);
 // An omitted live override follows the account policy rather than silently retaining five minutes.
 assert.equal(await accessGate({...store,env:{...vars,LIVE_ACCESS_MAX_AGE_SECONDS:undefined}},actor,'course',{live:true}),row);
 row.verified_at=Date.now()-TWELVE_HOURS-1;
 await assert.rejects(accessGate(store,actor,'course',{live:true}),{code:'ACCESS_REFRESH_REQUIRED'});
 row.verified_at=Date.now()-61_000;
 await assert.rejects(accessGate(store,actor,'course',{admin:true,live:true}),{code:'ACCESS_REFRESH_REQUIRED'});
});

test('near twelve hours, website/media/catalogue/Join reuse local rights; delivered removals and suspension still block',async()=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY',verification});try{
  const x=await accessFixture(f),cookie=await signIn(f),now=Date.now(),verified=now-TWELVE_HOURS+60_000;
  const session=await f.db.prepare("SELECT session_id FROM timetable WHERE offering_id='course' AND cancelled=0 LIMIT 1").first();assert(session);
  await f.run('UPDATE timetable SET starts_at=?,ends_at=? WHERE session_id=?',now-60_000,now+3600_000,session.session_id);
  await f.run("INSERT INTO objects VALUES('cached-video',NULL,'video/youtube','Synthetic video',0,NULL,'abcdefghijk')");
  await f.run("INSERT INTO attachments VALUES('cached-recording','course','site-course','cached-video','lesson-id','2026-10-30','','Recording','RECORDING',1)");
  await f.run('UPDATE accounts SET verified_at=? WHERE account_id=?',verified,x.student);
  await f.run('UPDATE source_access_people SET verified_at=? WHERE account_id=?',verified,x.student);
  f.source.resetMetrics();
  for(const path of ['/api/me','/api/websites','/api/circles/access?website=site-course&website=site-surah','/api/websites/site-course','/api/websites/site-surah','/api/offerings/course/media','/api/media/cached-recording'])ok(await f.request(path,{cookie}));
  ok(await f.request('/api/offerings/course/join',{cookie,method:'POST',body:{sessionId:session.session_id}}));
  assert.equal(f.source.metrics.queries,0,'normal use must not renew authority in Academy before twelve hours');
  await x.run('UPDATE course_subscription_decisions SET active=0 WHERE account_id=? AND activity_key=?',x.student,x.courseA);await x.recover(8);
  assert.equal((await f.request('/api/websites/site-course',{cookie})).status,403);
  assert.equal((await f.request('/api/media/cached-recording',{cookie})).status,403);
  await x.run('UPDATE accounts SET active=0 WHERE account_id=?',x.student);await x.recover(8);
  assert.equal((await f.request('/api/me',{cookie})).status,401);
 }finally{await f.close();}
});

test('twelve-hour expiry requires renewal, permission proof expires independently, and staff refresh remains one minute',async()=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY',verification});try{
  const x=await accessFixture(f),cookie=await signIn(f);
  await f.run('UPDATE accounts SET verified_at=? WHERE account_id=?',Date.now()-TWELVE_HOURS-1,x.student);
  assert.equal((await f.request('/api/me',{cookie})).body.code,'STATUS_EXPIRED');
  ok(await f.request('/auth/refresh',{cookie,method:'POST',body:{}}));ok(await f.request('/api/websites/site-course',{cookie}));
  await f.run('UPDATE source_access_people SET verified_at=? WHERE account_id=?',Date.now()-TWELVE_HOURS-1,x.student);
  assert.equal((await f.request('/api/websites/site-course',{cookie})).body.code,'ACCESS_REFRESH_REQUIRED');
  ok(await f.request('/auth/access',{cookie,method:'POST',body:{offeringId:'course'}}));ok(await f.request('/api/websites/site-course',{cookie}));
  const admin=await signIn(f,'adminA'),accountId=f.source.f.actors.adminA;
  await f.run('UPDATE accounts SET verified_at=? WHERE account_id=?',Date.now()-61_000,accountId);
  assert.equal((await f.request('/api/websites/site-course/edit',{cookie:admin})).body.code,'ADMIN_STATUS_EXPIRED');
  ok(await f.request('/auth/refresh',{cookie:admin,method:'POST',body:{}}));ok(await f.request('/api/websites/site-course/edit',{cookie:admin}));
 }finally{await f.close();}
});
