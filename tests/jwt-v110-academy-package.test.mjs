import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
assert.equal(process.env.GITHUB_ACTIONS,'true','Disposable GitHub runners only.');
assert.ok(process.env.ACADEMY_SOURCE,'Pinned Academy source required.');
const repo=resolve(process.env.ACADEMY_SOURCE);
let directory,report,build,site,manifest;
before(async()=>{
 const load=name=>import(pathToFileURL(join(repo,'backend/tools',name)).href);
 [build,site,manifest]=await Promise.all(['academy-assets.mjs','academy-site.mjs','jwt-v110-public-assets.mjs'].map(load));
 directory=await mkdtemp(join(tmpdir(),'jwt-v110-package-'));
 report=build.buildAcademyAssets({repo,directory,target:'feature',isolated:true});
});
after(async()=>{if(directory)await rm(directory,{recursive:true,force:true});});
test('the real Academy feature asset builder packages all eight exact public V110 files with flags disabled',async()=>{
 assert.equal(manifest.jwtV110PublicAssets.length,8);
 for(const file of manifest.jwtV110PublicAssets){
  assert.ok(report.files.includes(file),'Missing '+file);
  const expected=await readFile(join(repo,file),'utf8'),actual=await readFile(join(directory,file),'utf8');
  if(file===manifest.jwtV110Relay){assert.ok(actual.includes('noindex,nofollow'));assert.ok(actual.includes('startRelayDocument'));assert.ok(!actual.includes('data-circles-native'));build.validateCirclesPresentation(file,actual);}
  else assert.equal(actual,expected,file+' must not be substituted or activated');
 }
 assert.match(await readFile(join(directory,'auth/v110/browser-config.js'),'utf8'),/"enabled": false/);
 assert.throws(()=>build.academyPublishableAsset('auth/v110/private-admin.html'),/UNAPPROVED_ACADEMY_HTML/);
 assert.throws(()=>build.validateCirclesPresentation('academy/unknown.html','<!doctype html><html><body></body></html>'),/CIRCLES_SHELL_REQUIRED/);
 assert.ok(!report.files.some(file=>file.startsWith('backend/')||file.startsWith('docs/')));
 await mkdir('.build/jwt-v110-academy-package',{recursive:true});
 await writeFile('.build/jwt-v110-academy-package/package.json',JSON.stringify({synthetic:true,target:'feature',files:manifest.jwtV110PublicAssets,totalPublicFiles:report.fileCount,totalPublicBytes:report.bytes,featureEnabled:false,workerDeployed:false,liveDBChanges:0},null,2)+'\n');
});
test('the actual Pages site entrypoint serves the exact public relay/runtime without cookies, authorization or other caller headers',async()=>{
 const seen=[];
 const env=new Proxy({ASSETS:{async fetch(request){
  seen.push({path:new URL(request.url).pathname,method:request.method,headers:[...request.headers]});
  const file=new URL(request.url).pathname.slice(1),body=await readFile(join(directory,file),'utf8');
  return new Response(body,{headers:{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8'}});
 }}},{get(target,key){if(key!=='ASSETS')throw Error('Unexpected binding access');return target[key];}});
 for(const file of manifest.jwtV110PublicAssets){
  const request=new Request('https://academy.example/'+file,{headers:{Cookie:'synthetic-never-an-authentication-cookie=fixture',Authorization:'Bearer synthetic-test-only','X-Maktab-Signature':'synthetic-test-only',Origin:'https://studio.example'}});
  const response=await site.serveAcademySite(request,env,{pages:true});
  assert.equal(response.status,200,file);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');
  assert.ok((await response.text()).length>0);
  assert.deepEqual(seen.at(-1).headers,[],file+' must not forward credentials or caller headers');
 }
 const head=await site.serveAcademySite(new Request('https://academy.example/'+manifest.jwtV110Relay,{method:'HEAD'}),env,{pages:true});
 assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(seen.at(-1).method,'HEAD');
 const count=seen.length;
 const post=await site.serveAcademySite(new Request('https://academy.example/'+manifest.jwtV110Relay,{method:'POST'}),env,{pages:true});
 assert.equal(post.status,405);assert.equal(seen.length,count);
});
test('neighbouring auth sources and the private context endpoint are not public asset allowlist entries',async()=>{
 let assets=0;const env={ASSETS:{fetch(){assets++;throw Error('Unexpected asset access');}}};
 for(const path of ['/auth/v110/private-admin.html','/auth/v110/private-signing-key.pem','/auth/v110/context','/auth/v110/../keys.json']){
  const response=await site.serveAcademySite(new Request('https://academy.example'+path),env,{pages:true});
  assert.notEqual(response.status,200,path);assert.equal(assets,0);
 }
});
