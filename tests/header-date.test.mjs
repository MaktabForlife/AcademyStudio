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
