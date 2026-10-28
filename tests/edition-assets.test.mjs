import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './fixture.mjs';
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
test('current edition files survive thousands of historical and duplicate attachments with bounded reads',async t=>{
 const f=await fixture();try{
  const admin=(await f.login('admin')).cookie,learner=(await f.login()).cookie,pdf=new TextEncoder().encode('%PDF-1.7 synthetic');
  for(const asset of ['history-file','z-published-file','z-draft-file']){await f.run('INSERT INTO objects VALUES(?,?,?,?,?,?,NULL)',asset,'shared/'+asset,'application/pdf',asset+'.pdf',pdf.length,'synthetic');await f.media.put('shared/'+asset,pdf);}
  await f.run("INSERT INTO attachments VALUES('z-published-attachment','course','site-course','z-published-file','stable-lesson','2026-10-28','','Published PDF','WEBSITE',1)");
  await f.run("INSERT INTO attachments VALUES('z-draft-attachment','course','site-course','z-draft-file','stable-lesson','2026-10-28','','Draft PDF','WEBSITE',0)");
  await f.run("INSERT INTO published_assets VALUES('site-course','z-published-file')");
  const published=structuredClone(f.doc);published.materials.files=[{id:crypto.randomUUID(),assetId:'z-published-file',title:'Published PDF',description:''}];
  const draft=structuredClone(published);draft.materials.files.push({id:crypto.randomUUID(),assetId:'z-draft-file',title:'Draft PDF',description:''});
  await f.content.put('websites/site-course/versions/published.json',JSON.stringify(published));await f.content.put('websites/site-course/versions/draft.json',JSON.stringify(draft));await f.run("UPDATE websites SET published_key='websites/site-course/versions/published.json',draft_key='websites/site-course/versions/draft.json' WHERE website_id='site-course'");
  const open=()=>f.request('/api/websites/site-course/edit',{cookie:admin}),read=()=>f.request('/api/websites/site-course',{cookie:learner}),beforeEdit=await open(),beforeRead=await read();ok(beforeEdit);ok(beforeRead);
  const historical=JSON.stringify(Array.from({length:4000},(_,i)=>'a-history-'+String(i).padStart(5,'0')));await f.run("INSERT INTO attachments SELECT value,'course','site-course','history-file','old-lesson','2024-01-01','',value,'WEBSITE',1 FROM json_each(?)",historical);
  const duplicate=JSON.stringify(Array.from({length:1000},(_,i)=>'b-duplicate-'+String(i).padStart(5,'0')));await f.run("INSERT INTO attachments SELECT value,'course','site-course','z-published-file','stable-lesson','2026-10-28','',value,'WEBSITE',1 FROM json_each(?)",duplicate);
  const privateDuplicates=JSON.stringify(Array.from({length:50},(_,i)=>'c-private-'+String(i).padStart(5,'0')));await f.run("INSERT INTO attachments SELECT value,'course','site-course','z-draft-file','stable-lesson','2026-10-28','',value,'WEBSITE',0 FROM json_each(?)",privateDuplicates);
  const afterEdit=await open(),afterRead=await read();assert.deepEqual(ok(afterEdit).assets.map(a=>a.asset_id),['z-draft-file','z-published-file']);assert.deepEqual(ok(afterRead).assets.map(a=>a.asset_id),['z-published-file']);assert(afterEdit.reads<=beforeEdit.reads+8,`${beforeEdit.reads} -> ${afterEdit.reads}`);assert(afterRead.reads<=beforeRead.reads+8,`${beforeRead.reads} -> ${afterRead.reads}`);
  assert.equal((await f.request(afterRead.body.assets[0].url,{cookie:learner})).status,200);assert.equal((await f.request('/api/media/z-draft-attachment',{cookie:learner})).status,404);
  assert.deepEqual(ok(await f.request('/api/websites/site-course/export',{cookie:admin})).assets.map(a=>a.asset_id),['z-draft-file','z-published-file']);
  const first=await f.request('/api/websites/site-course/assets',{cookie:admin});assert.equal(ok(first).assets.length,50);assert.equal(first.body.more,true);assert.equal(first.body.nextCursor,first.body.assets.at(-1).attachment_id);assert(first.reads<180,'Picker read count: '+first.reads);
  const next=ok(await f.request('/api/websites/site-course/assets?after='+first.body.nextCursor,{cookie:admin}));assert(next.assets[0].attachment_id>first.body.nextCursor);
  assert.equal((await f.request('/api/websites/site-course/assets',{cookie:learner})).status,403);
  const exact=await f.request('/api/websites/site-course/assets?assetId=history-file',{cookie:admin});assert.equal(ok(exact).assets.length,1);assert.equal(exact.body.assets[0].asset_id,'history-file');assert(exact.reads<25,'Exact lookup read count: '+exact.reads);
  assert.equal(await f.db.prepare("SELECT count(*) n FROM attachments WHERE website_id='site-course'").first('n'),5052);
  const saved=await f.request('/api/websites/site-course/edit',{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'save',revision:0,document:draft}});ok(saved);assert(saved.reads<80,'Save scans history: '+saved.reads);
  const publishedEdition=await f.request('/api/websites/site-course/edit',{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'publish',revision:1}});ok(publishedEdition);assert(publishedEdition.reads<150,'Publish scans or rewrites history: '+publishedEdition.reads);
  const released=ok(await read()).assets.find(row=>row.asset_id==='z-draft-file');assert(released);assert.equal((await f.request(released.url,{cookie:learner})).status,200);
  assert.equal(await f.db.prepare("SELECT count(*) n FROM attachments WHERE website_id='site-course' AND asset_id='z-draft-file' AND published=1").first('n'),1);
  assert.equal((await f.request('/api/media/z-draft-attachment',{cookie:learner})).status,404);assert.equal(await f.db.prepare("SELECT count(*) n FROM attachments WHERE website_id='site-course'").first('n'),5052);
  t.diagnostic(JSON.stringify({historicalAttachments:4000,duplicateAttachments:1050,editorBefore:beforeEdit.reads,editorAfter:afterEdit.reads,readerBefore:beforeRead.reads,readerAfter:afterRead.reads,picker:first.reads,exact:exact.reads,save:saved.reads,publish:publishedEdition.reads}));
 }finally{await f.close();}
});
test('exact unused-file lookup is scoped and does not publish an uploaded attachment',async()=>{
 const f=await fixture();try{const admin=(await f.login('admin')).cookie,learner=(await f.login()).cookie;
  const upload=ok(await f.request('/api/admin/course/files?'+new URLSearchParams({assetId:'unused-pdf',operationId:crypto.randomUUID(),filename:'New.pdf'}),{cookie:admin,method:'PUT',body:new TextEncoder().encode('%PDF-1.7 new file')}));
  ok(await f.request('/api/admin/course',{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'attachment',attachmentId:'unused-attachment',assetId:upload.assetId,websiteId:'site-course',lessonId:'stable-lesson',lessonDate:'2026-10-28',cohort:'',title:'Unused PDF',audience:'WEBSITE',published:false}}));
  assert.equal(ok(await f.request('/api/websites/site-course/edit',{cookie:admin})).assets.length,0);
  const exact=ok(await f.request('/api/websites/site-course/assets?assetId=unused-pdf',{cookie:admin}));assert.equal(exact.assets[0].name,'New.pdf');assert.equal(exact.assets[0].type,'application/pdf');assert.equal(exact.assets[0].url,'/api/media/unused-attachment');
  assert.equal(ok(await f.request('/api/websites/site-surah/assets?assetId=unused-pdf',{cookie:admin})).assets.length,0);assert.equal((await f.request(exact.assets[0].url,{cookie:learner})).status,404);
  await f.run("UPDATE accounts SET global_admin=0 WHERE account_id='admin'");assert.equal((await f.request('/api/websites/site-course/assets?assetId=unused-pdf',{cookie:admin})).status,403);
 }finally{await f.close();}
});
