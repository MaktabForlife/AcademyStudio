import test from 'node:test';
import assert from 'node:assert/strict';
import {hostingOrigins,exactOrigin,legacyHosting} from '../src/deployment-origins.mjs';
import {originCheck,cookie} from '../src/protocol.mjs';
import {routeWebsite} from '../routing/worker.mjs';
import {publicCirclesRoute} from '../src/public-circles-routes.mjs';
const website='https://studio.example.test',backend='https://studio-backend.example.test',academy='https://academy.example.test',portal='https://ummabbadacademy.app';
const env={WEBSITE_ORIGIN:website,STUDIO_BACKEND_ORIGIN:backend,ACADEMY_ORIGIN:academy,ACADEMY_PORTAL_ORIGIN:portal,WEBSITE_ALIAS_ORIGINS:'["https://www.studio.example.test"]'};
test('legacy configuration stays current until an explicit paired origin change',()=>{
 const value=hostingOrigins();assert.equal(value.website,legacyHosting.website);assert.equal(value.academyPortal,value.website);assert.deepEqual(value.aliases,['https://www.maktab4life.org']);
 assert.equal(hostingOrigins({WEBSITE_ORIGIN:website}).academyPortal,website);
 assert.deepEqual(hostingOrigins({WEBSITE_ORIGIN:website}).aliases,[]);
 assert(cookie('opaque').includes('Secure; HttpOnly; SameSite=Lax'));assert(!cookie('opaque').includes('Domain='));
});
test('only canonical reviewed HTTPS origins and bounded unique alias lists are configuration',()=>{
 for(const value of [null,{},'', 'http://site.test','https://*.site.test','https://u:p@site.test','https://site.test/','https://site.test/path','https://site.test?q=1','https://site.test#x','https://site.test:8443',' https://site.test','https://SITE.test']){
  assert.throws(()=>exactOrigin(value),e=>e.status===503,JSON.stringify(value));
 }
 for(const value of ['null','{}','["https://studio.example.test"]','["https://alias.test","https://alias.test"]','["http://alias.test"]','not-json'])assert.throws(()=>hostingOrigins({...env,WEBSITE_ALIAS_ORIGINS:value}),e=>e.status===503);
 assert.deepEqual(hostingOrigins(env),{website,studioBackend:backend,academy,academyPortal:portal,aliases:['https://www.studio.example.test']});
});
test('action Origin cannot be supplied by Host, forwarding metadata, an alias or the Academy portal',()=>{
 originCheck(new Request(backend+'/auth/exchange',{method:'POST',headers:{Origin:website}}),env);
 for(const origin of [portal,academy,'https://www.studio.example.test','https://attacker.test','null','']){
  assert.throws(()=>originCheck(new Request(backend+'/auth/exchange',{method:'POST',headers:{Origin:origin,Host:'studio.example.test','X-Maktab-Front-Door':'studio.example.test','X-Forwarded-Host':'studio.example.test'}}),env),e=>e.status===403);
 }
 assert.throws(()=>originCheck(new Request(backend+'/auth/exchange',{method:'POST',headers:{Origin:'https://attacker.test'}}),{WEBSITE_ORIGIN:'https://attacker.test/path'}),e=>e.status===503);
});
test('configured router retains fixed upstream, private streaming headers and exact alias redirects',async()=>{
 let calls=0;
 const reply=await routeWebsite(new Request(website+'/api/media/pdf?next=https://evil.test',{headers:{Cookie:'__Host-maktab_web=opaque',Range:'bytes=1-3',Origin:website,'X-Maktab-Front-Door':'attacker.test'}}),async request=>{
  calls++;assert.equal(request.url,backend+'/api/media/pdf?next=https://evil.test');assert.equal(request.headers.get('Origin'),website);assert.equal(request.headers.get('X-Maktab-Front-Door'),'studio.example.test');assert.equal(request.headers.get('Range'),'bytes=1-3');assert.equal(request.headers.get('Cookie'),'__Host-maktab_web=opaque');return new Response('abc',{status:206,headers:{'Content-Range':'bytes 1-3/10','Cache-Control':'private, no-store'}});
 },env);
 assert.equal(calls,1);assert.equal(reply.status,206);assert.equal(reply.headers.get('Content-Range'),'bytes 1-3/10');assert.equal(await reply.text(),'abc');
 const unexpected=()=>{throw Error('Unexpected network');};
 assert.equal((await routeWebsite(new Request('https://www.studio.example.test/studio/?website=x'),unexpected,env)).headers.get('Location'),website+'/studio/?website=x');
 assert.equal((await routeWebsite(new Request(website+'/academy/library/?x=1'),unexpected,env)).headers.get('Location'),academy+'/academy/library/?x=1');
 assert.equal((await routeWebsite(new Request('https://hifz.maktab4life.org/'),unexpected,env)).status,421);
 assert.equal((await routeWebsite(new Request(website+'/'),unexpected,{...env,STUDIO_BACKEND_ORIGIN:'https://evil.test/path'})).status,503);
});
test('portal handover redirects only safe common pages and preserves Studio readers and native tool aliases',()=>{
 const get=path=>publicCirclesRoute(new Request(website+path),env);
 assert.equal(get('/?dashboard=1#today').headers.get('Location'),portal+'/?dashboard=1#today');
 assert.equal(get('/?login=1').headers.get('Location'),portal+'/?login=1');
 assert.equal(get('/dashboard/').headers.get('Location'),portal+'/?dashboard=1');
 assert.equal(get('/?website=private').headers.get('Location'),website+'/studio/?website=private');
 assert.equal(get('/?classroom=mothers').headers.get('Location'),website+'/studio/?classroom=mothers');
 for(const path of ['/studio/?website=x','/auth/exchange','/api/me','/circles/free-learning.html'])assert.equal(get(path),null,path);
 assert.equal(publicCirclesRoute(new Request(website+'/',{method:'POST'}),env),null);
 assert.equal(get('/programs/x').headers.get('Location'),academy+'/programs/x');
 assert.equal(publicCirclesRoute(new Request(legacyHosting.website+'/')),null);
});
