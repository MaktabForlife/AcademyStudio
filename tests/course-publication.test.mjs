import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {signedHeaders} from '../src/protocol.mjs';
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
async function setup(t){
 const f=await fixture({academy:true,authorityMode:'ACADEMY',coursePublication:true,verification:{accountSeconds:43200,adminSeconds:60,liveSeconds:43200}});t.after(()=>f.close());
 const db=await f.runtime.getD1Database('ACADEMY_DB','academy');
 const call=async(path,input={},token='')=>{const response=await f.runtime.dispatchFetch('https://academy.test'+path,{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json','X-Academy-Workspace':'ADMIN',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(input)});return {status:response.status,body:await response.json()};};
 const token=ok(await call('/api/account/login',{uniqueid:'separation-global',pin:'1234'})).token;
 const editor=async(action,input={},who=token)=>call('/api/admin/platform/courses/'+action,input,who);
 const list=ok(await editor('list'));
 const legacy=ok(await call('/api/admin/platform/global/get',{},token));const bypass=await call('/api/admin/platform/global/subject/save',{subjectName:'Unmarked Course bypass',active:true,workflowRevision:legacy.workflowRevision,operationId:crypto.randomUUID()},token);assert.equal(bypass.status,409,JSON.stringify(bypass));assert.equal(bypass.body.code,'COURSE_EDITOR_REQUIRED');
 const teacher=list.teachers[0]?.accountId;assert.ok(teacher,JSON.stringify(list.teachers));
 const draft=async(accessModel='PAID')=>ok(await editor('save',{operationId:crypto.randomUUID(),details:{name:'New synthetic '+accessModel,accessModel,timezone:list.timezone,weekdays:[1],startDate:'2026-11-02',endDate:'2026-11-02',startTime:'12:00',endTime:'13:00',teacherId:teacher,zoomLink:'https://zoom.us/j/12345678901',sessions:[{id:'CMSESSION-'+crypto.randomUUID(),date:'2026-11-02',startTime:'12:00',endTime:'13:00',teacherId:teacher,zoomLink:'https://zoom.us/j/12345678901',title:'Opening',status:'SCHEDULED'}]}}));
 const prepare=async(selection)=>{const c=ok(await editor('get',selection)).course;const review=ok(await editor('validate',{...selection,operationId:crypto.randomUUID(),baseRevision:c.revision}));assert.equal(review.validation.valid,true,JSON.stringify(review));const accepted=ok(await editor('accept',{...selection,operationId:crypto.randomUUID(),baseRevision:review.revision,validationToken:review.validation.token,acknowledgeWarnings:true}));const input={...selection,operationId:crypto.randomUUID(),baseRevision:accepted.revision,validationToken:review.validation.token};return input;};
 const publish=async selection=>{const input=await prepare(selection);return {input,result:ok(await editor('publish',input))};};
 const recover=async(activity,max=35)=>{for(let i=0;i<max;i++){const job=await db.prepare('SELECT * FROM website_platform_course_jobs WHERE activity_key=?').bind(activity).first();if(job?.phase==='COMPLETE')return job;await db.prepare('UPDATE website_platform_course_jobs SET next_attempt=0 WHERE activity_key=?').bind(activity).run();const r=await f.runtime.dispatchFetch('https://academy.test/__local/recover');assert.equal(r.status,200,await r.text());}assert.fail(JSON.stringify({job:await db.prepare('SELECT * FROM website_platform_course_jobs WHERE activity_key=?').bind(activity).first(),owner:await db.prepare('SELECT * FROM website_platform_access_ownership WHERE activity_key=?').bind(activity).first(),dirty:(await db.prepare('SELECT * FROM website_platform_access_dirty WHERE activity_key=?').bind(activity).all()).results,pending:(await db.prepare("SELECT stream,version,attempts,json_extract(event_json,'$.type') type FROM website_platform_outbox WHERE acknowledged=0 LIMIT 12").all()).results}));};
 return {f,db,editor,token,draft,publish,recover,call,list,prepare};
}
test('first native publication atomically registers a pending job; retries preserve purchases and later publication does not repeat ownership',async t=>{
 const {f,db,editor,draft,publish,recover}=await setup(t),c=await draft(),activity='COURSE:'+c.courseId;
 assert.equal(await db.prepare('SELECT count(*) n FROM website_platform_course_jobs').first('n'),0);
 ok(await editor('get',c));assert.equal(await db.prepare('SELECT count(*) n FROM website_platform_course_jobs').first('n'),0);
 const student=f.source.f.actors.studentA,global=f.source.f.actors.global;
 await db.prepare("INSERT INTO course_subscription_decisions(account_id,activity_key,active,updated_at,updated_by_account_id) VALUES(?,?,1,'2026-10-31',?)").bind(student,activity,global).run();
 const before=await db.prepare('SELECT * FROM course_subscription_decisions WHERE activity_key=?').bind(activity).all();
 const pub=await publish(c);assert.equal(pub.result.studioSetupPending,true);
 ok(await editor('publish',pub.input));const job=await recover(activity);
 assert.equal((await db.prepare('SELECT state FROM website_platform_access_ownership WHERE activity_key=?').bind(activity).first()).state,'STUDIO');
 assert.equal((await f.db.prepare('SELECT authority FROM source_access_scopes WHERE offering_id=?').bind(c.courseId).first()).authority,'WEBSITE');
 assert.equal(await f.db.prepare('SELECT purchased FROM participation WHERE account_id=? AND offering_id=?').bind(student,c.courseId).first('purchased'),1);
 assert.deepEqual((await db.prepare('SELECT * FROM course_subscription_decisions WHERE activity_key=?').bind(activity).all()).results,before.results);
 assert.equal(await f.db.prepare('SELECT count(*) n FROM course_publications WHERE offering_id=?').bind(c.courseId).first('n'),1);
 const selected=ok(await editor('get',c)).course;ok(await editor('status',{...c,operationId:crypto.randomUUID(),baseRevision:selected.revision,stage:'DRAFT'}));
 const next=await publish(c);assert.equal(next.result.studioSetupPending,false);assert.equal((await db.prepare('SELECT registration_id FROM website_platform_course_jobs WHERE activity_key=?').bind(activity).first()).registration_id,job.registration_id);
});
test('machine publication endpoint rejects unsigned calls and conflicting first publication receipts',async t=>{
 const f=await fixture({authorityMode:'ACADEMY'});t.after(()=>f.close());
 assert.equal((await f.request('/internal/studio/course-publication',{method:'POST',body:{}})).status,401);
 const r={activityKey:'COURSE:new-course',offeringId:'new-course',registrationId:'first-publish',runId:'run',publicationId:'pub',accessModel:'PAID'};
 const send=async(registration)=>{const signed=await signedHeaders(f.env.ACADEMY_TO_WEBSITE_SECRET,'/internal/studio/course-publication',{issuedAt:Date.now(),registration,command:{action:'register'}});const response=await f.runtime.dispatchFetch('https://website.test/internal/studio/course-publication',{method:'POST',headers:signed.headers,body:signed.payload});return {status:response.status,body:await response.json()};};
 ok(await send(r));ok(await send(r));assert.equal((await send({...r,registrationId:'another-publish'})).status,409);
 assert.equal(await f.db.prepare('SELECT count(*) n FROM access_handovers WHERE offering_id=?').bind('new-course').first('n'),0);
});

test('Free Course setup keeps free material access separate from a purchase or live enrolment',async t=>{
 const {f,db,draft,publish,recover}=await setup(t),c=await draft('FREE'),activity='COURSE:'+c.courseId;await db.prepare("INSERT INTO course_subscription_decisions(account_id,activity_key,active,updated_at,updated_by_account_id) VALUES(?,?,1,'2026-10-31',?)").bind(f.source.f.actors.studentA,activity,f.source.f.actors.global).run();await publish(c);await recover(activity);
 assert.equal(await f.db.prepare('SELECT access_model FROM course_access_models WHERE offering_id=?').bind(c.courseId).first('access_model'),'FREE');
 assert.equal(await f.db.prepare('SELECT count(*) n FROM participation WHERE offering_id=? AND purchased=1').bind(c.courseId).first('n'),0);
 await f.content.put('websites/new-free/versions/seed.json',JSON.stringify(f.doc));
 await f.run("INSERT INTO websites VALUES('new-free',?,'Free published material',NULL,'websites/new-free/versions/seed.json','websites/new-free/versions/seed.json',0,1,NULL)",c.courseId);
 await f.media.put('new-free-recording','Synthetic retained recording');await f.run("INSERT INTO objects VALUES('new-free-asset','new-free-recording','video/mp4','free.mp4',28,'synthetic-hash',NULL)");
 await f.run("INSERT INTO attachments VALUES('new-free-attachment',?,NULL,'new-free-asset','new-lesson','2026-11-02','','Free lesson','RECORDING',1)",c.courseId);
 const cookie=(await f.login('outsider')).cookie;ok(await f.request('/api/websites/new-free',{cookie}));ok(await f.request('/api/media/new-free-attachment',{cookie}));
 assert.equal(await f.db.prepare('SELECT count(*) n FROM participation WHERE account_id=? AND offering_id=?').bind('outsider',c.courseId).first('n'),0);
 assert.equal(await db.prepare('SELECT count(*) n FROM course_subscription_decisions WHERE activity_key=?').bind(activity).first('n'),1);
});
test('an accepted job survives an unavailable Studio and a lost commit acknowledgement after its publisher session ends',async t=>{
 const {f,db,draft,publish,recover,editor,token}=await setup(t),c=await draft(),activity='COURSE:'+c.courseId;await publish(c);
 await db.prepare('UPDATE account_sessions SET revoked_at=? WHERE account_id=?').bind(new Date().toISOString(),f.source.f.actors.global).run();
 assert.equal((await editor('studio-resume',c,token)).status,401);
 const step=async(mode,automatic=false)=>{const response=await f.runtime.dispatchFetch('https://academy.test/__local/course-setup',{method:'POST',body:JSON.stringify({...(!automatic?{activity}:{}),mode})});assert.equal(response.status,200,await response.text());};
 // Deliberately fail a machine delivery without changing any authority.
 await db.prepare("UPDATE website_platform_course_jobs SET phase='REGISTER' WHERE activity_key=?").bind(activity).run();await step('offline');
 assert.equal(await db.prepare('SELECT state FROM website_platform_access_ownership WHERE activity_key=?').bind(activity).first('state'),'FROZEN');
 assert.equal(await db.prepare('SELECT phase FROM website_platform_course_jobs WHERE activity_key=?').bind(activity).first('phase'),'REGISTER');
 // The new job selector and failure bookkeeping remain indexed beside 4000 completed jobs.
 await db.prepare('UPDATE website_platform_course_jobs SET next_attempt=0 WHERE activity_key=?').bind(activity).run();f.source.resetMetrics();await step('offline',true);const baseline={...f.source.metrics};
 const ids=JSON.stringify(Array.from({length:4000},(_,i)=>'budget-course-'+i));
 await db.prepare("INSERT INTO activities(activity_key,activity_id,kind,name,active,lifecycle,website_visible,created_at,updated_at,revision) SELECT 'COURSE:'||value,value,'COURSE','Unrelated completed Course',1,'ACTIVE',0,'2026-10-31','2026-10-31',1 FROM json_each(?)").bind(ids).run();
 await db.prepare("INSERT INTO website_platform_new_courses(activity_key,created_operation) SELECT 'COURSE:'||value,'created:'||value FROM json_each(?)").bind(ids).run();
 await db.prepare("INSERT INTO website_platform_course_jobs(activity_key,offering_id,registration_id,run_id,publication_id,access_model,phase,created_at) SELECT 'COURSE:'||value,value,'registered:'||value,'run:'||value,'publication:'||value,'PAID','COMPLETE',0 FROM json_each(?)").bind(ids).run();
 await db.prepare('UPDATE website_platform_course_jobs SET next_attempt=0 WHERE activity_key=?').bind(activity).run();f.source.resetMetrics();await step('offline',true);const after4000={...f.source.metrics};
 assert.ok(after4000.rowsRead<=baseline.rowsRead+2,JSON.stringify({baseline,after4000}));assert.ok(after4000.rowsRead<=32,JSON.stringify(after4000));console.log(JSON.stringify({automaticSetupFailureRows:{baseline,after4000}}));
 // Advance with normal bounded delivery until commit is the next step.
 for(let i=0;i<30;i++){
  const h=await f.db.prepare('SELECT * FROM access_handovers WHERE offering_id=?').bind(c.courseId).first();
  const o=await db.prepare('SELECT * FROM website_platform_access_ownership WHERE activity_key=?').bind(activity).first();
  if(h?.phase==='PREPARING'&&o.checked>0&&h.checked===o.checked)break;
  await db.prepare('UPDATE website_platform_course_jobs SET next_attempt=0 WHERE activity_key=?').bind(activity).run();await f.runtime.dispatchFetch('https://academy.test/__local/recover');
 }
 await step('lost-ack');
 assert.equal(await f.db.prepare('SELECT phase FROM access_handovers WHERE offering_id=?').bind(c.courseId).first('phase'),'COMMITTED');
 assert.equal(await db.prepare('SELECT state FROM website_platform_access_ownership WHERE activity_key=?').bind(activity).first('state'),'FROZEN');
 await recover(activity);assert.equal(await db.prepare('SELECT state FROM website_platform_access_ownership WHERE activity_key=?').bind(activity).first('state'),'STUDIO');
});
test('scoped publisher registration uses current scope; revoked, expired and unrelated actors cannot publish or resume',async t=>{
 const {f,db,draft,editor,call,list,recover}=await setup(t),c=await draft(),activity='COURSE:'+c.courseId,scoped=f.source.f.actors.adminA;
 await db.prepare("INSERT INTO role_assignments(assignment_id,account_id,activity_key,role,active,review_state,granted_at,granted_by_account_id) VALUES(?,?,?,'PROGRAM_ADMIN',1,'CONFIRMED',?,?)").bind(crypto.randomUUID(),scoped,activity,new Date().toISOString(),f.source.f.actors.global).run();
 const login=async who=>ok(await call('/api/account/login',{uniqueid:'separation-'+who,pin:'1234'})).token;
 let token=await login('adminA');const unrelated=await login('adminB'),learner=await login('studentA');
 const get=()=>editor('get',c,token),current=ok(await get()).course;
 for(const denied of [unrelated,learner])assert.equal((await editor('validate',{...c,operationId:crypto.randomUUID(),baseRevision:current.revision},denied)).status,403);
 const review=ok(await editor('validate',{...c,operationId:crypto.randomUUID(),baseRevision:current.revision},token));
 const accepted=ok(await editor('accept',{...c,operationId:crypto.randomUUID(),baseRevision:review.revision,validationToken:review.validation.token,acknowledgeWarnings:true},token));
 const input={...c,operationId:crypto.randomUUID(),baseRevision:accepted.revision,validationToken:review.validation.token};
 await db.prepare("UPDATE account_sessions SET created_at='2019-01-01T00:00:00.000Z',expires_at='2020-01-01T00:00:00.000Z' WHERE account_id=?").bind(scoped).run();assert.equal((await editor('publish',input,token)).status,401);token=await login('adminA');
 await db.prepare("UPDATE role_assignments SET active=0 WHERE account_id=? AND activity_key=?").bind(scoped,activity).run();
 assert.ok([401,403].includes((await editor('publish',input,token)).status));assert.equal(await db.prepare('SELECT count(*) n FROM website_platform_course_jobs').first('n'),0);
 await db.prepare("UPDATE role_assignments SET active=1 WHERE account_id=? AND activity_key=?").bind(scoped,activity).run();
 ok(await editor('publish',input,token));
 await db.prepare("UPDATE role_assignments SET active=0 WHERE account_id=? AND activity_key=?").bind(scoped,activity).run();
 assert.ok([401,403].includes((await editor('studio-resume',c,token)).status));
 await recover(activity);
 assert.equal(await db.prepare('SELECT state FROM website_platform_access_ownership WHERE activity_key=?').bind(activity).first('state'),'STUDIO');
 assert.equal(await f.db.prepare('SELECT count(*) n FROM staff WHERE offering_id=? AND account_id=?').bind(c.courseId,scoped).first('n'),0,'Revoking the publisher also removes current Studio staff authority');
});

test('a rejected first-publication transaction leaves no registration, scope, freeze or half-published timetable',async t=>{
 const {f,db,draft,editor,prepare}=await setup(t),c=await draft(),activity='COURSE:'+c.courseId,input=await prepare(c);
 await db.prepare("CREATE TRIGGER fail_new_course_job BEFORE INSERT ON website_platform_course_jobs BEGIN SELECT RAISE(ABORT,'Synthetic publication rejection'); END").run();
 assert.equal((await editor('publish',input)).status,503);
 for(const table of ['website_platform_course_jobs','website_platform_timetable_scopes','website_platform_access_ownership','timetable_publications'])assert.equal(await db.prepare('SELECT count(*) n FROM '+table+' WHERE activity_key=?').bind(activity).first('n'),0,table);
 assert.equal(ok(await editor('get',c)).course.stage,'DRAFT');
 await db.prepare('DROP TRIGGER fail_new_course_job').run();ok(await editor('publish',input));
});
test('changed staff facts restart the prepared checkpoint without unlocking Academy access',async t=>{
 const {f,db,draft,publish,recover}=await setup(t),c=await draft(),activity='COURSE:'+c.courseId;await publish(c);
 for(let i=0;i<30;i++){
  const o=await db.prepare('SELECT * FROM website_platform_access_ownership WHERE activity_key=?').bind(activity).first();if(o.source_version!==null)break;
  await db.prepare('UPDATE website_platform_course_jobs SET next_attempt=0 WHERE activity_key=?').bind(activity).run();
  await f.runtime.dispatchFetch('https://academy.test/__local/recover');
 }
 const before=await db.prepare('SELECT * FROM website_platform_access_ownership WHERE activity_key=?').bind(activity).first();assert.ok(before.source_version);
 await db.prepare("UPDATE role_assignments SET active=0 WHERE activity_key=? AND role='TEACHER'").bind(activity).run();
 await recover(activity);
 assert.equal(await f.db.prepare('SELECT count(*) n FROM access_handover_cancellations WHERE transfer_id=?').bind(before.transfer_id).first('n'),1);
 assert.notEqual(await db.prepare('SELECT transfer_id FROM website_platform_access_ownership WHERE activity_key=?').bind(activity).first('transfer_id'),before.transfer_id);
 assert.equal(await db.prepare('SELECT state FROM website_platform_access_ownership WHERE activity_key=?').bind(activity).first('state'),'STUDIO');
});
test('copy and repeat publish independent registrations without inheriting purchases or changing the original transfer',async t=>{
 const {f,db,draft,publish,recover,editor}=await setup(t),c=await draft(),activity='COURSE:'+c.courseId;
 await db.prepare("INSERT INTO course_subscription_decisions(account_id,activity_key,active,updated_at,updated_by_account_id) VALUES(?,?,1,'2026-10-31',?)").bind(f.source.f.actors.studentA,activity,f.source.f.actors.global).run();
 await publish(c);const originalJob=await recover(activity),original=ok(await editor('get',c)).course;
 const copyInput={...c,operationId:crypto.randomUUID(),baseRevision:original.revision,name:'Independent copied Course',copySchedule:true,copyTimetable:true,copyEnrollments:true,reuseMedia:false};const staleRoster=await editor('copy',copyInput);assert.equal(staleRoster.status,409);assert.equal(staleRoster.body.code,'STUDIO_ROSTER_COPY_UNAVAILABLE');
 const copy=ok(await editor('copy',{...copyInput,operationId:crypto.randomUUID(),copyEnrollments:false}));
 assert.notEqual(copy.courseId,c.courseId);assert.equal(await db.prepare('SELECT count(*) n FROM course_subscription_decisions WHERE activity_key=?').bind('COURSE:'+copy.courseId).first('n'),0);
 await publish(copy);await recover('COURSE:'+copy.courseId);
 assert.equal(await f.db.prepare('SELECT count(*) n FROM participation WHERE offering_id=? AND account_id=?').bind(copy.courseId,f.source.f.actors.studentA).first('n'),0);
 for(const stage of ['CANCELLED','ARCHIVED']){const current=ok(await editor('get',c)).course;ok(await editor('status',{...c,operationId:crypto.randomUUID(),baseRevision:current.revision,stage}));}
 const archived=ok(await editor('get',c)).course,repeat=ok(await editor('repeat',{...c,operationId:crypto.randomUUID(),baseRevision:archived.revision,name:'Independent repeated Course',reuseMedia:false}));
 const repeated=ok(await editor('get',repeat)).course;
 ok(await editor('save',{...repeat,operationId:crypto.randomUUID(),baseRevision:repeated.revision,details:{...original.details,name:'Independent repeated Course',sessions:original.details.sessions.map(s=>({...s,id:'CMSESSION-'+crypto.randomUUID()}))}}));
 await publish(repeat);await recover('COURSE:'+repeat.courseId);
 assert.equal(await f.db.prepare('SELECT count(*) n FROM participation WHERE offering_id=? AND purchased=1').bind(repeat.courseId).first('n'),0);
 assert.equal(await db.prepare('SELECT registration_id FROM website_platform_course_jobs WHERE activity_key=?').bind(activity).first('registration_id'),originalJob.registration_id);
 assert.equal(await f.db.prepare('SELECT purchased FROM participation WHERE offering_id=? AND account_id=?').bind(c.courseId,f.source.f.actors.studentA).first('purchased'),1);
});
