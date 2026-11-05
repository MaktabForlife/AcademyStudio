import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForReleaseHealth} from '../tools/release-health.mjs';
function fixture(bodies){
 const calls=[],delays=[],samples=[];let index=0;
 return {calls,delays,samples,options:{url:'https://academy.test/api/health',expectedVersion:'109.25',previousVersion:'109.24',sleep:async ms=>delays.push(ms),onSample:async(sample,all)=>samples.push({sample,all}),fetcher:async(url,options)=>{
  calls.push({url,cache:options.cache,headers:options.headers});
  const item=bodies[index++];assert(item,'No extra health request is allowed.');
  return item.raw?new Response(item.raw,{status:item.status||200}):Response.json({success:item.success??true,version:item.version},{status:item.status||200});
 }}};
}
test('exact current health succeeds once using an uncached public request',async()=>{
 const f=fixture([{version:'109.25'}]);const result=await waitForReleaseHealth(f.options);
 assert(result.passed);assert.equal(f.calls.length,1);assert.deepEqual(f.delays,[]);
 assert.equal(f.calls[0].url,'https://academy.test/api/health?release_check=109.25');
 assert.equal(f.calls[0].cache,'no-store');assert.equal(f.calls[0].headers['Cache-Control'],'no-cache');
});
test('healthy known previous versions get bounded delays before exact-version acceptance',async()=>{
 const f=fixture([{version:'109.24'},{version:'109.24'},{version:'109.25'}]);
 const result=await waitForReleaseHealth(f.options);assert(result.passed);
 assert.deepEqual(f.delays,[2000,5000]);assert.equal(result.samples.length,3);
 assert.deepEqual(f.samples.map(x=>x.all.length),[1,2,3]);
});
test('a persistent previous version fails after four samples and never passes',async()=>{
 const f=fixture(Array.from({length:4},()=>({version:'109.24'})));
 await assert.rejects(waitForReleaseHealth(f.options),/still serving the previous version/);
 assert.equal(f.calls.length,4);assert.deepEqual(f.delays,[2000,5000,10000]);assert.equal(f.samples.length,4);
});
for(const [name,response]of [
 ['unhealthy expected version',{version:'109.25',success:false}],
 ['non-success HTTP status',{version:'109.24',status:503}],
 ['unexpected release',{version:'109.23'}],
 ['absent release',{}],
 ['credential-shaped version',{version:'secret-should-not-be-logged'}]
])test(name+' aborts without propagation retries',async()=>{
 const f=fixture([response]);await assert.rejects(waitForReleaseHealth(f.options),/Unexpected Academy health response/);
 assert.equal(f.calls.length,1);assert.deepEqual(f.delays,[]);
 if(name==='credential-shaped version')assert.equal(f.samples[0].sample.version,null);
});
test('malformed health JSON aborts without a retry',async()=>{
 const f=fixture([{raw:'not json'}]);await assert.rejects(waitForReleaseHealth(f.options));assert.equal(f.calls.length,1);assert.deepEqual(f.delays,[]);
});
