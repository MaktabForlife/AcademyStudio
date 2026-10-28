import test from 'node:test';import assert from 'node:assert/strict';
import {previewFixture} from './preview-fixture.mjs';
import {PREVIEW_ACCOUNTS,previewAccessCode,previewDeadline} from '../src/preview-identity.mjs';

test('preview login uses signed known identities, strict origin and ordinary revocable sessions',async()=>{
 const f=await previewFixture();try{
  for(const a of PREVIEW_ACCOUNTS)await f.run('INSERT INTO accounts VALUES(?,?,1,1,1,?,?)',a.id,a.name,Date.now(),a.globalAdmin);
  const bad=await f.request('/auth/preview/login',{method:'POST',body:{accessCode:'preview-admin.'+'0'.repeat(64)}});assert.equal(bad.status,401);
  const code=await previewAccessCode(f.env.PREVIEW_INVITE_SECRET,'preview-admin',Number(f.env.PREVIEW_ACCESS_EXPIRES_AT));
  assert.equal((await f.request('/auth/preview/login',{method:'POST',body:{accessCode:code},headers:{Origin:'https://other.test'}})).status,403);
  const signed=await f.login('preview-admin');assert.equal(signed.status,200);assert.match(signed.response.headers.get('Set-Cookie'),/Secure; HttpOnly; SameSite=Lax/);
  assert.equal((await f.request('/api/me',{cookie:signed.cookie})).body.globalAdmin,true);
  // Removing admission is authoritative even when an invitation remains valid.
  await f.run("UPDATE accounts SET admitted=0 WHERE account_id='preview-admin'");assert.equal((await f.login('preview-admin')).status,401);assert.equal((await f.request('/auth/refresh',{method:'POST',body:{},cookie:signed.cookie})).status,401);
  await f.run("UPDATE accounts SET admitted=1,global_admin=0 WHERE account_id='preview-admin'");const lower=await f.login('preview-admin');assert.equal((await f.request('/api/me',{cookie:lower.cookie})).body.globalAdmin,false);
  await f.run("UPDATE accounts SET verified_at=0 WHERE account_id='preview-admin'");assert.equal((await f.request('/auth/refresh',{method:'POST',body:{},cookie:lower.cookie})).status,200);assert.equal((await f.request('/api/me',{cookie:lower.cookie})).body.globalAdmin,false);
  assert.equal((await f.request('/auth/logout',{method:'POST',body:{},cookie:lower.cookie})).status,200);assert.equal((await f.request('/api/me',{cookie:lower.cookie})).status,401);assert.equal((await f.request('/auth/refresh',{method:'POST',body:{},cookie:lower.cookie})).status,401);
  for(const path of ['/auth/login','/auth/exchange','/auth/academy','/internal/academy/events'])assert.equal((await f.request(path,{method:'POST',body:{}})).status,503);
  assert.equal((await f.request('/api/library-return')).status,503);
  const home=await f.request('/');assert.match(home.body,/href="\/preview\/"/);assert.match(home.body,/id="sign-in-button"[^>]*disabled/);
 }finally{await f.close();}
});
test('private preview access expires and cannot be enabled against live Academy',()=>{
 const base={ENVIRONMENT:'isolated-preview',ACADEMY_ORIGIN:'https://academy.invalid',PREVIEW_LOGIN_ENABLED:'1',PREVIEW_INVITE_SECRET:'local synthetic secret of adequate length',PREVIEW_ACCESS_EXPIRES_AT:String(Date.now()-1)};
 assert.throws(()=>previewDeadline(base),e=>e.code==='PREVIEW_ACCESS_EXPIRED');
 assert.throws(()=>previewDeadline({...base,ACADEMY_ORIGIN:'https://live.test'}),e=>e.code==='PREVIEW_DISCONNECTED');
 assert.throws(()=>previewDeadline({...base,PREVIEW_INVITE_SECRET:undefined}),e=>e.code==='PREVIEW_DISCONNECTED');
});
