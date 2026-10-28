import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './fixture.mjs';import {random,challenge,signedHeaders} from '../src/protocol.mjs';
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
async function signIn(f,uniqueid,pin='1234',extra={}){
 const verifier=random(),state=random(),result=await f.request('/auth/login',{method:'POST',body:{uniqueid,pin,challenge:await challenge(verifier),state,...extra}});
 if(result.status!==200)return result;
 const exchanged=await f.request('/auth/exchange',{method:'POST',body:{code:result.body.code,verifier,state}});ok(exchanged);return {status:200,cookie:exchanged.response.headers.get('Set-Cookie').split(';')[0]};
}
test('sign-in drains a bounded account backlog in order without scanning other accounts',async()=>{
 const f=await fixture({academy:true});try{
  const db=await f.runtime.getD1Database('ACADEMY_DB','academy'),account=f.source.f.actors.global;
  await db.batch(Array.from({length:45},(_,i)=>db.prepare('UPDATE accounts SET display_name=? WHERE account_id=?').bind('Synthetic update '+i,account)));
  const signed=await signIn(f,'separation-global');assert.equal(signed.status,200);assert.equal(ok(await f.request('/api/me',{cookie:signed.cookie})).displayName,'Synthetic update 44');
  assert.equal(await db.prepare('SELECT count(*) n FROM website_platform_outbox WHERE stream=? AND acknowledged=0').bind('account:'+account).first('n'),0);
  assert.equal(await f.db.prepare('SELECT version FROM stream_heads WHERE stream=?').bind('account:'+account).first('version'),46);
 }finally{await f.close();}
});
test('lost identity response resumes the same master account, grants no purchase, and first PIN is set by Academy',async()=>{
 const f=await fixture({academy:true});try{
  const admin=await signIn(f,'separation-global');assert.equal(admin.status,200);const cookie=admin.cookie,operationId=crypto.randomUUID();
  ok(await f.request('/api/offerings/course/provision',{cookie,method:'POST',body:{operationId,displayName:'Synthetic newly enrolled learner'}}));
  const job=await f.db.prepare('SELECT * FROM provisioning WHERE operation_id=?').bind(operationId).first(),ref=await f.db.prepare('SELECT source_ref FROM sessions WHERE account_id=?').bind(f.source.f.actors.global).first('source_ref');
  const path='/internal/website/identity',signed=await signedHeaders(f.env.WEBSITE_TO_ACADEMY_SECRET,path,{...JSON.parse(job.command_json),sourceRef:ref,issuedAt:Date.now()});
  const committed=await f.runtime.dispatchFetch('https://academy.test'+path,{method:'POST',headers:signed.headers,body:signed.payload});assert.equal(committed.status,200,await committed.clone().text());const first=(await committed.json()).delivery.event;
  // The source committed, but its response did not reach the website receiver.
  const completed=ok(await f.request('/api/offerings/course/resume',{cookie,method:'POST',body:{jobId:operationId}}));assert.equal(completed.accountId,first.account.accountId);assert.equal(completed.state,'COMPLETE');assert(completed.loginPath.startsWith('/account/'));
  const db=await f.runtime.getD1Database('ACADEMY_DB','academy');assert.equal(await db.prepare('SELECT count(*) n FROM accounts WHERE display_name=?').bind('Synthetic newly enrolled learner').first('n'),1);
  const right=await f.db.prepare("SELECT enrolled,live,purchased FROM participation WHERE account_id=? AND offering_id='course'").bind(completed.accountId).first();assert.deepEqual(right,{enrolled:1,live:0,purchased:0});
  assert.equal(ok(await f.request('/api/offerings/course/resume',{cookie,method:'POST',body:{jobId:operationId}})).accountId,completed.accountId);
  const uniqueid=completed.loginPath.slice('/account/'.length),missing=await signIn(f,uniqueid);assert.equal(missing.status,403,JSON.stringify(missing.body));assert.equal(missing.body.code,'PIN_NOT_SET');
  const setup=await signIn(f,uniqueid,'2468',{setup:true,pinConfirmation:'2468'});assert.equal(setup.status,200,JSON.stringify(setup));assert.equal(ok(await f.request('/api/me',{cookie:setup.cookie})).accountId,completed.accountId);
  assert.equal((await f.request('/api/websites/site-course',{cookie:setup.cookie})).status,403);
  assert.equal(await f.db.prepare('SELECT count(*) n FROM sqlite_schema WHERE name LIKE ?').bind('%credential%').first('n'),0);
 }finally{await f.close();}
});
