import test from 'node:test';import assert from 'node:assert/strict';
import {publicHeaderDate} from '../src/header-date.mjs';
import {academyDay,validHeaderDate} from '../public/shared/header-dates.mjs';
const now=new Date('2026-10-30T12:00:00Z'),record={gregorian:'2026-10-30',hijri:'1 Test 1448',timezone:'Africa/Johannesburg',source:'https://jamiat.org.za/'};
test('public dates reuse the native source without credentials or D1 and share the validated cache',async()=>{
 const env={ACADEMY_ORIGIN:'https://academy.test',ACADEMY_API_ORIGIN:'https://api.academy.test'};Object.defineProperty(env,'DB',{get(){assert.fail('Public dates must not read D1');}});
 const saved=new Map(),cache={match:async r=>saved.get(r.url)?.clone(),put:async(r,v)=>saved.set(r.url,v)},request=new Request('https://circles.test/api/public/header-date');let calls=0;
 const fetcher=async(url,options)=>{calls++;assert.equal(url,'https://api.academy.test/api/academy/header-date');assert.deepEqual(options.headers,{Accept:'application/json'});return Response.json(record);};
 assert.deepEqual(await (await publicHeaderDate(request,env,fetcher,{now,cache})).json(),record);
 assert.deepEqual(await (await publicHeaderDate(request,env,fetcher,{now,cache})).json(),record);assert.equal(calls,1);
});
test('unavailable or stale source dates never become an invented Hijri date',async()=>{
 for(const data of [{...record,gregorian:'2026-10-29'},{...record,source:'https://evil.test'},{...record,hijri:'<script>bad</script>'},null]){
  const response=await publicHeaderDate(new Request('https://circles.test/api/public/header-date'),{ACADEMY_ORIGIN:'https://academy.test'},async()=>Response.json(data),{now,cache:null});
  assert.equal((await response.json()).hijri,null);assert.equal(response.headers.get('Cache-Control'),'public, max-age=60');
 }
 assert.equal(academyDay(Date.parse('2026-10-30T22:01:00Z')),'2026-10-31');assert(validHeaderDate(record,now));assert(!validHeaderDate(record,now.getTime()+86400000));
});

test('date failures retain bounded non-sensitive diagnostics, cancel rejected bodies and share the short cache',async()=>{
 const request=new Request('https://circles.test/api/public/header-date'),env={ACADEMY_API_ORIGIN:'https://api.academy.test'};
 let cancelled=false;
 const cases=[
  {reason:'HTTP_503',fetcher:async()=>new Response(new ReadableStream({cancel(){cancelled=true;}}),{status:503})},
  {reason:'timeout',fetcher:async()=>{throw new DOMException('Private exception text must not be logged','TimeoutError');}},
  {reason:'source-request-failed',fetcher:async()=>{throw Error('Private network diagnostic');}},
  {reason:'source-response-invalid',fetcher:async()=>new Response('{invalid')},
  {reason:'source-response-invalid',fetcher:async()=>new Response('x'.repeat(4097))},
  {reason:'source-date-mismatch',fetcher:async()=>Response.json({...record,gregorian:'2026-10-29'})},
  {reason:'source-date-unavailable',fetcher:async()=>Response.json({...record,hijri:null})},
  {reason:'source-response-invalid',fetcher:async()=>Response.json({...record,hijri:'<b>Private body</b>'})}
 ];
 for(const entry of cases){
  const saved=new Map(),warnings=[];let calls=0;
  const cache={match:async key=>saved.get(key.url)?.clone(),put:async(key,value)=>saved.set(key.url,value)};
  const options={now,cache,warn:(...args)=>warnings.push(args)},fetcher=async(...args)=>{calls++;return entry.fetcher(...args);};
  for(let i=0;i<2;i++){
   const response=await publicHeaderDate(request,env,fetcher,options);
   assert.deepEqual(await response.json(),{...record,hijri:null});
   assert.equal(response.headers.get('Cache-Control'),'public, max-age=60');
  }
  assert.equal(calls,1);assert.deepEqual(warnings,[['Circles header date source unavailable',{reason:entry.reason}]]);
 }
 assert.equal(cancelled,true);
});

test('a later valid source response recovers after the short negative cache expires',async()=>{
 let saved,calls=0;const warnings=[],request=new Request('https://circles.test/api/public/header-date');
 const cache={match:async()=>saved?.clone(),put:async(_key,response)=>{saved=response;}};
 const fetcher=async()=>{calls++;return Response.json(calls===1?{...record,hijri:null}:record);};
 const options={now,cache,warn:(...args)=>warnings.push(args)};
 assert.equal((await (await publicHeaderDate(request,{ACADEMY_ORIGIN:'https://academy.test'},fetcher,options)).json()).hijri,null);
 saved=undefined; // Model the existing Cache API's 60-second expiry.
 const response=await publicHeaderDate(request,{ACADEMY_ORIGIN:'https://academy.test'},fetcher,options);
 assert.deepEqual(await response.json(),record);assert.equal(response.headers.get('Cache-Control'),'public, max-age=900');
 assert.equal(calls,2);assert.equal(warnings.length,1);
});
