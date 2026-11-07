// Disposable GitHub source/package checks only. No deploy, ref write or status API.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {registry,digest,selectComponent,assertContext,assertSafeEnvironment,preflightPair,assertRetainedVersionState,assertSelectionBinding,assertSourcePreservation} from './development-component-selection.mjs';
import {githubClient} from './approved-deployment.mjs';
const control=resolve(new URL('..',import.meta.url).pathname);
const root=resolve(process.env.GITHUB_WORKSPACE||'.'),out=resolve(process.env.RUNNER_TEMP||'/invalid','development-component-check');
const statePath=join(out,'component.json'),api=()=>githubClient(process.env.GH_TOKEN);
const git=(dir,...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=value=>{mkdirSync(out,{recursive:true});writeFileSync(statePath,JSON.stringify(value,null,2)+'\n');};
const input=side=>resolve(root,'input',side),work=side=>resolve(root,'work',side);
const repoFor=side=>'MaktabForlife/'+side;
function context(){
 assert.equal(process.env.GITHUB_ACTIONS,'true','GITHUB_ONLY');assertSafeEnvironment(process.env);
 const event=process.env.GITHUB_EVENT_PATH?read(process.env.GITHUB_EVENT_PATH):{};
 return {event:process.env.GITHUB_EVENT_NAME,repository:process.env.GITHUB_REPOSITORY,ref:process.env.GITHUB_REF,proposalOnly:process.env.COMPONENT_PROPOSAL_ONLY==='true',prNumber:Number(process.env.COMPONENT_PR),eventPR:event.pull_request};
}
async function fresh(selected){
 const pr=await api()('/repos/'+selected.repository+'/pulls/'+selected.pr);
 assert.equal(pr.state,'open','PR_CLOSED');assert.equal(pr.head.sha,selected.actualSourceSha,'PR_SOURCE_CHANGED');
 assert.equal(pr.head.repo.full_name,selected.repository,'FORK_SOURCE');
}
function roleRefs(selected){
 return Object.fromEntries(['Academy','AcademyStudio'].map(side=>[side,selected.repository===repoFor(side)?selected.actualSourceSha:selected.counterpart.sha]));
}
function controlGuard(){
 const expected=context().proposalOnly?process.env.GITHUB_SHA:process.env.COMPONENT_CONTROL_REF;
 assert.match(expected||'',/^[a-f0-9]{40}$/,'IMMUTABLE_CONTROL_REQUIRED');assert.equal(git(control,'rev-parse','HEAD'),expected,'CONTROL_SOURCE_CHANGED');
 assert.equal(git(control,'status','--porcelain'),'','CONTROL_DIRTY');
 return {repository:'MaktabForlife/AcademyStudio',sha:expected,tree:git(control,'rev-parse','HEAD^{tree}')};
}
function guards(selected){
 assertContext(context());assertSafeEnvironment(process.env);controlGuard();
 const sourceSha=context().proposalOnly?process.env.COMPONENT_EXPECTED_SOURCE:context().eventPR.head.sha;
 assertSelectionBinding(selected,{repository:process.env.COMPONENT_REPO,prNumber:Number(process.env.COMPONENT_PR),sourceSha});
 assert.equal(git(resolve(root,'checker'),'rev-parse','HEAD'),selected.checker.sha,'CHECKER_SOURCE_CHANGED');
 assert.equal(git(resolve(root,'checker'),'status','--porcelain'),'','CHECKER_DIRTY');
 const refs=roleRefs(selected);
 for(const side of Object.keys(refs)){
  assert.equal(git(input(side),'rev-parse','HEAD'),refs[side],'INPUT_SOURCE_CHANGED');
  assert.equal(git(input(side),'remote','get-url','origin').replace(/\.git$/,''),'https://github.com/'+repoFor(side),'INPUT_REPO_CHANGED');
  assert.equal(git(input(side),'status','--porcelain'),'','INPUT_DIRTY');
 }
}
function blob(dir,path){return git(dir,'rev-parse','HEAD:'+path);}
function retainedTree(dir){const row=git(dir,'ls-tree','-d','HEAD','--','release/v109.25');return row?row.split(/\s+/)[2]:null;}
function changedBytes(dir,path,bytes,transforms,kind){
 const before=readFileSync(join(dir,path)),beforeBlob=blob(dir,path);writeFileSync(join(dir,path),bytes);
 transforms.push({path,kind,beforeBlob,beforeSHA256:digest(before),afterSHA256:digest(bytes)});
}
function versionJson(dir,path,transforms){
 const old=readFileSync(join(dir,path),'utf8'),data=JSON.parse(old),copy=structuredClone(data);
 assert.equal(data.version,'109.25','EXPECTED_ORIGINAL_VERSION');copy.version='109.27';
 changedBytes(dir,path,JSON.stringify(copy,null,2)+'\n',transforms,'VERSION_FIELD_ONLY');
}
function versionCode(dir,path,from,to,transforms){
 const old=readFileSync(join(dir,path),'utf8');assert.equal(old.split(from).length,2,'EXACT_VERSION_STAMP_REQUIRED');
 changedBytes(dir,path,old.replace(from,to),transforms,'EXACT_VERSION_LITERAL_ONLY');
}
async function freeze(side,selected,progress=()=>{}){
 progress('READ_RETAINED_METADATA');
 const dir=work(side),original=git(dir,'rev-parse','HEAD'),priorTree=retainedTree(dir),transforms=[];
 const current=read(join(dir,'release/current.json')),version=selected.version;
 const priorManifestPath=existsSync(join(dir,'release/v109.25/manifest.json'))?'release/v109.25/manifest.json':current.version==='109.25'?'release/manifest.json':null;
 const priorManifest=priorManifestPath?{path:priorManifestPath,blob:blob(dir,priorManifestPath),sha256:digest(readFileSync(join(dir,priorManifestPath))),version:read(join(dir,priorManifestPath)).version}:null;
 let generated=false;
 if(current.version===version){
  assert(existsSync(join(dir,'release/v'+version+'/manifest.json')),'EXISTING_PACKAGE_REQUIRED');
 }else{
  assert.equal(current.version,'109.25','EXPECTED_RETAINED_VERSION');
  assert(!existsSync(join(dir,'release/v'+version)),'NEVER_OVERWRITE_FROZEN_CANDIDATE');
  progress('GENERATE_FROZEN_PACKAGE');
  if(side==='Academy'){
   versionJson(dir,'version.json',transforms);versionJson(dir,'js/version.json',transforms);
   versionCode(dir,'backend/tools/academy-site.mjs',"siteVersion='109.25'","siteVersion='109.27'",transforms);
   versionCode(dir,'backend/src/academy/d1/worker.js',"version:'109.25'","version:'109.27'",transforms);
   execFileSync(process.execPath,['tools/package-public-release.mjs',version],{cwd:dir,env:process.env,stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024});
  }else{
   const {buildStudioPackage}=await import(pathToFileURL(resolve(root,'checker/tools/build-studio-package.mjs')));
   const built=await buildStudioPackage({root:dir,version});
   writeFileSync(join(dir,'release/manifest.json'),JSON.stringify(built.manifest,null,2)+'\n');
   writeFileSync(join(dir,'release/current.json'),JSON.stringify({version,manifest:'release/manifest.json'},null,2)+'\n');
  }
  progress('VALIDATE_AND_COMMIT_GENERATED_PACKAGE');
  const allowed=path=>path.startsWith('release/v'+version+'/')||['release/current.json',...(side==='AcademyStudio'?['release/manifest.json']:transforms.map(x=>x.path))].includes(path);
  const changes=git(dir,'diff','--name-only').split('\n').filter(Boolean);assert(changes.every(allowed),'UNEXPECTED_PACKAGE_CHANGE');
  assert.equal(git(dir,'diff','--name-only','--','release/v109.25'),'','V10925_CHANGED');
  git(dir,'add','--force','--','release/v'+version);git(dir,'add','--','release/current.json',...(side==='AcademyStudio'?['release/manifest.json']:transforms.map(x=>x.path)));
  git(dir,'-c','user.name=Component check','-c','user.email=component-check@users.noreply.github.com','commit','-m','Ephemeral component check package; not a source approval');
  assert.equal(git(dir,'rev-parse','HEAD^'),original,'PACKAGE_PARENT_CHANGED');generated=true;
 }
 assert.equal(git(dir,'status','--porcelain'),'','PACKAGE_TREE_DIRTY');
 assertRetainedVersionState(priorTree,retainedTree(dir));
 const manifestPath='release/v'+version+'/manifest.json',manifest=read(join(dir,manifestPath));
 assert.equal(manifest.version,version);assert.equal(manifest.repository,repoFor(side));
 const names=git(dir,'diff','--name-only',original+'..HEAD').split('\n').filter(Boolean);
 assert(names.every(p=>p.startsWith('release/v'+version+'/')||['release/current.json','release/manifest.json',...transforms.map(x=>x.path)].includes(p)),'NONPACKAGE_TREE_CHANGED');
 return {repository:repoFor(side),actualInputSha:original,actualInputTree:git(input(side),'rev-parse','HEAD^{tree}'),generated,generatedPackageSha:git(dir,'rev-parse','HEAD'),generatedPackageTree:git(dir,'rev-parse','HEAD^{tree}'),manifestPath,manifestSHA256:digest(readFileSync(join(dir,manifestPath))),manifestSourceVersionCommit:manifest.sourceVersionCommit,publicFiles:Object.keys(manifest.manifest).length,retainedV10925Tree:priorTree,retainedV10925TreePresent:priorTree!==null,priorVersionManifest:priorManifest,transformations:transforms};
}
async function main(){
 const phase=process.argv[2];assert(['select','stage','package','check','verify'].includes(phase),'CHECK_ONLY_PHASE');
 assertContext(context());const adapter=controlGuard();
 if(phase==='select'){
  const repository=process.env.COMPONENT_REPO,prNumber=Number(process.env.COMPONENT_PR);
  assert(registry.components.some(x=>x.repository===repository&&x.pr===prNumber),'UNSELECTED_COMPONENT');const client=api();
  const pr=await client('/repos/'+repository+'/pulls/'+prNumber);const sourceSha=pr.head.sha;
  if(!context().proposalOnly){assert.equal(process.env.GITHUB_REPOSITORY,repository,'CALLER_REPO');assert.equal(context().eventPR.head.sha,sourceSha,'PR_EVENT_SOURCE_CHANGED');}
  if(process.env.COMPONENT_EXPECTED_SOURCE)assert.equal(sourceSha,process.env.COMPONENT_EXPECTED_SOURCE,'SOURCE_PIN_CHANGED');
  assert(pr.changed_files>0&&pr.changed_files<=1000,'BOUNDED_COMPONENT_FILES');
  const files=[];for(let page=1;files.length<pr.changed_files;page++){assert(page<=10);const rows=await client('/repos/'+repository+'/pulls/'+prNumber+'/files?per_page=100&page='+page);assert(rows.length,'INCOMPLETE_FILES');files.push(...rows);}
  assert.equal(files.length,pr.changed_files,'INCOMPLETE_FILES');
  const value=await client('/repos/'+repository+'/contents/deployment/release-plan.json?ref='+sourceSha);
  assert(value.encoding==='base64'&&value.size<16384,'PLAN_FORMAT');
  const selected=selectComponent({repository,prNumber,sourceSha,pr,plan:JSON.parse(Buffer.from(value.content,'base64').toString('utf8')),files});
  await fresh(selected);save({state:'SELECTED_SOURCE_ONLY',selected,adapter,proposalOnly:context().proposalOnly,approval:false,deployable:false});
  if(process.env.GITHUB_OUTPUT)for(const [side,ref]of Object.entries(roleRefs(selected)))writeFileSync(process.env.GITHUB_OUTPUT,side.toLowerCase()+'_sha='+ref+'\n',{flag:'a'});
  console.log(JSON.stringify({state:'SELECTED_SOURCE_ONLY',actualSource:{repository,pr:prNumber,sha:sourceSha},counterpart:selected.counterpart,checker:selected.checker,proposalOnly:context().proposalOnly,approval:false}));return;
 }
 const state=read(statePath),selected=state.selected;guards(selected);await fresh(selected);
 if(phase==='stage'){
  const academyView=readFileSync(join(input('Academy'),'js/m4l-course-media-view.mjs'),'utf8'),studioView=readFileSync(join(input('AcademyStudio'),'public/shared/course-media-workflow.mjs'),'utf8'),academyNative=readFileSync(join(input('Academy'),'portal-adapter/circles-sign-in.mjs'),'utf8');
  preflightPair({academyView,studioView,academyNative,requiresSameTab:selected.requiresSameTab});
  mkdirSync(resolve(root,'work'),{recursive:true});
  for(const [side,ref]of Object.entries(roleRefs(selected))){assert(!existsSync(work(side)),'FRESH_WORKTREE_REQUIRED');git(input(side),'worktree','add','--detach',work(side),ref);}
  state.state='EXACT_INPUTS_STAGED';save(state);return;
 }
 if(phase==='package'){
  assert.equal(state.state,'EXACT_INPUTS_STAGED','STAGE_REQUIRED');state.packages={};
  for(const side of ['Academy','AcademyStudio']){state.packages[side]=await freeze(side,selected,stage=>{state.packageSide=side;state.packageStage=stage;save(state);});save(state);}
  state.state='FROZEN_CHECK_PACKAGES_NOT_SOURCE_COMMITS';save(state);return;
 }
 assert.equal(state.state,'FROZEN_CHECK_PACKAGES_NOT_SOURCE_COMMITS','PACKAGE_REQUIRED');
 for(const side of ['Academy','AcademyStudio']){
  const dir=work(side),original=roleRefs(selected)[side];assert.equal(git(dir,'rev-parse','HEAD'),state.packages[side].generatedPackageSha,'PACKAGE_SOURCE_CHANGED');assert.equal(git(dir,'status','--porcelain'),'','PACKAGE_DIRTY');
  const changes=git(dir,'diff','--name-only',original+'..HEAD').split('\n').filter(Boolean);
  assertSourcePreservation({side,changes,readOriginal:path=>execFileSync('git',['show',original+':'+path],{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}),readCurrent:path=>readFileSync(join(dir,path),'utf8')});
 }
 if(phase==='check'){
  execFileSync(process.execPath,[resolve(root,'checker/tools/cloud-release-check.mjs'),'check'],{cwd:root,env:process.env,stdio:'inherit'});
  return;
 }
 const checked=read(resolve(process.env.M4L_RELEASE_OUTPUT,'checks.json'));
 assert.equal(checked.passed,true,'FULL_CHECK_REQUIRED');assert.equal(checked.version,selected.version,'VERSION_CHANGED');
 assert.deepEqual(checked.commits,{source:state.packages.Academy.generatedPackageSha,target:state.packages.AcademyStudio.generatedPackageSha},'CHECKED_PACKAGE_CHANGED');
 assert.deepEqual(checked.pendingMigrations,[],'NO_PENDING_MIGRATIONS');assert.equal(checked.hostedRequests,0);assert.equal(checked.hostedSQL,0);
 for(const side of ['Academy','AcademyStudio'])assert.equal(git(work(side),'rev-parse','HEAD'),state.packages[side].generatedPackageSha,'CHECKED_TREE_CHANGED');
 await fresh(selected);state.state='COMPONENT_CHECK_PASSED_NOT_APPROVAL';state.checks=checked;state.originalPRChecksReplaced=false;state.hostedDeployable=false;save(state);
 console.log(JSON.stringify({state:state.state,actualSourceSha:selected.actualSourceSha,counterpart:selected.counterpart,generatedPackageCommits:checked.commits,proposalOnly:state.proposalOnly,approval:false,deployable:false}));
}
try{await main();}catch(error){
 const known=['DEPENDENCY_ACADEMY_SAME_TAB','DEPENDENCY_EXACT_SHARED_MODULE','PR_SOURCE_CHANGED','SOURCE_PIN_CHANGED'];
 const reason=known.find(x=>String(error.message).includes(x))||'COMPONENT_CHECK_STOPPED';
 try{const state=existsSync(statePath)?read(statePath):{approval:false,deployable:false};state.state='BLOCKED_CHECK_ONLY';state.reason=reason;save(state);}catch{}
 console.error(reason);process.exitCode=1;
}
