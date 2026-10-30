import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {circlesFixture} from './circles-fixture.mjs';
import {signIn,ok} from './access-fixture.mjs';
import {random,challenge} from '../src/protocol.mjs';

test('dashboard reuses current native scopes, caches bounded account summaries and denies forged workspaces',async()=>{
 const f=await fixture({academy:true,dashboard:true,authorityMode:'ACADEMY',navigation:{mothers:'programA',alimiyah:'programB'},verification:{accountSeconds:43200,adminSeconds:60,liveSeconds:43200}});
 try{
  await circlesFixture(f);const cookie=await signIn(f),other=await signIn(f,'studentB'),admin=await signIn(f,'global');
  const mine=ok(await f.request('/api/circles/dashboard',{cookie,method:'POST',body:{mode:'learn'}}));assert.equal(mine.mode,'learn');assert.deepEqual(mine.availableModes,['learn']);assert.equal(mine.adminBadge,null);assert(mine.messages,'Actual native messaging reader should be connected');assert.equal(mine.messages.counts.unread,0);assert(mine.activities.some(a=>a.navigationKey==='mothers'&&a.destinationHref==='/studio/?classroom=mothers'));assert(mine.activities.every(a=>a.roles.includes('STUDENT')||a.roles.includes('MEDIA_READER')));assert(!JSON.stringify(mine).includes('pin_hash'));assert(!JSON.stringify(mine).includes('zoom_url'));
  f.source.resetMetrics();assert(ok(await f.request('/api/circles/dashboard',{cookie,method:'POST',body:{mode:'learn'}})).cached);assert.equal(f.source.metrics.queries,0,'A page return must not make another Academy request');
  assert.equal((await f.request('/api/circles/dashboard',{cookie,method:'POST',body:{mode:'admin'}})).status,403);assert.equal((await f.request('/api/circles/dashboard',{cookie,method:'POST',body:{mode:'teach'}})).status,403);
  const theirs=ok(await f.request('/api/circles/dashboard',{cookie:other,method:'POST',body:{mode:'learn'}}));assert(theirs.activities.some(a=>a.navigationKey==='alimiyah'));assert(!theirs.activities.some(a=>a.navigationKey==='mothers'));
  const managed=ok(await f.request('/api/circles/dashboard',{cookie:admin,method:'POST',body:{mode:'admin'}}));assert(managed.availableModes.includes('admin'));assert.equal(managed.adminBadge,'Global Admin');assert(managed.activities.some(a=>a.navigationKey==='mothers'));
  const state=random(),verifier=random(),issued=ok(await f.request('/auth/academy',{cookie:other,method:'POST',body:{state,challenge:await challenge(verifier),dashboard:{mode:'learn',tool:'activity',activityKey:f.source.f.scopes.programB}}}));
  const response=await f.runtime.dispatchFetch('https://academy.test/api/website-platform/exchange',{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json'},body:JSON.stringify({state,verifier,code:issued.code})});const exchanged=await response.json();assert.equal(response.status,200,exchanged.error);assert.match(exchanged.destination,/\/learn$/);assert(exchanged.token);
  assert.equal((await f.request('/auth/academy',{cookie,method:'POST',body:{state,challenge:await challenge(verifier),dashboard:{mode:'admin',tool:'home'}}})).status,403);
  await f.run('UPDATE circles_navigation SET verified_at=0 WHERE account_id=?',f.source.f.actors.studentA);assert.equal((await f.request('/api/circles/dashboard',{cookie,method:'POST',body:{mode:'learn'}})).body.code,'ACCESS_REFRESH_REQUIRED','A known permission invalidation fences a saved dashboard');
 }finally{await f.close();}
});
