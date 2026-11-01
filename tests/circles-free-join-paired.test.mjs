import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {random,challenge,sha256} from '../src/protocol.mjs';

const ok=result=>{assert.equal(result.status,200,JSON.stringify(result.body));return result.body;};
async function signIn(f,uniqueid){
 const verifier=random(),state=random(),ticket=ok(await f.request('/auth/login',{method:'POST',body:{uniqueid,pin:'1234',state,challenge:await challenge(verifier)}}));
 const result=await f.request('/auth/exchange',{method:'POST',body:{code:ticket.code,verifier,state}});ok(result);return result.response.headers.get('Set-Cookie').split(';')[0];
}
test('actual paired Workers let a signed-in nonmember join public Free classes without enrolment, upgrade once and retain current denials',{timeout:60000},async t=>{
 const f=await fixture({academy:true,dashboard:true,nativeJoinTest:true,freeProgrammeJoinTest:true,authorityMode:'ACADEMY',navigation:{alimiyah:'programA',reboot:'programB'},verification:{accountSeconds:43200,adminSeconds:60,liveSeconds:43200}});t.after(()=>f.close());
 const cookie=await signIn(f,'login-0007'),accountId=ok(await f.request('/api/me',{cookie})).accountId,scope=f.source.f.scopes.programA,core=await f.runtime.getD1Database('ACADEMY_DB','academy');
 const roles=await core.prepare('SELECT * FROM role_assignments WHERE account_id=? ORDER BY assignment_id').bind(accountId).all();assert(!roles.results.some(r=>r.activity_key===scope));
 const load=()=>f.request('/api/circles/dashboard',{cookie,method:'POST',body:{mode:'learn'}}),data=ok(await load());assert.equal(data.freeProgrammeJoinVersion,1);
 const row=data.timetable.find(r=>r.kind==='PROGRAM'&&'PROGRAM:'+r.activityId===scope&&r.nativeJoin&&r.joinAvailableAt<=Date.now()&&r.endsAt>Date.now());assert(row,'The current nonmember must receive the public class reference');assert(!row.subjectName&&!row.moduleName);assert(!JSON.stringify(data).includes('zoom.'));
 const classReads=f.source.statements.filter(item=>item.sql?.includes('SELECT c.* FROM')&&item.sql.includes('json_each(?) UNION'));assert(classReads.length>0,'Public class references share the existing accepted class query');
 const input={mode:'learn',...row.nativeJoin},join=()=>f.request('/api/circles/lesson-join',{cookie,method:'POST',body:input});assert.match(ok(await join()).joinUrl,/^https:\/\//);
 const key='private/dashboard/'+await sha256(accountId)+'/learn.json',saved=await (await f.content.get(key)).json();delete saved.dashboard.freeProgrammeJoinVersion;await f.content.put(key,JSON.stringify(saved));assert.equal(ok(await load()).cached,false);f.source.resetMetrics();assert.equal(ok(await load()).cached,true);assert.equal(ok(await load()).cached,true);assert.equal(f.source.metrics.queries,0,'A current dashboard never polls Source on warm reuse');
 for(const state of ['STUDIO','FROZEN']){await core.prepare('INSERT INTO website_platform_access_ownership(activity_key,state,updated_at) VALUES(?,?,0) ON CONFLICT(activity_key) DO UPDATE SET state=excluded.state').bind(scope,state).run();const denied=await join();assert.equal(denied.body.code,'STUDIO_JOIN_REQUIRED');assert(!denied.body.joinUrl);}
 await core.prepare("UPDATE website_platform_access_ownership SET state='ACADEMY' WHERE activity_key=?").bind(scope).run();
 await core.prepare("UPDATE academy_settings SET setting_value='PAID' WHERE setting_key=?").bind('ProgramAccess:'+scope.toUpperCase()).run();assert.equal((await join()).body.code,'LESSON_UNAVAILABLE');
 await core.prepare("UPDATE academy_settings SET setting_value='FREE' WHERE setting_key=?").bind('ProgramAccess:'+scope.toUpperCase()).run();ok(await join());
 await core.prepare('INSERT INTO website_platform_admissions VALUES(?,0) ON CONFLICT(account_id) DO UPDATE SET active=0').bind(accountId).run();assert.equal((await join()).status,401);await core.prepare('UPDATE website_platform_admissions SET active=1 WHERE account_id=?').bind(accountId).run();
 await core.prepare('UPDATE account_sessions SET revoked_at=? WHERE account_id=?').bind(new Date().toISOString(),accountId).run();assert.equal((await join()).status,401);
 assert.deepEqual((await core.prepare('SELECT * FROM role_assignments WHERE account_id=? ORDER BY assignment_id').bind(accountId).all()).results,roles.results);
 t.diagnostic(JSON.stringify({source:f.source.root,hostedActions:0,meetingsOpened:0,warmSourceQueries:0,paidAndOwnership:'current per click',rightsCreated:0,classLookup:'Existing accepted class query widened; no extra query, inherited accepted JSON expansion is not a flat full-route growth claim'}));
});
