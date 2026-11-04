import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile} from 'node:fs/promises';
import manifest from '../release/manifest.json' with {type:'json'};
import {saasWebsite} from '../hosting/saas/worker.mjs';
import {pagesAsset} from '../hosting/saas/assets.mjs';
import {fixture} from './fixture.mjs';
import {accessFixture} from './access-fixture.mjs';
import {random,challenge,sha256} from '../src/protocol.mjs';
const root='https://worshipuponbaseera.ummabbadacademy.app',provider='https://ummabbadacademy.maktab4life.org',backend='https://academy-studio-parallel.naidu-hajira.workers.dev',pages='https://academy-studio-public.pages.dev';
const env={WEBSITE_ORIGIN:root,WEBSITE_ALIAS_ORIGINS:'[]',STUDIO_BACKEND_ORIGIN:backend,ACADEMY_ORIGIN:'https://academy-maktab4life.pages.dev',ACADEMY_PORTAL_ORIGIN:'https://ummabbadacademy.app',STUDIO_PROVIDER_ORIGIN:provider,STUDIO_REDIRECT_ORIGINS:'["https://maktab4life.org","https://www.maktab4life.org"]',PUBLIC_ASSET_ORIGIN:pages,RELEASE_VERSION:'109.20'};
test('static Pages fetch strips credentials and query input, uses a fixed origin and preserves range streams',async()=>{
 const file=Object.keys(manifest.manifest).find(path=>path.startsWith('_assets/')&&path.endsWith('.css'));assert(file);
 const response=await pagesAsset(new Request(root+'/'+file+'?code=private&url=https://evil.test',{headers:{Cookie:'__Host-maktab_web=private',Authorization:'Bearer private',Origin:root,Range:'bytes=10-19','If-Range':'"original"','If-None-Match':'"asset"','X-Maktab-Front-Door':'evil.test'}}),env,async request=>{
  assert.equal(request.url,pages+'/'+file);assert.equal(request.redirect,'manual');
  for(const key of ['Cookie','Authorization','Origin','X-Maktab-Front-Door'])assert.equal(request.headers.get(key),null);
  assert.equal(request.headers.get('Range'),'bytes=10-19');assert.equal(request.headers.get('If-Range'),'"original"');assert.equal(request.headers.get('If-None-Match'),'"asset"');
  return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('ten bytes!'));c.close();}}),{status:206,headers:{'Content-Range':'bytes 10-19/100','Content-Type':'text/css','Set-Cookie':'unwanted=fixture','X-Robots-Tag':'noindex',ETag:'"original"'}});
 });
 assert.equal(response.status,206);assert.equal(await response.text(),'ten bytes!');assert.equal(response.headers.get('Content-Range'),'bytes 10-19/100');assert.equal(response.headers.get('Set-Cookie'),null);assert.equal(response.headers.get('X-Robots-Tag'),null);assert.equal(response.headers.get('Cache-Control'),'public, max-age=31536000, immutable');
});
test('only reviewed static paths can reach Pages; APIs/private/unknown paths never fall through',async()=>{
 let count=0;const fetcher=async()=>{count++;return new Response('must not be called');};
 for(const path of ['/api/media/private','/auth/exchange','/internal/academy/events','/.git/config','/_worker.js','/not-a-reviewed-file.css','//evil.test/example.css']){
  assert.equal((await pagesAsset(new Request(root+path),env,fetcher)).status,404,path);
 }
 assert.equal(count,0);
 assert.equal((await pagesAsset(new Request(root+'/studio/',{method:'POST',body:'fixture'}),env,fetcher)).status,405);
});
test('Pages clean URLs never redirect the browser to the service address; outage and wrong HTML fallback fail closed',async()=>{
 const html=await pagesAsset(new Request(root+'/studio/'),env,async request=>{assert.equal(request.url,pages+'/studio/');return new Response('<html>Review</html>',{headers:{'Content-Type':'text/html'}});});
 assert.equal(html.status,200);assert.equal(html.headers.get('Cache-Control'),'no-store');
 for(const fetcher of [async()=>{throw Error('Offline');},async()=>new Response(null,{status:301,headers:{Location:pages+'/unexpected'}})])assert.equal((await pagesAsset(new Request(root+'/studio/'),env,fetcher)).status,503);
 const file=Object.keys(manifest.manifest).find(path=>path.endsWith('.css'));
 const wrong=await pagesAsset(new Request(root+'/'+file),env,async()=>new Response('<html>Fallback</html>',{headers:{'Content-Type':'text/html'}}));assert.equal(wrong.status,404);
 const head=await pagesAsset(new Request(root+'/studio/',{method:'HEAD'}),env,async()=>new Response(null,{headers:{'Content-Type':'text/html'}}));assert.equal(await head.text(),'');
 const unchanged=await pagesAsset(new Request(root+'/'+file),env,async()=>new Response(null,{status:304,headers:{ETag:'"asset"'}}));assert.equal(unchanged.status,304);assert.equal(unchanged.headers.get('ETag'),'"asset"');
});
test('SaaS public/private requests retain URL, Origin, body and cookie; no additional authentication service',async()=>{
 const request=new Request(root+'/auth/exchange',{method:'POST',headers:{Origin:'https://evil.test',Cookie:'__Host-maktab_web=fixture','Content-Type':'application/json'},body:'{"fixture":true}'});
 let calls=0;
 const response=await saasWebsite(request,env,{},{
  assetFetcher(){throw Error('No static fetch on auth');},
  application:async(actual,passed)=>{
   calls++;assert.equal(actual.url,request.url);assert.equal(actual.headers.get('Origin'),'https://evil.test');assert.equal(actual.headers.get('Cookie'),'__Host-maktab_web=fixture');assert.equal(await actual.text(),'{"fixture":true}');assert.equal(passed.WEBSITE_ORIGIN,root);
   return new Response('Denied',{status:403,headers:{'Cache-Control':'private, no-store','Set-Cookie':'__Host-maktab_web=fixture; Path=/; Secure; HttpOnly; SameSite=Lax'}});
  }
 });
 assert.equal(calls,1);assert.equal(response.status,403);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert(response.headers.get('Set-Cookie').includes('Secure; HttpOnly; SameSite=Lax'));
});
test('provider and old-domain GETs redirect; mutations, unknown hosts and configuration loops are denied without data reads',async()=>{
 let calls=0;const deps={application(){calls++;throw Error('No application/database call');}};
 for(const origin of [provider,'https://maktab4life.org','https://www.maktab4life.org']){
  const response=await saasWebsite(new Request(origin+'/studio/?website=fixture'),env,{},deps);assert.equal(response.status,307);assert.equal(response.headers.get('Location'),root+'/studio/?website=fixture');
  assert.equal((await saasWebsite(new Request(origin+'/auth/logout',{method:'POST'}),env,{},deps)).status,403);
 }
 for(const origin of ['https://evil.test',pages,'https://baseerah.ummabbadacademy.app','https://mahadarwa-hifz.ummabbadacademy.app',root+':444'])assert.equal((await saasWebsite(new Request(origin+'/api/me'),env,{},deps)).status,421);
 for(const assetOrigin of [root,provider,backend,'https://maktab4life.org'])assert.equal((await saasWebsite(new Request(root+'/'),{...env,PUBLIC_ASSET_ORIGIN:assetOrigin},{},deps)).status,503);
 assert.equal(calls,0);
});
test('a different configured public/provider domain works without editing application code',async()=>{
 const changed={...env,WEBSITE_ORIGIN:'https://learning.other.test',STUDIO_PROVIDER_ORIGIN:'https://tenant.provider.test',STUDIO_REDIRECT_ORIGINS:'[]'};
 const response=await saasWebsite(new Request(changed.STUDIO_PROVIDER_ORIGIN+'/studio/'),changed,{},{});assert.equal(response.headers.get('Location'),'https://learning.other.test/studio/');
});
test('actual SaaS Worker preserves public navigation, unsigned denials and zero-database static serving',async()=>{
 const script=(await build({entryPoints:[new URL('../hosting/saas/worker.mjs',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers']})).outputFiles[0].text;
 let staticCalls=0;
 const runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script,compatibilityDate:'2026-11-04',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'empty'},r2Buckets:{CONTENT:'empty',MEDIA:'empty'},bindings:{...env,ENVIRONMENT:'parallel',AUTHORITY_MODE:'ACADEMY',PLATFORM_ENABLED:'1',PARALLEL_ACCESS_ENABLED:'1',ACADEMY_API_ORIGIN:'https://api.academy.test',ACADEMY_TO_WEBSITE_SECRET:'s'.repeat(48),WEBSITE_TO_ACADEMY_SECRET:'r'.repeat(48)},outboundService:request=>{
  staticCalls++;assert.equal(new URL(request.url).origin,pages);assert.equal(request.headers.get('Cookie'),null);return new Response('<!doctype html><html><head><title>Studio</title></head><body>Current public bytes</body></html>',{headers:{'Content-Type':'text/html','X-Robots-Tag':'noindex'}});
 }}));
 try{
  const homepage=await runtime.dispatchFetch(root+'/',{redirect:'manual'});assert.equal(homepage.status,307);assert.equal(homepage.headers.get('Location'),'https://ummabbadacademy.app/');assert.equal(staticCalls,0);
  const html=await runtime.dispatchFetch(root+'/prospectus-2027.html');assert.equal(html.status,200);assert.equal(html.headers.get('Cache-Control'),'no-store');assert.equal(html.headers.get('X-Robots-Tag'),null);assert((await html.text()).includes('rel="canonical" href="'+root+'/prospectus-2027.html"'));assert.equal(staticCalls,1);
  for(const path of ['/api/me','/api/websites/private','/api/media/private'])assert.equal((await runtime.dispatchFetch(root+path)).status,401,path);
  assert.equal(staticCalls,1,'API failures must never fall back to Pages');
  const internal=await runtime.dispatchFetch(backend+'/internal/academy/events',{method:'POST',body:'{}'});assert.equal(internal.status,401);
  const native=await runtime.dispatchFetch(root+'/academy/admin/',{redirect:'manual'});assert.equal(native.headers.get('Location'),env.ACADEMY_ORIGIN+'/academy/admin/');
 }finally{await runtime.dispose();}
});
test('SaaS wrapper retains paired sign-in, permissions, twelve-hour reads and account-switch revocation',async t=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY',websiteOrigin:root,websiteServerOrigin:backend,verification:{accountSeconds:43200,adminSeconds:60,liveSeconds:43200}});
 try{
  const access=await accessFixture(f);await access.recover(2);
  const deps={application:request=>f.runtime.dispatchFetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers),...(request.body?{body:request.body,duplex:'half'}:{}),redirect:'manual'}),assetFetcher(){throw Error('No Pages request for protected data');}};
  const request=async(path,{method='GET',cookie,body,origin=root}={})=>{const response=await saasWebsite(new Request(root+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:origin,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),env,{},deps);return {response,status:response.status,body:await response.json()};};
  const verifier=random(),state=random(),fields={uniqueid:'separation-global',pin:'1234',state,challenge:await challenge(verifier)};
  for(const origin of ['https://evil.test','https://ummabbadacademy.app',provider]){f.source.resetMetrics();assert.equal((await request('/auth/login',{method:'POST',body:fields,origin})).status,403);assert.equal(f.source.metrics.queries,0);}
  const login=await request('/auth/login',{method:'POST',body:fields});assert.equal(login.status,200,JSON.stringify(login.body));
  const exchange=await request('/auth/exchange',{method:'POST',body:{code:login.body.code,state,verifier}});assert.equal(exchange.status,200,JSON.stringify(exchange.body));
  const setCookie=exchange.response.headers.get('Set-Cookie'),cookie=setCookie.split(';')[0];assert(setCookie.includes('Secure; HttpOnly; SameSite=Lax'));assert(!setCookie.includes('Domain='));
  f.source.resetMetrics();for(let n=0;n<2;n++){assert.equal((await request('/api/me',{cookie})).status,200);assert.equal((await request('/api/websites/site-course',{cookie})).status,200);}assert.equal(f.source.metrics.queries,0);
  const former=await f.login('former');assert.equal((await request('/api/websites/site-surah',{cookie:former.cookie})).status,200);
  const outsider=await f.login('outsider');assert.equal((await request('/api/websites/site-course',{cookie:outsider.cookie})).status,403);
  const code=random(),nextVerifier=random(),nextState=random();await f.deliver({type:'handoff',codeHash:await sha256(code),accountId:'former',epoch:1,challenge:await challenge(nextVerifier),state:nextState,expiresAt:Date.now()+60000});
  assert.equal((await request('/auth/exchange',{method:'POST',cookie,body:{code,verifier:nextVerifier,state:nextState}})).status,200);assert.equal((await request('/api/me',{cookie})).status,401);
  t.diagnostic(JSON.stringify({routineAcademyQueries:0,verificationSeconds:[43200,43200,60],newAuthenticationService:false}));
 }finally{await f.close();}
});
test('prepared static Pages and Worker candidate retain reviewed bytes, storage and manual publication',async()=>{
 const base=new URL('../.build/studio-saas/',import.meta.url),receipt=JSON.parse(await readFile(new URL('preparation.json',base))),candidate=JSON.parse(await readFile(new URL('worker.jsonc',base))),production=JSON.parse(await readFile(new URL('../wrangler.production.jsonc',import.meta.url))),plan=JSON.parse(await readFile(new URL('activation-plan.json',base)));
 assert.equal(receipt.activated,false);assert.equal(receipt.exactReviewedPublicBytes,true);assert(receipt.publicFilesVerified>100);assert.equal(receipt.pagesFunctions,0);assert.equal(receipt.newDatabaseBindings,0);assert.equal(receipt.newStorageBindings,0);assert.equal(receipt.liveRequests,0);
 assert.equal(receipt.publicOrigin,root);assert.deepEqual(receipt.verificationSeconds,[43200,43200,60]);assert.equal(receipt.manualMediaPublication,true);
 assert.deepEqual(candidate.d1_databases,production.d1_databases);assert.deepEqual(candidate.r2_buckets,production.r2_buckets);assert.equal(candidate.vars.ACCOUNT_MAX_AGE_SECONDS,'43200');assert.equal(candidate.vars.ADMIN_MAX_AGE_SECONDS,'60');assert.equal(candidate.routes,undefined);
 assert.equal(plan.active,false);assert.equal(plan.customHostname.hostname,new URL(root).hostname);assert(!plan.workerRoutes.includes('*/*'));assert.equal(plan.providerRecord.content,'100::');
});
