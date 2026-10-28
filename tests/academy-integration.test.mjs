import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './fixture.mjs';import {random,challenge} from '../src/protocol.mjs';
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
test('existing Academy PIN sign-in is reused, source suspension is durably delivered, and routine reading makes no Academy calls',async()=>{
 const f=await fixture({academy:true});try{
  const verifier=random(),state=random(),input={uniqueid:'separation-global',pin:'1234',challenge:await challenge(verifier),state};
  const signedIn=ok(await f.request('/auth/login',{method:'POST',body:input}));assert(signedIn.code);assert(!JSON.stringify(signedIn).includes('token'));
  const exchanged=await f.request('/auth/exchange',{method:'POST',body:{code:signedIn.code,verifier,state}});ok(exchanged);const cookie=exchanged.response.headers.get('Set-Cookie').split(';')[0],profile=ok(await f.request('/api/me',{cookie}));assert.equal(profile.accountId,f.source.f.actors.global);
  const source=await f.runtime.getD1Database('ACADEMY_DB','academy'),before=await source.prepare('SELECT count(*) n FROM website_platform_outbox').first('n');
  ok(await f.request('/api/websites/site-course',{cookie}));ok(await f.request('/api/offerings/course/join',{cookie,method:'POST',body:{sessionId:'course-session'}}));assert.equal(await source.prepare('SELECT count(*) n FROM website_platform_outbox').first('n'),before);
  const sourceVerifier=random(),sourceState=random(),ticket=ok(await f.request('/auth/academy',{cookie,method:'POST',body:{challenge:await challenge(sourceVerifier),state:sourceState}}));
  const open=await f.runtime.dispatchFetch('https://academy.test/api/website-platform/exchange',{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json'},body:JSON.stringify({code:ticket.code,verifier:sourceVerifier,state:sourceState})});
  assert.equal(open.status,200,await open.clone().text());assert((await open.json()).token);
  await source.prepare('UPDATE accounts SET active=0 WHERE account_id=?').bind(profile.accountId).run();const recovery=await f.runtime.dispatchFetch('https://academy.test/__local/recover');assert.equal(recovery.status,200);assert.equal((await f.request('/api/me',{cookie})).status,401);
 }finally{await f.close();}
});
