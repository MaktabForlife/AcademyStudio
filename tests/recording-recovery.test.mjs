import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './fixture.mjs';
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
test('multipart recordings require the validated first part, retain exact completion retries and stream ranges',async()=>{
 const f=await fixture();try{const admin=(await f.login('admin')).cookie,learner=(await f.login('former')).cookie,path='/api/admin/course/recording',assetId='synthetic-mp4';
  const post=body=>f.request(path,{cookie:admin,method:'POST',body}),start={operationId:crypto.randomUUID(),action:'start',assetId,filename:'Retained recording.mp4'};
  const upload=ok(await post(start));assert.equal(ok(await post(start)).uploadId,upload.uploadId);
  assert.equal((await f.request(path+'?assetId='+assetId+'&partNumber=1',{cookie:admin,method:'PUT',body:new Uint8Array(32)})).status,400);
  const bytes=new Uint8Array(32);bytes.set(new TextEncoder().encode('ftyp'),4);const part=ok(await f.request(path+'?assetId='+assetId+'&partNumber=1',{cookie:admin,method:'PUT',body:bytes}));
  assert.equal(typeof part.etag,'string',JSON.stringify(part));assert(part.etag.length<=1024);
  assert.equal((await post({operationId:crypto.randomUUID(),action:'complete',assetId,parts:[{...part,partNumber:2}]})).status,400);assert.equal(await f.db.prepare('SELECT count(*) n FROM objects WHERE asset_id=?').bind(assetId).first('n'),0);
  const completion={operationId:crypto.randomUUID(),action:'complete',assetId,parts:[part]},completed=ok(await post(completion));assert.equal(completed.size,32);assert.equal(ok(await post(completion)).replayed,true);
  ok(await f.request('/api/admin/course',{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'attachment',attachmentId:'course-video',assetId,lessonId:'stable-session',lessonDate:'2024-01-12',cohort:'',title:'Retained Course recording',audience:'RECORDING',published:true}}));
  const range=await f.request('/api/media/course-video',{cookie:learner,headers:{Range:'bytes=4-7'}});assert.equal(range.status,206);assert.equal(new TextDecoder().decode(range.body),'ftyp');assert.equal(range.response.headers.get('Cache-Control'),'private, no-store');
  await f.run("UPDATE participation SET purchased=0 WHERE account_id='former' AND offering_id='course'");assert.equal((await f.request('/api/media/course-video',{cookie:learner,headers:{Range:'bytes=4-7'}})).status,403);
 }finally{await f.close();}
});
