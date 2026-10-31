import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './fixture.mjs';
import {newBlock} from '../public/shared/model.mjs';import {sha256} from '../src/protocol.mjs';
import {importReviewedWebsite,reviewImport} from '../public/shared/reviewed-website-import.mjs';
const picture='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
async function plan(f,websiteId='reviewed-import-site'){
 const document=structuredClone(f.doc);document.home.imageId='reviewed-art';document.home.imageAlt='Reviewed artwork';
 document.lessons[0].sections[0].blocks.push({...newBlock('note'),id:'recording-guide',aside:true,text:'',attribution:'Reviewed recording',sourceKey:'recording:independent-recording'});
 const bytes=Buffer.from(picture,'base64');return {format:'STUDIO_REVIEWED_WEBSITE_IMPORT_V1',offeringId:'course',websiteId,document,documentSha256:await sha256(JSON.stringify(document)),assets:[{assetId:'reviewed-art',mimeType:'image/png',filename:'art.png',bytes:bytes.length,sha256:await sha256(bytes),base64:picture}],recordings:[{lessonId:'independent-recording',assetId:'reviewed-video',attachmentId:'reviewed-recording',videoId:'UzKY4mmZTPQ',title:'Reviewed recording',lessonDate:null,cohort:''}]};
}
const client=(f,cookie,hook=()=>{})=>async(path,{body,method=body===undefined?'GET':'POST'}={})=>{const result=await f.request(path,{cookie,method,body:body instanceof Blob?new Uint8Array(await body.arrayBuffer()):body});if(result.status!==200)throw Object.assign(Error(result.body.error||'Local import failed'),{status:result.status,code:result.body.code});await hook(path,body,result);return result.body;};

test('reviewed import publishes original content and protected recordings, deduplicates bytes and replays the same receipt',async()=>{
 const f=await fixture();try{const cookie=(await f.login('admin')).cookie,p=await plan(f),before=(await f.db.prepare('SELECT * FROM participation').all()).results;
  const done=await importReviewedWebsite(p,{api:client(f,cookie)});assert.equal(done.published,true);assert.equal(done.recordings,1);assert.equal(done.readings,p.document.lessons.length);
  const operations=await f.db.prepare('SELECT count(*) n FROM operations').first('n');await importReviewedWebsite(p,{api:client(f,cookie)});assert.equal(await f.db.prepare('SELECT count(*) n FROM operations').first('n'),operations);
  assert.equal((await f.media.list()).objects.length,1);assert.equal(await f.db.prepare('SELECT count(*) n FROM timetable WHERE session_id=?').bind('independent-recording').first('n'),0);
  assert.deepEqual((await f.db.prepare('SELECT * FROM participation').all()).results,before);
  const learner=(await f.login('learner')).cookie,outsider=(await f.login('outsider')).cookie;
  assert.deepEqual((await f.request('/api/websites/'+p.websiteId,{cookie:learner})).body.document,p.document);
  assert.equal((await f.request('/api/media/reviewed-recording',{cookie:learner})).status,200);assert.equal((await f.request('/api/media/reviewed-recording',{cookie:outsider})).status,403);
 }finally{await f.close();}
});
test('invalid file bytes and a revoked Admin stop before publication and never change learner rights',async()=>{
 for(const failure of ['file','authority']){const f=await fixture();try{const cookie=(await f.login('admin')).cookie,p=await plan(f,'failed-'+failure),before=(await f.db.prepare('SELECT * FROM participation').all()).results;
   if(failure==='file')p.assets[0].base64=btoa('Wrong bytes');
   const api=client(f,cookie,async(path,body)=>{if(failure==='authority'&&body instanceof Blob)await f.run("UPDATE accounts SET global_admin=0 WHERE account_id='admin'");});
   await assert.rejects(()=>importReviewedWebsite(p,{api}));const saved=await f.db.prepare('SELECT enabled,published_key FROM websites WHERE website_id=?').bind(p.websiteId).first();assert.equal(saved.enabled,0);assert.equal(saved.published_key,null);assert.deepEqual((await f.db.prepare('SELECT * FROM participation').all()).results,before);
  }finally{await f.close();}}
});
test('an account change abandons the prior import and operational grants cannot enter a content package',async()=>{
 const f=await fixture();try{const cookie=(await f.login('admin')).cookie,p=await plan(f);let switched=false;
  const api=client(f,cookie,async(path,body)=>{if(body?.action==='website-create')switched=true;});
  await assert.rejects(()=>importReviewedWebsite(p,{api,current:()=>{if(switched)throw new DOMException('Account changed','AbortError');}}),{name:'AbortError'});
  assert.equal((await f.media.list()).objects.length,0);assert.equal(await f.db.prepare('SELECT enabled FROM websites WHERE website_id=?').bind(p.websiteId).first('enabled'),0);
  await assert.rejects(()=>reviewImport({...p,rights:{purchased:true}}));
 }finally{await f.close();}
});
