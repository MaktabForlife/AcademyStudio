import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';

test('an undated Course recording uses its own lesson identity and retains material permissions',async()=>{
 const f=await fixture();try{
  const cookie=(await f.login('admin')).cookie;
  const video=await f.request('/api/admin/course',{cookie,method:'POST',body:{operationId:crypto.randomUUID(),action:'youtube',assetId:'historical-course-recording',title:'Recorded lesson',videoId:'UzKY4mmZTPQ'}});assert.equal(video.status,200,JSON.stringify(video.body));
  const body={operationId:crypto.randomUUID(),action:'attachment',attachmentId:'independent-course-attachment',assetId:'historical-course-recording',websiteId:'site-course',lessonId:'independent-recording-lesson',title:'Recorded lesson',audience:'RECORDING',published:true};
  const saved=await f.request('/api/admin/course',{cookie,method:'POST',body});assert.equal(saved.status,200,JSON.stringify(saved.body));
  const row=await f.db.prepare('SELECT lesson_id,lesson_date FROM attachments WHERE attachment_id=?').bind(body.attachmentId).first();assert.deepEqual(row,{lesson_id:'independent-recording-lesson',lesson_date:''});
  assert.equal(await f.db.prepare('SELECT count(*) n FROM timetable WHERE session_id=?').bind(body.lessonId).first('n'),0);
  assert.equal((await f.request('/api/admin/course',{cookie,method:'POST',body})).body.replayed,true);
  const learner=(await f.login('learner')).cookie,outsider=(await f.login('outsider')).cookie;
  assert.equal((await f.request('/api/media/'+body.attachmentId,{cookie:learner})).status,200);
  assert.equal((await f.request('/api/media/'+body.attachmentId,{cookie:outsider})).status,403);
  assert.equal((await f.request('/api/admin/course',{cookie:learner,method:'POST',body:{...body,operationId:crypto.randomUUID()}})).status,403);
  assert.equal((await f.request('/api/admin/course',{cookie,method:'POST',body:{...body,operationId:crypto.randomUUID(),lessonDate:'2026-02-30'}})).status,400);
 }finally{await f.close();}
});

test('monthly material still requires a valid recording date and exact owned assets',async()=>{
 const f=await fixture();try{
  const cookie=(await f.login('admin')).cookie;
  const video=await f.request('/api/admin/tafseer',{cookie,method:'POST',body:{operationId:crypto.randomUUID(),action:'youtube',assetId:'monthly-recording',title:'Monthly lesson',videoId:'abcdefghijk'}});assert.equal(video.status,200,JSON.stringify(video.body));
  const body={action:'attachment',attachmentId:'monthly-attachment',assetId:'monthly-recording',websiteId:'site-surah',lessonId:'separate-monthly-recording',title:'Monthly lesson',cohort:'historic-cohort',audience:'RECORDING',published:true};
  for(const lessonDate of [undefined,null,'','2026-02-30'])assert.equal((await f.request('/api/admin/tafseer',{cookie,method:'POST',body:{...body,operationId:crypto.randomUUID(),lessonDate}})).status,400);
  const saved=await f.request('/api/admin/tafseer',{cookie,method:'POST',body:{...body,operationId:crypto.randomUUID(),lessonDate:'2024-01-15'}});assert.equal(saved.status,200,JSON.stringify(saved.body));
  assert.equal((await f.request('/api/admin/course',{cookie,method:'POST',body:{...body,websiteId:'site-course',operationId:crypto.randomUUID()}})).status,403,'A Course cannot adopt a different programme’s asset.');
 }finally{await f.close();}
});
