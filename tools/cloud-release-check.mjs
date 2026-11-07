// Runs in GitHub's disposable runner. Does not write to the owner's Mac.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,mkdir,appendFile,lstat,mkdtemp} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {buildStudioPackage} from './build-studio-package.mjs';
import {recoveredBaseline} from './release-safety.mjs';
import {reviewedSQLIdentifierFinding} from './reviewed-sql-integrity.mjs';
import {loadProductionApproval,assertProductionSource} from './approved-deployment.mjs';
const root=resolve(process.env.GITHUB_WORKSPACE||process.env.M4L_PROJECT_ROOT||'.');
const source=resolve(root,'work/Academy'),studio=resolve(root,'work/AcademyStudio');
const out=resolve(process.env.M4L_RELEASE_OUTPUT||process.env.RUNNER_TEMP+'/paired-release');
assert(process.env.GITHUB_ACTIONS==='true','This workflow belongs in GitHub, not a Mac working folder');
const mode=process.argv[2]||'check',sha=v=>createHash('sha256').update(v).digest('hex');
const git=(dir,...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0'}}).trim();
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const save=(name,value)=>writeFile(resolve(out,name),JSON.stringify(value,null,2)+'\n');
await mkdir(out,{recursive:true});
const version=(await json(resolve(studio,'release/current.json'))).version;
assert(/^\d+\.\d+$/.test(version));
if(process.env.RELEASE_VERSION)assert.equal(process.env.RELEASE_VERSION,version);
const commits={source:git(source,'rev-parse','HEAD'),target:git(studio,'rev-parse','HEAD')};
const dirs={source,target:studio};
const repos={source:'MaktabForlife/Academy',target:'MaktabForlife/AcademyStudio'};
let packageExists=false;try{packageExists=(await lstat(resolve(studio,'release/v'+version+'/public'))).isDirectory();}catch(e){if(e.code!=='ENOENT')throw e;}
await buildStudioPackage({root:studio,version,...(packageExists?{output:resolve(await mkdtemp(resolve(process.env.RUNNER_TEMP,'studio-source-recheck-')),'public')}:{})});
const manifests={};
for(const [side,dir]of Object.entries(dirs)){
 assert.equal(git(dir,'remote','get-url','origin').replace(/\.git$/,''),'https://github.com/'+repos[side]);
 assert.equal(git(dir,'status','--porcelain'),'','Source tree changed during verification');
 assert.equal((await json(resolve(dir,'release/current.json'))).version,version);
 const m=await json(resolve(dir,side==='target'?'release/manifest.json':'release/v'+version+'/manifest.json'));
 assert.equal(m.repository,repos[side]);
 const actual={},base=resolve(dir,'release/v'+version+'/public');
 async function visit(p){for(const e of await readdir(p,{withFileTypes:true})){assert(!e.isSymbolicLink());const f=resolve(p,e.name);if(e.isDirectory())await visit(f);else{assert((await lstat(f)).isFile());actual[relative(base,f)]=sha(await readFile(f));}}}
 await visit(base);
 assert.deepEqual(Object.fromEntries(Object.entries(actual).sort()),Object.fromEntries(Object.entries(m.manifest).sort()),'Frozen asset mismatch');
 manifests[side]={...m,files:Object.keys(actual).length};
}
const gh=(path,body)=>JSON.parse(execFileSync('gh',['api',...(body?['--method','POST','--input','-']:[]),path],{encoding:'utf8',input:body?JSON.stringify(body):undefined}));
if(mode==='publish-receipt'){
 const v=await json(resolve(out,'verification.json')),prior=await json(resolve(out,'baseline.json'));
 assert(v.passed&&v.version===version);
 const receipt={version,source:{commit:commits.source,workerVersion:v.source.workerVersion,pages:v.source.pages},studio:{commit:commits.target,workerVersion:v.studio.workerVersion},coordinatorVersion:v.coordinator.versionId,bindings:v.bindings,hosting:v.hosting,databaseVersions:prior.databaseVersions,verificationSeconds:v.verificationSeconds,manualLessonAttachment:true,manualLessonPublication:true,localTests:v.localChecks,unsignedLiveChecks:v.unsignedChecks,verifiedAt:v.verifiedAt};
 const release=gh('/repos/MaktabForlife/AcademyStudio/releases',{tag_name:'v'+version,target_commitish:commits.target,name:'V'+version+' — paired Academy and Studio',body:'Tested and deployed together from exact GitHub source. Academy '+commits.source+'; Studio '+commits.target+'. Media attachment and publication remain manual.',draft:false,prerelease:false});
 const body=JSON.stringify(receipt,null,2)+'\n',url=release.upload_url.split('{')[0]+'?name=paired-release.json';
 execFileSync('gh',['api','--method','POST',url,'-H','Content-Type: application/json','-H','Content-Length: '+Buffer.byteLength(body),'--input','-'],{input:body,stdio:['pipe','ignore','pipe']});
 console.log(release.html_url);process.exit(0);
}
if(mode==='verify-deploy'){
 const check=await json(resolve(out,'checks.json'));
 assert(check.passed);assert.deepEqual(check.commits,commits);
 const approved=await loadProductionApproval();
 assert.equal(commits.source,approved.plan.source_sha);assert.equal(commits.target,approved.plan.studio_sha);
 assert.equal(version,approved.plan.version);assertProductionSource({root,baseline:await json(resolve(out,'baseline.json')),plan:approved.plan});
 assert.equal(check.pendingMigrations.length,0,'New database migrations require a separate reviewed upgrade; this job never silently applies hosted SQL');
 assert.notEqual(version,check.baselineVersion,'Already deployed version; prepare a new frozen release first');
 for(const name of ['CLOUDFLARE_SOURCE_API_TOKEN','CLOUDFLARE_STUDIO_API_TOKEN'])assert(process.env[name],name+' must be saved in the production GitHub environment');
 await save('github-verification.json',{source:{commit:commits.source,githubVerified:true},target:{commit:commits.target,githubVerified:true}});
 console.log(JSON.stringify({ready:true,version,commits,hostedSQL:0}));process.exit(0);
}
assert.equal(mode,'check');
const release=gh('/repos/MaktabForlife/AcademyStudio/releases/latest');
const asset=release.assets.find(a=>a.name==='paired-release.json');assert(asset&&asset.size<32768,'A verified paired GitHub release receipt is required');
const receipt=JSON.parse(execFileSync('gh',['api','/repos/MaktabForlife/AcademyStudio/releases/assets/'+asset.id,'-H','Accept: application/octet-stream'],{encoding:'utf8'}));
let baseline=receipt;
 if(receipt.version!==version){
  try{const record=await json(resolve(studio,'release/production-baseline-v'+version+'.json'));baseline=recoveredBaseline(receipt,record,version);}
  catch(error){if(error.code!=='ENOENT')throw error;}
 }
assert(/^\d+\.\d+$/.test(baseline.version));for(const side of ['source','studio'])assert(/^[a-f0-9]{40}$/.test(baseline[side].commit));
await save('baseline.json',baseline);
const pendingMigrations=[];
for(const [side,dir]of Object.entries(dirs)){
 const base=baseline[side==='source'?'source':'studio'].commit;
 const names=git(dir,'diff','--name-only',base+'..HEAD').split('\n').filter(Boolean);
 for(const name of names){
  assert(!/(^|\/)(?:\.env|\.dev\.vars|\.wrangler|\.build|node_modules|outputs|recovery|backups?)(?:\/|$|\.)/i.test(name),'Private working path in GitHub change: '+name);
  if(/(^|\/)migrations\/.*\.sql$/.test(name))pendingMigrations.push({side,path:name});
 }
 const scan=spawnSync(process.env.GITLEAKS_BIN,['git','--log-opts='+base+'..HEAD','--no-banner','--redact','--report-format','json','--report-path',resolve(out,side+'-scan.json'),'--log-level','error'],{cwd:dir,encoding:'utf8'});
 assert([0,1].includes(scan.status),'Credential scanner could not finish');
 const findings=await json(resolve(out,side+'-scan.json'));
 const blocked=[];
 for(const f of findings){
  // Exact public integrity hashes may resemble secrets. Verify their file bytes.
  const content=git(dir,'show',f.Commit+':'+f.File).split('\n')[f.StartLine-1]||'';
  const m=f.File.match(/^release\/(?:v(\d+\.\d+)\/)?manifest\.json$/);
  const pair=content.match(/^\s*"([^"]+)": "([a-f0-9]{64})",?$/);
  let publicValue=false;
  if(m&&pair)publicValue=sha(await readFile(resolve(dir,'release/v'+(m[1]||version)+'/public',pair[1])))===pair[2];
  if(side==='source'&&f.File==='portal/provenance.json'&&pair&&/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(pair[1])&&!pair[1].split('/').includes('..')){
   const recorded=JSON.parse(git(dir,'show',f.Commit+':'+f.File));
   const bytes=execFileSync('git',['show',f.Commit+':portal/'+pair[1]],{cwd:dir});
   publicValue=recorded.upstream==='MaktabForlife/AcademyStudio'&&recorded.privateMediaCopied===false&&recorded.manifest[pair[1]]===pair[2]&&sha(bytes)===pair[2];
  }
  // These exact lines contain storage identifiers/accessors, not credentials.
  if(/(?:^|\/)m4l-academy-(?:history|progress)\.js$/.test(f.File)&&["da4b73c0e4887323a7bac1b1b9ffbf00bf63649ab24b5f3362f624d0628be0b7","fda1b2bf2e8787fd53d53d29a9e7670ff83a6a9cc8b22ca7f63d64acd18a0754"].includes(sha(content.trim())))publicValue=true;
  if(f.File==='tools/cloud-release-check.mjs'&&["11bd93b2ce5afe79c3d4cb8a99993fd210c706934e421dc398df9b9d0299311a","b1f7353e27116a3c628cc80b31031c19af4a5774c541ef1c584dc3c412122302"].includes(sha(content.trim())))publicValue=true;
  // Exact reviewed SQL identifiers only; altered values/files/rules still fail.
  if(reviewedSQLIdentifierFinding(f,content))publicValue=true;
  if(!publicValue)blocked.push({file:f.File,line:f.StartLine,rule:f.RuleID});
 }
 assert.equal(blocked.length,0,'Credential review required: '+JSON.stringify(blocked));
}
await save('source-assets.json',manifests.source);await save('studio-assets.json',manifests.target);
const rollbackManifest=await json(resolve(source,'release/v'+baseline.version+'/manifest.json'));
const scope={version,source:'work/Academy',studio:'work/AcademyStudio',baseline:{source:{...baseline.source,coordinatorVersion:baseline.coordinatorVersion},studio:baseline.studio},hosting:await json(resolve(source,'config/hosting.json')),baselineBindings:baseline.bindings||{source:43,coordinator:3,studio:17},rollback:{pagesArtifact:resolve(source,'release/v'+baseline.version+'/public'),pagesManifest:{files:Object.keys(rollbackManifest.manifest).length,manifest:rollbackManifest.manifest}},databaseUpdates:[]};
await save('approval-and-scope.json',scope);
async function run(dir,args,file){
 const r=spawnSync(process.execPath,args,{cwd:dir,encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,ACADEMY_SOURCE:source}});
 await writeFile(resolve(out,file),r.stdout+'\n'+r.stderr);
 const lines=(r.stdout+'\n'+r.stderr).split('\n'),failures=lines.flatMap((line,i)=>/not ok|error:|ERR_|failureType/.test(line)?lines.slice(Math.max(0,i-2),i+28):[]).join('\n');
 assert.equal(r.status,0,file+' failed: '+(failures||r.stderr||r.stdout).slice(0,10000));
 return writeFile(resolve(out,file),r.stdout+'\n'+r.stderr);
}
await run(source,['--test','--test-reporter=tap','backend/tests/academy-workspace-client.test.mjs','backend/tests/academy-workspace-destination.test.mjs','backend/tests/academy-header-workspaces.test.mjs'],'academy-tests.log');
await run(studio,['--test','--test-reporter=tap','--test-concurrency=1','tests/source-package.test.mjs','tests/private-playlist-reference.test.mjs','tests/private-playlist-reference-ui.test.mjs','tests/private-playlist-reference-monthly-proxy.test.mjs','tests/monthly-media-review-ui.test.mjs','tests/course-playlist-workflow.test.mjs','tests/monthly-media-collection.test.mjs','tests/dashboard-load.test.mjs','tests/circles-dashboard-consumer.test.mjs'],'paired-media-tests.log');
await run(source,['--test','--test-reporter=tap','backend/tests/portal-hosting.test.mjs','backend/tests/academy-circles-native.test.mjs','backend/tests/academy-circles-native-join.test.mjs','backend/tests/academy-circles-free-join.test.mjs','backend/tests/academy-hifz-handoff.test.mjs','backend/tests/academy-hifz-bridge-ui.test.mjs'],'portal-source-tests.log');
await run(studio,['--test','--test-reporter=tap','--test-concurrency=1','tests/deployment-origin-config.test.mjs','tests/website-routing.test.mjs','tests/website-launch.test.mjs','tests/academy-origins.test.mjs','tests/native-hub-bridge.test.mjs','tests/academy-connect.test.mjs','tests/native-portal-paired.test.mjs','tests/native-portal-browser.test.mjs'],'portal-paired-tests.log');
await run(source,['--test','--test-reporter=tap','backend/tests/academy-programme-prospectus.test.mjs','backend/tests/academy-announcements-client.test.mjs','backend/tests/academy-announcements-split.test.mjs','backend/tests/academy-announcements-v2.test.mjs'],'homepage-contract-tests.log');
await run(studio,['tools/prepare-studio-saas.mjs'],'studio-hosting-preparation.log');
await run(studio,['--test','--test-reporter=tap','--test-concurrency=1','tests/studio-saas.test.mjs'],'studio-hosting-tests.log');
function totals(t){const n=key=>Number(t.match(new RegExp('^# '+key+' (\\d+)$','m'))?.[1]);const v={tests:n('tests'),pass:n('pass'),fail:n('fail')};assert(v.tests>0&&v.tests===v.pass&&v.fail===0);return v;}
const localTests={homepage:totals(await readFile(resolve(out,'homepage-contract-tests.log'),'utf8')),studioHosting:totals(await readFile(resolve(out,'studio-hosting-tests.log'),'utf8')),portalSource:totals(await readFile(resolve(out,'portal-source-tests.log'),'utf8')),portalPaired:totals(await readFile(resolve(out,'portal-paired-tests.log'),'utf8')),academyUI:totals(await readFile(resolve(out,'academy-tests.log'),'utf8')),pairedMedia:totals(await readFile(resolve(out,'paired-media-tests.log'),'utf8'))};
await save('local-acceptance.json',{localTests,hostedSQL:0,hostedLogins:0});
await run(studio,['tools/check-paired-static.mjs',version],'static-routes.log');
const config=await json(resolve(studio,'wrangler.production.jsonc'));
const entries=[resolve(studio,config.main),resolve(source,'backend/src/academy/d1/worker.js'),resolve(source,'release/v'+version+'/public/_worker.js'),resolve(studio,'release/v'+version+'/public/api.mjs'),resolve(source,'release/v'+version+'/public/js/m4l-course-media-view.mjs')];
const builds=[];for(const e of entries){const r=await build({entryPoints:[e],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['cloudflare:*','node:*'],logLevel:'silent'});builds.push({entry:relative(root,e),bytes:r.outputFiles.reduce((n,f)=>n+f.contents.length,0),warnings:r.warnings.length});}
await save('bundle-checks.json',{passed:true,builds});
await save('github-verification.json',{source:{commit:commits.source,githubVerified:true},target:{commit:commits.target,githubVerified:true}});
const check={passed:true,version,commits,baselineVersion:baseline.version,pendingMigrations,localTests,staticRoutes:50,hostedRequests:0,hostedSQL:0};
await save('checks.json',check);
if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'source_sha='+commits.source+'\nstudio_sha='+commits.target+'\nversion='+version+'\n');
console.log(JSON.stringify(check));
