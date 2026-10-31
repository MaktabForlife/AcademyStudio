import {test} from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';import {signIn,ok} from './access-fixture.mjs';
async function mouFixture(t){
 const f=await fixture({academy:true,authorityMode:'ACADEMY',mou:true,navigation:{mothers:'programB'},verification:{accountSeconds:43200,adminSeconds:60,liveSeconds:43200}});t.after(()=>f.close());
 const db=await f.runtime.getD1Database('ACADEMY_DB','academy'),scope=f.source.f.scopes.programB,offer=scope.slice(8);
 const native=async(path,body,token)=>{const response=await f.runtime.dispatchFetch('https://academy.test'+path,{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json','X-Academy-Workspace':'ADMIN',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
 const token=ok(await native('/api/account/login',{uniqueid:'separation-global',pin:'1234'})).token;
 const register=async(input={})=>native('/api/admin/platform/programme-studio/register',{programmeKey:'mothers',accessModel:'MONTHLY',noMediaMigration:true,operationId:crypto.randomUUID(),...input},token);
 const recover=async(n=20)=>{for(let i=0;i<n;i++){const r=await f.runtime.dispatchFetch('https://academy.test/__local/recover');assert.equal(r.status,200,await r.text());}};
 const proxy=async command=>native('/api/admin/platform/studio-access',{activityKey:scope,command},token);
 const handover=async()=>{const transferId=crypto.randomUUID();ok(await proxy({action:'handover-start',transferId}));let done=false;for(let i=0;i<30;i++){const r=ok(await proxy({action:'handover-reconcile',transferId}));await recover(2);if(r.reconciliation.done&&!r.reconciliation.dataset){done=true;break;}}assert(done);let page;for(let i=0;i<20;i++){page=ok(await proxy({action:'handover-page',transferId}));if(!page.more)break;}assert.equal(page.more,false);ok(await proxy({action:'handover-commit',transferId}));return transferId;};
 const save=async change=>{const read=ok(await proxy({action:'read'}));return proxy({action:'save',revision:read.revision,change:{operationId:crypto.randomUUID(),...change}});};
 return {f,db,scope,offer,native,token,register,recover,proxy,handover,save};
}
test('MOU registration uses the exact reviewed programme and preserves empty months and all native media policy/roles',async t=>{
 const {f,db,scope,offer,register,recover}=await mouFixture(t);
 const before={roles:(await db.prepare('SELECT * FROM role_assignments WHERE activity_key=?').bind(scope).all()).results,policies:(await db.prepare('SELECT * FROM program_monthly_media_policies WHERE activity_key=?').bind(scope).all()).results};
 const input={operationId:crypto.randomUUID()},r=ok(await register(input));assert.equal(r.offeringId,offer);assert.equal(r.mediaImported,false);assert.equal(ok(await register(input)).replayed,true);
 await recover();assert.equal(await f.db.prepare("SELECT offering_id FROM programme_offerings WHERE programme_key='mothers'").first('offering_id'),offer);
 assert.equal(await f.db.prepare('SELECT count(*) n FROM paid_months WHERE offering_id=?').bind(offer).first('n'),0);
 assert.equal(await f.db.prepare('SELECT count(*) n FROM attachments WHERE offering_id=?').bind(offer).first('n'),0);
 assert.deepEqual((await db.prepare('SELECT * FROM role_assignments WHERE activity_key=?').bind(scope).all()).results,before.roles);
 assert.deepEqual((await db.prepare('SELECT * FROM program_monthly_media_policies WHERE activity_key=?').bind(scope).all()).results,before.policies);
 const cookie=await signIn(f,'studentB'),view=ok(await f.request('/api/circles/classrooms/mothers',{cookie}));assert.equal(view.schema,'MOU_CLASSROOM_V1');assert.equal(view.programme.accessModel,'MONTHLY');assert.equal(view.monthly.hasCurrentMonth,false);assert.equal(view.subjects.length,10);assert.equal(view.subjects[0].key,'surah-al-baqarah');assert.equal(view.subjects.filter(x=>x.key==='surah-al-baqarah').length,1);assert(view.subjects.slice(1).every(x=>x.availabilityLabel==='Coming soon إن شاء الله'&&x.website===null));assert.equal(view.materialsConnected,false);assert(!JSON.stringify(view).includes('zoom.us'));
 assert.equal(view.management.canManage,false);
 const admin=ok(await f.request('/api/circles/classrooms/mothers',{cookie:await signIn(f,'adminB')}));assert.equal(admin.management.canManage,true);assert.equal(admin.management.offeringId,offer);
 assert.equal((await f.request('/api/circles/classrooms/mothers',{cookie:await signIn(f,'studentA')})).status,403);
});

test('MOU months, original cohorts and website-only rights remain separate from Tafseer and do not import old media',async t=>{
 const x=await mouFixture(t),{f,db,scope,offer,register,recover,handover,save}=x;ok(await register());await recover();await handover();
 const a=f.source.f.actors.studentB,b=f.source.f.actors.studentA;const cookie=await signIn(f,'studentB'),other=await signIn(f,'studentA');
 const month=new Date().toISOString().slice(0,7),completionDate=month+'-01';
 await f.run("INSERT INTO websites VALUES('synthetic-mou-baqarah',?,'Synthetic Baqarah',?,'websites/site-course/versions/seed.json','websites/site-course/versions/seed.json',0,1,?)",offer,month,completionDate);
 ok(await save({action:'mou-subject',displayKey:'surah-al-baqarah',websiteId:'synthetic-mou-baqarah',enabled:true}));
 const editor=ok(await f.request('/api/circles/classrooms/mothers',{cookie:await signIn(f,'adminB')}));assert.equal(editor.management.canManage,true);assert.equal(editor.subjects[0].website.editorHref,'/builder/?website=synthetic-mou-baqarah');
 for(const [asset,cohort,date] of [['mou-future-recording','mou-cohort',month+'-01'],['mou-wrong-cohort','other-cohort',month+'-01'],['mou-wrong-month','mou-cohort','2020-01-01']]){
  await f.run('INSERT INTO objects VALUES(?,NULL,?,?,0,NULL,?)',asset,'video/youtube',asset,'abcdefghijk');await f.run("INSERT INTO attachments VALUES(?,?,'synthetic-mou-baqarah',?,'synthetic-prepared-lesson',?,?,?,'RECORDING',1)",asset,offer,asset,date,cohort,asset);
 }
 // A Tafseer payment for the same month/cohort is no MOU entitlement.
 await f.run('INSERT INTO paid_months VALUES(?,?,?,?,?)',a,'tafseer',month,'mou-cohort','Other programme');
 assert.equal((await f.request('/api/media/mou-future-recording',{cookie})).status,403);
 ok(await save({action:'paid-months',changes:[{accountId:a,month,cohort:'mou-cohort',paid:true,reason:'Synthetic verified MOU month'}]}));
 assert.equal(ok(await f.request('/api/circles/classrooms/mothers',{cookie})).monthly.hasCurrentMonth,true);
 ok(await f.request('/api/media/mou-future-recording',{cookie}));assert.equal((await f.request('/api/media/mou-wrong-cohort',{cookie})).status,403);assert.equal((await f.request('/api/media/mou-wrong-month',{cookie})).status,403);
 ok(await save({action:'surah-grant',accountId:b,websiteId:'synthetic-mou-baqarah',enabled:true,reason:'Synthetic website only'}));
 const view=ok(await f.request('/api/circles/classrooms/mothers',{cookie:other}));assert.equal(view.subjects[0].website.canOpen,true);assert.equal(view.monthly.hasCurrentMonth,false);assert.equal((await f.request('/api/media/mou-future-recording',{cookie:other})).status,403);
 assert.equal(await db.prepare('SELECT count(*) n FROM program_monthly_subscriptions WHERE activity_key=?').bind(scope).first('n'),0,'Studio month edits never change old Academy rows');
 const before=f.source.metrics.queries;await f.request('/api/circles/classrooms/mothers',{cookie});assert.equal(f.source.metrics.queries,before,'Ordinary classroom reading makes no Academy request');
});
test('MOU published sessions keep exact class/teacher/time/cancellation gates and never expose Zoom in snapshots',async t=>{
 const x=await mouFixture(t),{f,db,scope,offer,register,recover,handover,save}=x;ok(await register());
 const student=f.source.f.actors.studentB,teacher=f.source.f.actors.teacherB,klass=await db.prepare('SELECT class_id FROM classes WHERE activity_key=? AND active=1 LIMIT 1').bind(scope).first('class_id'),today=new Date().toISOString().slice(0,10);
 await db.prepare('UPDATE class_memberships SET start_date=?,end_date=NULL,active=1 WHERE activity_key=? AND account_id=?').bind(today,scope,student).run();
 const start=new Date(Date.now()+120_000).toISOString().slice(11,16),end=new Date(Date.now()+3600_000).toISOString().slice(11,16),weekly={schema:'105.3.2.2-weekly',format:'105.3.2.2-weekly',programId:offer,effectiveFrom:today,timezone:'UTC',programZoomLink:'https://example.zoom.us/j/123456789',rules:[{id:'mou-published-rule',weekdays:[new Date().getUTCDay()],startTime:start,endTime:end,classIds:[klass],teacherIds:[teacher],moduleName:'Synthetic published MOU lesson',zoomLink:'',effectiveZoomLink:'https://example.zoom.us/j/123456789',zoomSource:'PROGRAM'}]};
 await db.prepare("INSERT INTO timetable_publications(activity_key,publication_id,scope_key,version_no,pattern,effective_from,timezone,snapshot_json,source_snapshot_sha256,conversion) VALUES(?,'mou-publication',?,10001,'WEEKLY',?,'UTC',?,?,'EXACT')").bind(scope,scope,today,JSON.stringify(weekly),'a'.repeat(64)).run();
 await recover();await handover();const cookie=await signIn(f,'studentB'),view=ok(await f.request('/api/circles/classrooms/mothers',{cookie}));
 assert.equal(view.timetable.state,'PUBLISHED',JSON.stringify(view));assert(view.timetable.sessions.length);const session=view.timetable.sessions[0];assert.equal(session.canJoin,true,JSON.stringify(view));assert.equal(session.eligibleToJoin,true);assert(session.eligibilityExpiresAt>Date.now());assert.equal(session.timezone,'UTC');assert.deepEqual(session.classIds,[klass]);assert.equal(session.classes[0].id,klass);assert(!JSON.stringify(view).includes('zoom.us'));
 assert.equal(ok(await f.request(session.joinPath,{cookie,method:'POST',body:{sessionId:session.id}})).destination,'https://example.zoom.us/j/123456789');
 await f.run('UPDATE timetable SET starts_at=? WHERE session_id=?',Date.now()+600_000,session.id);assert.equal((await f.request(session.joinPath,{cookie,method:'POST',body:{sessionId:session.id}})).status,403);
 const future=ok(await f.request('/api/circles/classrooms/mothers',{cookie})).timetable.sessions.find(s=>s.id===session.id);assert.equal(future.eligibleToJoin,true);assert.equal(future.canJoin,false);
 await f.run('UPDATE source_session_audiences SET class_ids_json=?,teacher_ids_json=? WHERE session_id=?',JSON.stringify(['different-class']),JSON.stringify([f.source.f.actors.teacherA]),session.id);
 assert(!ok(await f.request('/api/circles/classrooms/mothers',{cookie})).timetable.sessions.some(s=>s.id===session.id),'Learners do not receive another class session');
 const teacherCookie=await signIn(f,'teacherB');assert(!ok(await f.request('/api/circles/classrooms/mothers',{cookie:teacherCookie})).timetable.sessions.some(s=>s.id===session.id),'Teachers do not receive another teacher session');
 await f.run('UPDATE source_session_audiences SET class_ids_json=?,teacher_ids_json=? WHERE session_id=?',JSON.stringify([klass]),JSON.stringify([teacher]),session.id);
 await f.run('UPDATE timetable SET starts_at=?,cancelled=1 WHERE session_id=?',Date.now()+120_000,session.id);assert.equal((await f.request(session.joinPath,{cookie,method:'POST',body:{sessionId:session.id}})).status,403);
 const publicSnapshot=await f.content.get('public/schedule.json');assert(!await publicSnapshot.text().then(x=>x.includes('zoom.us')));
 await f.run('UPDATE source_access_people SET verified_at=? WHERE account_id=? AND offering_id=?',Date.now()-43200_001,student,offer);assert.equal((await f.request(session.joinPath,{cookie,method:'POST',body:{sessionId:session.id}})).body.code,'ACCESS_REFRESH_REQUIRED');await signIn(f,'studentB');
 await db.prepare("INSERT INTO program_publication_lifecycle VALUES(?,'mou-publication','CANCELLED',?)").bind(scope,new Date().toISOString()).run();await recover(12);
 assert.equal(await f.db.prepare('SELECT cancelled FROM timetable WHERE session_id=?').bind(session.id).first('cancelled'),1,'Actual Source cancellation reaches the stored target publication');
 assert(!ok(await f.request('/api/circles/classrooms/mothers',{cookie})).timetable.sessions.some(s=>s.id===session.id));assert.equal((await f.request(session.joinPath,{cookie,method:'POST',body:{sessionId:session.id}})).status,403);
 ok(await save({action:'participant',accountId:student,enrolled:false,live:false,purchased:false,reason:'Synthetic withdrawal'}));assert.equal((await f.request('/api/circles/classrooms/mothers',{cookie})).status,403,'A stale native Student role cannot restore Studio membership');
});

test('MOU native content operations preserve independent recording lessons and enforce account and scoped staff changes',async t=>{
 const {f,db,scope,offer,register,recover,handover,save}=await mouFixture(t);ok(await register());await recover();await handover();
 const admin=await signIn(f,'adminB'),student=await signIn(f,'studentB'),wrongAdmin=await signIn(f,'adminA');
 const document=await f.content.get('websites/site-course/versions/seed.json').then(x=>x.json()),websiteId='mou-native-created-site',date=new Date().toISOString().slice(0,10);
 const change=body=>f.request('/api/admin/'+offer,{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),...body}});
 const input={action:'website-create',websiteId,title:'Synthetic native MOU',document};
 assert.equal((await f.request('/api/admin/'+offer,{cookie:wrongAdmin,method:'POST',body:{operationId:crypto.randomUUID(),...input}})).status,403);
 ok(await change(input));ok(await change({action:'youtube',assetId:'mou-native-recording',videoId:'abcdefghijk',title:'Synthetic recording only'}));
 // This recording has no timetable row and no supporting reading. Neither is required.
 ok(await change({action:'attachment',attachmentId:'mou-native-attachment',websiteId,assetId:'mou-native-recording',lessonId:'mou-native-lesson',lessonDate:date,cohort:'verified-synthetic-cohort',title:'Recording-only lesson',audience:'RECORDING',published:true}));
 ok(await save({action:'mou-subject',displayKey:'surah-al-baqarah',websiteId,enabled:true}));
 assert.equal(await f.db.prepare('SELECT count(*) n FROM timetable WHERE session_id=?').bind('mou-native-lesson').first('n'),0);
 assert.equal((await f.request('/api/media/mou-native-attachment',{cookie:student})).status,403);
 f.source.resetMetrics();const result=await save({action:'paid-months',changes:[{accountId:f.source.f.actors.studentB,month:date.slice(0,7),cohort:'verified-synthetic-cohort',paid:true,reason:'Synthetic reviewed month'}]});ok(result);t.diagnostic(JSON.stringify({stage:'MOU native monthly save including preceding read',source:{...f.source.metrics},targetSave:result.body.localReadBudget}));
 const sourceBefore={...f.source.metrics};const media=await f.request('/api/media/mou-native-attachment',{cookie:student});ok(media);
 assert.equal(f.source.metrics.queries,sourceBefore.queries);assert.equal(f.source.metrics.rowsWritten,sourceBefore.rowsWritten);
 const state=ok(await f.request('/api/circles/classrooms/mothers',{cookie:admin}));assert.equal(state.subjects[0].website.canEdit,true);assert.equal(state.subjects[0].website.canOpen,false);
 await db.prepare("UPDATE role_assignments SET active=0 WHERE activity_key=? AND account_id=? AND role='PROGRAM_ADMIN'").bind(scope,f.source.f.actors.adminB).run();await recover(12);
 const denied=await f.request('/api/websites/'+websiteId+'/edit',{cookie:admin});assert([401,403].includes(denied.status),JSON.stringify(denied.body));
 await db.prepare('UPDATE accounts SET active=0 WHERE account_id=?').bind(f.source.f.actors.studentB).run();await recover(12);
 assert.equal((await f.request('/api/media/mou-native-attachment',{cookie:student})).status,401);
 assert.equal((await f.request('/api/circles/classrooms/mothers',{cookie:student})).status,401);
});

test('ongoing MOU support is isolated by recorded lesson/month/cohort, without invented completion or timetable',async t=>{
 const {f,offer,register,recover,handover,save}=await mouFixture(t);ok(await register());await recover();await handover();
 const {newCourse,newLesson,newSection,newBlock}=await import('../public/shared/model.mjs');
 const admin=await signIn(f,'adminB'),student=await signIn(f,'studentB'),other=await signIn(f,'studentA'),websiteId='mou-ongoing-support';
 const timetableBefore=await f.db.prepare('SELECT count(*) n FROM timetable WHERE offering_id=?').bind(offer).first('n');
 const note=(sectionId,editorial,text)=>{const section=newSection();section.id=sectionId;section.title='Verified support';const b=newBlock('note');b.aside=true;b.sourceKey='recording:'+editorial;b.text=text;section.blocks=[b];return section;};
 const document=newCourse();document.name='Ongoing synthetic MOU';document.lessons=[newLesson('Mixed-month reading','Support'),newLesson('Second February reading','Support')];
 document.lessons[0].sections=[note('support-feb','editorial-feb','FEBRUARY_PRIVATE_SUPPORT'),note('support-mar','editorial-mar','MARCH_PRIVATE_SUPPORT'),note('support-other','editorial-other','OTHER_COHORT_PRIVATE_SUPPORT'),note('support-mixed','editorial-feb','FEB_AND_MARCH_SHARED_PRIVATE_SUPPORT')];
 const second=newBlock('note');second.aside=true;second.sourceKey='recording:editorial-mar';second.text='SECOND_MARCH_PRIVATE_SUPPORT';document.lessons[0].sections[3].blocks.push(second);
 document.lessons[1].sections=[note('support-feb-again','editorial-feb','SECOND_FEBRUARY_READING')];
 const unassigned=newSection();unassigned.id='unassigned-support';unassigned.blocks[0].text='UNASSIGNED_PRIVATE_SOURCE';document.lessons[1].sections.push(unassigned);const shared=newSection();shared.id='reviewed-shared-pdf';shared.sourcePages=[2];shared.blocks[0].text='REVIEWED_SHARED_PDF_SUPPORT';document.lessons[1].sections.push(shared);
 const native=body=>f.request('/api/admin/'+offer,{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),...body}});
 const pdf=new TextEncoder().encode('%PDF-1.4\nSynthetic full notes\n%%EOF');ok(await f.request('/api/admin/'+offer+'/files?assetId=mou-full-pdf&filename=Notes.pdf&operationId='+crypto.randomUUID(),{cookie:admin,method:'PUT',body:pdf}));
 ok(await native({action:'website-create',websiteId,title:'Ongoing synthetic MOU',document}));
 ok(await save({action:'mou-subject',displayKey:'surah-al-baqarah',websiteId,enabled:true}));
 ok(await native({action:'attachment',attachmentId:'mou-full-pdf-link',assetId:'mou-full-pdf',websiteId,lessonId:'shared-notes-source',lessonDate:'2026-02-17',cohort:'original-mou-cohort',title:'Full shared PDF',audience:'WEBSITE',published:false}));
 // Add the whole PDF as deliberate full-text material. Partial-month readers must
 // not receive its URL or open it by guessing the attachment identity.
 document.materials.files=[{id:'full-pdf-material',assetId:'mou-full-pdf',title:'Full notes',description:'Shared PDF source'}];
 let view=ok(await f.request('/api/websites/'+websiteId+'/edit',{cookie:admin}));
 ok(await f.request('/api/websites/'+websiteId+'/edit',{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'save',revision:view.revision,document}}));
 for(const [suffix,date] of [['feb','2026-02-17'],['mar','2026-03-03'],['may','2026-05-05'],['other','2026-02-17']]){
  ok(await native({action:'youtube',assetId:'mou-support-video-'+suffix,videoId:'abcdefghijk',title:'Synthetic '+suffix}));
  ok(await native({action:'attachment',attachmentId:'mou-support-link-'+suffix,assetId:'mou-support-video-'+suffix,websiteId,lessonId:'mou-recorded-'+suffix,lessonDate:date,cohort:suffix==='other'?'different-mou-cohort':'original-mou-cohort',title:'Recorded '+suffix,audience:'RECORDING',published:true}));
 }
 ok(await save({action:'mou-subject',displayKey:'surah-al-baqarah',websiteId,enabled:true}));
 const bindings=['feb','mar','other'].map(s=>({editorialLessonId:'editorial-'+s,nativeLessonId:'mou-recorded-'+s,assetId:'mou-support-video-'+s}));
 const sections=[{readingId:document.lessons[1].id,sectionId:'reviewed-shared-pdf',lessonIds:['mou-recorded-feb','mou-recorded-mar'],access:'ANY'},{readingId:document.lessons[0].id,sectionId:'support-other',lessonIds:['mou-recorded-other']},{readingId:document.lessons[0].id,sectionId:'support-feb',lessonIds:['mou-recorded-feb']},{readingId:document.lessons[0].id,sectionId:'support-mar',lessonIds:['mou-recorded-mar']},{readingId:document.lessons[0].id,sectionId:'support-mixed',lessonIds:['mou-recorded-feb','mou-recorded-mar']},{readingId:document.lessons[1].id,sectionId:'support-feb-again',lessonIds:['mou-recorded-feb']}];
 view=ok(await f.request('/api/websites/'+websiteId+'/edit',{cookie:admin}));const supportInput={operationId:crypto.randomUUID(),action:'recording-support',revision:view.revision,bindings,sections};
 const indexed=ok(await f.request('/api/websites/'+websiteId+'/edit',{cookie:admin,method:'POST',body:supportInput}));assert.equal(ok(await f.request('/api/websites/'+websiteId+'/edit',{cookie:admin,method:'POST',body:supportInput})).replayed,true);
 ok(await f.request('/api/websites/'+websiteId+'/edit',{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'publish',revision:indexed.revision}}));
 ok(await save({action:'paid-months',changes:['2026-02','2026-05'].map(month=>({accountId:f.source.f.actors.studentB,month,cohort:'original-mou-cohort',paid:true,reason:'Synthetic verified month'}))}));
 const sourceBefore={...f.source.metrics},read=await f.request('/api/websites/'+websiteId,{cookie:student});ok(read);const text=JSON.stringify(read.body);
 assert.equal(read.body.contentAccess.mode,'RECORDING_SCOPED');assert.equal(read.body.document.lessons.length,2);assert(text.includes('FEBRUARY_PRIVATE_SUPPORT'));assert(text.includes('SECOND_FEBRUARY_READING'));assert(text.includes('REVIEWED_SHARED_PDF_SUPPORT'));assert(!text.includes('MARCH_PRIVATE_SUPPORT'));assert(!text.includes('OTHER_COHORT_PRIVATE_SUPPORT'));assert(!text.includes('FEB_AND_MARCH'));assert(!text.includes('UNASSIGNED_PRIVATE_SOURCE'));assert.equal(read.body.assets.length,0);assert.equal(f.source.metrics.queries,sourceBefore.queries);
 const growth=JSON.stringify(Array.from({length:4000},(_,i)=>'unrelated-mou-'+i));
 await f.run("INSERT INTO attachments SELECT value,?,?,'mou-support-video-mar',value,'2020-01-01','different-mou-cohort','Unrelated recording','RECORDING',1 FROM json_each(?)",offer,websiteId,growth);
 const afterGrowth=await f.request('/api/websites/'+websiteId,{cookie:student});ok(afterGrowth);assert(afterGrowth.reads<=read.reads+12,JSON.stringify({before:read.reads,after:afterGrowth.reads}));assert.equal(f.source.metrics.queries,sourceBefore.queries);
 t.diagnostic(JSON.stringify({stage:'MOU protected support reading',before:{queries:read.queries,rowsRead:read.reads,rowsWritten:Number(read.response.headers.get('X-Local-D1-Rows-Written'))},after4000UnrelatedRecordings:{queries:afterGrowth.queries,rowsRead:afterGrowth.reads,rowsWritten:Number(afterGrowth.response.headers.get('X-Local-D1-Rows-Written'))},academyQueries:0}));
 assert.equal((await f.request('/api/media/mou-full-pdf-link',{cookie:student})).status,403);
 const feed=ok(await f.request('/api/offerings/'+offer+'/media?website='+websiteId,{cookie:student}));assert.deepEqual(feed.media.map(x=>x.lesson_id).sort(),['mou-recorded-feb','mou-recorded-may']);assert.equal(feed.mediaBindings.length,1);ok(await f.request('/api/media/mou-support-link-may',{cookie:student}));
 const editPath='/api/websites/'+websiteId+'/edit',edit=ok(await f.request(editPath,{cookie:admin})),changed=structuredClone(edit.document);changed.lessons[0].sections[0].blocks[0].text='EDITED_FEBRUARY_SUPPORT';changed.lessons[0].sections[1].blocks[0].sourceKey='recording:editorial-feb';
 const addedSection=structuredClone(changed.lessons[0].sections[0]);addedSection.id='new-unindexed-section';addedSection.blocks[0].id='new-unindexed-block';addedSection.blocks[0].text='NEW_UNASSIGNED_SUPPORT';changed.lessons[0].sections.push(addedSection);
 let edited=ok(await f.request(editPath,{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'save',revision:edit.revision,document:changed}}));
 let published=ok(await f.request(editPath,{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'publish',revision:edited.revision}}));
 const afterEdit=ok(await f.request('/api/websites/'+websiteId,{cookie:student}));assert(JSON.stringify(afterEdit.document).includes('EDITED_FEBRUARY_SUPPORT'));assert(!JSON.stringify(afterEdit.document).includes('NEW_UNASSIGNED_SUPPORT'));assert(!afterEdit.document.lessons.flatMap(l=>l.sections).some(s=>s.id==='support-mar'),'Conflicting changed sourceKey drops the old March association');
 const afterEditFeed=ok(await f.request('/api/offerings/'+offer+'/media?website='+websiteId,{cookie:student}));assert.equal(afterEditFeed.mediaBindings.length,1);
 const restored=ok(await f.request(editPath,{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'restore',revision:published.revision,historyRevision:indexed.revision}}));
 ok(await f.request(editPath,{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'publish',revision:restored.revision}}));assert(JSON.stringify(ok(await f.request('/api/websites/'+websiteId,{cookie:student})).document).includes('FEBRUARY_PRIVATE_SUPPORT'));
 assert.equal(await f.db.prepare('SELECT completion_date FROM websites WHERE website_id=?').bind(websiteId).first('completion_date'),null);assert.equal(await f.db.prepare('SELECT count(*) n FROM timetable WHERE offering_id=?').bind(offer).first('n'),timetableBefore,'Recording imports do not create or republish timetable sessions');
 ok(await save({action:'surah-grant',accountId:f.source.f.actors.studentA,websiteId,enabled:true,reason:'Deliberate text-only grant'}));const granted=ok(await f.request('/api/websites/'+websiteId,{cookie:other}));assert.equal(granted.contentAccess.mode,'FULL_TEXT');assert(JSON.stringify(granted.document).includes('MARCH_PRIVATE_SUPPORT'));ok(await f.request('/api/media/mou-full-pdf-link',{cookie:other}));assert.equal((await f.request('/api/media/mou-support-link-feb',{cookie:other})).status,403);
 ok(await save({action:'paid-months',changes:[{accountId:f.source.f.actors.studentB,month:'2026-02',cohort:'original-mou-cohort',paid:false,reason:'Synthetic removal'}]}));
 const removed=ok(await f.request('/api/websites/'+websiteId,{cookie:student}));assert.equal(removed.document.lessons.length,0,'May recording-only rights do not leak another month or unassigned notes');
});
