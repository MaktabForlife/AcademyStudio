import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {pendingMedia,saveMediaDraft} from '../public/shared/media-workflow.mjs';
async function setup(){
 const f=await fixture({nativeTeacherChoices:[{id:'outsider',name:'Registered synthetic Teacher'}],verification:{accountSeconds:43200,adminSeconds:60}});
 const cookie=(await f.login('admin')).cookie;await f.run("UPDATE sessions SET source_ref='native-synthetic-admin' WHERE account_id='admin'");
 const calls=[],api=async(path,{body,method}={})=>{calls.push({path,action:body?.action||method||'GET'});if(body instanceof Blob)body=new Uint8Array(await body.arrayBuffer());const r=await f.request(path,{cookie,...(body!==undefined?{method:method||'POST',body}:{})});assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
 const path='/api/admin/course',table=await api(path+'/playlists'),playlistId=crypto.randomUUID();await api(path,{body:{action:'mou-playlist-save',operationId:crypto.randomUUID(),playlistId,name:'Explicit private recording destination',closeDate:'',revision:table.revision,playlistRevision:0,websiteRevision:0}});
 return {...f,cookie,calls,api,path,playlistId};
}
const input=f=>({sourceOnly:true,playlistId:f.playlistId,sourceKind:'YOUTUBE',sourceURL:'https://www.youtube.com/watch?v=ABCdef12345',title:'Explicitly selected source',teacherIds:['outsider'],supportingFiles:[]});
test('source-only native YouTube attachment needs no fabricated companion and lost attach ACK retries the same source/parent once',async()=>{
 const f=await setup();try{
  const pending=pendingMedia(input(f));assert.equal(pending.input.companion,undefined);let lost=true;const api=async(path,options)=>{const value=await f.api(path,options);if(options?.body?.action==='media-attach'&&lost){lost=false;throw Error('Synthetic lost attachment ACK');}return value;};
  await assert.rejects(saveMediaDraft({pending,api,path:f.path}),/lost attachment/);const result=await saveMediaDraft({pending,api:f.api,path:f.path});assert.equal(result.sourceOnly,true);assert.equal(result.attachmentId,pending.attachmentId);
  assert.equal((await f.db.prepare('SELECT count(*) n FROM objects').first()).n,1);assert.equal((await f.db.prepare('SELECT count(*) n FROM attachments').first()).n,1);assert.equal((await f.db.prepare('SELECT count(*) n FROM recording_companions').first()).n,0);assert(!f.calls.some(c=>c.action==='media-companion-save'));
  const row=await f.db.prepare('SELECT * FROM attachments WHERE attachment_id=?').bind(pending.attachmentId).first();assert.equal(row.published,0);assert.equal(row.lesson_date,'');assert.equal((await f.db.prepare('SELECT count(*) n FROM timetable').first()).n,3);
  const learner=(await f.login('learner')).cookie;assert.equal((await f.request('/api/media/'+pending.attachmentId,{cookie:learner})).status,404);
 }finally{await f.close();}
});
test('source-only MP4 uses the existing native multipart writer and retained object, with no processed placeholder or automatic publication',async()=>{
 const f=await setup();try{
  const file=new File([new Uint8Array([0,0,0,24]),'ftypmp42synthetic mp4 payload'],'synthetic-recording.mp4',{type:'video/mp4'}),pending=pendingMedia({...input(f),sourceKind:'UPLOAD',sourceURL:undefined,recordingFile:file});
  await saveMediaDraft({pending,api:f.api,path:f.path});const object=await f.db.prepare('SELECT * FROM objects WHERE asset_id=?').bind(pending.assetId).first();assert.equal(object.mime_type,'video/mp4');assert(await f.media.head(object.object_key));
  const upload=await f.db.prepare('SELECT created_at,state FROM uploads WHERE asset_id=?').bind(pending.assetId).first();assert.equal(upload.state,'COMPLETE');await saveMediaDraft({pending,api:f.api,path:f.path});assert.deepEqual(await f.db.prepare('SELECT created_at,state FROM uploads WHERE asset_id=?').bind(pending.assetId).first(),upload);
  // created_at here is the existing initiation clock, NOT first-success proof.
  assert.equal((await f.db.prepare('SELECT count(*) n FROM recording_companions').first()).n,0);assert.equal((await f.db.prepare('SELECT count(*) n FROM attachments WHERE published=1').first()).n,0);
 }finally{await f.close();}
});
test('a late changed browser context stops before attachment; nonboolean sourceOnly cannot bypass the normal reviewed companion',async()=>{
 const f=await setup();try{
  for(const sourceOnly of [false,'true',1])assert.throws(()=>pendingMedia({...input(f),sourceOnly}));
  const pending=pendingMedia(input(f));let current=true;const api=async(path,options)=>{const value=await f.api(path,options);if(options?.body?.action==='youtube')current=false;return value;};
  await assert.rejects(saveMediaDraft({pending,api,path:f.path,current:()=>{if(!current)throw new DOMException('Context changed','AbortError');}}),e=>e.name==='AbortError');
  assert.equal((await f.db.prepare('SELECT count(*) n FROM attachments').first()).n,0);assert.equal((await f.db.prepare('SELECT count(*) n FROM recording_companions').first()).n,0);assert(!f.calls.some(c=>c.action==='media-attach'));
 }finally{await f.close();}
});
