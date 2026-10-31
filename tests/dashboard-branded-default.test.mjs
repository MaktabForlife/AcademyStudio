import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {circlesFixture} from './circles-fixture.mjs';
import {signIn,ok} from './access-fixture.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';

test('the branded default dashboard tolerates a nine-second Source delay and retains private cache reuse',{timeout:60000},async t=>{
 const f=await fixture({academy:true,dashboard:true,dashboardDelayMs:9000,authorityMode:'ACADEMY',navigation:{mothers:'programA',alimiyah:'programB'},websiteOrigin:'https://maktab4life.org',academyApiOrigin:'https://source-api.test',websiteServerOrigin:'https://academy-studio-parallel.naidu-hajira.workers.dev',verification:{accountSeconds:43200,adminSeconds:60,liveSeconds:43200}});
 try{
  await circlesFixture(f);const cookie=await signIn(f,'global');
  f.source.resetMetrics();const began=Date.now(),opened=await f.request('/api/circles/dashboard',{cookie,method:'POST',body:{}}),first=ok(opened),elapsed=Date.now()-began,cold={targetRowsRead:opened.reads,...f.source.metrics};assert(elapsed>=9000,'The real local Source result arrives after the former eight-second deadline');
  assert.equal(first.mode,'admin');assert.equal(first.adminBadge,'Global Admin');assert.deepEqual(first.availableModes,['learn','teach','admin']);
  assert.equal(first.cached,false);assert(Array.isArray(first.timetable));assert(Array.isArray(first.activities));
  f.source.resetMetrics();const reused=await f.request('/api/circles/dashboard',{cookie,method:'POST',body:{}}),second=ok(reused),warm={targetRowsRead:reused.reads,...f.source.metrics};
  assert.equal(second.mode,'admin');assert.equal(second.cached,true);assert.equal(f.source.metrics.queries,0);
  const evidence={syntheticOnly:true,liveRequests:0,sourceDelayMs:9000,firstBuildElapsedMs:elapsed,cold,warm,mode:first.mode,privateCacheReused:second.cached};mkdirSync('outputs',{recursive:true});writeFileSync('outputs/dashboard-first-build.json',JSON.stringify(evidence,null,2)+'\n');t.diagnostic(JSON.stringify(evidence));
 }finally{await f.close();}
});
