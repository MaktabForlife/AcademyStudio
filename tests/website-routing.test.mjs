import test from 'node:test';
import assert from 'node:assert/strict';
import {routeWebsite} from '../routing/worker.mjs';

const root='https://maktab4life.org',target='https://academy-studio-parallel.naidu-hajira.workers.dev';
test('domain router has fixed upstream, preserves streams/ranges/cookies and never follows redirects',async()=>{
 let calls=0;
 const r=await routeWebsite(new Request(root+'/api/media/attachment?next=https://evil.test',{headers:{Cookie:'__Host-maktab_web=private',Range:'bytes=10-19','If-Range':'"original"','X-Maktab-Front-Door':'evil','X-Forwarded-Host':'evil'}}),async req=>{
  calls++;assert.equal(req.url,target+'/api/media/attachment?next=https://evil.test');assert.equal(req.redirect,'manual');assert.equal(req.headers.get('Range'),'bytes=10-19');assert.equal(req.headers.get('Cookie'),'__Host-maktab_web=private');assert.equal(req.headers.get('If-Range'),'"original"');assert.equal(req.headers.get('X-Maktab-Front-Door'),'maktab4life.org');assert.equal(req.headers.get('X-Forwarded-Host'),null);
  return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('ten bytes!'));c.close();}}),{status:206,headers:{'Content-Range':'bytes 10-19/100','Cache-Control':'private, no-store',ETag:'"original"'}});
 });
 assert.equal(calls,1);assert.equal(r.status,206);assert.equal(r.headers.get('Content-Range'),'bytes 10-19/100');assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.equal(await r.text(),'ten bytes!');
 const upload=await routeWebsite(new Request(root+'/api/admin/upload',{method:'POST',headers:{Origin:root,'Content-Type':'application/pdf'},body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('small synthetic PDF'));c.close();}}),duplex:'half'}),async req=>{assert.equal(req.headers.get('Origin'),root);assert.equal(req.headers.get('Content-Type'),'application/pdf');assert.equal(await req.text(),'small synthetic PDF');return new Response(null,{status:204,headers:{'Set-Cookie':'__Host-maktab_web=new; Path=/; Secure; HttpOnly; SameSite=Lax'}});});
 assert.equal(upload.status,204);assert.equal(upload.headers.get('Set-Cookie'),'__Host-maktab_web=new; Path=/; Secure; HttpOnly; SameSite=Lax');
});

test('www and old Academy bookmarks retain paths and queries, without forwarding mutations or Hifz traffic',async()=>{
 const unexpected=()=>{throw Error('No upstream call expected');};
 for(const method of ['GET','HEAD']){
  const www=await routeWebsite(new Request('https://www.maktab4life.org/studio/?website=site',{method}),unexpected);assert.equal(www.status,307);assert.equal(www.headers.get('Location'),root+'/studio/?website=site');
  for(const path of ['/academy','/academy/library/?view=pdf#item','/account/known-link']){const r=await routeWebsite(new Request(root+path,{method}),unexpected);assert.equal(r.headers.get('Location'),'https://academy-maktab4life.pages.dev'+path);assert.equal(r.headers.get('Cache-Control'),'no-store');}
 }
 assert.equal((await routeWebsite(new Request('https://www.maktab4life.org/auth/login',{method:'POST',body:'private'}),unexpected)).status,403);
 assert.equal((await routeWebsite(new Request(root+'/academy/save',{method:'POST',body:'private'}),unexpected)).status,405);
 const secure=await routeWebsite(new Request('http://maktab4life.org/studio/?website=site'),unexpected);assert.equal(secure.status,307);assert.equal(secure.headers.get('Location'),root+'/studio/?website=site');
 for(const origin of ['https://hifz.maktab4life.org','https://evil.test','https://maktab4life.org:444'])assert.equal((await routeWebsite(new Request(origin+'/'),unexpected)).status,421);
});

test('router never selects a destination from URL-like paths, closes on outage, and preserves protected denial',async()=>{
 for(const path of ['//evil.test/path','/%2f%2fevil.test/','/?url=https://evil.test'])await routeWebsite(new Request(root+path),async req=>{assert.equal(new URL(req.url).origin,target);return new Response('Denied',{status:403,headers:{'Cache-Control':'private, no-store'}});});
 const failed=await routeWebsite(new Request(root+'/api/websites/site'),async()=>{throw Error('Synthetic offline');});assert.equal(failed.status,503);assert.equal(failed.headers.get('Cache-Control'),'no-store');
 const denied=await routeWebsite(new Request(root+'/api/media/private'),async()=>new Response('Denied',{status:403,headers:{'Cache-Control':'private, no-store'}}));assert.equal(denied.status,403);assert.equal(await denied.text(),'Denied');
 const redirect=await routeWebsite(new Request(root+'/old'),async()=>new Response(null,{status:307,headers:{Location:target+'/studio/?website=site'}}));assert.equal(redirect.headers.get('Location'),root+'/studio/?website=site');
});
