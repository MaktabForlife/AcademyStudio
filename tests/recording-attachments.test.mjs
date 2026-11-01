import test from 'node:test';import assert from 'node:assert/strict';
import {buildNativeMouPackage} from '../tools/native-mou-attachment-package.mjs';
import {recordingAttachmentFixture} from './recording-attachment-fixture.mjs';
import {seriesRecordings,recordingList,recordingDetail} from '../public/shared/recording-website.mjs';
import {learnerCompanion,recordingRetention} from '../public/shared/learner-companion.mjs';
import {normalizeMouClassroom} from '../public/shared/mou-classroom.mjs';
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
test('four actual MOU outputs use native guards and preserve Baqarah, private data and month/cohort rights',async t=>{
 const f=await recordingAttachmentFixture();t.after(()=>f.close());
 const response=await f.request('/api/circles/classrooms/mothers',{cookie:f.learner}),view=normalizeMouClassroom(ok(response),{accountId:'learner',epoch:1});
 assert.equal(view.subjects.length,10);assert.equal(view.subjects.filter(s=>s.website?.canOpen).length,5);assert.equal(view.subjects[0].website.id,f.baqarah.websiteId);assert.equal(view.subjects.filter(s=>s.state==='COMING_SOON').length,5);
 const receipts=[];
 for(const item of f.receipts){
  const feed=await f.request('/api/offerings/'+f.offer+'/media?website='+item.websiteId,{cookie:f.learner}),body=ok(feed);assert.equal(body.media.length,1);assert.equal(body.companions.length,1);
  const detail=await f.request('/api/media/'+item.attachmentId+'/companion',{cookie:f.learner}),companion=ok(detail);assert.deepEqual(companion,item.expectedCompanion);
  assert.doesNotMatch(JSON.stringify(companion),/quoteCandidates|reviewFlags|sourcebook|assignmentEvidence|sourceTranscript|selectedQuoteIds|originalSourceTitle|verification|evidence|https?:/);
  assert.deepEqual(learnerCompanion(companion),companion,'The canonical learner object must round-trip without dropping references');assert.equal(companion.quotations.length,0);if(item.editorialLessonId==='trial-jWocCuATE14')assert.equal(companion.references.length,11);
  const [entry]=seriesRecordings({media:body.media,companions:body.companions,details:new Map([[item.attachmentId,companion]])});assert.equal(entry.summary,companion.summary);assert.equal(entry.duration, f.packages.manifest.items.find(i=>i.editorialLessonId===item.editorialLessonId).durationSeconds);const html=recordingDetail(entry,{lessons:[]});assert(recordingList({entries:[entry]}).includes('data-listen="1"'));assert(html.includes('<details class="rs-topics">'));assert(html.indexOf('rs-player-slot')<html.indexOf('Follow along by topic'));
  assert.equal((await f.request('/api/media/'+item.attachmentId+'/companion',{cookie:(await f.login('grant-only')).cookie})).status,403);
  receipts.push({id:item.editorialLessonId,feedQueries:feed.queries,feedRowsRead:feed.reads,feedRowsWritten:Number(feed.response.headers.get('X-Local-D1-Rows-Written')),detailQueries:detail.queries,detailRowsRead:detail.reads,writeBudget:item.localWriteBudget});
 }
 assert.equal((await f.db.prepare('SELECT COUNT(*) count FROM attachments WHERE website_id=?').bind(f.baqarah.websiteId).first()).count,26);
 const site=await f.db.prepare('SELECT draft_key,published_key,revision FROM websites WHERE website_id=?').bind(f.baqarah.websiteId).first();assert.equal(site.revision,0);assert.equal(site.published_key,site.draft_key);
 const selected=f.receipts[0],baseline=await f.request('/api/offerings/'+f.offer+'/media?website='+selected.websiteId,{cookie:f.learner});
 await f.run("WITH RECURSIVE n(v) AS(SELECT 1 UNION ALL SELECT v+1 FROM n WHERE v<1000) INSERT INTO attachments SELECT 'unrelated-'||v,'course',NULL,?,'unrelated-'||v,'2026-10-01','','Unavailable unrelated recording','RECORDING',1 FROM n",selected.assetId);
 await f.run("INSERT INTO recording_companions SELECT attachment_id,'unrelated',1,'unreachable-private-key','unreachable-private-key','{\"summary\":\"PRIVATE UNRELATED\"}',600 FROM attachments WHERE attachment_id LIKE 'unrelated-%'");
 const after=await f.request('/api/offerings/'+f.offer+'/media?website='+selected.websiteId,{cookie:f.learner});assert.equal(after.queries,baseline.queries);assert.equal(after.reads,baseline.reads);assert.doesNotMatch(JSON.stringify(after.body),/PRIVATE UNRELATED|Unavailable unrelated/);
 await f.run("UPDATE attachments SET cohort='other-cohort' WHERE attachment_id=?",f.receipts[0].attachmentId);
 const hidden=ok(await f.request('/api/offerings/'+f.offer+'/media?website='+f.receipts[0].websiteId,{cookie:f.learner}));assert.deepEqual(hidden.media,[]);assert.deepEqual(hidden.companions,[]);
 t.diagnostic(JSON.stringify({classroom:{queries:response.queries,rowsRead:response.reads},receipts,hostedCalls:0}));
});
test('native retries, stale drafts, saved publications and immediate session invalidation',async t=>{
 const f=await recordingAttachmentFixture();t.after(()=>f.close());const item=f.receipts[0],lesson=f.packages.lessons[0];
 const input={action:'companion-save',operationId:crypto.randomUUID(),attachmentId:item.attachmentId,revision:2,sourceRevision:f.packages.manifest.items[0].sourceRevision,durationSeconds:lesson.durationSeconds,companion:{...item.expectedCompanion,summary:'A deliberate saved Admin edit.'}};
 const oversized={...input,operationId:crypto.randomUUID(),companion:{...input.companion,references:Array.from({length:50},()=>({arabic:'ع'.repeat(3500),meaning:'Meaning',time:'00:12'}))}};assert.equal((await f.request('/api/admin/'+f.offer,{cookie:f.admin,method:'POST',body:oversized})).status,413,'Arabic-rich content is bounded in UTF-8 bytes before saving');
 const request=()=>f.request('/api/admin/'+f.offer,{cookie:f.admin,method:'POST',body:input});assert.equal(ok(await request()).revision,3);assert.equal(ok(await request()).replayed,true);
 assert.equal(ok(await f.request('/api/media/'+item.attachmentId+'/companion',{cookie:f.learner})).summary,item.expectedCompanion.summary);
 assert.equal((await f.request('/api/admin/'+f.offer,{cookie:f.admin,method:'POST',body:{...input,operationId:crypto.randomUUID()}})).status,409);
 await f.run("UPDATE sessions SET revoked=1 WHERE account_id='learner'");assert.equal((await f.request('/api/media/'+item.attachmentId+'/companion',{cookie:f.learner})).status,401);
 const saved=await f.db.prepare('SELECT draft_key,published_key FROM recording_companions WHERE attachment_id=?').bind(item.attachmentId).first();assert.notEqual(saved.draft_key,saved.published_key);const edited=await (await f.content.get(saved.draft_key)).json();assert.equal(edited.references.length,item.expectedCompanion.references.length,'A native canonical resave retains all permitted references');
});
test('publication allowlist and immutable upload retention reject missing times and month-end resets',()=>{
 const d={summary:'Exact approved text.',quote:{verified:false,text:'private'},reviewFlags:['secret'],evidence:{private:true},references:[{enabled:false,verification:'matched',arabic:'held'}]};
 assert.equal(learnerCompanion(d).summary,d.summary);assert.deepEqual(learnerCompanion(d).quotations,[]);assert.deepEqual(learnerCompanion(d).references,[]);assert.throws(()=>recordingRetention(null));
 const policy=recordingRetention('2026-10-31T09:00:00Z',{now:Date.parse('2026-11-15T09:00:00Z')});assert.equal(policy.recordingExpiresAt,'2026-11-14T09:00:00.000Z');assert.equal(policy.companionExpiresAt,'2026-11-30T09:00:00.000Z');assert(policy.recordingExpired);assert(!policy.companionExpired);assert.equal(recordingRetention(null,{permanent:true}).companionExpiresAt,null);
});

test('the exact guarded four-MOU request package executes natively once and never overwrites an existing association',async t=>{
 const f=await recordingAttachmentFixture({attach:false});t.after(()=>f.close());
 const params=new URLSearchParams();for(const l of f.packages.lessons.filter(l=>l.kind==='studio'))params.append('source',new URL(l.sourceURL).searchParams.get('v'));
 const preflight=await f.request('/api/admin/'+f.offer+'/recording-attachments?'+params,{cookie:f.admin});const plan=buildNativeMouPackage({preflight:ok(preflight),...f.packages,cohort:'local-review',localOnly:true});assert.equal(plan.items.length,4);assert.equal(plan.requests.length,32);
 const writes=[];
 for(const step of plan.requests){const response=await f.request(step.path,{cookie:f.admin,method:step.method,body:step.body});ok(response);writes.push({step:step.name,queries:response.queries,rowsRead:response.reads,rowsWritten:Number(response.response.headers.get('X-Local-D1-Rows-Written'))});assert.equal(ok(await f.request(step.path,{cookie:f.admin,method:step.method,body:step.body})).replayed,true);}
 for(const item of plan.items){const view=ok(await f.request('/api/media/'+item.attachmentId+'/companion',{cookie:f.learner}));assert.equal(view.quotations.length,0);}
 const stage=plan.requests.find(r=>r.body.action==='attachment'),conflict=await f.request(stage.path,{cookie:f.admin,method:'POST',body:{...stage.body,operationId:crypto.randomUUID(),title:'Do not overwrite the accepted saved entry'}});assert.equal(conflict.status,409);
 assert.throws(()=>buildNativeMouPackage({preflight:{...preflight.body,scope:{...preflight.body.scope,classes_json:'[]'}},...f.packages}),/cohort/);
 t.diagnostic(JSON.stringify({preflight:{queries:preflight.queries,rowsRead:preflight.reads,rowsWritten:Number(preflight.response.headers.get('X-Local-D1-Rows-Written'))},requests:plan.requests.length,writeTotals:writes.reduce((s,r)=>({queries:s.queries+r.queries,rowsRead:s.rowsRead+r.rowsRead,rowsWritten:s.rowsWritten+r.rowsWritten}),{queries:0,rowsRead:0,rowsWritten:0}),writes,hostedCalls:0}));
});

test('retained website-month rights preserve Baqarah navigation without leaking recording names, counts or companions',async t=>{
 const f=await recordingAttachmentFixture();t.after(()=>f.close());await f.run("INSERT INTO website_months VALUES('grant-only',?,'2026-10')",f.offer);const cookie=(await f.login('grant-only')).cookie;
 const view=normalizeMouClassroom(ok(await f.request('/api/circles/classrooms/mothers',{cookie})),{accountId:'grant-only',epoch:1});assert.equal(view.subjects[0].website.id,f.baqarah.websiteId);assert.equal(view.subjects[0].website.canOpen,true);
 const page=ok(await f.request('/api/websites/'+f.baqarah.websiteId,{cookie}));assert.equal(page.contentAccess.mode,'RECORDING_SCOPED');assert.deepEqual(page.document.lessons,[]);
 const media=ok(await f.request('/api/offerings/'+f.offer+'/media?website='+f.baqarah.websiteId,{cookie}));assert.deepEqual(media.media,[]);assert.deepEqual(media.companions,[]);
 assert.equal((await f.request('/api/media/'+f.receipts[0].attachmentId+'/companion',{cookie})).status,403);
 t.diagnostic(JSON.stringify({websiteMonthOnly:true,baqarahNavigationPreserved:true,recordings:0,companions:0}));
});
test('canonical quotations and references survive authorised resave while private keys remain excluded',()=>{
 const canonical={...learnerCompanion({summary:'Saved summary.',references:[{verification:'matched',arabic:'عربي',meaning:'Meaning',time:'00:12'}],quote:{verified:true,text:'Exact verified words',speaker:'Teacher',time:'00:30'}}),privateReview:'secret'};
 const expected={...canonical};delete expected.privateReview;assert.deepEqual(learnerCompanion(canonical),expected);assert.doesNotMatch(JSON.stringify(learnerCompanion(canonical)),/secret|privateReview/);
});
