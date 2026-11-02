import {mkdirSync,writeFileSync} from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './fixture.mjs';import {accessFixture,signIn,ok} from './access-fixture.mjs';
test('actual Academy sign-in imports separate purchases, historical months/cohorts and website-only grants; source removals close authority',async()=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY'});try{
  const x=await accessFixture(f),cookie=await signIn(f);ok(await f.request('/api/websites/site-course',{cookie}));ok(await f.request('/api/websites/site-surah',{cookie}));
  assert.equal(await f.db.prepare('SELECT cohort FROM paid_months WHERE account_id=? AND offering_id=?').bind(x.student,'tafseer').first('cohort'),'historic-cohort');assert.equal(await f.db.prepare('SELECT completion_date FROM websites WHERE website_id=?').bind('site-surah').first('completion_date'),'2024-01-23');
  const grant=await signIn(f,'studentB');ok(await f.request('/api/websites/site-surah',{cookie:grant}));assert.equal(await f.db.prepare('SELECT count(*) n FROM paid_months WHERE account_id=?').bind(x.grant).first('n'),0);
  await x.run('UPDATE program_monthly_subscriptions SET active=0 WHERE activity_key=? AND account_id=?',x.programA,x.student);await x.run('UPDATE course_subscription_decisions SET active=0 WHERE activity_key=? AND account_id=?',x.courseA,x.student);await x.recover(8);
  assert.equal((await f.request('/api/websites/site-course',{cookie})).status,403);assert.equal((await f.request('/api/websites/site-surah',{cookie})).status,403);
  await x.run('DELETE FROM program_surah_grants WHERE activity_key=? AND account_id=?',x.programA,x.grant);await x.recover(4);assert.equal((await f.request('/api/websites/site-surah',{cookie:grant})).status,403);
 }finally{await f.close();}
});
test('parallel authority blocks raw administrative enrolment/grant/completion writes but preserves source-authorised website editing',async()=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY'});try{
  const x=await accessFixture(f),cookie=await signIn(f,'adminA');ok(await f.request('/api/websites/site-course/edit',{cookie}));f.source.resetMetrics();
  for(const action of ['participant','paid-months','staff','surah-grant','completion-month','completion-date','enrolment-decision','website-create','attachment']){const r=await f.request('/api/admin/course',{cookie,method:'POST',body:{action,operationId:crypto.randomUUID()}});assert.equal(r.status,409,JSON.stringify(r.body));assert.equal(r.body.code,'ACADEMY_AUTHORITY');}
  for(const action of ['provision','resume','enrol'])assert.equal((await f.request('/api/offerings/course/'+action,{cookie,method:'POST',body:{operationId:crypto.randomUUID()}})).body.code,'ACADEMY_AUTHORITY');assert.equal(f.source.metrics.queries,0);
  const draft=ok(await f.request('/api/websites/site-course/edit',{cookie}));ok(await f.request('/api/websites/site-course/edit',{cookie,method:'POST',body:{action:'save',operationId:crypto.randomUUID(),revision:draft.revision,document:draft.document}}));
  await x.run("UPDATE role_assignments SET active=0 WHERE activity_key=? AND account_id=?",x.courseA,f.source.f.actors.adminA);await x.recover(8);assert.equal((await f.request('/api/websites/site-course/edit',{cookie})).status,403);
 }finally{await f.close();}
});
test('a former participant retains historical purchases/months through actual Academy PIN sign-in while completed/live-withdrawn sessions remain closed',async()=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY'});try{
  const x=await accessFixture(f);await x.run('UPDATE role_assignments SET active=0 WHERE account_id=?',x.student);await x.run("UPDATE course_runs SET end_date='2020-01-01' WHERE activity_key=?",x.courseA);
  const cookie=await signIn(f);ok(await f.request('/api/websites/site-course',{cookie}));ok(await f.request('/api/websites/site-surah',{cookie}));
  const sessions=await f.db.prepare("SELECT session_id FROM timetable WHERE offering_id='course' AND cancelled=0 LIMIT 1").first();if(sessions)assert.equal((await f.request('/api/offerings/course/join',{cookie,method:'POST',body:{sessionId:sessions.session_id}})).status,403);
  assert.equal((await f.request('/api/offerings/tafseer/sessions',{cookie})).status,403);
 }finally{await f.close();}
});
test('a paid month without a recording cohort grants its Surah website only; class membership cannot join a different class',async()=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY'});try{
  const x=await accessFixture(f);await x.run("UPDATE program_monthly_subscriptions SET class_ids_json='[]' WHERE activity_key=? AND account_id=?",x.programA,x.student);
  const cookie=await signIn(f);ok(await f.request('/api/websites/site-surah',{cookie}));assert(ok(await f.request('/api/websites',{cookie})).websites.some(w=>w.website_id==='site-surah'));
  assert.equal(await f.db.prepare('SELECT count(*) n FROM paid_months WHERE account_id=?').bind(x.student).first('n'),0);
  await f.run("INSERT INTO objects VALUES('cohort-video',NULL,'video/youtube','Cohort recording',0,NULL,'abcdefghijk')");await f.run("INSERT INTO attachments VALUES('cohort-recording','tafseer','site-surah','cohort-video','lesson-id','2024-01-23','','Recording','RECORDING',1)");assert.equal((await f.request('/api/media/cohort-recording',{cookie})).status,403);
  for(const cls of ['class-a','class-b'])await x.run('INSERT INTO classes(activity_key,class_id,name,active) VALUES(?,?,?,1)',x.programA,cls,cls);
  await x.run("INSERT INTO class_memberships(activity_key,enrollment_id,class_id,account_id,active) VALUES(?,'membership-a','class-a',?,1)",x.programA,x.student);
  const snapshot={...x.weekly,rules:['class-a','class-b'].map((c,i)=>({...x.weekly.rules[0],id:'RULE-class-'+i,classIds:[c],moduleName:c}))};await x.run("INSERT INTO timetable_publications(activity_key,publication_id,scope_key,version_no,pattern,effective_from,timezone,snapshot_json,source_snapshot_sha256,conversion) VALUES(?,'class-publication',?,10001,'WEEKLY',?,'UTC',?,?,'EXACT')",x.programA,x.programA,x.today,JSON.stringify(snapshot),'f'.repeat(64));
  await x.recover(8);ok(await f.request('/auth/access',{cookie,method:'POST',body:{offeringId:'tafseer'}}));
  const sessions=ok(await f.request('/api/offerings/tafseer/sessions',{cookie})).sessions,a=sessions.find(s=>s.title==='class-a'&&s.starts_at<=Date.now()&&s.ends_at>Date.now()),b=sessions.find(s=>s.title==='class-b'&&s.starts_at<=Date.now()&&s.ends_at>Date.now());assert(a&&b);ok(await f.request('/api/offerings/tafseer/join',{cookie,method:'POST',body:{sessionId:a.session_id}}));assert.equal((await f.request('/api/offerings/tafseer/join',{cookie,method:'POST',body:{sessionId:b.session_id}})).body.code,'JOIN_AUDIENCE');
 }finally{await f.close();}
});
test('delayed access cannot restore suspended master authority; superseded retries fence only their old access version',async()=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY'});try{
  const x=await accessFixture(f),cookie=await signIn(f),old=await x.db.prepare('SELECT * FROM website_platform_outbox WHERE access_scope=? AND access_account=? ORDER BY version DESC LIMIT 1').bind(x.courseA,x.student).first();
  await x.run('UPDATE website_platform_outbox SET acknowledged=0,next_attempt=0 WHERE operation_id=?',old.operation_id);await x.run('UPDATE course_subscription_decisions SET active=0 WHERE activity_key=? AND account_id=?',x.courseA,x.student);await x.recover();assert.equal((await f.request('/api/websites/site-course',{cookie})).body.code,'ACCESS_REFRESH_REQUIRED');await x.recover(8);assert.equal((await f.request('/api/websites/site-course',{cookie})).status,403);
  const replay=await f.deliver(JSON.parse(old.event_json),{stream:old.stream,version:old.version,operationId:old.operation_id});assert.equal(replay.response.status,200);assert.equal(await f.db.prepare('SELECT purchased FROM participation WHERE account_id=? AND offering_id=?').bind(x.student,'course').first('purchased'),0);
  const global=f.source.f.actors.global,admin=await signIn(f,'global'),access=await x.db.prepare('SELECT * FROM website_platform_outbox WHERE access_scope=? AND access_account=? ORDER BY version DESC LIMIT 1').bind(x.courseA,global).first();await x.run('UPDATE accounts SET active=0 WHERE account_id=?',global);await x.run('INSERT INTO website_platform_admissions VALUES(?,0) ON CONFLICT(account_id) DO UPDATE SET active=0',global);await x.run('UPDATE global_role_assignments SET active=0 WHERE account_id=?',global);await x.run('UPDATE account_credentials SET credential_epoch=credential_epoch+1 WHERE account_id=?',global);await x.recover(12);
  const before=await f.db.prepare('SELECT active,admitted,global_admin,epoch,verified_at FROM accounts WHERE account_id=?').bind(global).first();assert.equal(before.active,0);assert.equal(before.global_admin,0);
  const event=JSON.parse(access.event_json),next=(await f.db.prepare('SELECT version FROM stream_heads WHERE stream=?').bind(access.stream).first('version'))+1;assert.equal((await f.deliver(event,{stream:access.stream,version:next})).response.status,200);assert.deepEqual(await f.db.prepare('SELECT active,admitted,global_admin,epoch,verified_at FROM accounts WHERE account_id=?').bind(global).first(),before);assert.equal((await f.request('/api/me',{cookie:admin})).status,401);
  assert.equal((await f.deliver(event,{stream:access.stream,version:next+2})).response.status,409);
 }finally{await f.close();}
});
test('checkpoint import and active sign-in stay bounded beside 4000 unrelated pending events and source rights',async t=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY',academyApiOrigin:'https://academy-api.test'});try{
  const x=await accessFixture(f),{importAccessPage,queueAccess}=await import('file://'+f.source.root+'/backend/src/academy/d1/web-platform/access.mjs');
  await signIn(f);f.source.resetMetrics();await signIn(f);const baseline={...f.source.metrics};
  const ids=JSON.stringify(Array.from({length:4000},(_,i)=>'pending-unrelated-'+i));await x.run("INSERT INTO accounts(account_id,display_name,login_link_id,active,revision) SELECT value,value,value,1,1 FROM json_each(?)",ids);await x.run('INSERT INTO account_credentials(account_id,pin_setup,credential_epoch) SELECT value,0,1 FROM json_each(?)',ids);
  await x.run("INSERT INTO role_assignments(assignment_id,account_id,activity_key,role,active,review_state) SELECT value,value,?,'STUDENT',1,'CONFIRMED' FROM json_each(?)",x.courseA,ids);
  await x.run("INSERT INTO website_platform_outbox(operation_id,stream,version,event_json) SELECT 'operation-'||value,'account:'||value,1,'{}' FROM json_each(?)",ids);
  f.source.resetMetrics();const cookie=await signIn(f),scaled={...f.source.metrics};assert(scaled.rowsRead<baseline.rowsRead+250,JSON.stringify({baseline,scaled,large:f.source.statements.filter(s=>s.rowsRead>100)}));assert(f.source.statements.every(s=>s.rowsRead<250),JSON.stringify(f.source.statements.filter(s=>s.rowsRead>=250)));
  // Initial phase extraction is explicitly scoped, keyset-paged and checkpointed.
  const a=await importAccessPage(x.db,{activityKey:x.courseA,limit:5});assert(a.records<=5);const checkpoint=await x.db.prepare('SELECT cursor FROM website_platform_access_imports WHERE activity_key=? AND dataset=?').bind(x.courseA,a.dataset).first('cursor');assert.equal(checkpoint,a.cursor);
  // A role change between projection reads and its guarded outbox commit wins.
  await x.run('UPDATE role_assignments SET active=1 WHERE account_id=? AND activity_key=?',f.source.f.actors.adminA,x.courseA);const session=x.db.withSession('first-primary');let raced=false;await queueAccess({prepare:sql=>session.prepare(sql),async batch(statements){if(!raced){raced=true;await x.run('UPDATE role_assignments SET active=0 WHERE account_id=? AND activity_key=?',f.source.f.actors.adminA,x.courseA);}return session.batch(statements);}},{onlyScope:x.courseA,onlyAccount:f.source.f.actors.adminA});assert(raced);assert.equal(await x.db.prepare('SELECT next_attempt FROM website_platform_access_dirty WHERE activity_key=? AND account_id=?').bind(x.courseA,f.source.f.actors.adminA).first('next_attempt'),0);
  f.source.resetMetrics();ok(await f.request('/api/websites/site-course',{cookie}));assert.equal(f.source.metrics.queries,0);const evidence={baseline,after4000PendingAndRights:scaled,checkpoint:a};mkdirSync('outputs',{recursive:true});writeFileSync('outputs/parallel-access-reads.json',JSON.stringify(evidence,null,2)+'\n');t.diagnostic(JSON.stringify(evidence));
 }finally{await f.close();}
});
test('expired access fails closed and one status refresh renews the current account projection; oversized authority cannot retain old grants',async()=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY',verification:{accountSeconds:43200,adminSeconds:60,liveSeconds:43200}});try{
  const x=await accessFixture(f),cookie=await signIn(f,'adminA');await f.run('UPDATE source_access_people SET verified_at=? WHERE account_id=?',Date.now()-61_000,f.source.f.actors.adminA);
  ok(await f.request('/api/websites/site-course/edit',{cookie}));
  assert.equal((await f.request('/api/websites/site-course/edit',{cookie,method:'POST',body:{operationId:crypto.randomUUID(),action:'save',revision:0,document:f.doc}})).body.code,'ACCESS_REFRESH_REQUIRED','Sensitive changes retain the sixty-second scope requirement');
  await f.run('UPDATE source_access_people SET verified_at=? WHERE account_id=?',Date.now()-43200_001,f.source.f.actors.adminA);
  assert.equal((await f.request('/api/websites/site-course/edit',{cookie})).body.code,'ACCESS_REFRESH_REQUIRED');ok(await f.request('/auth/access',{cookie,method:'POST',body:{}}));ok(await f.request('/api/websites/site-course/edit',{cookie}));
  const learner=await signIn(f);await x.run('UPDATE program_monthly_subscriptions SET class_ids_json=? WHERE activity_key=? AND account_id=?',JSON.stringify(Array.from({length:101},(_,i)=>'oversized-cohort-'+i)),x.programA,x.student);await x.recover(8);assert.equal((await f.request('/api/websites/site-surah',{cookie:learner})).body.code,'ACCESS_REFRESH_REQUIRED');assert.equal(await f.db.prepare('SELECT ready FROM source_access_people WHERE account_id=? AND offering_id=?').bind(x.student,'tafseer').first('ready'),0);
 }finally{await f.close();}
});
test('reactivation fences earlier generations and reconciles changes made while capture was off',async()=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY'});try{
  const x=await accessFixture(f),cookie=await signIn(f),oldGeneration=await f.db.prepare("SELECT generation FROM source_access_scopes WHERE offering_id='course'").first('generation');
  await x.run('UPDATE website_platform_control SET enabled=0');await x.run('UPDATE course_subscription_decisions SET active=0 WHERE account_id=? AND activity_key=?',x.student,x.courseA);await x.run('UPDATE website_platform_control SET enabled=1');await x.recover();
  assert((await f.db.prepare("SELECT generation FROM source_access_scopes WHERE offering_id='course'").first('generation'))>oldGeneration);const blocked=await f.request('/api/websites/site-course',{cookie});assert.notEqual(blocked.status,200);ok(await f.request('/auth/access',{cookie,method:'POST',body:{}}));assert.equal((await f.request('/api/websites/site-course',{cookie})).status,403);
 }finally{await f.close();}
});
test('background baseline/recovery without any prior sign-in delivers scope before people with no failed deliveries',async()=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY'});try{
  const x=await accessFixture(f);await x.recover(24);
  assert.equal(await x.db.prepare("SELECT count(*) n FROM website_platform_outbox WHERE attempts<>0").first('n'),0);
  assert.equal(await x.db.prepare('SELECT count(*) n FROM website_platform_access_imports WHERE done=0').first('n'),0);
  assert.equal(await x.db.prepare('SELECT count(*) n FROM website_platform_access_dirty WHERE revision<>exported_revision OR last_error IS NOT NULL').first('n'),0);
  assert.equal(await f.db.prepare('SELECT purchased FROM participation WHERE account_id=? AND offering_id=?').bind(x.student,'course').first('purchased'),1);assert.equal(await f.db.prepare('SELECT count(*) n FROM sessions WHERE source_ref IS NOT NULL').first('n'),0);
 }finally{await f.close();}
});
