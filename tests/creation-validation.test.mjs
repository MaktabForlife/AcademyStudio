import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './fixture.mjs';
test('website creation applies the common schema before any content object is stored',async()=>{
 const f=await fixture();try{const cookie=(await f.login('admin')).cookie,before=(await f.content.list()).objects.length;
  for(const document of [{...f.doc,participants:[]},{...f.doc,home:{...f.doc.home,description:'https://example.zoom.us/j/123?pwd=private'}}]){
   const websiteId='invalid-'+crypto.randomUUID(),result=await f.request('/api/admin/course',{cookie,method:'POST',body:{operationId:crypto.randomUUID(),action:'website-create',websiteId,title:'Invalid content',document}});assert.equal(result.status,400,JSON.stringify(result.body));assert.equal(await f.db.prepare('SELECT count(*) n FROM websites WHERE website_id=?').bind(websiteId).first('n'),0);
  }
  assert.equal((await f.content.list()).objects.length,before);
  const document={...f.doc,name:'Exact new website'},made=await f.request('/api/admin/course',{cookie,method:'POST',body:{operationId:crypto.randomUUID(),action:'website-create',websiteId:'valid-new-site',title:'New website',document}});assert.equal(made.status,200,JSON.stringify(made.body));const edit=await f.request('/api/websites/valid-new-site/edit',{cookie});assert.deepEqual(edit.body.document,document);assert.equal(edit.body.enabled,false);
 }finally{await f.close();}
});
