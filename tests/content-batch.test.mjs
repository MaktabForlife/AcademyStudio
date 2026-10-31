import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './fixture.mjs';
test('a bounded media batch uses current Admin authority, preserves optional Course dates and replays safely',async()=>{
 const f=await fixture();try{const admin=(await f.login('admin')).cookie,learner=(await f.login('learner')).cookie;
  const videos={operationId:crypto.randomUUID(),action:'content-batch',changes:Array.from({length:25},(_,i)=>({action:'youtube',assetId:'batch-video-'+i,title:'Recording '+i,videoId:'UzKY4mmZTPQ'}))};
  assert.equal((await f.request('/api/admin/course',{cookie:learner,method:'POST',body:videos})).status,403);
  const saved=await f.request('/api/admin/course',{cookie:admin,method:'POST',body:videos});assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal((await f.request('/api/admin/course',{cookie:admin,method:'POST',body:videos})).body.replayed,true);
  const attached=await f.request('/api/admin/course',{cookie:admin,method:'POST',body:{action:'content-batch',operationId:crypto.randomUUID(),changes:videos.changes.map((row,i)=>({action:'attachment',assetId:row.assetId,attachmentId:'batch-attachment-'+i,websiteId:'site-course',lessonId:'independent-lesson-'+i,title:row.title,audience:'RECORDING',published:true}))}});assert.equal(attached.status,200,JSON.stringify(attached.body));
  assert(attached.queries<=45,JSON.stringify({queries:attached.queries,rowsRead:attached.reads}));
  assert.equal(await f.db.prepare("SELECT count(*) n FROM attachments WHERE lesson_date='' AND attachment_id LIKE 'batch-%'").first('n'),25);
  assert.equal((await f.request('/api/admin/course',{cookie:admin,method:'POST',body:{...videos,operationId:crypto.randomUUID(),changes:Array.from({length:26},(_,i)=>({...videos.changes[0],assetId:'too-many-'+i}))}})).status,400);
 }finally{await f.close();}
});
test('a failed media batch changes no rights or partial objects and cannot adopt another offering’s file',async()=>{
 const f=await fixture();try{const cookie=(await f.login('admin')).cookie;
  await f.run("INSERT INTO objects VALUES('foreign-video',NULL,'video/youtube','Foreign',0,NULL,'abcdefghijk')");await f.run("INSERT INTO asset_owners VALUES('foreign-video','tafseer')");
  for(const bad of [{action:'participant',accountId:'outsider',enrolled:true,live:true,purchased:true},{action:'attachment',assetId:'foreign-video',attachmentId:'stolen',lessonId:'lesson',title:'Foreign',audience:'RECORDING',published:true}]){
   const result=await f.request('/api/admin/course',{cookie,method:'POST',body:{operationId:crypto.randomUUID(),action:'content-batch',changes:[{action:'youtube',assetId:'must-rollback',title:'Never saved',videoId:'UzKY4mmZTPQ'},bad]}});assert([400,403].includes(result.status),JSON.stringify(result.body));assert.equal(await f.db.prepare("SELECT count(*) n FROM objects WHERE asset_id='must-rollback'").first('n'),0);
  }
  assert.equal(await f.db.prepare("SELECT count(*) n FROM participation WHERE account_id='outsider'").first('n'),0);
 }finally{await f.close();}
});
