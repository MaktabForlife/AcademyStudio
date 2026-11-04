import './preserve-local-files.mjs';
// Exact frozen assets and real route handlers; no hosted services or SQL.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(process.env.M4L_PROJECT_ROOT||resolve(import.meta.dirname,'../../..')),version=process.argv[2],out=resolve(process.env.M4L_RELEASE_OUTPUT||resolve(import.meta.dirname,'../.build/release-'+version));
assert(/^\d+\.\d+$/.test(version||''));
const scope=JSON.parse(await readFile(resolve(out,'approval-and-scope.json')));
const old=JSON.parse(await readFile(resolve(import.meta.dirname,'paired-static-routes.json')));
const source=await import(resolve(root,scope.source,'backend/tools/academy-site.mjs'));
const {launch}=await import(resolve(root,scope.studio,'src/launch-worker.mjs'));
const config=JSON.parse(await readFile(resolve(root,scope.studio,'wrangler.production.jsonc')));
let sourceAssets=0,studioAssets=0,dbOrObjectReads=0;
function assets(base,side){return {fetch:async request=>{
 const url=new URL(request.url);let path=decodeURIComponent(url.pathname);if(path.endsWith('/'))path+='index.html';
 const file=resolve(base,'.'+path);assert(file.startsWith(base+'/'));
 if(side==='source')sourceAssets++;else studioAssets++;
 try{return new Response(await readFile(file),{headers:{'Content-Type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.fragment':'text/plain'})[extname(file)]||'application/octet-stream'}});}catch(e){if(e.code!=='ENOENT')throw e;return new Response('Missing asset',{status:404});}
 }};}
const srcEnv={ASSETS:assets(resolve(root,scope.source,'release/v'+version+'/public'),'source')};
const targetEnv={...config.vars,ACADEMY_TO_WEBSITE_SECRET:'local-static-fixture-key-'.repeat(2),WEBSITE_TO_ACADEMY_SECRET:'local-static-fixture-key-'.repeat(2),ASSETS:assets(resolve(root,scope.studio,'release/v'+version+'/public'),'target')};
for(const env of [srcEnv,targetEnv])for(const name of ['DB','CONTENT','MEDIA','ACADEMY_DB','ACADEMY_ADMIN_DB'])Object.defineProperty(env,name,{get(){dbOrObjectReads++;throw Error('Unexpected stored-data access during static route '+name);}});
// Canonical-tag rewriting is separately compiled by Wrangler; this facade
// leaves the exact source bytes available to inspect the navigation contract.
globalThis.HTMLRewriter=class{on(){return this;}transform(response){return response;}};
const rows=[];
for(const page of old.pageEntries){
 const native=page.source==='Academy deployed Pages',url=(native?'https://academy-maktab4life.pages.dev':'https://maktab4life.org')+page.route;
 const request=new Request(url),response=native?await source.serveAcademySite(request,srcEnv,{pages:true}):await launch(request,targetEnv,{});
 let expected=200;
 if(native){if(['/academy/pdf-icon-samples/','/academy/website-platform/handover/'].includes(page.route))expected=404;else if(['/academy/teaching/','/academy/open-library/','/programs/timetable.html','/programs/manage.html','/programs/lesson-media.html','/programs/library-view.html','/programs/library.html','/programs/media.html'].includes(page.route))expected=302;}
 else if(['/preview/','/preview/websites/','/import/'].includes(page.route))expected=410;
 else if(page.route==='/'||page.route==='/circles/'||page.route==='/circles/prospectus-2027.html')expected=307;
 assert.equal(response.status,expected,page.source+' '+page.route);
 const text=await response.text();
 if(native&&['/academy/','/academy/admin/'].includes(page.route)){assert.match(text,/data-circles-native="true"/);assert(!/id="(?:overview|dashboard|about|contact|prospectus|workshops)"/.test(text));}
 rows.push({source:page.source,path:page.route,status:response.status,location:response.headers.get('Location'),bytes:Buffer.byteLength(text)});
}
assert.equal(rows.length,50);assert.equal(dbOrObjectReads,0);
const receipt={passed:true,entries:50,sourceEntries:40,studioEntries:10,sourceAssets,studioAssets,databaseOrObjectReads:0,hostedRequests:0,htmlRewriter:'local canonical-tag facade; actual Worker compilation checked separately',rows};
await writeFile(resolve(out,'static-route-matrix.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({...receipt,rows:undefined}));
