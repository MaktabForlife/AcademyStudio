import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
const ok=result=>{assert.equal(result.status,200,JSON.stringify(result.body));return result.body;};
test('public views use no D1 and one Academy handoff establishes an account-bound session',async()=>{
 const f=await fixture();try{
  const home=await f.request('/api/public/home');ok(home);assert.equal(home.reads,0);assert.equal(home.queries,0);assert(!JSON.stringify(home.body).includes('zoom.us'));
  const connection=await f.login();assert(connection.cookie.startsWith('__Host-maktab_web='));assert.equal(ok(await f.request('/api/me',{cookie:connection.cookie})).accountId,'learner');
  assert.equal((await f.request('/auth/exchange',{method:'POST',body:{code:connection.code,verifier:connection.verifier,state:connection.state}})).status,401);
  assert.equal((await f.request('/api/me')).status,401);
  const csrf=await f.request('/auth/logout',{cookie:connection.cookie,method:'POST',body:{},headers:{Origin:'https://attacker.test'}});assert.equal(csrf.status,403);
  ok(await f.request('/auth/logout',{cookie:connection.cookie,method:'POST',body:{}}));assert.equal((await f.request('/api/me',{cookie:connection.cookie})).status,401);
 }finally{await f.close();}
});
test('whole Course purchase survives withdrawal while live joining requires a separate current right',async()=>{
 const f=await fixture();try{
  const former=(await f.login('former')).cookie,learner=(await f.login()).cookie,outsider=(await f.login('outsider')).cookie;
  ok(await f.request('/api/websites/site-course',{cookie:former}));assert.equal((await f.request('/api/offerings/course/join',{cookie:former,method:'POST',body:{sessionId:'course-session'}})).status,403);
  assert.equal((await f.request('/api/websites/site-course',{cookie:outsider})).status,403);
  const cards=ok(await f.request('/api/offerings/course/sessions',{cookie:learner}));assert(!JSON.stringify(cards).includes('zoom'));
  const join=ok(await f.request('/api/offerings/course/join',{cookie:learner,method:'POST',body:{sessionId:'course-session'}}));assert(join.destination.includes('zoom.us'));
  await f.run("UPDATE timetable SET cancelled=1 WHERE session_id='course-session'");assert.equal((await f.request('/api/offerings/course/join',{cookie:learner,method:'POST',body:{sessionId:'course-session'}})).status,403);
 }finally{await f.close();}
});
test('Tafseer paid month and website-only grants preserve distinct material and recording gates',async()=>{
 const f=await fixture();try{
  const former=(await f.login('former')).cookie,grant=(await f.login('grant-only')).cookie;
  ok(await f.request('/api/websites/site-surah',{cookie:former}));ok(await f.request('/api/websites/site-surah',{cookie:grant}));
  const data=new TextEncoder().encode('%PDF-1.7 synthetic recording note');await f.media.put('retained/note',data);
  await f.run("INSERT INTO objects VALUES('note','retained/note','application/pdf','Historic note.pdf',?,'synthetic',NULL)",data.length);
  await f.run("INSERT INTO attachments VALUES('historic-note','tafseer',NULL,'note','historic-lesson','2024-01-12','historic-cohort','Historic PDF','RECORDING',1)");
  assert.equal((await f.request('/api/media/historic-note',{cookie:former})).status,200);assert.equal((await f.request('/api/media/historic-note',{cookie:grant})).status,403);
  const partial=await f.request('/api/media/historic-note',{cookie:former,headers:{Range:'bytes=0-4'}});assert.equal(partial.status,206);assert.equal(new TextDecoder().decode(partial.body),'%PDF-');
  await f.run("DELETE FROM paid_months WHERE account_id='former'");assert.equal((await f.request('/api/media/historic-note',{cookie:former})).status,403);assert.equal((await f.request('/api/websites/site-surah',{cookie:former})).status,403);
  ok(await f.request('/api/websites/site-surah',{cookie:grant}));await f.run("UPDATE websites SET enabled=0 WHERE website_id='site-surah'");assert.equal((await f.request('/api/websites/site-surah',{cookie:grant})).status,404);
 }finally{await f.close();}
});
test('R2 saves preserve the published edition, retries and stale-save conflicts; staff removal is immediate',async()=>{
 const f=await fixture();try{
  const admin=(await f.login('admin')).cookie,learner=(await f.login()).cookie;
  const draft=ok(await f.request('/api/websites/site-course/edit',{cookie:admin}));draft.document.name='Private updated draft';const save={operationId:crypto.randomUUID(),action:'save',revision:0,document:draft.document};
  const saved=ok(await f.request('/api/websites/site-course/edit',{cookie:admin,method:'POST',body:save}));assert.equal(saved.revision,1);assert.equal(ok(await f.request('/api/websites/site-course',{cookie:learner})).document.name,f.doc.name);
  assert.equal(ok(await f.request('/api/websites/site-course/edit',{cookie:admin,method:'POST',body:save})).replayed,true);
  assert.equal((await f.request('/api/websites/site-course/edit',{cookie:admin,method:'POST',body:{...save,operationId:crypto.randomUUID()}})).status,409);
  ok(await f.request('/api/websites/site-course/edit',{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'publish',revision:1}}));assert.equal(ok(await f.request('/api/websites/site-course',{cookie:learner})).document.name,'Private updated draft');
  const teacher=(await f.login('teacher')).cookie;assert.equal((await f.request('/api/admin/course',{cookie:teacher})).status,403);
  await f.run("UPDATE accounts SET active=0 WHERE account_id='admin'");assert.equal((await f.request('/api/websites/site-course/edit',{cookie:admin})).status,401);
 }finally{await f.close();}
});
test('signed deliveries reject forgery, version gaps, replay changes and stale master status',async()=>{
 const f=await fixture();try{
  const learner=(await f.login()).cookie;
  const forged=await f.request('/internal/academy/events',{method:'POST',body:{issuedAt:Date.now()},headers:{'X-Maktab-Signature':'0'.repeat(64)}});assert.equal(forged.status,401);
  const account={accountId:'learner',displayName:'Synthetic learner',active:false,admitted:true,epoch:2,verifiedAt:Date.now(),globalAdmin:false};
  const gap=await f.deliver({type:'account',account},{version:4});assert.equal(gap.response.status,409);
  const delivered=await f.deliver({type:'account',account});assert.equal(delivered.response.status,200);assert.equal((await f.request('/api/me',{cookie:learner})).status,401);
  const replay=await f.deliver({type:'account',account},{operationId:delivered.value.operationId,version:delivered.value.version});assert.equal(replay.body.replayed,true);
  const conflict=await f.deliver({type:'account',account:{...account,active:true}},{operationId:delivered.value.operationId,version:delivered.value.version});assert.equal(conflict.response.status,409);
  const former=(await f.login('former')).cookie;await f.run("UPDATE accounts SET verified_at=? WHERE account_id='former'",Date.now()-86400_001);assert.equal((await f.request('/api/me',{cookie:former})).status,401);
 }finally{await f.close();}
});
