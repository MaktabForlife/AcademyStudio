import test from 'node:test';
import assert from 'node:assert/strict';
import {recordingAttachmentFixture} from './recording-attachment-fixture.mjs';
import {buildNativeMouPackage} from '../tools/native-mou-attachment-package.mjs';
import {mouOffering} from '../public/shared/native-mou-import.mjs';
import {preparedMouKey} from '../src/prepared-recordings.mjs';
import {reviewMouCatalogue,runMouLesson,mouLessonState} from '../public/shared/mou-prepared-review.mjs';
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
async function setup(){
 const f=await recordingAttachmentFixture({attach:false,authorityMode:'ACADEMY',offeringId:mouOffering,cohort:'CLS-39751608-d213-4c66-a4d5-dccfbbeb1c57'});
 try{
  const q=new URLSearchParams();for(const l of f.packages.lessons.filter(l=>l.kind==='studio'))q.append('source',new URL(l.sourceURL).searchParams.get('v'));
  const preflight=ok(await f.request('/api/admin/'+f.offer+'/recording-attachments?'+q,{cookie:f.admin}));
  const plan=buildNativeMouPackage({preflight,...f.packages});await f.content.put(preparedMouKey(f.offer),JSON.stringify(plan));
  const calls=[],api=async(path,{body}={})=>{calls.push({path,action:body?.action});const r=await f.request(path,{cookie:f.admin,...(body?{method:'POST',body}:{})});if(r.status!==200)throw Object.assign(Error(r.body.error),{status:r.status,code:r.body.code});return r.body;};
  return {f,plan,api,calls,queue:()=>api('/api/admin/'+f.offer+'/prepared-recordings')};
 }catch(e){await f.close();throw e;}
}
test('four private reviews require current scoped Admin authority and contain no learner/public data endpoint',async t=>{
 const {f,plan,queue}=await setup();t.after(()=>f.close());
 const snapshot=await queue(),items=await reviewMouCatalogue(snapshot.plan);assert.equal(items.length,4);assert(items.every(i=>i.companion.summary&&i.videoId));assert.deepEqual(snapshot.plan,plan);
 for(const cookie of [null,f.learner,(await f.login('outsider')).cookie]){const r=await f.request('/api/admin/'+f.offer+'/prepared-recordings',{...(cookie?{cookie}:{})});assert([401,403].includes(r.status));assert(!r.body.plan);}
 await f.run('UPDATE accounts SET verified_at=0 WHERE account_id=?','admin');assert.equal((await f.request('/api/admin/'+f.offer+'/prepared-recordings',{cookie:f.admin})).status,401);
});
test('resume the prior three private steps, attach without publication, then publish only one lesson with safe exact retries',async t=>{
 const {f,plan,api,queue,calls}=await setup();t.after(()=>f.close());const first=plan.items[0];
 for(const row of plan.requests.slice(0,3))await api(row.path,{body:row.body});
 const before=JSON.stringify(await f.db.prepare('SELECT * FROM websites WHERE website_id=?').bind(f.baqarah.websiteId).first());
 await assert.rejects(runMouLesson({plan,itemId:first.editorialLessonId,phase:'publish',api}),/Attach this lesson privately/);
 await runMouLesson({plan,itemId:first.editorialLessonId,phase:'attach',api});
 let fresh=await queue(),item=(await reviewMouCatalogue(plan))[0],state=mouLessonState(plan,item,fresh.facts);assert(state.attached&&!state.published);assert.equal(state.website.enabled,0);assert.equal(state.asset.companion_published_key,null);
 for(const path of ['/api/websites/'+first.websiteId,'/api/media/'+first.attachmentId,'/api/media/'+first.attachmentId+'/companion'])assert.equal((await f.request(path,{cookie:f.learner})).status,404);
 const writes=calls.filter(c=>c.action).length;await runMouLesson({plan,itemId:first.editorialLessonId,phase:'attach',api});assert.equal(calls.filter(c=>c.action).length,writes);
 await runMouLesson({plan,itemId:first.editorialLessonId,phase:'publish',api});await runMouLesson({plan,itemId:first.editorialLessonId,phase:'publish',api});
 fresh=await queue();assert(mouLessonState(plan,item,fresh.facts).published);
 assert.equal((await f.db.prepare('SELECT count(*) n FROM attachments WHERE website_id<>?').bind(f.baqarah.websiteId).first()).n,1);
 assert.equal((await f.db.prepare('SELECT count(*) n FROM recording_companions WHERE published_key IS NOT NULL').first()).n,1);
 assert.equal(JSON.stringify(await f.db.prepare('SELECT * FROM websites WHERE website_id=?').bind(f.baqarah.websiteId).first()),before);
 const companion=ok(await f.request('/api/media/'+first.attachmentId+'/companion',{cookie:f.learner}));assert.equal(companion.summary,item.companion.summary);assert.equal(companion.quotations.length,0);
 const other=(await f.login('grant-only')).cookie;await f.run("INSERT INTO website_months VALUES('grant-only',?,'2026-10')",f.offer);assert.equal((await f.request('/api/media/'+first.attachmentId+'/companion',{cookie:other})).status,403);
});
test('lost acknowledgements reuse original receipts, and an account change stops all remaining steps',async t=>{
 const {f,plan,api,queue}=await setup();t.after(()=>f.close());const item=plan.items[1];let lost=false;
 const unreliable=async(path,options)=>{const r=await api(path,options);if(options?.body?.action==='companion-save'&&!lost){lost=true;throw Error('Lost acknowledgement');}return r;};
 await assert.rejects(runMouLesson({plan,itemId:item.editorialLessonId,phase:'attach',api:unreliable}),/Lost acknowledgement/);
 await runMouLesson({plan,itemId:item.editorialLessonId,phase:'attach',api});
 let changed=false;const changing=async(path,options)=>{const r=await api(path,options);if(options?.body?.action==='publish')changed=true;return r;};
 await assert.rejects(runMouLesson({plan,itemId:item.editorialLessonId,phase:'publish',api:changing,current:()=>{if(changed)throw Error('Account changed');}}),/Account changed/);
 let state=mouLessonState(plan,(await reviewMouCatalogue(plan))[1],(await queue()).facts);assert(!state.published);assert.equal(state.asset.companion_published_key,null);
 await runMouLesson({plan,itemId:item.editorialLessonId,phase:'publish',api});assert(mouLessonState(plan,(await reviewMouCatalogue(plan))[1],(await queue()).facts).published);
});
test('changed drafts, duplicate source associations and changed cohorts are held without overwriting',async t=>{
 const {f,plan,api,queue}=await setup();t.after(()=>f.close());const item=plan.items[2];await runMouLesson({plan,itemId:item.editorialLessonId,phase:'attach',api});
 await f.run('UPDATE websites SET draft_key=?,revision=revision+1 WHERE website_id=?','saved-admin-edit',item.websiteId);
 await assert.rejects(runMouLesson({plan,itemId:item.editorialLessonId,phase:'publish',api}),/saved edits/);
 let fresh=await queue(),reviewed=(await reviewMouCatalogue(plan))[3];fresh.facts.scope.classes_json='[]';assert.throws(()=>mouLessonState(plan,reviewed,fresh.facts),/cohort changed/);
 fresh=await queue();fresh.facts.assets.push({youtube_id:reviewed.videoId,asset_id:'other-a'},{youtube_id:reviewed.videoId,asset_id:'other-b'});assert.throws(()=>mouLessonState(plan,reviewed,fresh.facts),/multiple native/);
});
