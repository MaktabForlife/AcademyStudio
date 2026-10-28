import test from 'node:test';import assert from 'node:assert/strict';
import {newCourse} from '../public/shared/model.mjs';import {validatePackage} from '../src/content-package.mjs';import {fixture} from './fixture.mjs';
test('content rejects operational fields and raw meeting links at every supported depth',()=>{
 for(const mutate of [d=>d.accounts=[],d=>d.home.zoomUrl='secret',d=>d.lessons[0].participants=[],d=>d.lessons[0].sections[0].blocks[0].access={paid:true},d=>d.home.description='Join https://example.zoom.us/j/123?pwd=private',d=>d.lessons[0].sections[0].blocks[0].text='https://zoomgov.com/j/123']){const doc=newCourse();mutate(doc);assert.throws(()=>validatePackage(doc));}
 assert.deepEqual(validatePackage(newCourse()),[]);assert.throws(()=>validatePackage({format:'ACADEMY_COURSE_STUDIO_V1',pages:null}));
});
test('capabilities and version labels use existing rows; rejected content never becomes a draft',async()=>{
 const f=await fixture();try{const admin=(await f.login('admin')).cookie,learner=(await f.login()).cookie;
  const read=await f.request('/api/websites/site-course',{cookie:learner});assert.equal(read.body.canEdit,false);assert.equal(read.body.publishedVersion,'seed');
  const edit=await f.request('/api/websites/site-course/edit',{cookie:admin});assert.equal(edit.body.canEdit,true);edit.body.document.paymentStatus='PAID';
  const rejected=await f.request('/api/websites/site-course/edit',{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'save',revision:0,document:edit.body.document}});assert.equal(rejected.status,400);assert.equal(await f.db.prepare("SELECT revision FROM websites WHERE website_id='site-course'").first('revision'),0);
 }finally{await f.close();}
});
