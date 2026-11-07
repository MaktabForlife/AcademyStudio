// GitHub-only unreleased source packaging; no Cloudflare client, private environment or deployment.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const branch='validation/ui-integration-20261107',repo=process.env.GITHUB_REPOSITORY,version='109.27';
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REF,'refs/heads/'+branch);assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
assert(['MaktabForlife/Academy','MaktabForlife/AcademyStudio'].includes(repo));
const plan=JSON.parse(readFileSync('deployment/ui-integration-source.json','utf8'));
assert.equal(plan.repository,repo);assert.equal(plan.hostedOperations,0);assert.equal(plan.deployable,false);
const out=resolve(process.env.RUNNER_TEMP,'ui-integration-freeze');mkdirSync(out,{recursive:true});
const git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
const api=p=>JSON.parse(execFileSync('gh',['api',p],{encoding:'utf8',env:{...process.env,GH_TOKEN:process.env.GITHUB_TOKEN},stdio:['ignore','pipe','pipe']}));
const hash=b=>createHash('sha256').update(b).digest('hex');
const evidence={schema:1,state:'SOURCE_BUILD_STARTED',repository:repo,source:process.env.GITHUB_SHA,canonical:plan.canonical,version,hostedOperations:0,hostedDatabaseCalls:0,deployable:false};
const save=()=>writeFileSync(resolve(out,'freeze.json'),JSON.stringify(evidence,null,2)+'\n');save();
try{
 assert.equal(git('rev-parse','HEAD'),process.env.GITHUB_SHA);assert.equal(git('status','--porcelain'),'');
 for(const [r,sha]of Object.entries(plan.canonicals))assert.equal(api('repos/'+r+'/git/ref/heads/studio_dev').object.sha,sha,'CANONICAL_CHANGED');
 assert.equal(git('diff','--name-only',plan.canonical+'..HEAD','--','release/v109.25'),'','FROZEN_V10925_CHANGED');
 assert.equal(git('diff','--name-only',plan.canonical+'..HEAD','--',...plan.preservedControls),'','CANONICAL_CONTROLS_CHANGED');
 if(repo==='MaktabForlife/Academy'){
  execFileSync(process.execPath,['tools/package-public-release.mjs',version],{stdio:['ignore','pipe','pipe'],env:process.env,maxBuffer:8*1024*1024});
 }else{
  const {buildStudioPackage}=await import('./build-studio-package.mjs');
  const built=await buildStudioPackage({version});
  writeFileSync('release/manifest.json',JSON.stringify(built.manifest,null,2)+'\n');
  writeFileSync('release/current.json',JSON.stringify({version,manifest:'release/manifest.json'},null,2)+'\n');
 }
 const manifestPath='release/v'+version+'/manifest.json',manifest=JSON.parse(readFileSync(manifestPath));
 assert.equal(manifest.version,version);assert.equal(manifest.repository,repo);
 evidence.manifestSHA256=hash(readFileSync(manifestPath));evidence.publicFiles=Object.keys(manifest.manifest).length;
 git('add','--force','--','release/v'+version);git('add','--','release/current.json',...(repo.endsWith('/AcademyStudio')?['release/manifest.json']:[]));
 git('-c','user.name=GitHub Actions','-c','user.email=actions@users.noreply.github.com','commit','-m','Freeze exact unreleased V109.27 integration assets');
 assert.equal(git('status','--porcelain'),'','UNCOMMITTED_BUILD_CHANGE');
 for(const [r,sha]of Object.entries(plan.canonicals))assert.equal(api('repos/'+r+'/git/ref/heads/studio_dev').object.sha,sha,'CANONICAL_CHANGED_BEFORE_SOURCE_PUSH');
 assert.equal(api('repos/'+repo+'/git/ref/heads/'+branch).object.sha,process.env.GITHUB_SHA,'VALIDATION_SOURCE_CHANGED');
 const auth='AUTHORIZATION: basic '+Buffer.from('x-access-token:'+process.env.GITHUB_TOKEN).toString('base64');
 try{git('-c','http.https://github.com/.extraheader='+auth,'push','origin','HEAD:refs/heads/'+branch);}catch{throw Error('SOURCE_PUSH_FAILED');}
 evidence.state='FROZEN_VALIDATION_SOURCE_ONLY';evidence.frozenHead=git('rev-parse','HEAD');save();console.log(JSON.stringify(evidence));
}catch{evidence.state='SOURCE_FREEZE_STOPPED';save();console.error('SOURCE_FREEZE_STOPPED_NO_HOSTED_ACTION');process.exitCode=1;}
