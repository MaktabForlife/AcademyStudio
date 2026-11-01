import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './fixture.mjs';import {circlesFixture} from './circles-fixture.mjs';import {signIn,ok} from './access-fixture.mjs';import {studioFixture} from './studio-access-fixture.mjs';
const policy={accountSeconds:43200,adminSeconds:60,liveSeconds:43200};
test('ordinary staff reads use twelve-hour verification; writes, Join, expiry and current revocations retain their guards',{timeout:90000},async t=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY',verification:policy});try{
 await circlesFixture(f);const cookie=await signIn(f,'global'),actor=ok(await f.request('/api/me',{cookie})).accountId,old=Date.now()-11*3600000;
 await f.run('UPDATE accounts SET verified_at=? WHERE account_id=?',old,actor);await f.run('UPDATE source_access_people SET verified_at=? WHERE account_id=?',old,actor);
 f.source.resetMetrics();for(const path of ['/api/me','/api/websites','/api/websites/site-course','/api/websites/site-surah','/api/circles/access?website=site-course&website=site-surah','/api/admin/course'])ok(await f.request(path,{cookie}));assert.equal(f.source.metrics.queries,0);
 const write=await f.request('/api/admin/course',{cookie,method:'POST',body:{action:'participant',operationId:crypto.randomUUID(),accountId:actor,enrolled:true,live:true,purchased:true}});assert([401,409].includes(write.status));assert(['ADMIN_STATUS_EXPIRED','ACCESS_REFRESH_REQUIRED'].includes(write.body.code));
 const join=await f.request('/api/offerings/course/join',{cookie,method:'POST',body:{sessionId:'course-session'}});assert.equal(join.body.code,'ACCESS_REFRESH_REQUIRED');
 await f.run('INSERT INTO source_access_master_fences VALUES(?,?,?,?,?,?)',actor,'course',1,1,1,1);assert.equal((await f.request('/api/websites/site-course',{cookie})).body.code,'ACCESS_REFRESH_REQUIRED');await f.run('DELETE FROM source_access_master_fences WHERE account_id=?',actor);
 await f.run('UPDATE source_access_people SET verified_at=? WHERE account_id=?',Date.now()-13*3600000,actor);assert.equal((await f.request('/api/websites/site-course',{cookie})).body.code,'ACCESS_REFRESH_REQUIRED');
 await f.run('UPDATE source_access_people SET verified_at=? WHERE account_id=?',old,actor);await f.run('UPDATE accounts SET epoch=epoch+1 WHERE account_id=?',actor);assert.equal((await f.request('/api/websites/site-course',{cookie})).status,401);
 t.diagnostic(JSON.stringify({hostedRequests:0,ordinaryReadSourceQueries:0,readAgeHours:11,write:write.body.code,join:join.body.code}));
 }finally{await f.close();}
});
test('Participants reuses account/access proof without generating new events; saves refresh current authority and removed scope is denied',{timeout:90000},async t=>{
 const {f,x,good,proxy,handover}=await studioFixture();try{
 await handover();await good({action:'read'},{who:'adminA'});const actor=f.source.f.actors.adminA;
 const version=()=>x.db.prepare('SELECT version FROM website_platform_streams WHERE stream=?').bind('account:'+actor).first('version'),before=await version(),old=Date.now()-11*3600000;
 await f.run('UPDATE accounts SET verified_at=? WHERE account_id=?',old,actor);await f.run('UPDATE source_access_people SET verified_at=? WHERE account_id=?',old,actor);
 f.source.resetMetrics();const view=await good({action:'read',accountId:x.student},{who:'adminA'});const full={...f.source.metrics};assert.equal(await version(),before);assert.equal(await f.db.prepare('SELECT verified_at FROM accounts WHERE account_id=?').bind(actor).first('verified_at'),old);
 const reused=await good({action:'read',accountId:x.student,known:{revision:view.revision,after:'',accountId:x.student}},{who:'adminA'});assert.equal(reused.notModified,true);assert.equal(await version(),before);
 await good({action:'save',revision:view.revision,change:{action:'participant',operationId:crypto.randomUUID(),accountId:x.student,enrolled:false,live:false,purchased:true}},{who:'adminA'});assert((await version())>before);assert((await f.db.prepare('SELECT verified_at FROM accounts WHERE account_id=?').bind(actor).first('verified_at'))>old);
 await x.run("UPDATE role_assignments SET active=0 WHERE account_id=? AND activity_key=? AND role='PROGRAM_ADMIN'",actor,x.courseA);assert([401,403].includes((await proxy({action:'read'},{who:'adminA'})).status));
 t.diagnostic(JSON.stringify({hostedRequests:0,participantsRead:full,target:view.localReadBudget,knownRevisionTarget:reused.localReadBudget,manufacturedAccountEventsOnRead:0}));
 }finally{await f.close();}
});
