import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './fixture.mjs';import {accessFixture} from './access-fixture.mjs';
test('initial access import delivers scope metadata before people without an earlier sign-in',async()=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY'});try{
  const x=await accessFixture(f),{recoverWebsite}=await import('file://'+f.source.root+'/backend/src/academy/d1/web-platform/bridge.mjs'),failures=[];
  const env={...f.env,ACADEMY_DB:x.db,ACADEMY_WEB_PLATFORM:'1',WEBSITE_PLATFORM_ORIGIN:'https://website.test'};
  for(let i=0;i<20;i++)await recoverWebsite(env,{fetcher:async(url,options)=>{const r=await f.runtime.dispatchFetch(url,options);if(!r.ok)failures.push({status:r.status,body:await r.clone().json()});return r;}});
  assert.deepEqual(failures,[]);
  assert.equal(await x.db.prepare('SELECT count(*) n FROM website_platform_access_imports WHERE done=0').first('n'),0);
  assert.equal(await x.db.prepare('SELECT count(*) n FROM website_platform_outbox WHERE acknowledged=0').first('n'),0);
  assert.equal(await f.db.prepare('SELECT purchased FROM participation WHERE account_id=? AND offering_id=?').bind(x.student,'course').first('purchased'),1);
 }finally{await f.close();}
});
test('a full bounded access backlog cannot hide prerequisite scope and master updates',async()=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY'});try{
  const x=await accessFixture(f),{recoverWebsite}=await import('file://'+f.source.root+'/backend/src/academy/d1/web-platform/bridge.mjs'),{projectAccess,accessStream}=await import('file://'+f.source.root+'/backend/src/academy/d1/web-platform/access.mjs');
  const event=await projectAccess(x.db,x.courseA,x.student),stream=await accessStream('course',x.student);
  const {enqueueAccount}=await import('file://'+f.source.root+'/backend/src/academy/d1/web-platform/bridge.mjs');await enqueueAccount(x.db,x.student);
  await x.run('INSERT INTO website_platform_streams VALUES(?,25)',stream);
  for(let version=1;version<=25;version++)await x.run('INSERT INTO website_platform_outbox(operation_id,stream,version,event_json,access_scope,access_account,access_revision,next_attempt) VALUES(?,?,?,?,?,?,1,-1)','backlog-'+version,stream,version,JSON.stringify(event),x.courseA,x.student);
  const failures=[],env={...f.env,ACADEMY_DB:x.db,ACADEMY_WEB_PLATFORM:'1',WEBSITE_PLATFORM_ORIGIN:'https://website.test'};
  for(let i=0;i<2;i++)await recoverWebsite(env,{fetcher:async(url,options)=>{const r=await f.runtime.dispatchFetch(url,options);if(!r.ok)failures.push({status:r.status,body:await r.clone().json()});return r;}});
  assert.deepEqual(failures,[]);assert.equal(await f.db.prepare('SELECT version FROM stream_heads WHERE stream=?').bind('account:'+x.student).first('version'),1);assert(await f.db.prepare("SELECT 1 FROM source_access_scopes WHERE offering_id='course'").first());
  assert.equal(await f.db.prepare('SELECT purchased FROM participation WHERE account_id=? AND offering_id=?').bind(x.student,'course').first('purchased'),1);
 }finally{await f.close();}
});
