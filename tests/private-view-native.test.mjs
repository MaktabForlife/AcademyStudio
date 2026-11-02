import {circlesFixture} from './circles-fixture.mjs';import {signIn} from './access-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './fixture.mjs';
const tag=r=>r.response.headers.get('ETag');
const conditional=(f,path,cookie,etag)=>f.request(path,{cookie,headers:{'If-None-Match':etag}});
test('published website validates current purchase before304 and avoids re-reading current edition files',async t=>{
 const f=await fixture();t.after(()=>f.close());const cookie=(await f.login()).cookie;
 const doc=structuredClone(f.doc);doc.materials.files=Array.from({length:20},(_,i)=>({id:'file-'+i,assetId:'file-'+i,title:'Original PDF '+i,description:''}));
 for(let i=0;i<20;i++){await f.run('INSERT INTO objects VALUES(?,?,?,?,?,?,NULL)','file-'+i,'private/'+i,'application/pdf','PDF '+i,20,'synthetic');await f.run("INSERT INTO attachments VALUES(?,?,?,?,'lesson','2026-10-28','','Shared original','WEBSITE',1)",'file-attachment-'+i,'course','site-course','file-'+i);await f.run("INSERT INTO published_assets VALUES('site-course',?)",'file-'+i);}
 await f.content.put('websites/site-course/versions/cache.json',JSON.stringify(doc));await f.run("UPDATE websites SET published_key='websites/site-course/versions/cache.json' WHERE website_id='site-course'");
 const path='/api/websites/site-course',cold=await f.request(path,{cookie});assert.equal(cold.status,200);assert.equal(cold.body.assets.length,20);assert(tag(cold));
 const warm=await conditional(f,path,cookie,tag(cold));assert.equal(warm.status,304);assert.equal(warm.body.length,0);assert(warm.reads<cold.reads/2,JSON.stringify({cold:cold.reads,warm:warm.reads}));assert.equal(warm.response.headers.get('Cache-Control'),'private, no-store');
 await f.run("UPDATE participation SET purchased=0 WHERE account_id='learner' AND offering_id='course'");assert.equal((await conditional(f,path,cookie,tag(cold))).status,403);
 t.diagnostic(JSON.stringify({coldRows:cold.reads,returnRows:warm.reads,editionAssets:20,sourceRequests:0}));
});
test('session, exact website, private drafts and withdrawal cannot reuse another cached body',async t=>{
 const f=await fixture();t.after(()=>f.close());const learner=(await f.login()).cookie,former=(await f.login('former')).cookie,admin=(await f.login('admin')).cookie,path='/api/websites/site-course',cold=await f.request(path,{cookie:learner});
 assert.equal((await conditional(f,path,former,tag(cold))).status,200);assert.equal((await conditional(f,'/api/websites/site-surah',learner,tag(cold))).status,403);
 const draft=await f.request(path+'/edit',{cookie:admin,headers:{'If-None-Match':tag(cold)}});assert.equal(draft.status,200);assert.equal(tag(draft),null);
 await f.run("UPDATE websites SET enabled=0 WHERE website_id='site-course'");assert.equal((await conditional(f,path,learner,tag(cold))).status,404);
 await f.run("UPDATE accounts SET active=0 WHERE account_id='learner'");assert.equal((await conditional(f,path,learner,tag(cold))).status,401);
});
test('empty media pages are cached but recording/companion/file changes invalidate without changing rights revisions',async t=>{
 const f=await fixture();t.after(()=>f.close());const cookie=(await f.login()).cookie,path='/api/offerings/course/media?website=site-course',empty=await f.request(path,{cookie});assert.equal(empty.status,200);assert.equal(empty.body.media.length,0);assert.equal((await conditional(f,path,cookie,tag(empty))).status,304);
 const access=await f.db.prepare("SELECT revision FROM access_revisions WHERE offering_id='course'").first('revision');
 await f.run("INSERT INTO objects VALUES('video','private/video','video/youtube','Original recording',1,'synthetic','UzKY4mmZTPQ')");await f.run("INSERT INTO attachments VALUES('recording','course','site-course','video','lesson','2026-10-28','','Original recording','RECORDING',1)");
 assert.equal(await f.db.prepare("SELECT revision FROM access_revisions WHERE offering_id='course'").first('revision'),access,'Content invalidation never changes existing optimistic accessRevision contracts');
 const changed=await conditional(f,path,cookie,tag(empty));assert.equal(changed.status,200);assert.equal(changed.body.media.length,1);assert.notEqual(tag(changed),tag(empty));assert.equal((await conditional(f,path,cookie,tag(changed))).status,304);
 await f.run("INSERT INTO recording_companions VALUES('recording','source',1,'private/companion',NULL,NULL,3600)");assert.equal((await conditional(f,path,cookie,tag(changed))).status,200);
 await f.run("UPDATE participation SET purchased=0 WHERE account_id='learner' AND offering_id='course'");const denied=await conditional(f,path,cookie,tag(changed));assert.notEqual(denied.status,304);assert.equal(denied.body.media?.length||0,0);
});
test('one checked bootstrap returns real navigation/dashboard/account and ignores a different account view preference',async t=>{
 const f=await fixture({academy:true,dashboard:true,authorityMode:'ACADEMY',navigation:{alimiyah:'programB'},verification:{accountSeconds:43200,adminSeconds:60}});t.after(()=>f.close());await circlesFixture(f);const cookie=await signIn(f,'global');
 const first=await f.request('/api/circles/bootstrap?preferredAccount=other&preferredMode=learn',{cookie});assert.equal(first.status,200,JSON.stringify(first.body));assert.equal(first.body.account.accountId,'sep-global');assert.match(first.body.account.cacheSession,/^[a-f0-9]{64}$/);assert(first.body.dashboard);assert(first.body.navigation);assert.equal(first.body.configuration.academyOrigin,'https://academy.test');
 const warm=await f.request('/api/circles/bootstrap',{cookie});assert.equal(warm.status,200);assert(warm.body.dashboard.cached);assert.equal((await conditional(f,'/api/circles/bootstrap',cookie,tag(warm))).status,304,'Only a complete current bootstrap may validate a private saved dashboard');const oldMe=await f.request('/api/me',{cookie}),oldNav=await f.request('/api/circles/navigation',{cookie}),oldDash=await f.request('/api/circles/dashboard',{cookie,method:'POST',body:{}});assert.equal(oldNav.status,200);assert.equal(oldDash.status,200);
 t.diagnostic(JSON.stringify({bootstrapRows:warm.reads,previousSeparateRows:oldMe.reads+oldNav.reads+oldDash.reads,bootstrapRequests:1,previousRequests:3}));assert(warm.reads<oldMe.reads+oldNav.reads+oldDash.reads);
 const path='/api/circles/dashboard?mode='+first.body.dashboard.mode+'&date='+first.body.dashboard.selectedDate,dash=await f.request(path,{cookie});assert.equal(dash.status,200);assert.equal((await conditional(f,path,cookie,tag(dash))).status,304);
 await f.run("UPDATE accounts SET active=0 WHERE account_id='sep-global'");assert.equal((await conditional(f,path,cookie,tag(dash))).status,401);
});
test('a failed timetable service leaves verified account and available navigation usable, without caching the failure',async t=>{const f=await fixture();t.after(()=>f.close());const cookie=(await f.login()).cookie;await f.run("UPDATE sessions SET source_ref='synthetic-source' WHERE account_id='learner'");await f.run("INSERT INTO circles_navigation VALUES('learner',1,?,'[]')",Date.now());const r=await f.request('/api/circles/bootstrap',{cookie});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.account.accountId,'learner');assert(r.body.navigation);assert.equal(r.body.dashboard,null);assert(r.body.errors.dashboard);assert.equal(tag(r),null,'A failed component never creates a reusable successful bootstrap');});
