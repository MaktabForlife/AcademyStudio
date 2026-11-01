import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {random,challenge,sha256} from '../src/protocol.mjs';

const ok=result=>{assert.equal(result.status,200,JSON.stringify(result.body));return result.body;};
async function signIn(f,uniqueid){
 const verifier=random(),state=random(),ticket=ok(await f.request('/auth/login',{method:'POST',body:{uniqueid,pin:'1234',state,challenge:await challenge(verifier)}}));
 const result=await f.request('/auth/exchange',{method:'POST',body:{code:ticket.code,verifier,state}});ok(result);return result.response.headers.get('Set-Cookie').split(';')[0];
}
test('actual paired Workers connect native dashboard reference to Join and retain Source/Studio/session denials and private cache upgrade',async t=>{
 const f=await fixture({academy:true,dashboard:true,nativeJoinTest:true,authorityMode:'ACADEMY',navigation:{alimiyah:'programA',reboot:'programB'},verification:{accountSeconds:43200,adminSeconds:60,liveSeconds:43200}});t.after(()=>f.close());
 const cookie=await signIn(f,'login-0002'),accountId=ok(await f.request('/api/me',{cookie})).accountId;
 const load=()=>f.request('/api/circles/dashboard',{cookie,method:'POST',body:{mode:'learn'}}),dashboard=ok(await load());
 assert.equal(dashboard.nativeJoinVersion,1);assert(!JSON.stringify(dashboard).includes('zoom.'));
 const lesson=dashboard.timetable.find(row=>row.kind==='PROGRAM'&&row.nativeJoin&&row.joinAvailableAt<=Date.now()&&row.endsAt>Date.now());assert(lesson,'A real native audience must have a native Join reference');
 const input={mode:'learn',...lesson.nativeJoin};
 const joined=await f.request('/api/circles/lesson-join',{cookie,method:'POST',body:input});
 assert.match(ok(joined).joinUrl,/^https:\/\//);assert.equal(joined.response.headers.get('Cache-Control'),'private, no-store');assert.equal(Number(joined.response.headers.get('X-Local-D1-Rows-Written')),0);
 f.source.resetMetrics();assert.equal(ok(await load()).cached,true);assert.equal(f.source.metrics.queries,0,'Returning to a checked dashboard must not poll Academy');
 const key='private/dashboard/'+await sha256(accountId)+'/learn.json',saved=await (await f.content.get(key)).json();assert(!JSON.stringify(saved).includes('zoom.'));
 delete saved.dashboard.nativeJoinVersion;await f.content.put(key,JSON.stringify(saved));
 assert.equal(ok(await load()).cached,false,'An old native-reference shape upgrades once');f.source.resetMetrics();assert.equal(ok(await load()).cached,true);assert.equal(f.source.metrics.queries,0);
 const other=await signIn(f,'separation-studentB');assert.equal((await f.request('/api/circles/lesson-join',{cookie:other,method:'POST',body:input})).status,403);
 assert.equal((await f.request('/api/circles/lesson-join',{cookie,method:'POST',body:{...input,mode:'admin'}})).status,403);
 const core=await f.runtime.getD1Database('ACADEMY_DB','academy'),scope=lesson.kind+':'+lesson.activityId;
 await core.prepare("INSERT INTO website_platform_access_ownership(activity_key,state,updated_at) VALUES(?,'STUDIO',0)").bind(scope).run();
 const handed=await f.request('/api/circles/lesson-join',{cookie,method:'POST',body:input});assert.equal(handed.status,409);assert.equal(handed.body.code,'STUDIO_JOIN_REQUIRED');assert(!handed.body.joinUrl);
 await core.prepare("UPDATE website_platform_access_ownership SET state='ACADEMY' WHERE activity_key=?").bind(scope).run();
 await core.prepare('UPDATE account_sessions SET revoked_at=? WHERE account_id=?').bind(new Date().toISOString(),accountId).run();
 const revoked=await f.request('/api/circles/lesson-join',{cookie,method:'POST',body:input});assert.equal(revoked.status,401);assert(!revoked.body.joinUrl);
 t.diagnostic(JSON.stringify({source:f.source.root,targetQueries:joined.queries,targetRowsRead:joined.reads,scope:'actual paired click, not whole release/read-growth benchmark',hostedActions:0,meetingsOpened:0}));
});
