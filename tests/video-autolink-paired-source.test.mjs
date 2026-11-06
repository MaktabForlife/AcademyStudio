import test from 'node:test';import assert from 'node:assert/strict';
import {studioFixture} from './studio-access-fixture.mjs';import {defaultCard} from '../src/playlist-cards.mjs';
import {hosting} from '../../Academy/backend/src/academy/hosting.mjs';
const origin=hosting().academyPortalOrigin;
test('actual paired native Academy sign-in/current Source proxy uploads one large private MP4 to the exact Course without published membership',async()=>{
 const s=await studioFixture({videoProcessing:true});const f=s.f;try{
  await s.handover(s.x.courseA);
  const token=await s.nativeLogin('global'),path='/api/admin/platform/studio-processing';
  const send=async(command,{activity=s.x.courseA,whoToken=token,headers={},part}={})=>{
   const url='https://academy.test'+path+(part?'/recording-part?'+new URLSearchParams({activityKey:activity,assetId:part.assetId,partNumber:part.partNumber}):'');
   const r=await f.runtime.dispatchFetch(url,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+whoToken,'X-Academy-Workspace':'ADMIN','Content-Type':part?'application/octet-stream':'application/json',...headers},body:part?part.bytes:JSON.stringify({activityKey:activity,command})});
   assert.equal(r.headers.get('Cache-Control'),'private, no-store');const body=await r.json();return {status:r.status,body};
  };
  const good=async(...args)=>{const r=await send(...args);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
  const catalogue=await s.good({action:'course-playlists'}),choices=await s.good({action:'course-playlist-options'}),own=choices.locations.find(l=>l.activityKey===choices.ownerActivityKey);assert(own);
  const playlistId=crypto.randomUUID();await s.good({action:'course-playlist-save',operationId:crypto.randomUUID(),playlistId,name:'Paired private processing playlist',description:'Synthetic paired Source flow only',revision:catalogue.revision,playlistRevision:0,websiteRevision:0,contentRevision:0,card:defaultCard(),teacherIds:[],placements:[{activityKey:own.activityKey,classId:''}]});
  const cap=await good({action:'video-source-capabilities'});assert.equal(cap.sourceAvailable,true);assert.equal(cap.processingAvailable,false);
  const options=await good({action:'video-source-options'});assert(options.teachers.length);assert(options.playlists.some(p=>p.id===playlistId));
  const assetId=crypto.randomUUID(),attachmentId=crypto.randomUUID(),start={action:'video-source-upload-start',operationId:crypto.randomUUID(),assetId,filename:'synthetic-paired.mp4'};
  await good(start);const data=new Uint8Array(200000);data.set([0,0,0,24,102,116,121,112],0);
  const part=await good(null,{part:{assetId,partNumber:1,bytes:data}});assert.equal(part.partNumber,1);assert(part.etag);
  await good({action:'video-source-upload-complete',operationId:crypto.randomUUID(),assetId,parts:[part]});
  const attach={action:'video-source-attach',operationId:crypto.randomUUID(),attachmentId,assetId,title:'Paired native private MP4',teacherIds:[options.teachers[0].id],playlistId};
  const saved=await good(attach);assert.equal(saved.published,false);assert.equal((await good(attach)).replayed,true);
  const current=await good({action:'video-source-detail',attachmentId});assert.equal(current.recordedContext.playlist.id,playlistId);assert.equal(current.assetId,assetId);assert.equal(current.companion,null);assert.equal(current.published,false);
  assert.equal((await f.db.prepare('SELECT count(*) n FROM mou_playlist_items WHERE playlist_id=?').bind(playlistId).first()).n,0);
  assert.equal((await f.db.prepare("SELECT count(*) n FROM course_playlist_content WHERE playlist_id=? AND stage='PUBLISHED'").bind(playlistId).first()).n,0);
  assert.equal((await f.db.prepare('SELECT count(*) n FROM course_playlist_release_guards').first()).n,0);
  const list=await good({action:'video-source-recordings',playlistId});assert(list.recordings.some(r=>r.id===attachmentId));
  const foreign=await send({action:'video-source-options'},{headers:{Origin:'https://hostile.test'}});assert.equal(foreign.status,403);
  const cookieHeader=JSON.stringify(current);assert(!cookieHeader.includes(token));assert(!cookieHeader.includes('OPENAI_API_KEY'));
  console.log(JSON.stringify({actualPairedSourcePINPath:true,syntheticLimiter:true,largePartBytes:data.length,actualNativePrivateR2:true,publishedMembershipRows:0,providerCalls:0,hostedCalls:0,realWorkflow:false,scope:'Synthetic local native Academy/Core/Admin/coordinator and Studio D1/R2, exact signed server path; no real hosting/browser/provider or billed usage claim'}));
 }finally{await f.close();}
});
