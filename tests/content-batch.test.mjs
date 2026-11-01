import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './fixture.mjs';
test('a bounded media batch uses current Admin authority, preserves optional Course dates and stays bounded beside unrelated playlists',async t=>{
 const f=await fixture();try{const admin=(await f.login('admin')).cookie,learner=(await f.login('learner')).cookie;
  const videos={operationId:crypto.randomUUID(),action:'content-batch',changes:Array.from({length:25},(_,i)=>({action:'youtube',assetId:'batch-video-'+i,title:'Recording '+i,videoId:'UzKY4mmZTPQ'}))};
  assert.equal((await f.request('/api/admin/course',{cookie:learner,method:'POST',body:videos})).status,403);
  const saved=await f.request('/api/admin/course',{cookie:admin,method:'POST',body:videos});assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal((await f.request('/api/admin/course',{cookie:admin,method:'POST',body:videos})).body.replayed,true);
  const attach=async prefix=>{const command={action:'content-batch',operationId:crypto.randomUUID(),changes:videos.changes.map((row,i)=>({action:'attachment',assetId:row.assetId,attachmentId:prefix+'-attachment-'+i,websiteId:'site-course',lessonId:prefix+'-lesson-'+i,title:row.title,audience:'RECORDING',published:true}))};return {...await f.request('/api/admin/course',{cookie:admin,method:'POST',body:command}),command};};
  const attached=await attach('batch');assert.equal(attached.status,200,JSON.stringify(attached.body));
  assert(attached.queries<=45,JSON.stringify({queries:attached.queries,rowsRead:attached.reads}));
  assert.equal((await f.request('/api/admin/course',{cookie:admin,method:'POST',body:attached.command})).body.replayed,true);
  assert.equal(await f.db.prepare("SELECT count(*) n FROM attachments WHERE lesson_date='' AND attachment_id LIKE 'batch-%'").first('n'),25);
  const unrelated=JSON.stringify(Array.from({length:4000},(_,i)=>'batch-unrelated-'+i));
  await f.run("INSERT INTO objects SELECT value,NULL,'video/youtube','Unrelated',0,NULL,'abcdefghijk' FROM json_each(?)",unrelated);
  await f.run("INSERT INTO asset_owners SELECT value,'tafseer' FROM json_each(?)",unrelated);
  await f.run("INSERT INTO websites SELECT value,'tafseer','Unrelated',NULL,'unrelated-doc',NULL,0,0,NULL FROM json_each(?)",unrelated);
  await f.run("INSERT INTO mou_playlists SELECT value,'tafseer',value,1,0,0,? FROM json_each(?)",Date.now(),unrelated);
  await f.run("INSERT INTO attachments SELECT value,'tafseer',value,value,value,'2024-01-01','other','Unrelated','RECORDING',0 FROM json_each(?)",unrelated);
  await f.run('INSERT INTO mou_playlist_items SELECT value,value FROM json_each(?)',unrelated);
  const grown=await attach('grown');assert.equal(grown.status,200,JSON.stringify(grown.body));
  assert.equal(grown.queries,attached.queries,'Unrelated playlists do not add batch queries');assert(grown.reads<=attached.reads+2,JSON.stringify({before:attached.reads,after:grown.reads}));
  assert.equal(await f.db.prepare("SELECT count(*) n FROM attachments WHERE lesson_date='' AND attachment_id LIKE 'grown-%'").first('n'),25);
  t.diagnostic(JSON.stringify({batchSize:25,unrelatedPlaylistsAndMedia:4000,before:{queries:attached.queries,rowsRead:attached.reads},after:{queries:grown.queries,rowsRead:grown.reads},queryCeiling:45,localOnly:true}));
  assert.equal((await f.request('/api/admin/course',{cookie:admin,method:'POST',body:{...videos,operationId:crypto.randomUUID(),changes:Array.from({length:26},(_,i)=>({...videos.changes[0],assetId:'too-many-'+i}))}})).status,400);
 }finally{await f.close();}
});
test('a failed media batch changes no rights or partial objects and cannot adopt another offering’s file',async()=>{
 const f=await fixture();try{const cookie=(await f.login('admin')).cookie;
  await f.run("INSERT INTO objects VALUES('foreign-video',NULL,'video/youtube','Foreign',0,NULL,'abcdefghijk')");await f.run("INSERT INTO asset_owners VALUES('foreign-video','tafseer')");
  for(const bad of [{action:'participant',accountId:'outsider',enrolled:true,live:true,purchased:true},{action:'attachment',assetId:'foreign-video',attachmentId:'stolen',lessonId:'lesson',title:'Foreign',audience:'RECORDING',published:true}]){
   const result=await f.request('/api/admin/course',{cookie,method:'POST',body:{operationId:crypto.randomUUID(),action:'content-batch',changes:[{action:'youtube',assetId:'must-rollback',title:'Never saved',videoId:'UzKY4mmZTPQ'},bad]}});assert([400,403].includes(result.status),JSON.stringify(result.body));assert.equal(await f.db.prepare("SELECT count(*) n FROM objects WHERE asset_id='must-rollback'").first('n'),0);
  }
  const table=(await f.request('/api/admin/course/playlists',{cookie})).body,playlistId=crypto.randomUUID();
  const created=await f.request('/api/admin/course',{cookie,method:'POST',body:{action:'mou-playlist-save',operationId:crypto.randomUUID(),playlistId,name:'Checked private playlist',closeDate:'',revision:table.revision,playlistRevision:0,websiteRevision:0}});assert.equal(created.status,200,JSON.stringify(created.body));
  await f.run("INSERT INTO objects VALUES('owned-video',NULL,'video/youtube','Owned',0,NULL,'abcdefghijk')");await f.run("INSERT INTO asset_owners VALUES('owned-video','course')");
  const unchecked={action:'attachment',assetId:'owned-video',attachmentId:'unchecked-playlist-recording',websiteId:playlistId,lessonId:'native-lesson',title:'Held raw playlist attachment',audience:'RECORDING',published:false};
  for(const body of [{...unchecked,operationId:crypto.randomUUID()},{action:'content-batch',operationId:crypto.randomUUID(),changes:[{...unchecked,attachmentId:'rolled-back-legacy-recording',websiteId:'site-course'},unchecked]}]){
   const held=await f.request('/api/admin/course',{cookie,method:'POST',body});assert.equal(held.status,409,JSON.stringify(held.body));assert.equal(held.body.code,'PLAYLIST_REQUIRED');
   assert.equal(await f.db.prepare("SELECT count(*) n FROM attachments WHERE attachment_id IN('unchecked-playlist-recording','rolled-back-legacy-recording')").first('n'),0,'The batch lookup must retain the same playlist fence and atomic rollback as a single attachment');
  }
  assert.equal(await f.db.prepare("SELECT count(*) n FROM participation WHERE account_id='outsider'").first('n'),0);
 }finally{await f.close();}
});
