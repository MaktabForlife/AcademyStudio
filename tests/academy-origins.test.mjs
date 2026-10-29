import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './fixture.mjs';import {signIn,ok} from './access-fixture.mjs';import {random,challenge} from '../src/protocol.mjs';
test('Academy browser origin stays separate from API origin for PIN, status, return codes and identity provisioning',async()=>{
 const f=await fixture({academy:true,academyApiOrigin:'https://academy-api.test'});try{
  const cookie=await signIn(f,'global');assert.equal(ok(await f.request('/api/config')).academyOrigin,'https://academy.test');
  const verifier=random(),state=random(),ticket=ok(await f.request('/auth/academy',{cookie,method:'POST',body:{challenge:await challenge(verifier),state}}));
  const browser=await f.runtime.dispatchFetch('https://academy.test/api/website-platform/exchange',{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json'},body:JSON.stringify({code:ticket.code,state,verifier})});assert.equal(browser.status,200,await browser.text());
  ok(await f.request('/auth/access',{cookie,method:'POST',body:{}}));const operationId=crypto.randomUUID();ok(await f.request('/api/offerings/course/provision',{cookie,method:'POST',body:{operationId,displayName:'Synthetic separate-origin learner'}}));assert.equal(ok(await f.request('/api/offerings/course/resume',{cookie,method:'POST',body:{jobId:operationId}})).state,'COMPLETE');
 }finally{await f.close();}
});
