import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {Store} from '../src/database.mjs';
import {attachMedia} from '../src/media-attribution.mjs';
import {change} from '../src/admin.mjs';
import {sha256} from '../src/protocol.mjs';
import {recordingList,seriesRecordings} from '../public/shared/recording-website.mjs';
const choices=[{id:'outsider',name:'Registered Teacher <one>'},{id:'teacher',name:'Registered Teacher two'}];
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
async function setup({authorityMode='WEBSITE',nativeTeacherHandler}={}){const f=await fixture({authorityMode,nativeTeacherHandler,nativeTeacherChoices:choices,verification:{accountSeconds:43200,adminSeconds:60}});const admin=(await f.login('admin')).cookie;await f.run("UPDATE sessions SET source_ref='synthetic-native-admin' WHERE account_id='admin'");if(authorityMode==='ACADEMY'){await f.run("INSERT INTO source_access_scopes VALUES('course','WEBSITE',1,1,1,0,'UTC','[]')");await f.run("INSERT INTO access_handovers VALUES('course','local-only-owner','COMMITTED',1,1,0,'',0,0)");await f.run("INSERT INTO source_access_people VALUES('admin','course',1,1,?,1,'[]',0,1)",Date.now());}const post=(body,offer='course',cookie=admin)=>f.request('/api/admin/'+offer,{method:'POST',cookie,body:{operationId:crypto.randomUUID(),...body}});ok(await post({action:'youtube',assetId:'new-media',videoId:'ABCdef12345',title:'Synthetic direct recording'}));return {...f,admin,post};}
const attachment=(extra={})=>({action:'media-attach',attachmentId:'direct-recording',assetId:'new-media',title:'Direct Course recording',teacherIds:['outsider'],...extra});
test('checked Teacher selection, direct Course without date/session, private then exact publication, attribution grants nothing',async t=>{
 const f=await setup();t.after(()=>f.close());const before=await f.db.prepare('SELECT * FROM staff ORDER BY account_id,offering_id').all();
 for(const teacherIds of [[],['outsider','outsider'],['OUTSIDER','outsider'],['invented'],['Registered Teacher <one>'],Array(11).fill('outsider')])assert([400,409].includes((await f.post(attachment({teacherIds}))).status));
 const input=attachment({operationId:'checked-attach-once'}),saved=ok(await f.post(input));assert.equal(saved.recordedContext.attributionSource,'NATIVE_TEACHER_ACCOUNT');assert.equal(saved.recordedContext.subject,null);assert.deepEqual(saved.recordedContext.classIds,[]);assert.equal((await f.db.prepare("SELECT lesson_date FROM attachments WHERE attachment_id='direct-recording'").first()).lesson_date,'');assert.equal(ok(await f.post(input)).replayed,true);
 const outsider=(await f.login('outsider')).cookie;assert.equal((await f.request('/api/media/direct-recording',{cookie:outsider})).status,404);
 let row=await f.db.prepare("SELECT * FROM media_attributions WHERE attachment_id='direct-recording'").first();const publish={action:'media-publication',attachmentId:'direct-recording',operationId:'checked-publish-once',revision:row.revision,draftContext:row.draft_json};ok(await f.post(publish));assert.equal(ok(await f.post(publish)).replayed,true);
 assert.equal((await f.request('/api/media/direct-recording',{cookie:outsider})).status,403);const learner=(await f.login('learner')).cookie,feed=ok(await f.request('/api/offerings/course/media',{cookie:learner}));assert.equal(feed.media[0].recordedContext.teacherIds[0],'outsider');assert.deepEqual((await f.db.prepare('SELECT * FROM staff ORDER BY account_id,offering_id').all()).results,before.results);
 const entries=seriesRecordings({media:feed.media}),html=recordingList({entries});assert.match(html,/Registered Teacher &lt;one&gt;/);assert(!html.includes('Teacher <one>'));
});
test('Tafseer uses native Surah, exact class/date retained with no timetable dependency',async t=>{
 const f=await setup();t.after(()=>f.close());await f.run("INSERT INTO asset_owners VALUES('new-media','tafseer')");await f.run("INSERT INTO source_access_scopes VALUES('tafseer','WEBSITE',1,1,1,0,'Africa/Johannesburg','[\"historic-cohort\"]')");
 for(const bad of [{websiteId:'site-course'},{cohort:'invented'},{lessonDate:''}])assert([400,409].includes((await f.post(attachment({websiteId:'site-surah',cohort:'historic-cohort',lessonDate:'2024-01-03',...bad}),'tafseer')).status));
 const saved=ok(await f.post(attachment({websiteId:'site-surah',cohort:'historic-cohort',lessonDate:'2024-01-03'}),'tafseer'));assert.equal(saved.recordedContext.subject.key,'site-surah');assert.deepEqual(saved.recordedContext.classIds,['historic-cohort']);assert.equal(saved.recordedContext.mediaIdentity.recordedDate,'2024-01-03');
 const before=await f.db.prepare('SELECT * FROM timetable ORDER BY session_id').all();assert.equal(before.results.length,3);assert.equal((await f.db.prepare('SELECT count(*) n FROM attachments').first()).n,1);
});
test('separate attribution revision preserves winning Admin edits and published labels until explicit publication',async t=>{
 const f=await setup();t.after(()=>f.close());ok(await f.post(attachment()));let row=await f.db.prepare("SELECT * FROM media_attributions WHERE attachment_id='direct-recording'").first();ok(await f.post({action:'media-publication',attachmentId:'direct-recording',revision:row.revision,draftContext:row.draft_json}));
 const first={action:'media-attribution-save',attachmentId:'direct-recording',revision:2,teacherIds:['teacher']};ok(await f.post(first));assert.equal((await f.post({...first,teacherIds:['outsider']})).status,409);
 row=await f.db.prepare("SELECT * FROM media_attributions WHERE attachment_id='direct-recording'").first();assert.deepEqual(JSON.parse(row.published_json).teacherIds,['outsider']);assert.deepEqual(JSON.parse(row.draft_json).teacherIds,['teacher']);
 await f.run("UPDATE attachments SET lesson_id='another-admin-edit' WHERE attachment_id='direct-recording'");assert.equal((await f.post({action:'media-publication',attachmentId:'direct-recording',revision:row.revision,draftContext:row.draft_json})).status,409);assert.deepEqual(JSON.parse((await f.db.prepare("SELECT published_json FROM media_attributions WHERE attachment_id='direct-recording'").first()).published_json).teacherIds,['outsider']);
});
test('transactional write fences revoke, epoch, fresh status and Admin changes after native validation',async t=>{
 const f=await setup();t.after(()=>f.close());
 const tests=["UPDATE sessions SET revoked=1 WHERE account_id='admin'","UPDATE accounts SET epoch=2 WHERE account_id='admin'","UPDATE accounts SET verified_at=0 WHERE account_id='admin'","UPDATE accounts SET global_admin=0 WHERE account_id='admin'"];
 for(let i=0;i<tests.length;i++){
  const store=new Store({...f.env,DB:f.db}),actor=await store.actor(await sha256(f.admin.split('=')[1])),original=store.mutate.bind(store);store.mutate=async(...args)=>{await f.run(tests[i]);return original(...args);};
  const fetcher=async()=>Response.json({schema:'NATIVE_MEDIA_TEACHERS_V1',offeringId:'course',teachers:choices,checkedAt:Date.now()});
  await assert.rejects(attachMedia(f.env,store,actor,'course',attachment({operationId:'fenced-'+i}),fetcher,change),/permissions|changed/);assert.equal((await f.db.prepare('SELECT count(*) n FROM media_attributions').first()).n,0);
  await f.run("UPDATE sessions SET revoked=0 WHERE account_id='admin'");await f.run("UPDATE accounts SET epoch=1,verified_at=?,global_admin=1 WHERE account_id='admin'",Date.now());
 }
});
test('focused media reads and exact retries remain bounded under unrelated account/roster/media growth',async t=>{
 const f=await setup();t.after(()=>f.close());const measures=async()=>{const result={};for(const path of ['/api/admin/course/media-review','/api/admin/course/media-options']){const r=await f.request(path,{cookie:f.admin});ok(r);result[path]={reads:r.reads,queries:r.queries};}return result;};
 const small=await measures();await f.run("WITH RECURSIVE n(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<1000) INSERT INTO accounts SELECT 'unrelated-'||x,'Unrelated',1,1,1,?,0 FROM n",Date.now());await f.run("INSERT INTO participation SELECT account_id,'tafseer',1,0,0,'' FROM accounts WHERE account_id LIKE 'unrelated-%'");await f.run("INSERT INTO paid_months SELECT account_id,'tafseer','2024-01','unrelated','Local growth' FROM accounts WHERE account_id LIKE 'unrelated-%'");
 const grown=await measures();assert.deepEqual(grown,small);console.log('LOCAL_MEDIA_READ_BUDGET '+JSON.stringify({small,grown,unrelatedAccounts:1000,nativeTeacherSourceCost:'separate Source fixture; mocked DTO here'}));
});

test('current scoped role, source generation, readiness and committed Studio ownership fence the final transaction',async t=>{
 const f=await setup({authorityMode:'ACADEMY'});t.after(()=>f.close());await f.run("UPDATE accounts SET global_admin=0 WHERE account_id='admin'");await f.run("INSERT INTO staff VALUES('admin','course','ADMIN',0)");
 const cases=["DELETE FROM staff WHERE account_id='admin' AND offering_id='course'","UPDATE source_access_scopes SET enabled=0 WHERE offering_id='course'","UPDATE access_handovers SET phase='ABORTED' WHERE offering_id='course'","UPDATE source_access_people SET ready=0 WHERE account_id='admin' AND offering_id='course'","UPDATE source_access_scopes SET generation=2 WHERE offering_id='course'"];
 for(let i=0;i<cases.length;i++){
  const store=new Store({...f.env,DB:f.db}),actor=await store.actor(await sha256(f.admin.split('=')[1])),mutate=store.mutate.bind(store);store.mutate=async(...args)=>{await f.run(cases[i]);return mutate(...args);};
  const fetcher=async()=>Response.json({schema:'NATIVE_MEDIA_TEACHERS_V1',offeringId:'course',teachers:choices,checkedAt:Date.now()});await assert.rejects(attachMedia(f.env,store,actor,'course',attachment({operationId:'scoped-fence-'+i}),fetcher,change),/permissions|changed/);assert.equal((await f.db.prepare('SELECT count(*) n FROM media_attributions').first()).n,0);
  await f.run("INSERT OR REPLACE INTO staff VALUES('admin','course','ADMIN',0)");await f.run("UPDATE access_handovers SET phase='COMMITTED' WHERE offering_id='course'");await f.run("UPDATE source_access_scopes SET generation=1,enabled=1,authority='WEBSITE' WHERE offering_id='course'");await f.run("UPDATE source_access_people SET ready=1 WHERE account_id='admin' AND offering_id='course'");
 }
});

const invalidTeacherSelections=[
 {name:'missing',fields:{},nativeCalls:0},
 {name:'null',fields:{teacherIds:null},nativeCalls:0},
 {name:'empty',fields:{teacherIds:[]},nativeCalls:0},
 {name:'duplicate',fields:{teacherIds:['outsider','outsider']},nativeCalls:0},
 {name:'case-duplicate',fields:{teacherIds:['outsider','OUTSIDER']},nativeCalls:0},
 {name:'unknown',fields:{teacherIds:['not-registered']},nativeCalls:1},
 {name:'string',fields:{teacherIds:'outsider'},nativeCalls:0},
 {name:'null-item',fields:{teacherIds:[null]},nativeCalls:0},
 {name:'too-many',fields:{teacherIds:Array.from({length:11},(_,i)=>'native-'+i)},nativeCalls:0}
];
const nativeChoices=[...choices,...Array.from({length:8},(_,i)=>({id:'native-registered-'+i,name:'Registered native Teacher '+i}))];
async function teacherBoundaryFixture(){
 const nativeRequests=[];
 const f=await setup({nativeTeacherHandler:async request=>{const input=await request.json();nativeRequests.push(input);return Response.json({schema:'NATIVE_MEDIA_TEACHERS_V1',offeringId:input.offeringId,teachers:nativeChoices,classes:[],checkedAt:Date.now()});}});
 const snapshot=async()=>{
  const result={};for(const table of ['attachments','media_attributions','media_supporting_files','recording_companions','operations','audit','guards','objects','asset_owners','staff','participation','paid_months','website_months','surah_grants'])result[table]=(await f.db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()).results;return result;
 };
 const picker=async()=>ok(await f.request('/api/admin/course/media-options',{cookie:f.admin}));
 return {...f,nativeRequests,snapshot,picker};
}
test('media-attach write Teacher boundary rejects missing/null/empty/duplicate/unknown choices with no partial rows or receipts',async t=>{
 const f=await teacherBoundaryFixture();t.after(()=>f.close());
 const options=await f.picker();assert.equal(options.teachers.length,10);assert.deepEqual(options.selectedTeacherIds,[]);assert.equal(Object.hasOwn(f.nativeRequests.at(-1),'teacherIds'),false,'The picker keeps its undefined-selection read contract');
 for(const selection of invalidTeacherSelections){
  const before=await f.snapshot(),calls=f.nativeRequests.length;
  const response=await f.post({action:'media-attach',attachmentId:'teacher-boundary-recording',assetId:'new-media',title:'Private boundary recording',operationId:'teacher-attach-'+selection.name,...selection.fields});
  assert.equal(response.status,selection.name==='unknown'?409:400,selection.name+': '+JSON.stringify(response.body));assert.equal(Number(response.response.headers.get('X-Local-D1-Rows-Written')),0,selection.name);assert.equal(f.nativeRequests.length,calls+selection.nativeCalls,selection.name+' validation before native selection');assert.deepEqual(await f.snapshot(),before,selection.name+' must preserve metadata, attachments, receipts and rights');
 }
 const valid={action:'media-attach',attachmentId:'teacher-boundary-recording',assetId:'new-media',title:'Private boundary recording',operationId:'teacher-attach-missing',teacherIds:['outsider']},saved=ok(await f.post(valid));assert.deepEqual(saved.recordedContext.teacherIds,['outsider']);assert.equal(ok(await f.post(valid)).replayed,true,'A rejected attempt created no receipt; a valid save and exact retry remain compatible');assert.equal((await f.db.prepare('SELECT count(*) n FROM attachments').first()).n,1);
 assert.deepEqual((await f.picker()).selectedTeacherIds,[]);
});
test('media-attribution-save write Teacher boundary cannot insert empty metadata or clear an existing Teacher and creates no rejected receipts',async t=>{
 const f=await teacherBoundaryFixture();t.after(()=>f.close());
 ok(await f.post({action:'attachment',attachmentId:'historical-teacher-boundary',assetId:'new-media',lessonId:'historical-native-lesson',lessonDate:'',title:'Existing private source',audience:'RECORDING',published:false}));
 // Exercise both metadata insertion and overwriting an existing nonempty draft.
 for(const existing of [false,true]){
  if(existing)ok(await f.post({action:'media-attribution-save',attachmentId:'historical-teacher-boundary',revision:0,teacherIds:['outsider']}));
  for(const selection of invalidTeacherSelections){
   const before=await f.snapshot(),calls=f.nativeRequests.length;
   const response=await f.post({action:'media-attribution-save',attachmentId:'historical-teacher-boundary',revision:existing?1:0,operationId:'teacher-save-'+existing+'-'+selection.name,...selection.fields});
   assert.equal(response.status,selection.name==='unknown'?409:400,selection.name+': '+JSON.stringify(response.body));assert.equal(Number(response.response.headers.get('X-Local-D1-Rows-Written')),0,selection.name);assert.equal(f.nativeRequests.length,calls+selection.nativeCalls,selection.name+' validation before native selection');assert.deepEqual(await f.snapshot(),before,selection.name+' must leave the saved context, attachments, receipts and rights unchanged');
  }
 }
 const valid={action:'media-attribution-save',attachmentId:'historical-teacher-boundary',revision:1,operationId:'teacher-save-true-missing',teacherIds:nativeChoices.map(t=>t.id)},saved=ok(await f.post(valid));assert.equal(saved.recordedContext.teacherIds.length,10);assert.equal(saved.revision,2);assert.equal(ok(await f.post(valid)).replayed,true);assert.equal((await f.picker()).teachers.length,10);
 const row=await f.db.prepare('SELECT * FROM media_attributions WHERE attachment_id=?').bind('historical-teacher-boundary').first();assert.equal(row.published_json,null,'A valid private correction does not publish');assert.equal(row.revision,2);
});
