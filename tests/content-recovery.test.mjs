import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './fixture.mjs';import {Store} from '../src/database.mjs';import {editWebsite} from '../src/content.mjs';import {sha256} from '../src/protocol.mjs';
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
test('an object-store failure cannot advance a draft; historical restore stays private until explicit publication',async()=>{
 const f=await fixture();try{const admin=(await f.login('admin')).cookie,learner=(await f.login()).cookie,path='/api/websites/site-course/edit';
  const store=new Store({...f.env,DB:f.db}),actor=await store.actor(await sha256(admin.slice(admin.indexOf('=')+1))),input={operationId:crypto.randomUUID(),action:'save',revision:0,document:{...f.doc,name:'First new edition'}};
  await assert.rejects(editWebsite({...f.env,CONTENT:{put:async()=>{throw Error('Injected local R2 outage');}}},store,actor,'site-course',input),/R2 outage/);assert.equal(await f.db.prepare("SELECT revision FROM websites WHERE website_id='site-course'").first('revision'),0);
  ok(await f.request(path,{cookie:admin,method:'POST',body:input}));ok(await f.request(path,{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),revision:1,action:'publish'}}));
  ok(await f.request(path,{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),revision:2,action:'save',document:{...f.doc,name:'Second published edition'}}}));
  ok(await f.request(path,{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),revision:3,action:'publish'}}));
  ok(await f.request(path,{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),revision:4,action:'restore',historyRevision:1}}));
  assert.equal(ok(await f.request(path,{cookie:admin})).document.name,'First new edition');assert.equal(ok(await f.request('/api/websites/site-course',{cookie:learner})).document.name,'Second published edition');assert.equal(await f.db.prepare("SELECT revision FROM websites WHERE website_id='site-course'").first('revision'),5);
  const history=ok(await f.request('/api/websites/site-course/history',{cookie:admin}));assert.equal(history.history[0].action,'restore');assert.equal(history.history[0].revision,5);
 }finally{await f.close();}
});
