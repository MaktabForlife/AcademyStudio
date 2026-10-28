import test from 'node:test';
import assert from 'node:assert/strict';
import {newCourse} from '../public/shared/model.mjs';
import {createWebsitePackage,R2WebsiteContentStore,stableContentIds} from '../src/website-package.mjs';
import {createWebsiteEditSession} from '../public/shared/website-edit-session.mjs';

test('content packages preserve native content and identifiers while excluding operational data',()=>{
 const document=newCourse(),before=JSON.stringify(document),ids=stableContentIds(document);
 const packed=createWebsitePackage({websiteId:'site-one',document});
 assert.equal(JSON.stringify(packed.document),before);assert.deepEqual(stableContentIds(packed.document),ids);
 for(const field of ['participants','credentials','reflectionAnswers','zoomUrl']){
  assert.throws(()=>createWebsitePackage({websiteId:'site-one',document:{...document,[field]:[]}}),/Operational/);
 }
 document.home.description='https://example.zoom.us/j/123456789';assert.throws(()=>createWebsitePackage({websiteId:'site-one',document}),/join reference/);
});

function bucket(){
 const data=new Map();return {data,async put(key,body){if(data.has(key))return null;data.set(key,body);return {etag:'saved'};},async get(key){const body=data.get(key);return body===undefined?null:{size:new TextEncoder().encode(body).length,async text(){return body;}};}};
}
test('R2 editions use independent website namespaces, reuse identical objects and reject cross-website keys',async()=>{
 const storage=bucket(),store=new R2WebsiteContentStore(storage),document=newCourse();
 const first=createWebsitePackage({websiteId:'one',document}),second=createWebsitePackage({websiteId:'two',document});
 const a=await store.put(first),b=await store.put(second);assert.notEqual(a.key,b.key);assert.equal(storage.data.size,2);
 assert.deepEqual(await store.get('one',a.key),document);assert.equal((await store.put(first)).key,a.key);assert.equal(storage.data.size,2);
 await assert.rejects(store.get('one',b.key));
 document.home.description='New edition';await store.put(createWebsitePackage({websiteId:'one',document}));assert.equal(storage.data.size,3);assert.deepEqual(await store.get('two',b.key),second.document);
 storage.data.set(a.key,'{}');await assert.rejects(store.get('one',a.key),/integrity/);
});
test('failed R2 writes do not return a publishable key',async()=>{
 const store=new R2WebsiteContentStore({async put(){throw Error('Storage unavailable');}});
 await assert.rejects(store.put(createWebsitePackage({websiteId:'one',document:newCourse()})),/Storage unavailable/);
});

function editorFixture(){
 let owner='admin',revision=0,published=newCourse(),draft=structuredClone(published),calls=[],receipts=new Map(),fail=false;
 const request=async(action,input)=>{
  calls.push({action,input:structuredClone(input)});
  if(action==='open')return {websiteId:input.websiteId,revision,document:structuredClone(draft),publishedVersion:0};
  if(receipts.has(input.operationId))return receipts.get(input.operationId);
  if(input.revision!==revision)throw Object.assign(Error('Conflict'),{status:409});
  if(input.action==='save')draft=structuredClone(input.document);
  if(input.action==='publish')published=structuredClone(draft);
  const result={websiteId:input.websiteId,revision:++revision};receipts.set(input.operationId,result);
  if(fail){fail=false;throw Error('Response lost after commit');}return result;
 };
 const make=()=>createWebsiteEditSession({websiteId:'one',owner:()=>owner,request});
 return {make,calls,get published(){return published;},switch(){owner='other';},failNext(){fail=true;}};
}
test('both editing modes share manual Save/Publish; keystrokes and draft previews make no requests',async()=>{
 const f=editorFixture(),full=f.make();await full.open();const initial=f.published.home.description;
 for(let i=0;i<20;i++)full.change('home.description','Edited '+i);
 full.preview();assert.equal(f.calls.length,1);assert.equal(f.published.home.description,initial);
 await assert.rejects(full.publish(),/Save your changes/);await full.save();assert.equal(f.published.home.description,initial);
 const inline=f.make();await inline.open();assert.equal(inline.record.document.home.description,'Edited 19');
 inline.change('home.description','On-page edit');await inline.save();await inline.publish();assert.equal(f.published.home.description,'On-page edit');
});
test('conflicting windows preserve unsaved content; explicit export precedes reopening',async()=>{
 const f=editorFixture(),a=f.make(),b=f.make();await a.open();await b.open();a.change('home.description','First window');b.change('home.description','Keep this work');
 await a.save();await assert.rejects(b.save(),e=>e.status===409);assert.equal(b.dirty,true);assert.equal(b.conflict,true);assert.equal(b.export().document.home.description,'Keep this work');
 await assert.rejects(b.open(),/unsaved work/);await b.open({discardUnsaved:true});assert.equal(b.record.document.home.description,'First window');
});
test('uncertain saves retry the exact operation rather than creating a second revision',async()=>{
 const f=editorFixture(),s=f.make();await s.open();s.change('home.description','Saved once');f.failNext();await assert.rejects(s.save(),/Response lost/);
 assert.equal(s.pending,true);assert.equal(s.dirty,true);await s.save();assert.equal(s.record.revision,1);assert.equal(s.dirty,false);
 const mutations=f.calls.filter(c=>c.action==='mutate');assert.deepEqual(mutations[0].input,mutations[1].input);
});
test('switching accounts clears private editor state and an old response cannot restore it',async()=>{
 const f=editorFixture(),s=f.make();await s.open();s.change('home.description','Private text');f.switch();assert.equal(s.record,null);assert.throws(()=>s.preview(),e=>e.name==='AbortError');
 let resolve,owner='admin';const late=createWebsiteEditSession({websiteId:'one',owner:()=>owner,request:()=>new Promise(done=>resolve=done)}),opening=late.open();owner='other';late.clear();resolve({websiteId:'one',revision:0,document:newCourse()});await assert.rejects(opening,e=>e.name==='AbortError');assert.equal(late.record,null);
});

test('uncertain publication exposes a retry action and does not publish twice',async()=>{
 const f=editorFixture(),s=f.make();await s.open();s.change('home.description','Publish exactly once');await s.save();f.failNext();await assert.rejects(s.publish(),/Response lost/);
 assert.equal(s.pendingAction,'publish');await s.retry();assert.equal(s.pending,false);assert.equal(s.record.revision,2);assert.equal(f.published.home.description,'Publish exactly once');
 const attempts=f.calls.filter(call=>call.input?.action==='publish');assert.deepEqual(attempts[0].input,attempts[1].input);
});
test('a pending restore cannot silently switch to another requested historical edition',async()=>{
 const f=editorFixture(),s=f.make();await s.open();f.failNext();await assert.rejects(s.restore(0),/Response lost/);assert.equal(s.pendingAction,'restore');await assert.rejects(s.restore(1),/unfinished action/);
});
