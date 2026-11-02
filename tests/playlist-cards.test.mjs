import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {sha256} from '../src/protocol.mjs';
import {Store} from '../src/database.mjs';
import {defaultCard,uploadCover} from '../src/playlist-cards.mjs';
import {playlistPublication} from '../src/mou-playlists.mjs';
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'));
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
async function setup(t){
 const f=await fixture({verification:{accountSeconds:43200,adminSeconds:60},nativeTeacherChoices:[{id:'native-teacher',name:'Checked Native Teacher'}]});t.after(()=>f.close());
 await f.run("INSERT INTO source_access_scopes VALUES('course','WEBSITE',1,1,1,1,'Africa/Johannesburg','[]')");
 const admin=(await f.login('admin')).cookie;await f.run("UPDATE sessions SET source_ref='native-admin' WHERE account_id='admin'");
 const table=async()=>ok(await f.request('/api/admin/course/playlists',{cookie:admin}));
 const command=async(playlistId,extra={})=>{const v=await table(),p=v.playlists.find(p=>p.id===playlistId&&!p.legacy);return {action:'mou-playlist-save',operationId:crypto.randomUUID(),playlistId,name:p?.name||'Canonical playlist',closeDate:'',revision:v.revision,playlistRevision:p?.revision||0,websiteRevision:p?.websiteRevision||0,...extra};};
 const post=body=>f.request('/api/admin/course',{cookie:admin,method:'POST',body});
 const save=async(id,extra)=>ok(await post(await command(id,extra)));
 const publication=async(id,published=true)=>{const c=await command(id);return {action:'mou-playlist-publication',operationId:crypto.randomUUID(),playlistId:id,published,revision:c.revision,playlistRevision:c.playlistRevision,websiteRevision:c.websiteRevision};};
 const recording=async(id,playlistId=id)=>{await f.run("INSERT INTO objects VALUES(?,NULL,'video/youtube',?,0,NULL,'abcdefghijk')",'video-'+id,'video-'+id);await f.run("INSERT INTO attachments VALUES(?,?,?,?,?,'2024-01-11','native-class',?,'RECORDING',1)",'recording-'+id,'course',id,'video-'+id,'lesson-'+id,'Recording '+id);await f.run('INSERT INTO mou_playlist_items VALUES(?,?)',playlistId,'recording-'+id);};
 const image=async(id,data=png,more={})=>{const revision=(await table()).revision;return f.request('/api/admin/course/playlist-cover?'+new URLSearchParams({playlistId:id,operationId:crypto.randomUUID(),revision,sha256:await sha256(data),...more}),{cookie:admin,method:'PUT',headers:{'Content-Type':'image/png'},body:data});};
 return {...f,admin,table,command,post,save,publication,recording,image};
}
test('automatic card, optional checked native Teacher and safe canonical design fields',async t=>{
 const f=await setup(t);await f.save('new-card');let p=(await f.table()).playlists.find(p=>p.id==='new-card');assert.deepEqual(p.card,defaultCard());assert.equal(p.publishedCard,null);assert.equal(p.cardImageRequired,true);
 const options=ok(await f.request('/api/admin/course/playlist-card-options',{cookie:f.admin}));assert.equal(options.teacherRequired,false);assert.equal(options.imageUploadLimit,524288);
 const c={...defaultCard(),style:'gradient',gradient:'plum',colour:'#aabbcc',teacher:'Forged name'};
 const saved=await f.save('new-card',{card:c,teacherIds:['native-teacher']});assert.equal(saved.card.teacher,'Checked Native Teacher');assert.equal(saved.card.colour,'#AABBCC');assert((await f.post(await f.command('new-card',{card:c,teacherIds:['unregistered']}))).status===400);
 await f.save('new-card',{card:c,teacherIds:[]});p=(await f.table()).playlists.find(p=>p.id==='new-card');assert.equal(p.card.teacher,null);assert.deepEqual(p.teacherIds,[]);
 for(const card of [{...c,gradient:'url(evil)'},{...c,colour:'red;background:url(x)'},{...c,style:'other'},{...defaultCard(),style:'colour',gradient:'sage'},{...defaultCard(),gradient:'sage'}])assert.equal((await f.post(await f.command('new-card',{card}))).status,400);
 assert.equal((await f.post(await f.command('new-card',{card:{...c,style:'image',image:{assetId:'protected-pdf',sha256:'a'.repeat(64),type:'image/png',size:1,alt:'private'},teacherIds:[]}}))).status,409);
});
test('prospective artwork upload remains private, scoped and bounded without media/rights side effects',async t=>{
 const f=await setup(t),id='prospective-card',hash=await sha256(png),uploaded=ok(await f.image(id)),image=uploaded.image;assert.equal(image.url,null);assert.equal(uploaded.revision,(await f.table()).revision);
 assert.equal((await f.request('/api/public/circles/covers/'+hash)).status,404);
 const preview=await f.request('/api/admin/course/playlist-cover?'+new URLSearchParams({playlistId:id,assetId:image.assetId}),{cookie:f.admin});assert.equal(preview.status,200);assert.deepEqual(preview.body,png);assert.match(preview.response.headers.get('Cache-Control'),/no-store/);
 assert.equal((await f.request('/api/admin/course/playlist-cover?'+new URLSearchParams({playlistId:'another',assetId:image.assetId}),{cookie:f.admin})).status,404);
 const learner=(await f.login()).cookie;assert.equal((await f.request('/api/admin/course/playlist-cover?'+new URLSearchParams({playlistId:id,assetId:image.assetId}),{cookie:learner})).status,403);
 assert.equal((await f.image(id,new Uint8Array(524289))).status,413);assert.equal((await f.image(id,new TextEncoder().encode('%PDF-1.7'))).status,400);assert.equal((await f.image(id,png,{sha256:'f'.repeat(64)})).status,409);
 await f.save(id,{card:{...defaultCard(),style:'image',image:{...image,url:'https://untrusted.invalid/'}}});assert.equal((await f.table()).playlists.find(p=>p.id===id).card.image.url,null);
 assert.equal(await f.db.prepare('SELECT count(*) n FROM objects WHERE asset_id=?').bind(image.assetId).first('n'),0);assert.equal(await f.db.prepare('SELECT count(*) n FROM paid_months WHERE offering_id=\'course\'').first('n'),0);
 assert.equal((await f.request('/api/public/circles/covers/'+hash)).status,404);
});
test('persistent Course image gate covers playlist, canonical editor and SQL while legacy published cards stay exempt',async t=>{
 const f=await setup(t);await f.save('first-image');await f.recording('first-image');const pub=await f.publication('first-image');assert.equal((await f.post(pub)).body.code,'COURSE_CARD_IMAGE_REQUIRED');
 assert.equal((await f.request('/api/websites/first-image/edit',{cookie:f.admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'publish',revision:pub.websiteRevision}})).body.code,'COURSE_CARD_IMAGE_REQUIRED');
 await assert.rejects(f.run("UPDATE websites SET enabled=1,published_key=draft_key WHERE website_id='first-image'"),/COURSE_CARD_IMAGE_REQUIRED/);
 const image=ok(await f.image('first-image')).image;
 for(const style of ['default','colour','gradient']){const card={...defaultCard(),style,gradient:style==='gradient'?'sage':null,image};assert.equal((await f.post(await f.command('first-image',{card}))).status,400,'Non-image style must reject an unused image reference');}
 for(const card of [{...defaultCard(),style:'colour',image},{...defaultCard(),style:'image',image:{...image,sha256:'f'.repeat(64)}},{...defaultCard(),style:'image',image:{...image,type:'image/jpeg'}},{...defaultCard(),style:'image',image:{...image,size:image.size+1}}]){
  await assert.rejects(f.db.batch([f.db.prepare('UPDATE playlist_card_designs SET published_json=? WHERE playlist_id=?').bind(JSON.stringify(card),'first-image'),f.db.prepare('UPDATE websites SET enabled=1,published_key=draft_key WHERE website_id=?').bind('first-image')]),/COURSE_CARD_IMAGE_REQUIRED/);
  assert.equal(await f.db.prepare('SELECT published_json FROM playlist_card_designs WHERE playlist_id=?').bind('first-image').first('published_json'),null,'Rejected alternative publication rolls back its card snapshot');
 }
 await f.save('first-image',{card:{...defaultCard(),style:'image',gradient:'sage',image}});ok(await f.post(await f.publication('first-image')));
 assert.equal((await f.table()).playlists.find(p=>p.id==='first-image').cardImageRequired,true,'New Course requirement persists after first publication');
 await f.save('first-image',{name:'Private colour draft',card:{...defaultCard(),style:'colour'}});const previous=await f.db.prepare('SELECT published_json,published_title FROM playlist_card_designs WHERE playlist_id=?').bind('first-image').first();
 const rejected=await f.publication('first-image');assert.equal((await f.post(rejected)).body.code,'COURSE_CARD_IMAGE_REQUIRED');assert.equal((await f.request('/api/websites/first-image/edit',{cookie:f.admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'publish',revision:rejected.websiteRevision}})).body.code,'COURSE_CARD_IMAGE_REQUIRED');
 assert.deepEqual(await f.db.prepare('SELECT published_json,published_title FROM playlist_card_designs WHERE playlist_id=?').bind('first-image').first(),previous,'Rejected re-publication keeps the existing published card/name');
 ok(await f.post(await f.publication('first-image',false)));assert.equal((await f.post(await f.publication('first-image'))).body.code,'COURSE_CARD_IMAGE_REQUIRED');
 await f.save('first-image',{card:{...defaultCard(),style:'image',image}});ok(await f.post(await f.publication('first-image')));
 await f.run("INSERT INTO mou_playlists VALUES('legacy-course','course','site-course',1,0,0,1)");const legacy=(await f.table()).playlists.find(p=>p.id==='legacy-course');assert.equal(legacy.cardImageRequired,false);assert.equal(legacy.publishedName,'Whole Course');await f.recording('site-course','legacy-course');
 ok(await f.post(await f.publication('legacy-course',false)));ok(await f.post(await f.publication('legacy-course')));assert.equal((await f.table()).playlists.find(p=>p.id==='legacy-course').cardImageRequired,false);
});
test('explicit publication promotes artwork and snapshots canonical name; Save stays private across list, reader and recording header',async t=>{
 const f=await setup(t),id='publish-card',image=ok(await f.image(id)).image;await f.save(id,{name:'Public name',card:{...defaultCard(),style:'image',image}});await f.recording(id);const publish=await f.publication(id);ok(await f.post(publish));assert((await f.post(publish)).body.replayed);
 const art=await f.request('/api/public/circles/covers/'+image.sha256);assert.equal(art.status,200);assert.equal(art.reads,0);assert.equal(art.queries,0);assert.match(art.response.headers.get('Cache-Control'),/immutable/);
 await f.save(id,{name:'Private next name',card:{...defaultCard(),style:'colour',colour:'#112233'},teacherIds:[]});
 const learner=(await f.login()).cookie;
 for(const path of ['/api/offerings/course/playlists','/api/websites?published=1']){const r=ok(await f.request(path,{cookie:learner})),p=r.playlists.find(p=>p.id===id);assert.equal(p.title,'Public name');assert.equal(p.card.style,'image');assert.equal(p.card.image.url,'https://website.test/api/public/circles/covers/'+image.sha256);assert.equal(p.canEdit,false);assert(!('teacherIds' in p));if(r.websites)assert.equal(r.websites.find(w=>w.website_id===id).title,'Public name');}
 const reader=ok(await f.request('/api/websites/'+id,{cookie:learner}));assert.equal(reader.playlistId,id);assert.equal(reader.document.name,'Public name');assert.equal(reader.canEdit,false);
 const media=ok(await f.request('/api/offerings/course/media?website='+id,{cookie:learner}));assert.equal(media.playlist.name,'Public name');
 const adminList=ok(await f.request('/api/websites?published=1',{cookie:f.admin}));assert.equal(adminList.playlists.find(p=>p.id===id).canEdit,true);
 const draft=(await f.table()).playlists.find(p=>p.id===id);assert.equal(draft.name,'Private next name');assert.equal(draft.publishedName,'Public name');assert.equal(draft.card.style,'colour');
 assert.equal((await f.post(await f.publication(id))).body.code,'COURSE_CARD_IMAGE_REQUIRED');assert.equal(ok(await f.request('/api/websites/'+id,{cookie:learner})).document.name,'Public name');
 await f.save(id,{card:{...defaultCard(),style:'image',colour:'#112233',image}}); ok(await f.post(await f.publication(id)));assert.equal(ok(await f.request('/api/websites/'+id,{cookie:learner})).document.name,'Private next name');
 const exported=ok(await f.request('/api/websites/'+id+'/export',{cookie:f.admin}));assert.equal(exported.document.name,'Private next name');const document={...exported.document,name:'Draft editor name',home:{...exported.document.home,description:'Private changed description'}};
 ok(await f.request('/api/websites/'+id+'/edit',{cookie:f.admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'save',revision:exported.revision,document}}));assert.equal(ok(await f.request('/api/websites/'+id,{cookie:learner})).document.home.description,'');
 assert.equal(ok(await f.request('/api/websites/'+id+'/export',{cookie:f.admin})).document.name,'Draft editor name');
 const saved=ok(await f.request('/api/websites/'+id+'/export',{cookie:f.admin}));ok(await f.request('/api/websites/'+id+'/edit',{cookie:f.admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'publish',revision:saved.revision}}));const visible=ok(await f.request('/api/websites/'+id,{cookie:learner}));assert.equal(visible.document.name,'Draft editor name');assert.equal(visible.document.home.description,'Private changed description');
 ok(await f.post(await f.publication(id,false)));assert.equal((await f.request('/api/websites/'+id,{cookie:learner})).status,404);assert.equal((await f.request('/api/public/circles/covers/'+image.sha256)).status,200);
});
test('failed stale publication never promotes; committed artwork promotion completes on exact retry only',async t=>{
 const f=await setup(t),id='retry-card',image=ok(await f.image(id)).image;await f.save(id,{card:{...defaultCard(),style:'image',image}});await f.recording(id);
 const stale=await f.publication(id);await f.save(id,{name:'Changed private name'});assert.equal((await f.post(stale)).status,409);assert.equal((await f.request('/api/public/circles/covers/'+image.sha256)).status,404);
 const command=await f.publication(id),store=new Store({...f.env,DB:f.db}),actor=await store.actor(await sha256(f.admin.split('=')[1]));
 await assert.rejects(playlistPublication({...f.env,CONTENT:{get:async()=>null}},store,actor,'course',command),e=>e.code==='CARD_PUBLICATION_PENDING');
 assert.equal(await f.db.prepare('SELECT enabled FROM websites WHERE website_id=?').bind(id).first('enabled'),1);assert.equal((await f.request('/api/public/circles/covers/'+image.sha256)).status,404);
 await f.save(id,{name:'Later private draft',card:{...defaultCard(),style:'colour',colour:'#AABBCC'}});
 assert.equal((await f.post({...command,playlistId:'other'})).body.code,'RETRY_CONFLICT');ok(await f.post(command));assert.equal((await f.request('/api/public/circles/covers/'+image.sha256)).status,200);
 await f.run("UPDATE accounts SET epoch=2 WHERE account_id='admin'");assert.equal((await f.post(command)).status,401);
});
test('card read joins stay bounded after unrelated card/asset growth and Teacher has no edit capability',async t=>{
 const f=await setup(t),id='bounded-card',image=ok(await f.image(id)).image;await f.save(id,{card:{...defaultCard(),style:'image',image}});await f.recording(id);ok(await f.post(await f.publication(id)));
 const learner=(await f.login()).cookie,paths=['/api/admin/course/playlists','/api/offerings/course/playlists','/api/websites?published=1'];
 const measure=async()=>{const values=[];for(const path of paths){const r=await f.request(path,{cookie:path.includes('/admin/')?f.admin:learner});ok(r);values.push({path,reads:r.reads,queries:r.queries});}return values;};const before=await measure();
 await f.run("INSERT INTO offerings VALUES('unrelated','COURSE','Unrelated',1,1)");
 await f.run("WITH RECURSIVE n(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<4000) INSERT INTO websites(website_id,offering_id,title,enabled,revision) SELECT 'unrelated-'||x,'unrelated','Other',0,0 FROM n");
 await f.run("INSERT INTO mou_playlists SELECT website_id,'unrelated',website_id,1,0,0,1 FROM websites WHERE offering_id='unrelated'");
 await f.run("INSERT INTO playlist_cover_assets SELECT 'art-'||website_id,'unrelated',website_id,printf('%064d',rowid),'image/png',1,'private/other/'||website_id FROM websites WHERE offering_id='unrelated'");
 const after=await measure();for(let i=0;i<after.length;i++){assert.equal(after[i].queries,before[i].queries);assert(after[i].reads<=before[i].reads+2,'Indexed boundary overhead is constant after4000 unrelated cards/assets');}t.diagnostic(JSON.stringify({before,after}));
 const teacher=(await f.login('teacher')).cookie;assert.equal(ok(await f.request('/api/websites?published=1',{cookie:teacher})).playlists.find(p=>p.id===id).canEdit,false);
});
test('upload transaction fences role, session and epoch changes after private R2 write',async t=>{
 const f=await setup(t);for(const [i,sql] of ["UPDATE sessions SET revoked=1 WHERE account_id='admin'","UPDATE accounts SET epoch=2 WHERE account_id='admin'","UPDATE accounts SET global_admin=0 WHERE account_id='admin'","INSERT INTO source_access_master_fences VALUES('admin','course',1,1,1,1)"].entries()){
  const store=new Store({...f.env,DB:f.db}),actor=await store.actor(await sha256(f.admin.split('=')[1])),mutate=store.mutate.bind(store);store.mutate=async(...args)=>{await f.run(sql);return mutate(...args);};
  await assert.rejects(uploadCover({...f.env,CONTENT:f.content},store,actor,'course',{operationId:'race-'+i,playlistId:'race-card-'+i,revision:(await f.table()).revision,type:'image/png',sha256:await sha256(png)},png),/permissions|changed/);
  assert.equal(await f.db.prepare('SELECT count(*) n FROM playlist_cover_assets').first('n'),0);await f.run("DELETE FROM source_access_master_fences WHERE account_id='admin'");await f.run("UPDATE sessions SET revoked=0 WHERE account_id='admin'");await f.run("UPDATE accounts SET epoch=1,global_admin=1,verified_at=? WHERE account_id='admin'",Date.now());
 }
});
