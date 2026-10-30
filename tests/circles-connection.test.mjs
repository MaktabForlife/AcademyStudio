import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {circlesFixture} from './circles-fixture.mjs';
import {signIn,ok} from './access-fixture.mjs';
import {bindRecordingGuides} from '../public/shared/media-bindings.mjs';
import {recordingGuides} from '../public/shared/recording-companion.mjs';
import {seriesRecordings,recordingDetail} from '../public/shared/recording-website.mjs';
import {circlesCatalogue} from '../public/shared/circles-catalogue.mjs';
import {guideBindingsKey} from '../src/circles.mjs';
import {sha256} from '../src/protocol.mjs';

const access='/api/circles/access?website=site-course&website=site-surah&website=unknown';
test('published Circles cards are public with zero D1 reads; private metadata and unreviewed links stay out',async()=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY'});try{
  await circlesFixture(f);f.source.resetMetrics();
  const r=await f.request('/api/public/circles'),data=ok(r);assert.equal(r.reads,0);assert.equal(f.source.metrics.queries,0);
  assert.equal(data.items.find(i=>i.key==='foundations').publicTextUrl,'https://academy.test/academy/foundations/');
  assert.equal(data.items.find(i=>i.key==='unmapped-course').websiteId,null);assert(!JSON.stringify(data).includes('must-not-leak'));
  const cover=new Uint8Array([137,80,78,71]),digest=await sha256(cover);await f.content.put('public/circles/covers/'+digest,cover,{httpMetadata:{contentType:'image/png'}});
  const image=await f.request('/api/public/circles/covers/'+digest);assert.equal(image.status,200);assert.equal(image.reads,0);assert.deepEqual(image.body,cover);
  const html=circlesCatalogue(data.items);assert(!html.includes('data-circles-website="must-not-leak"'));assert(html.includes('Text pending'));assert(!html.includes('View lesson'));
  await f.content.put('public/circles/catalogue.json',JSON.stringify({format:'CIRCLES_PUBLIC_CATALOGUE_V1',items:[{key:'foundations',kind:'TAFSEER',title:'Free text',publicTextPath:'https://outside.test/academy/'}]}));
  assert.equal((await f.request('/api/public/circles')).status,503);
  assert.equal((await f.request('/api/public/circles/covers/not-a-digest')).status,401);
 }finally{await f.close();}
});

test('ordinary private Save and explicit Publish retain exact guide links without changing the original edition',async()=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY'});try{
  const x=await circlesFixture(f),cookie=await signIn(f,'global'),path='/api/websites/site-course/edit';
  const before=ok(await f.request(path,{cookie})),document=structuredClone(before.document);document.name='Edited synthetic Course';
  const saved=ok(await f.request(path,{cookie,method:'POST',body:{action:'save',operationId:crypto.randomUUID(),revision:before.revision,document}}));
  assert.deepEqual(ok(await f.request('/api/websites/site-course',{cookie})).document,x.doc,'Private Save leaves published teaching unchanged');
  const draft=ok(await f.request(path,{cookie})),raw=await f.content.get(guideBindingsKey('site-course',draft.draftVersion));assert(raw);assert.deepEqual((await raw.json()).bindings,[x.binding]);
  ok(await f.request(path,{cookie,method:'POST',body:{action:'publish',operationId:crypto.randomUUID(),revision:saved.revision}}));
  const feed=ok(await f.request('/api/offerings/course/media?website=site-course',{cookie}));assert.deepEqual(feed.mediaBindings,[x.binding]);assert.equal(ok(await f.request('/api/websites/site-course',{cookie})).document.name,document.name);
  assert(await f.content.get(guideBindingsKey('site-course',x.edition)),'Original mapping history is retained');
 }finally{await f.close();}
});

test('catalogue symbols use acquired rights, keep staff access separate, and close after source withdrawal or expiry',async()=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY'});try{
  const x=await circlesFixture(f),cookie=await signIn(f),learner=ok(await f.request(access,{cookie})).websites;
  assert.equal(learner[0].accessBasis,'purchase');assert.equal(learner[0].canOpen,true);assert.equal(learner[1].accessBasis,'paid-month');assert.equal(learner[2].canOpen,false);
  const admin=await signIn(f,'global'),adminRights=ok(await f.request(access,{cookie:admin})).websites;
  assert.equal(adminRights[0].canOpen,true);assert.equal(adminRights[0].subscriptionStatus,'required');assert.equal(adminRights[0].accessBasis,null);
  const grant=await signIn(f,'studentB'),grants=ok(await f.request(access,{cookie:grant})).websites;assert.equal(grants[1].accessBasis,'website-grant');assert.equal(grants[0].canOpen,false);
  await x.run('UPDATE role_assignments SET active=0 WHERE account_id=?',x.student);await x.recover(8);
  assert.equal(ok(await f.request(access,{cookie})).websites[0].accessBasis,'purchase','Withdrawal of live participation retains the whole-Course purchase');
  await x.run('UPDATE course_subscription_decisions SET active=0 WHERE account_id=? AND activity_key=?',x.student,x.courseA);await x.recover(8);
  assert.equal(ok(await f.request(access,{cookie})).websites[0].canOpen,false);assert.equal((await f.request('/api/media/circles-video-attachment',{cookie})).status,403);
  await f.run('UPDATE source_access_people SET verified_at=? WHERE account_id=?',Date.now()-86_401_000,x.grant);
  const stale=ok(await f.request(access,{cookie:grant})).websites[1];assert.equal(stale.canOpen,false);assert.equal(stale.needsRefresh,true);assert.equal(stale.subscriptionStatus,'required');
 }finally{await f.close();}
});

test('recording companions join only the exact currently permitted native feed in the published edition',async()=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY'});try{
  const x=await circlesFixture(f),cookie=await signIn(f);f.source.resetMetrics();
  const feed=ok(await f.request('/api/offerings/course/media?website=site-course',{cookie}));assert.deepEqual(feed.mediaBindings,[x.binding]);
  const document=ok(await f.request('/api/websites/site-course',{cookie})).document;assert.deepEqual(document,x.doc);
  const guides=bindRecordingGuides(recordingGuides(document),feed.media,feed.mediaBindings),entries=seriesRecordings({media:feed.media,guides});assert.equal(entries[0].summary,'A synthetic summary for connection testing.');
  assert(recordingDetail(entries[0],document).includes('data-recording-start="135"'));
  assert.equal((await f.request('/api/media/circles-pdf-attachment',{cookie,headers:{Range:'bytes=0-7'}})).status,206);
  assert.equal(f.source.metrics.queries,0,'Ordinary catalogue/document/guide/media delivery never calls Academy');
  await f.run("UPDATE attachments SET published=0 WHERE attachment_id='circles-video-attachment'");
  assert.equal(ok(await f.request('/api/offerings/course/media?website=site-course',{cookie})).mediaBindings.length,0);assert.equal((await f.request('/api/media/circles-video-attachment',{cookie})).status,404);
  const grant=await signIn(f,'studentB');assert.equal((await f.request('/api/offerings/course/media?website=site-course',{cookie:grant})).status,403);
  await f.run("UPDATE attachments SET published=1 WHERE attachment_id='circles-video-attachment'");
  await f.content.put(guideBindingsKey('site-course',x.edition),JSON.stringify({format:'CIRCLES_RECORDING_BINDINGS_V1',websiteId:'another-website',edition:x.edition,bindings:[x.binding]}));
  assert.equal((await f.request('/api/offerings/course/media?website=site-course',{cookie})).status,503);
 }finally{await f.close();}
});

test('catalogue permission reads remain bounded beside unrelated websites and reject oversized batches',async t=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY'});try{
  await circlesFixture(f);const cookie=await signIn(f),before=await f.request(access,{cookie});ok(before);f.source.resetMetrics();
  await f.run("INSERT INTO websites SELECT 'unrelated-'||value,'course','Unrelated',NULL,NULL,NULL,0,1,NULL FROM json_each(?)",JSON.stringify(Array.from({length:4000},(_,i)=>i)));
  const after=await f.request(access,{cookie});ok(after);assert.equal(after.reads,before.reads);assert(after.reads<80);assert.equal(f.source.metrics.queries,0);
  const params=new URLSearchParams();for(let i=0;i<51;i++)params.append('website','site-'+i);assert.equal((await f.request('/api/circles/access?'+params,{cookie})).status,400);
  assert.equal((await f.request(access)).status,401);t.diagnostic(JSON.stringify({catalogueRowsRead:before.reads,after4000UnrelatedWebsites:after.reads,academyRowsRead:f.source.metrics.rowsRead}));
 }finally{await f.close();}
});
