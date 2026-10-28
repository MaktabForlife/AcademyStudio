import {readFile,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import assert from 'node:assert/strict';
import {previewFixture,loadPreparedPreview} from '../tests/preview-fixture.mjs';
const out=resolve(process.argv[2]||'');if(!process.argv[2])throw Error('Choose prepared private preview output.');
const plan=JSON.parse(await readFile(join(out,'seed-plan.json'),'utf8')),f=await previewFixture();
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
try{
 await loadPreparedPreview(f,plan);const cookies={};for(const id of ['preview-admin','preview-course-admin','preview-learner','preview-surah','preview-outsider']){const login=await f.login(id);ok(login);cookies[id]=login.cookie;}
 const counts={};for(const [id,cookie] of Object.entries(cookies))counts[id]=ok(await f.request('/api/websites',{cookie})).websites.length;
 assert.deepEqual(counts,{'preview-admin':9,'preview-course-admin':1,'preview-learner':8,'preview-surah':1,'preview-outsider':0});
 let lessons=0;for(const site of plan.websites){
  const draft=ok(await f.request('/api/websites/'+site.id+'/edit',{cookie:cookies['preview-admin']})),published=ok(await f.request('/api/websites/'+site.id,{cookie:cookies['preview-admin']}));
  assert.deepEqual(draft.document,JSON.parse(await readFile(plan.objects.find(o=>o.bucket==='CONTENT'&&o.key===site.draft.key).file,'utf8')));
  assert.deepEqual(published.document,JSON.parse(await readFile(plan.objects.find(o=>o.bucket==='CONTENT'&&o.key===site.published.key).file,'utf8')));lessons+=draft.document.lessons.length;
 }
 const course=plan.websites.find(w=>w.key==='kahf'),surah=plan.websites.find(w=>w.key==='yaseen'),endpoint='/api/websites/'+course.id;
 assert.equal((await f.request('/api/websites/'+surah.id+'/edit',{cookie:cookies['preview-course-admin']})).status,403);
 assert.equal((await f.request(endpoint+'/edit',{cookie:cookies['preview-learner']})).status,403);
 assert.equal((await f.request(endpoint,{cookie:cookies['preview-outsider']})).status,403);
 assert.deepEqual(ok(await f.request('/api/offerings/'+surah.offeringId+'/media?website='+surah.id,{cookie:cookies['preview-surah']})).media,[]);
 const admin=cookies['preview-admin'],learner=cookies['preview-learner'],old=ok(await f.request(endpoint,{cookie:learner})).document,draft=ok(await f.request(endpoint+'/edit',{cookie:admin})),document=structuredClone(draft.document),peers=await f.db.prepare('SELECT website_id,draft_key,published_key,revision FROM websites WHERE website_id<>? ORDER BY website_id').bind(course.id).all();document.home.description+=' Local preview acceptance.';
 ok(await f.request(endpoint+'/edit',{method:'POST',cookie:admin,body:{action:'save',revision:1,operationId:crypto.randomUUID(),document}}));assert.deepEqual(ok(await f.request(endpoint,{cookie:learner})).document,old);
 ok(await f.request(endpoint+'/edit',{method:'POST',cookie:admin,body:{action:'publish',revision:2,operationId:crypto.randomUUID()}}));assert.deepEqual(ok(await f.request(endpoint,{cookie:learner})).document,document);
 const after=await f.db.prepare('SELECT website_id,draft_key,published_key,revision FROM websites WHERE website_id<>? ORDER BY website_id').bind(course.id).all();assert.deepEqual(peers.results,after.results);
 await f.run("DELETE FROM surah_grants WHERE account_id='preview-surah'");assert.equal((await f.request('/api/websites/'+surah.id,{cookie:cookies['preview-surah']})).status,403);
 await assert.rejects(()=>f.run(plan.statements[0].sql,...plan.statements[0].args));assert.equal((await f.request('/api/websites/'+surah.id,{cookie:cookies['preview-surah']})).status,403);
 assert.equal((await f.request('/builder/',{cookie:admin})).status,200);
 const report={passed:true,localOnly:true,academyRequests:0,websites:9,lessons,objects:plan.objects.length,visibleWebsiteCounts:counts,exactDraftAndPublication:true,scopedEditing:true,privateSave:true,explicitPublish:true,peersUnchanged:true,revocationImmediate:true,reimportCannotRestoreRights:true};await writeFile(join(out,'local-rehearsal.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await f.close();}
