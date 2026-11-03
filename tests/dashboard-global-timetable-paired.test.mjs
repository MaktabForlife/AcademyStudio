import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {signIn,ok} from './access-fixture.mjs';
import {dashboardFixtureKey} from './dashboard-cache-fixture.mjs';
test('Global Admin circles retain native Academy classes in every presentation without enrolments or weaker Join gates',{timeout:90000},async t=>{
 const f=await fixture({academy:true,dashboard:true,nativeJoinTest:true,authorityMode:'ACADEMY',navigation:{alimiyah:'programA',reboot:'programB'},verification:{accountSeconds:43200,adminSeconds:60,liveSeconds:43200}});t.after(()=>f.close());
 const cookie=await signIn(f,'global'),core=await f.runtime.getD1Database('ACADEMY_DB','academy'),accountId=f.source.f.actors.global;
 const roles=()=>core.prepare('SELECT activity_key,role,active FROM role_assignments WHERE account_id=? ORDER BY activity_key,role').bind(accountId).all();const before=await roles();
 const load=mode=>f.request('/api/circles/dashboard',{cookie,method:'POST',body:{mode}}),admin=ok(await load('admin'));assert(admin.timetable.length>0);
 const key=row=>JSON.stringify([row.kind,row.activityId,row.date,row.startsAt,row.endsAt,row.subjectName]);
 let learn;
 for(const mode of ['learn','teach']){
  const data=ok(await load(mode));if(mode==='learn')learn=data;assert.equal(data.mode,mode);assert.equal(data.adminBadge,'Global Admin');assert.deepEqual(data.timetable.map(key).sort(),admin.timetable.map(key).sort());assert(!JSON.stringify(data).includes('zoom.'));
  const row=data.timetable.find(r=>r.nativeJoin&&r.startsAt-300000<=Date.now()&&r.endsAt>Date.now());assert(row,'A current native Admin class is available in '+mode);
  const joined=await f.request('/api/circles/lesson-join',{cookie,method:'POST',body:{mode,...row.nativeJoin}});assert.match(ok(joined).joinUrl,/^https:\/\//);assert.equal(joined.response.headers.get('Cache-Control'),'private, no-store');
 }
 assert.deepEqual(await roles(),before,'Oversight never inserts Student or Teacher assignments');
 f.source.resetMetrics();assert(ok(await load('learn')).cached);assert.equal(f.source.metrics.queries,0);
 const storedKey=await dashboardFixtureKey(f,accountId,'learn'),saved=await (await f.content.get(storedKey)).json();saved.format='DASHBOARD_WEEKS_V1';saved.dashboard.activities=[];saved.dashboard.timetable=[];await f.content.put(storedKey,JSON.stringify(saved));
 f.source.resetMetrics();const upgraded=ok(await load('learn'));assert(!upgraded.cached);assert.equal(upgraded.timetable.length,learn.timetable.length);assert(f.source.metrics.queries>0);f.source.resetMetrics();assert(ok(await load('learn')).cached);assert.equal(f.source.metrics.queries,0);
 const row=learn.timetable.find(r=>r.nativeJoin&&r.startsAt-300000<=Date.now()&&r.endsAt>Date.now()),body={mode:'learn',...row.nativeJoin};
 const other=await signIn(f,'studentB');assert.equal((await f.request('/api/circles/lesson-join',{cookie:other,method:'POST',body})).status,403);
 const future=learn.timetable.find(r=>r.nativeJoin&&r.startsAt>Date.now()+300000);assert(future);const tooEarly=await f.request('/api/circles/lesson-join',{cookie,method:'POST',body:{mode:'learn',...future.nativeJoin}});assert([403,409].includes(tooEarly.status));assert(!tooEarly.body.joinUrl);
 const scope=row.kind+':'+row.activityId;await core.prepare("INSERT INTO website_platform_access_ownership(activity_key,state,updated_at) VALUES(?,'STUDIO',0)").bind(scope).run();const transferred=await f.request('/api/circles/lesson-join',{cookie,method:'POST',body});assert.equal(transferred.status,409);assert.equal(transferred.body.code,'STUDIO_JOIN_REQUIRED');assert(!transferred.body.joinUrl);
 await core.prepare("UPDATE website_platform_access_ownership SET state='ACADEMY' WHERE activity_key=?").bind(scope).run();await core.prepare('UPDATE account_sessions SET revoked_at=? WHERE account_id=?').bind(new Date().toISOString(),accountId).run();const revoked=await f.request('/api/circles/lesson-join',{cookie,method:'POST',body});assert.equal(revoked.status,401);assert(!revoked.body.joinUrl);
 t.diagnostic(JSON.stringify({nativeClasses:admin.timetable.length,views:['learn','teach','admin'],cacheUpgrade:'once',hostedActions:0}));
});
