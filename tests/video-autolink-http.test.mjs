import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';import {signedHeaders,sha256} from '../src/protocol.mjs';
async function setup(){
 const f=await fixture({videoProcessing:true,nativeTeacherChoices:[{id:'outsider',name:'Registered synthetic Teacher'}],verification:{accountSeconds:43200,adminSeconds:60}});
 const cookie=(await f.login('admin')).cookie;await f.run("UPDATE sessions SET source_ref='native-synthetic-admin' WHERE account_id='admin'");
 const request=async(command,{offer='course',...options}={})=>f.request('/api/admin/'+offer+'/processing',{cookie,method:'POST',body:command,...options});
 const table=await f.request('/api/admin/course/playlists',{cookie}),playlistId=crypto.randomUUID();
 const p=await f.request('/api/admin/course',{cookie,method:'POST',body:{action:'mou-playlist-save',operationId:crypto.randomUUID(),playlistId,name:'Private processing destination',closeDate:'',revision:table.body.revision,playlistRevision:0,websiteRevision:0}});assert.equal(p.status,200,JSON.stringify(p.body));
 return {...f,cookie,request,playlistId,nativeRequest:f.request};
}
function privateReply(r){assert.equal(r.response.headers.get('Cache-Control'),'private, no-store');assert.equal(r.response.headers.get('X-Content-Type-Options'),'nosniff');assert(!r.response.headers.has('Set-Cookie'));}
test('new actual Worker entry is default-off before cookie/DB work; existing routes remain available',async()=>{
 const f=await fixture();try{
  for(const path of ['/api/admin/course/processing','/internal/studio/video-processing']){
   const r=await f.request(path,{method:'POST',body:{action:'video-source-capabilities'}});assert.equal(r.status,404);assert.equal(r.queries,0);privateReply(r);
  }
  const c=(await f.login('admin')).cookie;assert.equal((await f.request('/api/admin/course',{cookie:c})).status,200);
 }finally{await f.close();}
});
test('actual native entry retains method, exact Origin, cookie/current account and scoped Admin checks; forged actor/action denied',async t=>{
 const f=await setup();try{
  for(const [name,options,status]of [['missing cookie',{cookie:undefined},401],['wrong Origin',{headers:{Origin:'https://hostile.test'}},403],['GET',{method:'GET',body:undefined},405],['learner',{cookie:(await f.login('learner')).cookie},403]]){
   await t.test(name,async()=>{const r=await f.nativeRequest('/api/admin/course/processing',{cookie:f.cookie,method:'POST',body:{action:'video-source-capabilities'},...options});assert.equal(r.status,status,JSON.stringify(r.body));privateReply(r);});
  }
  const forged=await f.request({action:'video-source-options',actor:{globalAdmin:true}});assert.equal(forged.status,400);privateReply(forged);
  const wrong=await f.request({action:'save',change:{action:'staff'}});assert.equal(wrong.status,400);privateReply(wrong);
  const cap=await f.request({action:'video-source-capabilities'});assert.equal(cap.status,200);assert.equal(cap.body.sourceAvailable,true);assert.equal(cap.body.processingAvailable,false);assert.equal(cap.body.maxTranscriptBytes,524288);privateReply(cap);
 }finally{await f.close();}
});
test('actual signed processing entry binds exact path/raw body, rejects stale proof and preserves pending Source delivery without executing command',async()=>{
 const f=await setup();try{
  const path='/internal/studio/video-processing',proof={sourceRef:'signed-processing-source',accountId:'admin',epoch:1,verifiedAt:Date.now(),expiresAt:Date.now()+55000,globalAdmin:true};
  const envelope={issuedAt:Date.now(),proof,offeringId:'course',command:{action:'video-source-capabilities'},deliveries:[],more:false};
  const send=async(value,signPath=path)=>{const signed=await signedHeaders(f.env.ACADEMY_TO_WEBSITE_SECRET,signPath,value);return f.nativeRequest(path,{method:'POST',headers:signed.headers,body:signed.payload});};
  const cap=await send(envelope);assert.equal(cap.status,200,JSON.stringify(cap.body));assert.deepEqual(cap.body.acknowledge,[]);assert.equal(cap.body.sourceAvailable,true);privateReply(cap);
  const bad=await send(envelope,'/internal/studio/access');assert.equal(bad.status,401);privateReply(bad);
  const stale=await send({...envelope,proof:{...proof,verifiedAt:Date.now()-61000}});assert.equal(stale.status,401);privateReply(stale);
  const pending=await send({...envelope,more:true,command:{action:'video-source-youtube',operationId:crypto.randomUUID(),assetId:'must-not-run',videoId:'ABCdef12345',title:'Do not execute while Source is pending'}});assert.equal(pending.body.pending,true);assert.equal(await f.db.prepare("SELECT 1 FROM objects WHERE asset_id='must-not-run'").first(),null);
 }finally{await f.close();}
});
test('source-only recording commands reuse actual native MP4 writer and exact private attachment; generic route cannot tunnel them',async()=>{
 const f=await setup();try{
  const assetId=crypto.randomUUID(),attachmentId=crypto.randomUUID(),start={action:'video-source-upload-start',operationId:crypto.randomUUID(),assetId,filename:'synthetic.mp4'},complete={action:'video-source-upload-complete',operationId:crypto.randomUUID(),assetId,parts:[]};
  assert.equal((await f.request(start)).status,200);const data=new Uint8Array([0,0,0,24,...new TextEncoder().encode('ftypmp42synthetic private recording')]),hash=await sha256(data);
  const part=await f.request({action:'video-source-upload-part',assetId,partNumber:1,sha256:hash,data:btoa(String.fromCharCode(...data))});assert.equal(part.status,200,JSON.stringify(part.body));complete.parts=[part.body];assert.equal((await f.request(complete)).status,200);
  const original=await f.db.prepare('SELECT created_at,state FROM uploads WHERE asset_id=?').bind(assetId).first();assert.equal((await f.request(start)).status,200);assert.deepEqual(await f.db.prepare('SELECT created_at,state FROM uploads WHERE asset_id=?').bind(assetId).first(),original);
  const attach={action:'video-source-attach',operationId:crypto.randomUUID(),assetId,attachmentId,title:'Exact private Course source',teacherIds:['outsider'],playlistId:f.playlistId};
  const a=await f.request(attach);assert.equal(a.status,200,JSON.stringify(a.body));assert.equal((await f.request(attach)).status,200);
  assert.equal((await f.db.prepare('SELECT count(*) n FROM recording_companions').first()).n,0);assert.equal((await f.db.prepare('SELECT published FROM attachments WHERE attachment_id=?').bind(attachmentId).first()).published,0);
  const detail=await f.request({action:'video-source-detail',attachmentId});assert.equal(detail.status,200);assert.equal(detail.body.companion,null);privateReply(detail);
  const list=await f.request({action:'video-source-recordings',playlistId:f.playlistId});assert.equal(list.body.recordings[0].id,attachmentId);
  const signed=await signedHeaders(f.env.ACADEMY_TO_WEBSITE_SECRET,'/internal/studio/access',{issuedAt:Date.now(),proof:{sourceRef:'signed-native-source',accountId:'admin',epoch:1,verifiedAt:Date.now(),expiresAt:Date.now()+55000,globalAdmin:true},offeringId:'course',command:{action:'video-source-capabilities'},deliveries:[],more:false});
  assert.equal((await f.nativeRequest('/internal/studio/access',{method:'POST',headers:signed.headers,body:signed.payload})).status,400);
 }finally{await f.close();}
});
test('multipart command denies corruption, arbitrary decoder text, excess profile offset and all publication commands on the processing surface',async()=>{
 const f=await setup();try{
  const assetId=crypto.randomUUID(),data=btoa('synthetic'),hash=await sha256('synthetic');
  for(const input of [{partNumber:1,data:'@'+data,sha256:hash},{partNumber:1,data,sha256:'0'.repeat(64)},{partNumber:3,data,sha256:hash},{partNumber:1,data:'x'.repeat(7*1024*1024+4),sha256:hash}]){
   const r=await f.request({action:'video-source-upload-part',assetId,...input});assert([400,409,413].includes(r.status));assert(!JSON.stringify(r.body).includes(data));privateReply(r);
  }
  const p=await f.request({action:'video-source-publication',operationId:crypto.randomUUID(),attachmentId:'invented',revision:0,confirm:false});assert.equal(p.status,400);const explicit=await f.request({action:'video-source-publication',operationId:crypto.randomUUID(),attachmentId:'invented',revision:0,confirm:true});assert.equal(explicit.status,400);
  assert.equal((await f.db.prepare('SELECT count(*) n FROM uploads').first()).n,0);
 }finally{await f.close();}
});
