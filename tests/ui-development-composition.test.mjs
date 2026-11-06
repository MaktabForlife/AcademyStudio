import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
const root=process.cwd(),academy=resolve(process.env.ACADEMY_SOURCE),sha=x=>createHash('sha256').update(x).digest('hex');
test('paired V109.27 frozen files, exact isolated public configuration and earlier V109.25 remain intact',()=>{
 for(const [repo,dir,base]of [['MaktabForlife/Academy',academy,'1b4dd450a4a59093ae85d891f0277eb480418c30'],['MaktabForlife/AcademyStudio',root,'9a8c117e9279a2b67e62eb044be4da989db4a096']]){
  const m=JSON.parse(readFileSync(resolve(dir,'release/v109.27/manifest.json'),'utf8'));assert.equal(m.repository,repo);assert.equal(m.version,'109.27');
  const actual={},publicRoot=resolve(dir,'release/v109.27/public');
  function visit(path){for(const e of readdirSync(path,{withFileTypes:true})){const p=resolve(path,e.name);assert(!e.isSymbolicLink());if(e.isDirectory())visit(p);else{assert(lstatSync(p).isFile());actual[relative(publicRoot,p)]=sha(readFileSync(p));}}}visit(publicRoot);
  assert.deepEqual(Object.entries(actual).sort(),Object.entries(m.manifest).sort());
  assert.equal(execFileSync('git',['diff','--name-only',base+'..HEAD','--','release/v109.25'],{cwd:dir,encoding:'utf8'}).trim(),'');
 }
 const p=JSON.parse(readFileSync('deployment/ui-development-proposal.json','utf8'));
 assert.equal(p.activationAllowed,false);assert.equal(p.existingStoresChanged,false);assert.equal(p.provider.selected,false);
 assert.equal(p.resourceCounts.databases,3);assert.equal(p.resourceCounts.privateR2Buckets,6);
 for(const side of ['academy','studio'])assert(p.newResources[side].databases.every(d=>d.id===null));
 const h=readFileSync(resolve(academy,'release/v109.27/public/js/m4l-config.js'),'utf8');
 assert(h.includes(p.hosting.academyApiOrigin));assert(h.includes(p.hosting.academyPortalOrigin));
 assert.equal(p.controls.VIDEO_AUTOLINK_ENABLED,'0');assert.equal(p.controls.VIDEO_AUTOLINK_HTTP_ENABLED,'0');
});
test('complete 72-table empty Studio+processing blueprint imports into current local workerd without user rows or FK errors',async()=>{
 assert.equal(process.env.GITHUB_ACTIONS,'true');const modulePath=process.env.UI_DEV_CURRENT_MINIFLARE;assert(modulePath);
 const pkg=JSON.parse(readFileSync(new URL('../../package.json',pathToFileURL(modulePath)),'utf8'));assert.equal(pkg.version,'5.20261103.0-beta');
 const {Miniflare,convertV4MiniflareOptions}=await import(pathToFileURL(modulePath));
 const ddl=readFileSync('tests/fixtures/studio-ui-development-empty.sql','utf8');
 assert.equal(sha(ddl),'4b8ca03f913b768166141937aafb1d6cf10e03bacf6f0223982b43332cb69797');
 const node=new DatabaseSync(':memory:');node.exec(ddl);const definitions=node.prepare("SELECT type,name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND substr(name,1,7)!='sqlite_' ORDER BY rowid").all();node.close();
 assert.equal(definitions.length,218);const tables=definitions.filter(x=>x.type==='table');assert.equal(tables.length,72);
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'empty-studio-proposal',modules:true,script:"export default {fetch:()=>new Response('local-only')}",compatibilityDate:'2026-10-28',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'empty-studio-proposal-local'}}]}));
 let bindingCalls=0,statements=0,rowsRead=0,rowsWritten=0;
 const count=result=>{for(const r of Array.isArray(result)?result:[result]){rowsRead+=Number(r.meta?.rows_read)||0;rowsWritten+=Number(r.meta?.rows_written)||0;}return result;};
 try{
  const db=await mf.getD1Database('DB','empty-studio-proposal');
  for(let n=0;n<definitions.length;n+=25){const part=definitions.slice(n,n+25);bindingCalls++;statements+=part.length;count(await db.batch(part.map(d=>db.prepare(d.sql))));}
  const all=async sql=>{bindingCalls++;statements++;return count(await db.prepare(sql).all()).results;};
  const foreign=await all('PRAGMA foreign_key_check');assert.equal(foreign.length,0);
  assert.equal(Object.values((await all('PRAGMA quick_check'))[0])[0],'ok');
  let userRows=0;
  for(let at=0;at<tables.length;at+=24){
   const part=tables.slice(at,at+24);bindingCalls++;statements+=part.length;
   const results=count(await db.batch(part.map(t=>db.prepare('SELECT count(*) n FROM "'+t.name.replaceAll('"','""')+'"'))));
   for(const r of results){assert(Number.isSafeInteger(r.results[0].n));userRows+=r.results[0].n;}
  }assert.equal(userRows,0);
  const objects=await all("SELECT name FROM sqlite_schema WHERE sql IS NOT NULL"),expected=new Set(definitions.map(x=>x.name));assert.equal(objects.filter(x=>expected.has(x.name)).length,218);
  console.log(JSON.stringify({compatibilityDate:'2026-10-28',miniflare:pkg.version,workerd:pkg.dependencies.workerd,objects:218,tables:72,userRows:0,foreignKeyErrors:0,quickCheck:'ok',nodeD1BindingCalls:bindingCalls,statements,reportedRowsRead:rowsRead,reportedRowsWritten:rowsWritten,scope:'disposable LOCAL schema import only; not hosted billing or application flow',hostedCalls:0}));
 }finally{await mf.dispose();}
});
