import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {studioFixture} from './studio-access-fixture.mjs';
import {signIn,ok} from './access-fixture.mjs';
import {random,challenge} from '../src/protocol.mjs';

test('handed-over purchases remain in My courses while native Library modes and master suspension keep their own guards',{timeout:60000},async t=>{
 const {f,x,good,handover}=await studioFixture({dashboard:true,navigation:{mothers:'programA',alimiyah:'programB'}});
 try{
  await f.content.put('public/circles/catalogue.json',JSON.stringify({format:'CIRCLES_PUBLIC_CATALOGUE_V1',items:[{key:'synthetic-course',kind:'COURSE',title:'Synthetic combined Course',websiteId:'site-course'}]}));
  const learner=await signIn(f),staff=await signIn(f,'adminA'),admin=await signIn(f,'global');
  await handover();const view=await good({action:'read',accountId:x.student});
  await good({action:'save',revision:view.revision,change:{action:'participant',operationId:crypto.randomUUID(),accountId:x.student,enrolled:false,live:false,purchased:true,cohort:''}});
  // A current source refresh cannot turn former participation into lost material
  // rights, nor turn a staff-only permission into a confirmed purchase.
  const refreshed=await signIn(f);f.source.resetMetrics();const navigation=await f.request('/api/circles/navigation',{cookie:refreshed}),mine=ok(navigation);
  assert.equal(mine.purchasedCourses.length,1);assert.equal(mine.purchasedCourses[0].href,'/studio/?website=site-course');assert.equal(f.source.metrics.queries,0);const navigationBudget={targetRowsRead:navigation.reads,academyQueries:f.source.metrics.queries};
  assert.deepEqual(ok(await f.request('/api/circles/navigation',{cookie:staff})).purchasedCourses,[]);assert.deepEqual(ok(await f.request('/api/circles/navigation',{cookie:admin})).purchasedCourses,[]);
  assert.equal((await f.request('/api/websites/site-course',{cookie:refreshed})).status,200);assert.deepEqual(await f.db.prepare("SELECT enrolled,live,purchased FROM participation WHERE offering_id='course' AND account_id=?").bind(x.student).first(),{enrolled:0,live:0,purchased:1});
  ok(await f.request('/api/circles/dashboard',{cookie:refreshed,method:'POST',body:{mode:'learn'}}));f.source.resetMetrics();const cached=await f.request('/api/circles/dashboard',{cookie:refreshed,method:'POST',body:{mode:'learn'}});assert(ok(cached).cached);assert.equal(f.source.metrics.queries,0);const dashboardBudget={targetRowsRead:cached.reads,academyQueries:f.source.metrics.queries};
  assert.equal((await f.request('/api/circles/dashboard',{cookie:learner,method:'POST',body:{mode:'admin'}})).status,403);
  const state=random(),verifier=random(),ticket=ok(await f.request('/auth/academy',{cookie:admin,method:'POST',body:{state,challenge:await challenge(verifier),dashboard:{mode:'teach',tool:'library'}}}));
  const exchange=await f.runtime.dispatchFetch('https://academy.test/api/website-platform/exchange',{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json'},body:JSON.stringify({state,verifier,code:ticket.code})}),opened=await exchange.json();assert.equal(exchange.status,200,JSON.stringify(opened));assert.equal(opened.destination,'/academy/library/?workspace=TEACH');assert.deepEqual(opened.circles,{mode:'teach',returnUrl:'https://website.test/?workspace=teach'});
  const current=await f.runtime.dispatchFetch('https://academy.test/api/account/session',{method:'POST',headers:{Authorization:'Bearer '+opened.token,'Content-Type':'application/json'},body:'{}'});assert.equal(current.status,200,await current.clone().text());
  await x.run('UPDATE accounts SET active=0 WHERE account_id=?',x.student);await x.recover(8);assert.equal((await f.request('/api/circles/navigation',{cookie:refreshed})).status,401);assert.equal((await f.request('/api/websites/site-course',{cookie:refreshed})).status,401);
  const evidence={navigationAfterHandover:navigationBudget,cachedDashboard:dashboardBudget,purchaseRetained:true,staffPurchase:false,libraryMode:'teach',masterSuspensionBlocks:true};mkdirSync('outputs',{recursive:true});writeFileSync('outputs/combined-workflow-reads.json',JSON.stringify(evidence,null,2)+'\n');t.diagnostic(JSON.stringify(evidence));
 }finally{await f.close();}
});
