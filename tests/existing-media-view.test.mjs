import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {studioFixture} from './studio-access-fixture.mjs';
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};

async function setup(t){
 const f=await fixture();t.after(()=>f.close());
 await f.run("INSERT INTO source_access_scopes VALUES('course','WEBSITE',1,1,1,1,'Africa/Johannesburg','[]')");
 await f.run("INSERT INTO source_access_scopes VALUES('tafseer','WEBSITE',1,1,1,1,'Africa/Johannesburg','[]')");
 const admin=(await f.login('admin')).cookie,learner=(await f.login()).cookie;
 const add=async(id,{offer='course',site='site-course',type='video/youtube',published=1}={})=>{
  await f.run('INSERT INTO objects VALUES(?,?,?,?,?,?,?)','asset-'+id,type==='application/pdf'?'private/'+id+'.pdf':null,type,id,type==='application/pdf'?4:0,type==='application/pdf'?'a'.repeat(64):null,type==='application/pdf'?null:'abcdefghijk');
  await f.run('INSERT INTO asset_owners VALUES(?,?)','asset-'+id,offer);
  await f.run("INSERT INTO attachments VALUES(?,?,?,?,?,'2026-10-18','','Original '+?,'RECORDING',?)",id,offer,site,'asset-'+id,'lesson-'+id,id,published);
 };
 const read=(input={})=>f.request('/api/admin/course/course-playlists?'+new URLSearchParams(input),{cookie:admin});
 return {...f,admin,learner,add,read};
}
test('existing Course recordings, PDFs and website appear without creating playlists or publishing private material',async t=>{
 const f=await setup(t);await f.add('video-public');await f.add('video-private',{published:0});await f.add('pdf',{type:'application/pdf'});
 const before=await f.db.prepare('SELECT attachment_id,published,website_id FROM attachments ORDER BY attachment_id').all();
 const listing=await f.read(),list=ok(listing),site=list.websites.find(w=>w.id==='site-course');
 assert.equal(site.recordings,2);assert.equal(site.privateRecordings,1);assert.equal(site.pdfs,1);assert.equal(list.playlists.length,0);
 const response=await f.read({action:'course-playlist-detail',websiteId:'site-course'}),detail=ok(response).collection;
 t.diagnostic(JSON.stringify({existingCourse:{list:{rowsRead:listing.reads,queries:listing.queries},detail:{rowsRead:response.reads,queries:response.queries}},hostedRequests:0}));
 assert.equal(detail.websiteId,'site-course');assert.equal(detail.recordings.length,2);assert.equal(detail.pdfs.length,1);assert.equal(detail.recordings.find(r=>r.attachmentId==='video-private').published,0);
 assert(!JSON.stringify(detail).includes('private/pdf.pdf'));
 assert.equal((await f.request('/api/admin/course/course-playlists?action=course-playlist-detail&websiteId=site-course',{cookie:f.learner})).status,403);
 assert.equal((await f.request('/api/media/video-private',{cookie:f.learner})).status,404);
 assert.equal(await f.db.prepare('SELECT count(*) n FROM mou_playlists').first('n'),0);
 assert.deepEqual(await f.db.prepare('SELECT attachment_id,published,website_id FROM attachments ORDER BY attachment_id').all(),before);
});
test('foreign websites and Teacher-only sessions cannot read an existing Course collection',async t=>{
 const f=await setup(t);assert.equal((await f.read({action:'course-playlist-detail',websiteId:'site-surah'})).status,404);
 const teacher=(await f.login('teacher')).cookie;
 assert.equal((await f.request('/api/admin/course/course-playlists?action=course-playlist-detail&websiteId=site-course',{cookie:teacher})).status,403);
 await f.run("UPDATE accounts SET epoch=2 WHERE account_id='admin'");assert.equal((await f.read()).status,401);
});
test('six unassigned Tafseer recordings stay separate from website-linked recordings and retain their identities',async t=>{
 const f=await setup(t);await f.add('linked',{offer:'tafseer',site:'site-surah'});await f.add('notes',{offer:'tafseer',site:'site-surah',type:'application/pdf'});
 for(let i=0;i<6;i++)await f.add('unassigned-'+i,{offer:'tafseer',site:null});
 const list=ok(await f.request('/api/admin/tafseer/playlists',{cookie:f.admin}));
 assert.equal(list.unassigned.recordings,6);assert.equal(list.legacy.find(w=>w.id==='site-surah').recordings,1);assert.equal(list.legacy.find(w=>w.id==='site-surah').pdfs,1);
 const separate=ok(await f.request('/api/admin/tafseer/media-review?unassigned=1',{cookie:f.admin})).media;
 assert.equal(separate.length,6);assert(separate.every(r=>r.website_id===null&&r.attachment_id.startsWith('unassigned-')));
 const grouped=ok(await f.request('/api/admin/tafseer/media-review?website=site-surah',{cookie:f.admin})).media;assert.equal(grouped.length,2);
 assert.equal(await f.db.prepare('SELECT count(*) n FROM mou_playlist_items').first('n'),0);
});
test('existing Course pagination preserves private flags and includes PDFs on later pages',async t=>{
 const f=await setup(t);for(let i=0;i<51;i++)await f.add('rec-'+String(i).padStart(2,'0'),{published:i%2});await f.add('zz-pdf',{type:'application/pdf',published:0});
 const a=ok(await f.read({action:'course-playlist-detail',websiteId:'site-course'})).collection;assert.equal(a.recordings.length,50);assert(a.more);
 const b=ok(await f.read({action:'course-playlist-detail',websiteId:'site-course',after:a.next})).collection;assert.equal(b.recordings.length,1);assert.equal(b.pdfs[0].published,0);assert.equal(b.more,false);
 assert.equal(new Set([...a.recordings,...b.recordings].map(r=>r.attachmentId)).size,51);
});
test('existing summaries use the exact saved recording lesson, never a matching title or position',async t=>{
 const f=await setup(t);await f.add('exact');await f.add('unmapped');
 const doc={...f.doc,lessons:[{id:'reading',sections:[{blocks:[{type:'note',aside:true,sourceKey:'recording:lesson-exact',text:'A verified recording-specific summary.',attribution:'Reviewed recording'}]}]}]};
 await f.content.put('websites/site-course/versions/seed.json',JSON.stringify(doc));
 const r=ok(await f.read({action:'course-playlist-detail',websiteId:'site-course'})).collection;
 assert.equal(r.recordings.find(r=>r.attachmentId==='exact').summary,'A verified recording-specific summary.');
 assert(!r.recordings.find(r=>r.attachmentId==='unmapped').summary);
});
test('the native Academy Admin proxy transports existing Course collection reads with their original scope',async t=>{
 const z=await studioFixture();t.after(()=>z.f.close());await z.handover();
 const list=await z.good({action:'course-playlists'});assert(Array.isArray(list.websites));
 const missing=await z.proxy({action:'course-playlist-detail',websiteId:'foreign-or-missing'});assert.equal(missing.status,404);assert.match(missing.body.error,/existing website in this Course/);
 assert.equal((await z.proxy({action:'course-playlist-detail',websiteId:'foreign-or-missing'},{who:'studentA'})).status,403);
});
