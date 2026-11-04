// One-time GitHub-only normalisation. Never run on the owner's Mac.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.platform,'linux');
assert.equal(process.env.GITHUB_REPOSITORY,'MaktabForlife/AcademyStudio');
assert.equal(process.env.GITHUB_REF_NAME,'studio_dev');
assert(!process.env.CLOUDFLARE_API_TOKEN&&!process.env.CLOUDFLARE_SOURCE_API_TOKEN&&!process.env.CLOUDFLARE_STUDIO_API_TOKEN);
const root=process.cwd(),out=resolve(process.env.RUNNER_TEMP,'housekeeping');
await fs.mkdir(out,{recursive:true});
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
const json=async p=>JSON.parse(await fs.readFile(resolve(root,p),'utf8'));
const write=async(p,v)=>{await fs.mkdir(dirname(resolve(root,p)),{recursive:true});await fs.writeFile(resolve(root,p),v);};
const sha=b=>createHash('sha256').update(b).digest('hex');
const initial=git('rev-parse','HEAD');
assert.equal(initial,process.env.GITHUB_SHA);
assert.equal(git('status','--porcelain'),'');
assert.equal(git('ls-remote','origin','refs/heads/rollback/studio-before-housekeeping-20261104').split(/\s+/)[0],'e9a46a882fd823a5923f71e1afe5053c58f149dd');
const tracked=git('ls-files','-z').split('\0').filter(Boolean);
const invariant=tracked.filter(p=>/^(src|migrations|routing)\//.test(p));
const invariantHashes=Object.fromEntries(await Promise.all(invariant.map(async p=>[p,sha(await fs.readFile(p))])));
const current=await json('release/current.json'),version=current.version;
assert.equal(version,'109.17');
const expected=await json(current.manifest),frozen=resolve(root,'release/v'+version+'/public');
const oldPrefix=expected.prefix;assert(/^\/_assets\/[a-f0-9]{64}\/$/.test(oldPrefix));
let promoted=0,canonical=0;
for(const [p,digest]of Object.entries(expected.manifest)){
 const data=await fs.readFile(resolve(frozen,p));assert.equal(sha(data),digest,p);
 if(p.startsWith('_assets/'))continue;
 const destination='public/'+p;if(!tracked.includes(destination))promoted++;
 const normalized=/\.(?:html|fragment|js|mjs|css|json|txt|md|ftl|properties)$/.test(p)?Buffer.from(data.toString().split(oldPrefix).join('/')):data;
 await write(destination,normalized);canonical++;
}
const templates=await json('tools/maintenance/housekeeping-templates.json');
for(const [p,content]of Object.entries(templates))await write(p,content);
await write('release/manifest.json',JSON.stringify(expected,null,2)+'\n');
await write('release/current.json',JSON.stringify({version,manifest:'release/manifest.json'},null,2)+'\n');
await write('release/source.json',JSON.stringify({version,canonicalSource:'public/',recoveryBranch:'rollback/studio-before-housekeeping-20261104'},null,2)+'\n');
const production=await json('wrangler.github-'+version.replaceAll('.','')+'.jsonc');
await write('wrangler.production.jsonc',JSON.stringify(production,null,2)+'\n');
let assetTool=await fs.readFile('tools/version-public-assets.mjs','utf8');
assetTool=assetTool.replace('versionPublicAssets(directory){','versionPublicAssets(directory,{signature:approvedSignature}={}){');
assetTool=assetTool.replace("signature=digest(JSON.stringify([...assets].sort().map(file=>[file,digest(files.get(file))])))","signature=approvedSignature||digest(JSON.stringify([...assets].sort().map(file=>[file,digest(files.get(file))])))");
assert(assetTool.includes('signature=approvedSignature||'));
await write('tools/version-public-assets.mjs',assetTool);
// Stable production config paths in current release/check scripts.
for(const p of ['tools/paired-release.mjs','tools/check-paired-static.mjs','tools/cloud-release-check.mjs']){
 let s=await fs.readFile(p,'utf8');
 s=s.replaceAll("'wrangler.github-'+version.replaceAll('.','')+'.jsonc'","'wrangler.production.jsonc'");
 s=s.replaceAll("'/wrangler.github-'+version.replaceAll('.','')+'.jsonc'","'/wrangler.production.jsonc'");
 s=s.replaceAll("+'/wrangler.github-'+version.replaceAll('.','')+'.jsonc'","+'/wrangler.production.jsonc'");
 if(p==='tools/cloud-release-check.mjs'){
  s=s.replace("import {build} from 'esbuild';","import {build} from 'esbuild';\nimport {buildStudioPackage} from './build-studio-package.mjs';");
  s=s.replace("mkdir,appendFile,lstat}","mkdir,appendFile,lstat,mkdtemp}");
  s=s.replace("const manifests={};","let packageExists=false;try{packageExists=(await lstat(resolve(studio,'release/v'+version+'/public'))).isDirectory();}catch(e){if(e.code!=='ENOENT')throw e;}\nawait buildStudioPackage({root:studio,version,...(packageExists?{output:resolve(await mkdtemp(resolve(process.env.RUNNER_TEMP,'studio-source-recheck-')),'public')}:{})});\nconst manifests={};");
  s=s.replace("const m=await json(resolve(dir,'release/v'+version+'/manifest.json'));","const m=await json(resolve(dir,side==='target'?'release/manifest.json':'release/v'+version+'/manifest.json'));");
  s=s.replace("const m=f.File.match(/^release\\/v(\\d+\\.\\d+)\\/manifest\\.json$/);","const m=f.File.match(/^release\\/(?:v(\\d+\\.\\d+)\\/)?manifest\\.json$/);");
  s=s.replace("if(m&&pair)publicValue=sha(await readFile(resolve(dir,'release/v'+m[1]+'/public',pair[1])))===pair[2];","if(m&&pair)publicValue=sha(await readFile(resolve(dir,'release/v'+(m[1]||version)+'/public',pair[1])))===pair[2];");
  assert(s.includes("side==='target'?'release/manifest.json'"));
  s=s.replace("'tests/private-playlist-reference.test.mjs'","'tests/source-package.test.mjs','tests/private-playlist-reference.test.mjs'");
 }
 await write(p,s);
}
// Keep separate environments outside the root; keep their exact settings.
const moves=new Map();
for(const name of ['launch','parallel','preview']){
 const old='wrangler.'+name+'.jsonc',next='config/'+old,c=await json(old);
 c.$schema='../node_modules/wrangler/config-schema.json';
 if(c.main)c.main='../'+c.main.replace(/^\.\//,'');
 if(c.assets?.directory)c.assets.directory='../'+c.assets.directory.replace(/^\.\//,'');
 for(const row of c.d1_databases||[])if(row.migrations_dir)row.migrations_dir='../'+row.migrations_dir.replace(/^\.\//,'');
 await write(next,JSON.stringify(c,null,2)+'\n');moves.set(old,next);
}
const noteMoves=new Map();
for(const p of tracked.filter(p=>/^docs\/(?:RELEASE|CIRCLES-RELEASE|DEPLOYED-PARALLEL-V108)/.test(p))){
 const next='docs/history/releases/'+p.slice(5);await write(next,await fs.readFile(p));noteMoves.set(p,next);
}
// Update executable/test references and maintained docs, not archived history.
for(const p of tracked.filter(p=>/^(tools|tests|docs)\//.test(p)&&/\.(?:mjs|js|md|yml)$/.test(p)&&!noteMoves.has(p)&&!p.startsWith('tools/maintenance/'))){
 let s=await fs.readFile(p,'utf8');
 for(const [a,b]of moves)s=s.split(a).join(b);
 for(const [a,b]of noteMoves)s=s.split(a).join(b);
 await write(p,s);
}
const removed=tracked.filter(p=>/^release\/v\d+\.\d+\//.test(p)||/^wrangler\.(?:github|release|ui|recovery)-/.test(p)||moves.has(p)||noteMoves.has(p));
for(const p of removed)await fs.rm(resolve(root,p)); // GitHub runner only, after assertions above.
for(const folder of new Set(tracked.map(p=>p.match(/^release\/(v\d+\.\d+)\//)?.[1]).filter(Boolean)))await fs.rm(resolve(root,'release',folder),{recursive:true,force:true});
let ignore=await fs.readFile('.gitignore','utf8');
ignore+='\n# Website packages are generated on GitHub, not retained source.\n/release/v*/\n';
await write('.gitignore',ignore);
for(const p of invariant)assert.equal(sha(await fs.readFile(p)),invariantHashes[p],'Runtime/migration changed: '+p);
assert.deepEqual(await json('wrangler.production.jsonc'),production);
assert.deepEqual(production.vars.ACCOUNT_MAX_AGE_SECONDS,'43200');
assert.deepEqual(production.vars.LIVE_ACCESS_MAX_AGE_SECONDS,'43200');
assert.deepEqual(production.vars.ADMIN_MAX_AGE_SECONDS,'60');
const {buildStudioPackage}=await import('../build-studio-package.mjs');
const proof=await buildStudioPackage({root,version,output:resolve(out,'rebuilt','public')});
assert(proof.exactReviewedBytes);
assert.deepEqual(proof.manifest.manifest,expected.manifest);
// The one-time machinery is retained by Git history, not the working branch.
for(const p of ['tools/maintenance/repository-housekeeping.mjs','tools/maintenance/housekeeping-templates.json','.github/workflows/repository-housekeeping.yml'])await fs.rm(resolve(root,p));
git('add','-A');
git('-c','user.name=github-actions[bot]','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com','commit','--quiet','-m','[CF-Pages-Skip] [skip ci] Keep one complete Studio source and remove copied release trees');
const candidate=git('rev-parse','HEAD');
function run(cmd,args,label,env={}){
 const r=spawnSync(cmd,args,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,...env}});
 awaitlessWrite(label,r.stdout+'\n'+r.stderr);
 if(r.status!==0)console.error((r.stderr||r.stdout).slice(-6000));
 assert.equal(r.status,0,label+' failed; inspect redacted GitHub evidence.');
}
function awaitlessWrite(label,text){execFileSync(process.execPath,['-e',"require('fs').writeFileSync(process.argv[1],require('fs').readFileSync(0))",resolve(out,label)],{input:text});}
run(process.execPath,['tools/check.mjs'],'syntax-and-local-config.log');
run(process.execPath,['tools/cloud-release-check.mjs','check'],'paired-check.log',{NODE_OPTIONS:'--import='+resolve(root,'tools/preserve-local-files.mjs')});
assert.equal(git('status','--porcelain'),'');
assert.equal(git('ls-remote','origin','refs/heads/studio_dev').split(/\s+/)[0],initial,'studio_dev changed during checks; do not overwrite.');
if(process.env.APPLY_HOUSEKEEPING==='true')git('push','origin','HEAD:refs/heads/studio_dev');
const result={passed:true,applied:process.env.APPLY_HOUSEKEEPING==='true',before:initial,after:candidate,rollback:'rollback/studio-before-housekeeping-20261104',version,promotedFiles:promoted,canonicalPublicFiles:canonical,exactPublicFiles:proof.files,exactPublicBytes:true,runtimeAndMigrationFilesUnchanged:invariant.length,removedTrackedPaths:removed.length,rootConfigs:['wrangler.jsonc','wrangler.production.jsonc'],macWrites:0,macDeletions:0,cloudflareRequests:0,deployed:false};
await fs.writeFile(resolve(out,'result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
