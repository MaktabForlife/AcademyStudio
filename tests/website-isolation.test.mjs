import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {handle} from '../src/worker.mjs';
import {createWebsiteEditSession} from '../public/shared/website-edit-session.mjs';
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};

test('a draft, publication and history change only the selected website in the same offering',async()=>{
 const f=await fixture();try{
  const admin=(await f.login('admin')).cookie,learner=(await f.login()).cookie;
  const original=ok(await f.request('/api/websites/site-course',{cookie:learner}));
  await f.run("INSERT INTO websites(website_id,offering_id,title,draft_key,published_key,revision,enabled) VALUES('site-peer','course','Peer',?,?,0,1)",'websites/site-course/versions/seed.json','websites/site-course/versions/seed.json');
  const before=await f.db.prepare("SELECT * FROM websites WHERE website_id='site-peer'").first();
  const source=ok(await f.request('/api/websites/site-course/edit',{cookie:admin}));source.document.home.description='An independent private draft';
  const saved=await f.request('/api/websites/site-course/edit',{cookie:admin,method:'POST',body:{action:'save',revision:0,operationId:crypto.randomUUID(),document:source.document}});ok(saved);
  assert.deepEqual(ok(await f.request('/api/websites/site-course',{cookie:learner})).document,original.document);
  const published=await f.request('/api/websites/site-course/edit',{cookie:admin,method:'POST',body:{action:'publish',revision:1,operationId:crypto.randomUUID()}});ok(published);
  assert.equal(ok(await f.request('/api/websites/site-course',{cookie:learner})).document.home.description,'An independent private draft');
  assert.deepEqual(await f.db.prepare("SELECT * FROM websites WHERE website_id='site-peer'").first(),before);
  assert.equal(await f.db.prepare("SELECT count(*) n FROM website_history WHERE website_id='site-peer'").first('n'),0);
  assert.equal(await f.db.prepare("SELECT count(*) n FROM website_history WHERE website_id='site-course'").first('n'),2);
  const keys=await f.db.prepare("SELECT draft_key,published_key FROM websites WHERE website_id='site-course'").first();assert(keys.draft_key.startsWith('websites/site-course/versions/'));
  console.log(JSON.stringify({workflow:'independent-save-publish',localOnly:true,saveRowsRead:saved.reads,publishRowsRead:published.reads}));
 }finally{await f.close();}
});

test('both editor modes exercise the same real backend; unrelated websites do not amplify reads',async()=>{
 const f=await fixture();try{
  const cookie=(await f.login('admin')).cookie,metrics=[];
  const request=async(action,input)=>{const result=await f.request('/api/websites/site-course/edit',{cookie,...(action==='mutate'?{method:'POST',body:input}:{})});metrics.push({action,reads:result.reads});if(result.status!==200)throw Object.assign(Error(result.body.error),{status:result.status});return result.body;};
  const make=()=>createWebsiteEditSession({websiteId:'site-course',owner:()=> 'admin',request});
  const builder=make(),inline=make();await builder.open();await inline.open();const initialReads=metrics[0].reads;
  builder.change('home.headline','Builder edit');await builder.save();inline.change('home.headline','Preserve this conflicting text');await assert.rejects(inline.save(),e=>e.status===409);assert.equal(inline.export().document.home.headline,'Preserve this conflicting text');
  await inline.open({discardUnsaved:true});inline.change('home.headline','On-page edit');await inline.save();await inline.publish();
  const statements=Array.from({length:100},(_,i)=>f.db.prepare("INSERT INTO websites(website_id,offering_id,title,revision,enabled) VALUES(?,'course','Unrelated',0,0)").bind('unrelated-'+i));await f.db.batch(statements);
  const after=await f.request('/api/websites/site-course/edit',{cookie});ok(after);assert(after.reads<=initialReads+4,`${after.reads} vs ${initialReads}`);
  console.log(JSON.stringify({workflow:'shared-editor',localOnly:true,initialReads,after100UnrelatedWebsites:after.reads,operations:metrics}));
 }finally{await f.close();}
});

test('failed object storage leaves the previous draft and published edition untouched',async()=>{
 const f=await fixture();try{
  const cookie=(await f.login('admin')).cookie,before=await f.db.prepare("SELECT * FROM websites WHERE website_id='site-course'").first();
  const source=ok(await f.request('/api/websites/site-course/edit',{cookie}));source.document.home.description='Storage failure must not replace anything';
  const response=await handle(new Request('https://website.test/api/websites/site-course/edit',{method:'POST',headers:{Cookie:cookie,Origin:'https://website.test','Content-Type':'application/json'},body:JSON.stringify({action:'save',revision:0,operationId:crypto.randomUUID(),document:source.document})}),{...f.env,DB:f.db,CONTENT:{async put(){throw Error('Synthetic R2 outage');}},MEDIA:f.media},{waitUntil(){}});
  assert(response.status>=500);assert.deepEqual(await f.db.prepare("SELECT * FROM websites WHERE website_id='site-course'").first(),before);
  assert.equal(await f.db.prepare("SELECT count(*) n FROM website_history WHERE website_id='site-course'").first('n'),0);
 }finally{await f.close();}
});
