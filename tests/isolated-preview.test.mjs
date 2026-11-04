import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import {preview} from '../src/preview-worker.mjs';

test('preview refuses a live Academy origin or another environment',async()=>{
 for(const env of [{ENVIRONMENT:'production',ACADEMY_ORIGIN:'https://academy.invalid'},{ENVIRONMENT:'isolated-preview',ACADEMY_ORIGIN:'https://live.example'}]){
  const result=await preview(new Request('https://preview.test/auth/login',{method:'POST'}),env,{});
  assert.equal(result.status,503);assert.match((await result.json()).error,/configuration/);
 }
});

test('hosted preview is fail-closed, labelled, and disconnected from Academy',async()=>{
 const entry=new URL('../src/preview-worker.mjs',import.meta.url).pathname;
 const script=(await build({entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'browser'})).outputFiles[0].text;
 const env={ENVIRONMENT:'isolated-preview',PLATFORM_ENABLED:'1',ACADEMY_ORIGIN:'https://academy.invalid',WEBSITE_ORIGIN:'https://preview.test'};
 const runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script,compatibilityDate:'2026-09-28',bindings:env,d1Databases:{DB:'preview-empty'},r2Buckets:{CONTENT:'preview-content'},serviceBindings:{ASSETS:async()=>new Response('<html><body><button id="sign-in-button">Sign in</button><form id="sign-in-form"><input name="pin"><button>Continue</button></form></body></html>',{headers:{'Content-Type':'text/html'}})}}));
 try{
  // No DB schema: any accidental operational query would fail these checks.
  const homepage=await runtime.dispatchFetch('https://preview.test/');
  assert.equal(homepage.status,200);assert.equal(homepage.headers.get('X-Robots-Tag'),'noindex, nofollow, noarchive');
  const html=await homepage.text();assert.match(html,/isolated preview/);assert.match(html,/id="sign-in-button" disabled/);assert.match(html,/name="pin" disabled/);
  for(const path of ['/auth/login','/auth/exchange','/internal/academy/events']){
   const response=await runtime.dispatchFetch('https://preview.test'+path,{method:'POST',body:'{}'});
   assert.equal(response.status,503);assert.equal((await response.json()).code,'PREVIEW_DISCONNECTED');assert.equal(response.headers.get('Set-Cookie'),null);
  }
  const home=await runtime.dispatchFetch('https://preview.test/api/public/home');assert.equal(home.status,200);assert.deepEqual((await home.json()).cards,[]);
  const protectedPage=await runtime.dispatchFetch('https://preview.test/api/websites');assert.equal(protectedPage.status,401);
 }finally{await runtime.dispose();}
 const config=JSON.parse(readFileSync(new URL('../config/wrangler.preview.jsonc',import.meta.url),'utf8'));
 assert.equal(config.account_id,'2b01ca929611669e032703ff19f7098f');
 assert.equal(config.vars.ACADEMY_ORIGIN,'https://academy.invalid');
 assert.equal(config.main,'src/preview-worker.mjs');
 for(const binding of [...config.r2_buckets,...config.d1_databases])assert.match(binding.bucket_name||binding.database_name,/^academy-studio-preview/);
});
