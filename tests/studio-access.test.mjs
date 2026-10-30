import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {accessFixture,signIn,ok} from './access-fixture.mjs';

test('Studio access proxy uses the current native Academy Admin session', {timeout:60000}, async t=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY',verification:{accountSeconds:43200,adminSeconds:60,liveSeconds:43200}});try{
  const x=await accessFixture(f);await x.recover(25);
  const r=await f.runtime.dispatchFetch('https://academy.test/api/account/login',{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json'},body:JSON.stringify({uniqueid:'separation-global',pin:'1234'})});
  const login=await r.json();assert.equal(r.status,200,JSON.stringify(login));assert(login.token);
  const proxy=async(command,other={})=>{const reply=await f.runtime.dispatchFetch('https://academy.test/api/admin/platform/studio-access',{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json',Authorization:'Bearer '+login.token,'X-Academy-Workspace':'ADMIN',...other.headers},body:JSON.stringify({activityKey:x.courseA,command,...other.body})});return {status:reply.status,body:await reply.json()};};
  const view=await proxy({action:'read'});assert.equal(view.status,200,JSON.stringify(view.body));assert.equal(view.body.ownership.authority,'ACADEMY');
  const denied=await proxy({action:'save',revision:view.body.revision,change:{action:'participant',operationId:crypto.randomUUID(),accountId:x.student,enrolled:true,live:true,purchased:true}});assert.equal(denied.body.code,'ACADEMY_AUTHORITY');
  assert.equal((await proxy({action:'read'},{headers:{Origin:'https://evil.test'}})).status,403);
 }finally{await f.close();}
});

import {studioFixture} from './studio-access-fixture.mjs';
test('guarded offering handover preserves purchases, rejects old writes, and makes batched Studio Save authoritative',{timeout:60000},async t=>{
 const {f,x,good,proxy,handover}=await studioFixture();try{
  await assert.rejects(f.run("UPDATE source_access_scopes SET authority='WEBSITE' WHERE offering_id='course'"),/GUARDED_HANDOVER/);
  const transfer=await handover();assert.equal(await x.db.prepare('SELECT state FROM website_platform_access_ownership WHERE activity_key=?').bind(x.courseA).first('state'),'STUDIO');
  await assert.rejects(x.run('UPDATE course_subscription_decisions SET active=0 WHERE activity_key=? AND account_id=?',x.courseA,x.student),/STUDIO_ACCESS_MANAGED/);
  const view=await good({action:'read',accountId:x.student});assert.equal(view.person.purchased,1);assert.equal(view.canChangeStaff,false);
  const command={action:'save',revision:view.revision,change:{action:'access-batch',operationId:crypto.randomUUID(),changes:[{action:'participant',accountId:x.student,enrolled:false,live:false,purchased:true,cohort:''}]}};
  const saved=await good(command);assert.equal(saved.saved,true);assert.equal((await good(command)).replayed,true);
  assert.equal((await proxy({...command,change:{...command.change,changes:[{...command.change.changes[0],purchased:false,reason:'Explicit conflicting retry'}]}})).body.code,'RETRY_CONFLICT');
  const late=JSON.parse(await x.db.prepare("SELECT event_json FROM website_platform_outbox WHERE access_scope=? AND access_account=? ORDER BY version DESC LIMIT 1").bind(x.courseA,x.student).first('event_json'));late.participation.enrolled=true;late.participation.live=true;late.participation.purchased=false;
  const stream=(await import('../src/protocol.mjs')).sha256;const key='access:'+await stream(JSON.stringify(['course',x.student.toLowerCase()]));const nextVersion=(await f.db.prepare('SELECT version FROM stream_heads WHERE stream=?').bind(key).first('version'))+1;await x.run('UPDATE website_platform_streams SET version=? WHERE stream=?',nextVersion,key);assert.equal((await f.deliver(late,{stream:key,version:nextVersion})).response.status,200);
  const retained=await f.db.prepare('SELECT enrolled,live,purchased FROM participation WHERE account_id=? AND offering_id=\'course\'').bind(x.student).first();assert.deepEqual(retained,{enrolled:0,live:0,purchased:1});
  const cookie=await signIn(f);f.source.resetMetrics();ok(await f.request('/api/websites/site-course',{cookie}));assert.equal(f.source.metrics.queries,0);
  assert.equal((await proxy({action:'handover-abort',transferId:transfer})).body.code,'HANDOVER_COMMITTED');
  t.diagnostic('Final source write fence and late source delivery both preserved the Studio purchase.');
 }finally{await f.close();}
});

test('Tafseer handover keeps original cohorts, Surah-only grants and live class/date gates',{timeout:60000},async()=>{
 const {f,x,good,proxy,handover}=await studioFixture();try{
  for(const cls of ['class-a','class-b'])await x.run('INSERT INTO classes(activity_key,class_id,name,active) VALUES(?,?,?,1)',x.programA,cls,cls);
  await x.run("INSERT INTO class_memberships(activity_key,enrollment_id,class_id,account_id,active) VALUES(?,'studio-membership','class-a',?,1)",x.programA,x.student);
  const snapshot={...x.weekly,rules:['class-a','class-b'].map((c,i)=>({...x.weekly.rules[0],id:'RULE-studio-'+i,classIds:[c],moduleName:c}))};await x.run("INSERT INTO timetable_publications(activity_key,publication_id,scope_key,version_no,pattern,effective_from,timezone,snapshot_json,source_snapshot_sha256,conversion) VALUES(?,'studio-class-publication',?,10001,'WEEKLY',?,'UTC',?,?,'EXACT')",x.programA,x.programA,x.today,JSON.stringify(snapshot),'f'.repeat(64));await x.recover(10);
  await handover(x.programA);const cookie=await signIn(f),grant=await signIn(f,'studentB');
  const row=await good({action:'read',accountId:x.student},{activity:x.programA});assert.equal(row.person.months[0].cohort,'historic-cohort');
  await f.run("INSERT INTO objects VALUES('studio-video',NULL,'video/youtube','Historic recording',0,NULL,'abcdefghijk')");await f.run("INSERT INTO attachments VALUES('studio-recording','tafseer','site-surah','studio-video','lesson-id','2024-01-23','historic-cohort','Recording','RECORDING',1)");
  ok(await f.request('/api/media/studio-recording',{cookie}));ok(await f.request('/api/websites/site-surah',{cookie:grant}));assert.equal((await f.request('/api/media/studio-recording',{cookie:grant})).status,403);
  const sessions=ok(await f.request('/api/offerings/tafseer/sessions',{cookie})).sessions,a=sessions.find(s=>s.title==='class-a'&&s.starts_at<=Date.now()&&s.ends_at>Date.now()),b=sessions.find(s=>s.title==='class-b'&&s.starts_at<=Date.now()&&s.ends_at>Date.now());assert(a&&b);
  ok(await f.request('/api/offerings/tafseer/join',{cookie,method:'POST',body:{sessionId:a.session_id}}));assert.equal((await f.request('/api/offerings/tafseer/join',{cookie,method:'POST',body:{sessionId:b.session_id}})).body.code,'JOIN_AUDIENCE');
  const changes=[{accountId:x.student,month:'2024-02',cohort:'historic-cohort',paid:true,reason:'Second acquired month'},{accountId:x.student,month:'2024-03',cohort:'different-original-class',paid:true,reason:'Third acquired month'}];
  const v=await good({action:'read',accountId:x.student},{activity:x.programA});await good({action:'save',revision:v.revision,change:{action:'paid-months',operationId:crypto.randomUUID(),changes}},{activity:x.programA});
  assert.equal((await proxy({action:'save',revision:v.revision,change:{action:'paid-months',operationId:crypto.randomUUID(),changes}},{activity:x.programA})).body.code,'CHANGE_CONFLICT');
  await x.run('UPDATE class_memberships SET end_date=? WHERE activity_key=? AND account_id=?','2000-01-01',x.programA,x.student);await x.recover(6);assert.equal((await f.request('/api/offerings/tafseer/join',{cookie,method:'POST',body:{sessionId:a.session_id}})).status,403);ok(await f.request('/api/media/studio-recording',{cookie}));
  await x.run('UPDATE accounts SET active=0 WHERE account_id=?',x.student);await x.recover(8);assert.equal((await f.request('/api/media/studio-recording',{cookie})).status,401);
 }finally{await f.close();}
});

test('Admin access denies forged scope, learner/teacher roles and atomically changed authority',{timeout:60000},async()=>{
 const {f,x,proxy,good,handover}=await studioFixture();try{
  assert.equal((await proxy({action:'read'},{who:'teacherA',extra:{actorId:'sep-global',globalAdmin:true}})).status,403);
  assert.equal((await proxy({action:'read'},{who:'studentA',extra:{actorId:'sep-global',globalAdmin:true}})).status,403);
  assert.equal((await proxy({action:'read'},{who:'adminB',activity:x.courseA,extra:{offeringId:'tafseer',role:'ADMIN'}})).status,403);
  await handover();assert.equal((await proxy({action:'read'},{who:'adminA'})).status,200);
  assert.equal((await proxy({action:'read'},{headers:{'X-Academy-Workspace':'LEARN'}})).status,403);
  const editor=await signIn(f,'adminA');ok(await f.request('/api/websites/site-course/edit',{cookie:editor}));
  const v=await good({action:'read',accountId:x.student},{who:'adminA'});await x.run("UPDATE role_assignments SET active=0 WHERE account_id=? AND activity_key=? AND role='PROGRAM_ADMIN'",f.source.f.actors.adminA,x.courseA);
  assert([401,403].includes((await proxy({action:'save',revision:v.revision,change:{action:'participant',operationId:crypto.randomUUID(),accountId:x.student,enrolled:false,live:false,purchased:true}},{who:'adminA'})).status));
  await x.recover(8);assert.equal((await f.request('/api/websites/site-course/edit',{cookie:editor})).status,403);
  assert.equal(await f.db.prepare('SELECT purchased FROM participation WHERE account_id=? AND offering_id=\'course\'').bind(x.student).first('purchased'),1);
 }finally{await f.close();}
});

test('bounded Admin pages, empty cache reuse and batched Save stay bounded beside 4000 unrelated rights',{timeout:60000},async t=>{
 const {f,x,good,handover}=await studioFixture();try{
  await handover();const sample=async()=>{f.source.resetMetrics();const full=await good({action:'read',accountId:x.student});const source={...f.source.metrics};const empty=await good({action:'read',accountId:'sep-teacher-a'});assert.equal(empty.person.months.length,0);const reused=await good({action:'read',accountId:'sep-teacher-a',known:{revision:empty.revision,after:'',accountId:'sep-teacher-a'}});assert.equal(reused.notModified,true);return {full:{source,target:full.localReadBudget},empty:empty.localReadBudget,reused:reused.localReadBudget};};
  const baseline=await sample(),ids=JSON.stringify(Array.from({length:4000},(_,i)=>'zz-access-unrelated-'+String(i).padStart(5,'0')));
  await f.run("INSERT INTO accounts SELECT value,value,1,1,1,?,0 FROM json_each(?)",Date.now(),ids);await f.run("INSERT INTO participation SELECT value,'course',1,0,1,'' FROM json_each(?)",ids);await f.run("INSERT INTO paid_months SELECT value,'tafseer','2024-01','historic-cohort','fixture' FROM json_each(?)",ids);await f.run("INSERT INTO operations SELECT value,'unrelated',value,'{}',? FROM json_each(?)",Date.now(),ids);
  await x.run('INSERT INTO accounts(account_id,display_name,login_link_id,active,revision) SELECT value,value,value,1,1 FROM json_each(?)',ids);await x.run('INSERT INTO account_credentials(account_id,pin_setup,credential_epoch) SELECT value,0,1 FROM json_each(?)',ids);await x.run("INSERT INTO role_assignments(assignment_id,account_id,activity_key,role,active,review_state) SELECT value,value,?,'STUDENT',1,'CONFIRMED' FROM json_each(?)",f.source.f.scopes.courseB,ids);
  const scaled=await sample();assert(scaled.full.source.rowsRead<=baseline.full.source.rowsRead+250,JSON.stringify({baseline,scaled}));assert(scaled.full.target.targetRowsRead<350,JSON.stringify(scaled));assert(scaled.reused.targetRowsRead<scaled.empty.targetRowsRead);
  const cookie=await signIn(f);f.source.resetMetrics();ok(await f.request('/api/websites/site-course',{cookie}));assert.equal(f.source.metrics.queries,0);
  const v=await good({action:'read'});f.source.resetMetrics();const save=await good({action:'save',revision:v.revision,change:{action:'access-batch',operationId:crypto.randomUUID(),changes:JSON.parse(ids).slice(0,20).map(accountId=>({action:'participant',accountId,enrolled:false,live:false,purchased:true}))}});const batchSave={source:{...f.source.metrics},target:save.localReadBudget,edits:20};assert(batchSave.source.queries<50);assert(batchSave.target.targetRowsRead<700);
  const evidence={batchSave,baseline,after4000Unrelated:scaled,ordinaryReadingAcademyQueries:0,scope:'Synthetic native source and target D1 rows, including source account/role verification, outbox, acknowledgements and target session/authority checks.'};
  const {mkdirSync,writeFileSync}=await import('node:fs');mkdirSync('outputs',{recursive:true});writeFileSync('outputs/studio-access-reads.json',JSON.stringify(evidence,null,2)+'\n');t.diagnostic(JSON.stringify(evidence));
 }finally{await f.close();}
});

test('partial identity success survives an enrolment failure and exact retry creates no duplicate',{timeout:60000},async()=>{
 const {f,x,good,proxy,handover}=await studioFixture();try{
  await handover();const operationId=crypto.randomUUID(),name='Synthetic identity preserved on enrolment retry';await good({action:'provision',input:{operationId,displayName:name}},{who:'adminA'});
  await f.run("CREATE TRIGGER local_enrol_failure BEFORE INSERT ON participation WHEN NEW.account_id NOT IN(SELECT account_id FROM participation) BEGIN SELECT RAISE(ABORT,'LOCAL_ENROL_FAILURE'); END");
  const failed=await proxy({action:'resume',input:{jobId:operationId}},{who:'adminA'});assert.equal(failed.status,409,JSON.stringify(failed.body));
  const job=await f.db.prepare('SELECT account_id,state FROM provisioning WHERE operation_id=?').bind(operationId).first();assert.equal(job.state,'IDENTITY_LINKED');assert(job.account_id);assert.equal(await x.db.prepare('SELECT count(*) n FROM accounts WHERE display_name=?').bind(name).first('n'),1);
  await f.run('DROP TRIGGER local_enrol_failure');const complete=await good({action:'resume',input:{jobId:operationId}},{who:'adminA'});assert.equal(complete.accountId,job.account_id);assert.equal(complete.state,'COMPLETE');assert.equal((await good({action:'resume',input:{jobId:operationId}},{who:'adminA'})).accountId,job.account_id);
  assert.equal(await x.db.prepare('SELECT count(*) n FROM accounts WHERE display_name=?').bind(name).first('n'),1);assert.equal(await f.db.prepare('SELECT purchased FROM participation WHERE account_id=? AND offering_id=\'course\'').bind(job.account_id).first('purchased'),0);
 }finally{await f.close();}
});

test('an incomplete handover can be aborted safely and scope loss cannot commit the prepared transfer',{timeout:60000},async()=>{
 const {f,x,good,proxy}=await studioFixture();try{
  const transferId=crypto.randomUUID();await good({action:'handover-start',transferId});assert.equal((await proxy({action:'handover-commit',transferId})).body.code,'HANDOVER_PENDING');
  assert.equal((await good({action:'handover-abort',transferId})).state,'ACADEMY');await x.run('UPDATE course_subscription_decisions SET active=1 WHERE activity_key=? AND account_id=?',x.courseA,x.student);
  const second=crypto.randomUUID();await good({action:'handover-start',transferId:second});for(let i=0;i<9;i++){await good({action:'handover-reconcile',transferId:second});await x.recover(6);}await good({action:'handover-page',transferId:second});
  await x.run('UPDATE global_role_assignments SET active=0 WHERE account_id=?',f.source.f.actors.global);await x.recover(8);
  assert([401,403].includes((await proxy({action:'handover-commit',transferId:second})).status));assert.equal(await f.db.prepare("SELECT authority FROM source_access_scopes WHERE offering_id='course'").first('authority'),'ACADEMY');assert.equal(await x.db.prepare('SELECT state FROM website_platform_access_ownership WHERE activity_key=?').bind(x.courseA).first('state'),'FROZEN');
 }finally{await f.close();}
});

test('handover retains twelve-hour learner proofs, sensitive staff expiry and source session tombstones',{timeout:60000},async()=>{
 const {f,x,good,proxy,handover}=await studioFixture();try{
  await handover();const learner=await signIn(f),editor=await signIn(f,'adminA');const sourceRef=await f.db.prepare('SELECT source_ref FROM sessions WHERE account_id=? AND token_hash LIKE ? LIMIT 1').bind(f.source.f.actors.adminA,'%').first('source_ref');
  await f.run('UPDATE source_access_people SET verified_at=? WHERE account_id=?',Date.now()-61_000,f.source.f.actors.adminA);assert.equal((await f.request('/api/websites/site-course/edit',{cookie:editor})).body.code,'ACCESS_REFRESH_REQUIRED');
  await f.run('UPDATE accounts SET verified_at=? WHERE account_id=?',Date.now()-11*3600_000,x.student);f.source.resetMetrics();ok(await f.request('/api/websites/site-course',{cookie:learner}));assert.equal(f.source.metrics.queries,0);
  await f.run('UPDATE source_access_people SET verified_at=? WHERE account_id=?',Date.now()-13*3600_000,x.student);assert.equal((await f.request('/api/offerings/course/join',{cookie:learner,method:'POST',body:{sessionId:'course-session'}})).body.code,'ACCESS_REFRESH_REQUIRED');ok(await f.request('/api/websites/site-course',{cookie:learner}));
  await f.run('UPDATE accounts SET verified_at=? WHERE account_id=?',Date.now()-13*3600_000,x.student);assert.equal((await f.request('/api/websites/site-course',{cookie:learner})).body.code,'STATUS_EXPIRED');
  await good({action:'read'},{who:'adminA'});const bridgeRef=await f.db.prepare("SELECT source_ref FROM sessions WHERE account_id=? AND expires_at<? ORDER BY expires_at DESC LIMIT 1").bind(f.source.f.actors.adminA,Date.now()+60_000).first('source_ref');assert(bridgeRef);
  assert.equal((await f.deliver({type:'session-revoked',sourceRef:bridgeRef},{stream:'session:'+bridgeRef})).response.status,200);await f.run('DELETE FROM sessions WHERE source_ref=?',bridgeRef);
  assert.equal((await proxy({action:'read'},{who:'adminA'})).status,401);assert.equal(await f.db.prepare('SELECT count(*) n FROM source_session_revocations WHERE source_ref=?').bind(bridgeRef).first('n'),1);
  assert(sourceRef);
 }finally{await f.close();}
});

test('unknown identity outcome resumes its existing master account after the Admin signs in with a new epoch',{timeout:60000},async()=>{
 const {f,x,good,handover}=await studioFixture();try{
  await handover();const operationId=crypto.randomUUID(),name='Synthetic unknown identity outcome';await good({action:'provision',input:{operationId,displayName:name}});
  const job=await f.db.prepare('SELECT command_json FROM provisioning WHERE operation_id=?').bind(operationId).first(),sourceRef=await f.db.prepare('SELECT source_ref FROM sessions WHERE account_id=? AND expires_at<? ORDER BY expires_at DESC LIMIT 1').bind(f.source.f.actors.global,Date.now()+60_000).first('source_ref');
  const {signedHeaders}=await import('../src/protocol.mjs'),path='/internal/website/identity',signed=await signedHeaders(f.env.WEBSITE_TO_ACADEMY_SECRET,path,{...JSON.parse(job.command_json),sourceRef,issuedAt:Date.now()}),created=await f.runtime.dispatchFetch('https://academy.test'+path,{method:'POST',headers:signed.headers,body:signed.payload});assert.equal(created.status,200);await created.body.cancel();
  await x.run('UPDATE account_credentials SET credential_epoch=credential_epoch+1 WHERE account_id=?',f.source.f.actors.global);
  const r=await f.runtime.dispatchFetch('https://academy.test/api/account/login',{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json'},body:JSON.stringify({uniqueid:'separation-global',pin:'1234'})}),fresh=await r.json();assert.equal(r.status,200,JSON.stringify(fresh));
  const complete=await good({action:'resume',input:{jobId:operationId}},{headers:{Authorization:'Bearer '+fresh.token}});assert.equal(complete.state,'COMPLETE');assert.equal(await x.db.prepare('SELECT count(*) n FROM accounts WHERE display_name=?').bind(name).first('n'),1);assert.equal(await f.db.prepare('SELECT purchased FROM participation WHERE account_id=? AND offering_id=\'course\'').bind(complete.accountId).first('purchased'),0);
 }finally{await f.close();}
});

test('new Studio Tafseer enrolment receives an Academy class/date allocation without a duplicate Student authority',{timeout:60000},async()=>{
 const {f,x,good,proxy,handover}=await studioFixture();try{
  for(const cls of ['new-class-a','new-class-b'])await x.run('INSERT INTO classes(activity_key,class_id,name,active) VALUES(?,?,?,1)',x.programA,cls,cls);
  await handover(x.programA);const operationId=crypto.randomUUID();await good({action:'provision',input:{operationId,displayName:'Synthetic new Tafseer learner'}},{activity:x.programA});const created=await good({action:'resume',input:{jobId:operationId}},{activity:x.programA});
  const view=await good({action:'read',accountId:created.accountId},{activity:x.programA});await good({action:'save',revision:view.revision,change:{action:'participant',operationId:crypto.randomUUID(),accountId:created.accountId,enrolled:true,live:true,purchased:false}},{activity:x.programA});
  const command={action:'live-allocation',operationId:crypto.randomUUID(),accountId:created.accountId,classId:'new-class-a',start:x.today,end:x.today,active:true};const saved=await good(command,{activity:x.programA});assert.equal((await good(command,{activity:x.programA})).replayed,true);
  assert.equal(await x.db.prepare("SELECT count(*) n FROM role_assignments WHERE activity_key=? AND account_id=? AND role='STUDENT'").bind(x.programA,created.accountId).first('n'),0);
  const actual=await good({action:'read',accountId:created.accountId},{activity:x.programA}),allocation=actual.liveAllocation.windows.find(w=>w.enrollment_id===saved.enrollmentId);assert.equal(allocation.class_id,'new-class-a');assert.equal(actual.person.enrolled,1);assert.equal(actual.person.months.length,0);assert.equal(actual.person.grants.length,0);
  const projected=await f.db.prepare('SELECT ready,windows_json FROM source_access_people WHERE offering_id=\'tafseer\' AND account_id=?').bind(created.accountId).first();assert.equal(projected.ready,1);assert.equal(JSON.parse(projected.windows_json)[0].classId,'new-class-a');
  assert.equal((await proxy({...command,operationId:crypto.randomUUID(),enrollmentId:allocation.enrollment_id,base:{...allocation,active:0},active:false},{activity:x.programA})).body.code,'CHANGE_CONFLICT');
  const end={...command,operationId:crypto.randomUUID(),enrollmentId:allocation.enrollment_id,base:allocation,active:false};await good(end,{activity:x.programA});assert.equal((await good({action:'read',accountId:created.accountId},{activity:x.programA})).liveAllocation.windows.length,0);
 }finally{await f.close();}
});

test('a rejected Save acknowledges accepted authority deliveries so correcting a field keeps its revision',{timeout:60000},async()=>{
 const {f,x,good,proxy,handover}=await studioFixture();try{
  await handover(x.programA);const view=await good({action:'read',accountId:x.student},{activity:x.programA});
  const command={action:'save',revision:view.revision,change:{action:'access-batch',operationId:crypto.randomUUID(),changes:[{action:'surah-grant',accountId:x.student,websiteId:'site-surah',enabled:true,reason:''}]}};assert.equal((await proxy(command,{activity:x.programA})).status,400);
  const corrected={...command,change:{...command.change,operationId:crypto.randomUUID(),changes:[{...command.change.changes[0],reason:'Verified correction after validation'}]}};assert.equal((await good(corrected,{activity:x.programA})).saved,true);
 }finally{await f.close();}
});
