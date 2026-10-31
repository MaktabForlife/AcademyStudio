import test from 'node:test';import assert from 'node:assert/strict';
import {newCourse} from '../public/shared/model.mjs';import {validatePackage} from '../src/content-package.mjs';import {fixture} from './fixture.mjs';import {sha256} from '../src/protocol.mjs';
test('content rejects operational fields and raw meeting links at every supported depth',()=>{
 for(const mutate of [d=>d.accounts=[],d=>d.home.zoomUrl='secret',d=>d.lessons[0].participants=[],d=>d.lessons[0].sections[0].blocks[0].access={paid:true},d=>d.lessons[0].sections[0].blocks[0].aside={accounts:[]},d=>d.home.imageId='../another-file',d=>d.home.description='Join https://example.zoom.us/j/123?pwd=private',d=>d.lessons[0].sections[0].blocks[0].text='https://zoomgov.com/j/123',d=>d.home.description='https://zoom.com/j/123']){const doc=newCourse();mutate(doc);assert.throws(()=>validatePackage(doc));}
 assert.deepEqual(validatePackage(newCourse()),[]);assert.throws(()=>validatePackage({format:'ACADEMY_COURSE_STUDIO_V1',pages:null}));
});
test('the shared schema bounds the full asset-reference set before storage',()=>{
 const doc=newCourse();doc.academyMediaIds=Array.from({length:80},(_,i)=>'asset-'+i);doc.materials.files=Array.from({length:21},(_,i)=>({id:crypto.randomUUID(),assetId:'pdf-'+i,title:'PDF',description:''}));assert.throws(()=>validatePackage(doc),/100/);
 doc.materials.files.pop();assert.deepEqual(validatePackage(doc),[]);
});
test('typed editorial provenance and chapter flags preserve source and browser note identities',()=>{
 const doc=newCourse();doc.sourceEdition=true;Object.assign(doc.lessons[0],{sourceEdition:true,accent:'#694165',moduleId:'module-original',journal:false});Object.assign(doc.lessons[0].sections[0],{sourceKey:'source-original',sourcePages:[1,2]});Object.assign(doc.lessons[0].sections[0].blocks[0],{sourceKey:'source-block',sourcePage:2,legacyNoteKey:'old-reflection-key'});assert.deepEqual(validatePackage(doc),[]);
 for(const corrupt of [d=>d.sourceEdition='true',d=>d.lessons[0].journal={answers:[]},d=>d.lessons[0].accent=[],d=>d.lessons[0].sections[0].sourcePages=[1,'2'],d=>d.lessons[0].sections[0].blocks[0].sourcePage=0,d=>d.lessons[0].sections[0].blocks[0].legacyNoteKey={account:'private'}]){const copy=structuredClone(doc);corrupt(copy);assert.throws(()=>validatePackage(copy));}
});
test('capabilities and version labels use existing rows; rejected content never becomes a draft',async()=>{
 const f=await fixture();try{const admin=(await f.login('admin')).cookie,learner=(await f.login()).cookie;
  const read=await f.request('/api/websites/site-course',{cookie:learner});assert.equal(read.body.canEdit,false);assert.equal(read.body.publishedVersion,'seed');
  const edit=await f.request('/api/websites/site-course/edit',{cookie:admin});assert.equal(edit.body.canEdit,true);edit.body.document.paymentStatus='PAID';
  const rejected=await f.request('/api/websites/site-course/edit',{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'save',revision:0,document:edit.body.document}});assert.equal(rejected.status,400);assert.equal(await f.db.prepare("SELECT revision FROM websites WHERE website_id='site-course'").first('revision'),0);
  delete edit.body.document.paymentStatus;edit.body.document.pages.assessments=true;
  const accepted=await f.request('/api/websites/site-course/edit',{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'save',revision:0,document:edit.body.document}});assert.equal(accepted.status,200,JSON.stringify(accepted.body));
  const saved=await f.request('/api/websites/site-course/edit',{cookie:admin});assert.deepEqual(saved.body.document,edit.body.document);assert.equal(saved.body.draftVersion,await sha256(JSON.stringify(edit.body.document)));assert.deepEqual(saved.body.capabilities,{assessments:false,journal:false,liveSessions:true});
 }finally{await f.close();}
});
