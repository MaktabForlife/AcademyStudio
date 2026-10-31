import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {fixture} from './fixture.mjs';
import {accessFixture} from './access-fixture.mjs';
import {routeWebsite} from '../routing/worker.mjs';
import {random,challenge,sha256} from '../src/protocol.mjs';
const origin='https://maktab4life.org';

test('router streams a signed or browser request inside the actual Workers runtime without bindings',async()=>{
 const entry=new URL('../routing/worker.mjs',import.meta.url).pathname;
 const script=(await build({stdin:{contents:`import {routeWebsite} from ${JSON.stringify(entry)};export default {fetch(r){return routeWebsite(r,async q=>new Response(q.body,{status:201,headers:{'X-Test-Upstream':q.url,'X-Test-Origin':q.headers.get('Origin')||'','X-Test-Redirect':q.redirect,'X-Test-Signature':q.headers.get('X-Maktab-Signature')||'','Cache-Control':'private, no-store'}}));}}`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'})).outputFiles[0].text;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script,compatibilityDate:'2026-09-28'}));
 try{const r=await mf.dispatchFetch(origin+'/internal/academy/events',{method:'POST',headers:{Origin:origin,'X-Maktab-Signature':'synthetic-signature'},body:'small signed fixture'});assert.equal(r.status,201);assert.equal(r.headers.get('X-Test-Upstream'),'https://academy-studio-parallel.naidu-hajira.workers.dev/internal/academy/events');assert.equal(r.headers.get('X-Test-Origin'),origin);assert.equal(r.headers.get('X-Test-Redirect'),'manual');assert.equal(r.headers.get('X-Test-Signature'),'synthetic-signature');assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.equal(await r.text(),'small signed fixture');}finally{await mf.dispose();}
});

test('branded entry retains closed/preview gates and serves public content or unsigned denials with an empty database',async()=>{
 const entry=new URL('../src/launch-worker.mjs',import.meta.url).pathname;
 const script=(await build({stdin:{contents:`import {launch} from ${JSON.stringify(entry)};export default {fetch(r,e,c){return launch(r,e,c);}}`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'})).outputFiles[0].text;
 const base={ENVIRONMENT:'parallel',AUTHORITY_MODE:'ACADEMY',PLATFORM_ENABLED:'1',PARALLEL_ACCESS_ENABLED:'1',WEBSITE_ORIGIN:origin,ACADEMY_ORIGIN:'https://academy.test',ACADEMY_API_ORIGIN:'https://api.academy.test',ACADEMY_TO_WEBSITE_SECRET:'s'.repeat(48),WEBSITE_TO_ACADEMY_SECRET:'r'.repeat(48),RELEASE_VERSION:'109'};
 const options=bindings=>convertV4MiniflareOptions({modules:true,script,compatibilityDate:'2026-09-28',compatibilityFlags:['nodejs_compat'],bindings,d1Databases:{DB:'empty'},r2Buckets:{CONTENT:'empty'},serviceBindings:{ASSETS:()=>new Response('<!doctype html><html><head><title>Circles</title></head><body>Current design</body></html>',{headers:{'Content-Type':'text/html'}})},outboundService:()=>{throw Error('No external call is allowed');}});
 const mf=new Miniflare(options(base));
 try{
  const html=await mf.dispatchFetch(origin+'/',{headers:{'X-Maktab-Front-Door':'maktab4life.org'}});assert.equal(html.status,200);assert.equal(html.headers.get('X-AcademyStudio-Version'),'109');assert.equal(html.headers.get('Cache-Control'),'no-store');assert.equal(html.headers.get('X-Robots-Tag'),null);const text=await html.text();assert(text.includes('rel="canonical" href="https://maktab4life.org/"'));assert(!text.includes('parallel testing'));
  const direct=await mf.dispatchFetch('https://academy-studio-parallel.naidu-hajira.workers.dev/studio/?website=site',{redirect:'manual'});assert.equal(direct.status,307);assert.equal(direct.headers.get('Location'),origin+'/studio/?website=site');assert(direct.headers.get('X-Robots-Tag').includes('noindex'));
  const builder=await mf.dispatchFetch(origin+'/builder/',{headers:{'X-Maktab-Front-Door':'maktab4life.org'}});assert(builder.headers.get('X-Robots-Tag').includes('noindex'));
  for(const path of ['/api/public/home','/api/public/circles','/api/config'])assert.equal((await mf.dispatchFetch(origin+path)).status,200,path);
  for(const path of ['/api/websites/private','/api/media/private']){const r=await mf.dispatchFetch(origin+path);assert.equal(r.status,401);assert.equal((await r.json()).code,'SIGN_IN_REQUIRED');}
  const unsigned=await mf.dispatchFetch(origin+'/internal/academy/events',{method:'POST',body:'{}'});assert.equal(unsigned.status,401);
  await mf.setOptions(options({...base,PARALLEL_ACCESS_ENABLED:'0'}));assert.equal((await mf.dispatchFetch(origin+'/api/me')).status,503);
  await mf.setOptions(options({...base,PREVIEW_LOGIN_ENABLED:'1'}));assert.equal((await mf.dispatchFetch(origin+'/api/config')).status,503);
  await mf.setOptions(options({...base,WEBSITE_ORIGIN:'https://evil.test'}));assert.equal((await mf.dispatchFetch(origin+'/')).status,503);
 }finally{await mf.dispose();}
});

test('branded route supports real paired Academy sign-in, rejects other origins, binds Library returns and revokes an account switch',async t=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY',websiteOrigin:origin,websiteServerOrigin:'https://academy-studio-parallel.naidu-hajira.workers.dev',verification:{accountSeconds:43200,adminSeconds:60,liveSeconds:43200}});
 try{
  const access=await accessFixture(f);await access.recover(2);
  const request=async(path,{method='GET',cookie,body,actionOrigin=origin}={})=>{
   let forwardingError;const r=await routeWebsite(new Request(origin+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method==='POST'?{Origin:actionOrigin,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),async req=>{try{return await f.runtime.dispatchFetch(req.url,{method:req.method,headers:Object.fromEntries(req.headers),...(req.body?{body:req.body,duplex:'half'}:{}),redirect:'manual'});}catch(e){forwardingError=e;throw e;}});
   assert.equal(forwardingError,undefined,forwardingError?.message);
   return {response:r,status:r.status,body:await r.json(),reads:Number(r.headers.get('X-Local-D1-Rows-Read'))};
  };
  const verifier=random(),state=random(),fields={uniqueid:'separation-global',pin:'1234',state,challenge:await challenge(verifier)};
  for(const actionOrigin of ['https://evil.test','https://www.maktab4life.org','https://academy-studio-parallel.naidu-hajira.workers.dev']){f.source.resetMetrics();const denied=await request('/auth/login',{method:'POST',body:fields,actionOrigin});assert.equal(denied.status,403);assert.equal(f.source.metrics.queries,0);}
  const login=await request('/auth/login',{method:'POST',body:fields});assert.equal(login.status,200,JSON.stringify(login.body));const exchanged=await request('/auth/exchange',{method:'POST',body:{code:login.body.code,verifier,state}});assert.equal(exchanged.status,200,JSON.stringify(exchanged.body));const cookie=exchanged.response.headers.get('Set-Cookie').split(';')[0];assert(exchanged.response.headers.get('Set-Cookie').includes('Secure; HttpOnly; SameSite=Lax'));assert(!exchanged.response.headers.get('Set-Cookie').includes('Domain='));
  f.source.resetMetrics();const publicHome=await request('/api/public/home');assert.equal(publicHome.reads,0);const read=await request('/api/websites/site-course',{cookie});assert.equal(read.status,200,JSON.stringify(read.body));assert.equal(f.source.metrics.queries,0);
  const childVerifier=random(),childState=random(),handoff=await request('/auth/academy',{method:'POST',cookie,body:{state:childState,challenge:await challenge(childVerifier),library:{websiteId:'site-course',lessonId:f.doc.lessons[0].id}}});assert.equal(handoff.status,200,JSON.stringify(handoff.body));
  const opened=await f.runtime.dispatchFetch('https://academy.test/api/website-platform/exchange',{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json'},body:JSON.stringify({code:handoff.body.code,state:childState,verifier:childVerifier})});assert.equal(opened.status,200);assert((await opened.json()).library.returnUrl.startsWith(origin+'/?website=site-course&lesson='));
  const before=f.source.metrics.queries;await request('/api/media/missing',{cookie});assert.equal(f.source.metrics.queries,before);
  const nextCode=random(),nextVerifier=random(),nextState=random();await f.deliver({type:'handoff',codeHash:await sha256(nextCode),accountId:'former',epoch:1,challenge:await challenge(nextVerifier),state:nextState,expiresAt:Date.now()+60000});
  const switched=await request('/auth/exchange',{method:'POST',cookie,body:{code:nextCode,verifier:nextVerifier,state:nextState}});assert.equal(switched.status,200,JSON.stringify(switched.body));const nextCookie=switched.response.headers.get('Set-Cookie').split(';')[0];assert.equal((await request('/api/me',{cookie:nextCookie})).body.accountId,'former');assert.equal((await request('/api/me',{cookie})).status,401);
  await f.run("UPDATE accounts SET active=0 WHERE account_id='former'");assert.equal((await request('/api/me',{cookie:nextCookie})).status,401);
  t.diagnostic(JSON.stringify({publicReads:publicHome.reads,websiteReads:read.reads,routineAcademyQueries:0,verificationSeconds:[43200,43200,60]}));
 }finally{await f.close();}
});
