import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {validatePlan,evaluateApproval,resolveApproval,freshApproval,githubClient,assertProductionSource,assertFeatureComparison,routeApproved} from '../tools/approved-deployment.mjs';
const repo='MaktabForlife/AcademyStudio',head='a'.repeat(40),mergeSha='b'.repeat(40),tree='c'.repeat(40),old='d'.repeat(40);
const path='deployment/release-plan.json';
function fixture(){
 const plan={schema:1,request:'synthetic-release',kind:'release',target:'production',contains_jwt:false,database_changes:false,version:'109.26',source_sha:'e'.repeat(40),studio_sha:'f'.repeat(40)};
 const pr={number:7,changed_files:1,state:'closed',merged:true,merged_at:'2026-11-06T01:00:00Z',merge_commit_sha:mergeSha,base:{ref:'studio_dev',repo:{full_name:repo}},head:{sha:head},merged_by:{login:'MaktabForlife'},html_url:'https://github.com/'+repo+'/pull/7'};
 const comment={id:42,user:{login:'MaktabForlife'},created_at:'2026-11-06T00:59:00Z',body:'Optimisation approval\nhead: '+head+'\ntarget: production\ndb-changes: none\nSynthetic evidence.'};
 const statuses=[{id:12,context:'optimisation/approval',state:'success',creator:{login:'MaktabForlife'},created_at:'2026-11-06T00:59:30Z',description:'optimisation-record-sha256:'+createHash('sha256').update(comment.body).digest('hex'),target_url:pr.html_url+'#issuecomment-42'}];
 return {repo,mergeSha,currentSha:mergeSha,pr,merge:{sha:mergeSha,tree:{sha:tree}},head:{sha:head,tree:{sha:tree}},statuses,plan,files:[path],comment};
}
test('approved merged exact tree selects pinned non-JWT production pair',()=>{
 const f=fixture(),p=evaluateApproval(f);assert.equal(p.plan.target,'production');assert.equal(p.headSha,head);assert.equal(p.plan.source_sha,f.plan.source_sha);
});
for(const [name,change]of [
 ['unmerged PR',f=>f.pr.merged=false],['open PR',f=>f.pr.state='open'],
 ['different merged commit',f=>f.pr.merge_commit_sha=old],['new canonical commit',f=>f.currentSha=old],
 ['wrong base branch',f=>f.pr.base.ref='main'],['wrong base repository',f=>f.pr.base.repo.full_name='other/repo'],
 ['wrong merger',f=>f.pr.merged_by.login='other'],['changed merged tree',f=>f.merge.tree.sha=old],
 ['different reviewed head',f=>f.head.sha=old],['absent approval',f=>f.statuses=[]],
 ['pending approval',f=>f.statuses[0].state='pending'],['failed approval',f=>f.statuses[0].state='failure'],
 ['other approval actor',f=>f.statuses[0].creator.login='other'],
 ['approval after merge',f=>f.statuses[0].created_at='2026-11-06T01:01:00Z'],
 ['wrong approval record',f=>f.statuses[0].target_url=f.pr.html_url+'#issuecomment-99'],
 ['other comment author',f=>f.comment.user.login='other'],
 ['edited approval record',f=>f.comment.updated_at='2026-11-06T01:01:00Z'],
 ['wrong approved head in comment',f=>f.comment.body=f.comment.body.replace(head,old)],
 ['wrong approved target in comment',f=>f.comment.body=f.comment.body.replace('target: production','target: feature')],
 ['absent no-DB commitment',f=>f.comment.body=f.comment.body.replace('db-changes: none','db-changes: yes')],
 ['newer failed status despite older success',f=>f.statuses.unshift({...f.statuses[0],id:13,state:'failure'})],
 ['plan not changed by this PR',f=>f.files=['docs/readme.md']],
 ['database authorisation flag',f=>f.plan.database_changes=true],
 ['migration in PR',f=>f.files.push('migrations/0024.sql')],
 ['seed in PR',f=>f.files.push('backend/seeds/new.sql')],
 ['JWT mislabeled as production',f=>f.plan.contains_jwt=true],
 ['known V110 path mislabeled',f=>f.files.push('src/auth/v110/session.mjs')],
 ['invalid source selector',f=>f.plan.source_sha='studio_dev'],
 ['unknown plan field',f=>f.plan.unreviewed=true]
])test('reject '+name,()=>{const f=fixture();change(f);assert.throws(()=>evaluateApproval(f));});
test('JWT release is only Feature and V110 or newer in Academy',()=>{
 const p={schema:1,request:'jwt-review',kind:'release',target:'feature',contains_jwt:true,database_changes:false,version:'110.0',feature_sha:head,feature_base_sha:old};
 assert.equal(validatePlan(p,'MaktabForlife/Academy',[path,'backend/src/auth/v110/a.js']).target,'feature');
 assert.throws(()=>validatePlan(p,repo,[path]));assert.throws(()=>validatePlan({...p,version:'109.25'},'MaktabForlife/Academy',[path]));
 assert.throws(()=>validatePlan({...p,target:'production'},'MaktabForlife/Academy',[path]));
});
test('configuration-only PR cannot include application code or deployment target',()=>{
 const p={schema:1,request:'automation',kind:'configuration',target:'none',contains_jwt:false,database_changes:false};
 assert.equal(validatePlan(p,repo,[path,'.github/workflows/auto-deploy.yml']).kind,'configuration');
 assert.throws(()=>validatePlan(p,repo,[path,'src/worker.mjs']));
 assert.throws(()=>validatePlan({...p,target:'production'},repo,[path]));
});
test('component routes retain target classification without granting deployment',()=>{
 const p={schema:1,request:'component',kind:'component',target:'feature',contains_jwt:true,database_changes:false};
 assert.equal(validatePlan(p,repo,[path,'src/auth/v110/reader.mjs']).kind,'component');
});
function apiFixture(f=fixture()){
 const calls=[];
 const api=async(p)=>{
  calls.push(p);
  if(p.includes('/commits/'+mergeSha+'/pulls'))return [f.pr];
  if(p.endsWith('/pulls/7'))return f.pr;
  if(p.includes('/pulls/7/files'))return f.fileChanges||f.files.map(filename=>({filename}));
  if(p.includes('/statuses?'))return f.statuses;
  if(p.endsWith('/git/ref/heads/studio_dev'))return {object:{sha:f.currentSha}};
  if(p.endsWith('/git/commits/'+mergeSha))return f.merge;
  if(p.endsWith('/git/commits/'+head))return f.head;
  if(p.includes('/contents/'+path))return {size:1024,encoding:'base64',content:Buffer.from(JSON.stringify(f.plan)).toString('base64')};
  if(p.endsWith('/issues/comments/42'))return f.comment;
  throw Error('Unexpected synthetic API path: '+p);
 };return {api,calls,f};
}
test('actual API composition reads immutable plan and proof without Cloudflare or DB requests',async()=>{
 const f=apiFixture(),proof=await resolveApproval({repo,mergeSha,api:f.api});
 assert.equal(proof.plan.studio_sha,f.f.plan.studio_sha);assert(f.calls.length<20);
 assert(f.calls.every(p=>p.startsWith('/repos/MaktabForlife/')));
});
test('ambiguous merged PR association is rejected',async()=>{
 const f=apiFixture();await assert.rejects(resolveApproval({repo,mergeSha,api:async p=>p.includes('/pulls?')?[f.f.pr,f.f.pr]:f.api(p)}));
});
test('missing approval URL is rejected before reading unrelated records',async()=>{
 const f=apiFixture();delete f.f.statuses[0].target_url;await assert.rejects(resolveApproval({repo,mergeSha,api:f.api}));
});
test('each write freshness check rejects new canonical work, changed status or changed record',async()=>{
 const f=apiFixture(),proof=evaluateApproval(f.f);assert(await freshApproval(proof,f.api));
 f.f.currentSha=old;await assert.rejects(freshApproval(proof,f.api));f.f.currentSha=mergeSha;
 f.f.statuses[0].id=14;await assert.rejects(freshApproval(proof,f.api));f.f.statuses[0].id=12;
 f.f.comment.body+='Withdrawn';await assert.rejects(freshApproval(proof,f.api));
});
test('GitHub client is restricted to repository API and safe bounded diagnostics',async()=>{
 const requests=[];const api=githubClient('synthetic-only',async(url,options)=>{requests.push({url,method:options.method});return Response.json({ok:true});});
 assert.deepEqual(await api('/repos/MaktabForlife/Academy/pulls/1'),{ok:true});
 await assert.rejects(api('/accounts/anything/d1/query'));assert.equal(requests.length,1);
 assert(requests[0].url.startsWith('https://api.github.com/repos/MaktabForlife/'));
});
async function productionFixture(change,beforeBase){
 assert.equal(process.env.GITHUB_ACTIONS,'true');
 const root=await mkdtemp(resolve(process.env.RUNNER_TEMP,'approved-production-'));
 const git=(dir,...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',env:{...process.env,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1'}}).trim();
 const commits={};
 for(const [side,folder]of [['source','Academy'],['studio','AcademyStudio']]){
  const dir=resolve(root,'work',folder);await mkdir(dir,{recursive:true});git(dir,'init','-q');git(dir,'config','user.email','synthetic@example.invalid');git(dir,'config','user.name','Synthetic');
  const config=side==='source'?'backend/wrangler.jsonc':'wrangler.production.jsonc';
  await mkdir(resolve(dir,'backend'),{recursive:true});await mkdir(resolve(dir,'src'),{recursive:true});
  const binding={vars:{RELEASE_VERSION:'109.25',MODE:'same'},d1_databases:[{binding:'DB',database_id:'synthetic-db'}]};
  await writeFile(resolve(dir,config),JSON.stringify(binding));await writeFile(resolve(dir,'src/worker.mjs'),'export default {fetch(){return new Response("same")}};\n');
  if(beforeBase)await beforeBase({side,dir,config,binding});
  git(dir,'add','.');git(dir,'commit','-qm','synthetic baseline');const base=git(dir,'rev-parse','HEAD');
  if(change)await change({side,dir,config,binding});
  else {binding.vars.RELEASE_VERSION='109.26';await writeFile(resolve(dir,config),JSON.stringify(binding));}
  git(dir,'add','.');git(dir,'commit','--allow-empty','-qm','synthetic candidate');
  commits[side]={commit:base,candidate:git(dir,'rev-parse','HEAD')};
 }
 return {root,baseline:{source:{commit:commits.source.commit},studio:{commit:commits.studio.commit}},plan:{version:'109.26',source_sha:commits.source.candidate,studio_sha:commits.studio.candidate}};
}
test('production guard checks actual pinned Git trees and permits version-only metadata',async()=>{
 assert(assertProductionSource(await productionFixture()));
});
for(const [name,change]of [
 ['new migration',async({dir})=>{await mkdir(resolve(dir,'migrations'));await writeFile(resolve(dir,'migrations/0002.sql'),'CREATE TABLE synthetic_only(id);');}],
 ['root Academy auth/v110',async({dir})=>{await mkdir(resolve(dir,'auth/v110'),{recursive:true});await writeFile(resolve(dir,'auth/v110/browser-entry.mjs'),'export const enabled=false;');}],
 ['root js V110 import',async({dir})=>{await mkdir(resolve(dir,'js'),{recursive:true});await writeFile(resolve(dir,'js/start.mjs'),"import '../auth/v110/session.mjs';");}],
 ['root functions runtime DDL',async({dir})=>{await mkdir(resolve(dir,'functions'),{recursive:true});await writeFile(resolve(dir,'functions/api.mjs'),'const ddl="CREATE TABLE synthetic_only(id)";');}],
 ['publisher runtime DDL',async({dir})=>{await mkdir(resolve(dir,'backend/tools'),{recursive:true});await writeFile(resolve(dir,'backend/tools/academy-site.mjs'),'const ddl="CREATE TABLE synthetic_only(id)";');}],
 ['V110 runtime anywhere in candidate',async({dir})=>{await mkdir(resolve(dir,'src/auth/v110'),{recursive:true});await writeFile(resolve(dir,'src/auth/v110/read.mjs'),'export const enabled=false;');}],
 ['runtime DDL',async({dir})=>writeFile(resolve(dir,'src/worker.mjs'),'const ddl="CREATE TABLE synthetic_only(id)";\n')],
 ['storage rebind',async({dir,config,binding})=>{binding.d1_databases[0].database_id='different';await writeFile(resolve(dir,config),JSON.stringify(binding));}],
 ['activation variable change',async({dir,config,binding})=>{binding.vars.MODE='changed';await writeFile(resolve(dir,config),JSON.stringify(binding));}],
 ['V110 in active frozen public tree',async({dir})=>{await mkdir(resolve(dir,'release/v109.26/public/auth/v110'),{recursive:true});await writeFile(resolve(dir,'release/v109.26/public/auth/v110/session.mjs'),'export const enabled=false;');}]
])test('actual production tree guard rejects '+name,async()=>{const f=await productionFixture(change);assert.throws(()=>assertProductionSource(f));});
test('historical inactive release assets do not become a production runtime gate',async()=>{
 const f=await productionFixture(async({dir})=>{await mkdir(resolve(dir,'release/v110.0/public/auth/v110'),{recursive:true});await writeFile(resolve(dir,'release/v110.0/public/auth/v110/old.mjs'),'archived');});
 assert(assertProductionSource(f));
});

test('approval record edited after success but before merge is rejected',()=>{
 const f=fixture();f.comment.updated_at='2026-11-06T00:59:45Z';f.comment.body+='\nWithdrawal';
 assert.throws(()=>evaluateApproval(f),/changed after its successful status/);
});
test('same-second changed approval body is rejected by the immutable status hash',()=>{
 const f=fixture();f.comment.updated_at=f.statuses[0].created_at;f.comment.body+='\nChanged within timestamp granularity';
 assert.throws(()=>evaluateApproval(f),/not bound to this exact approval record/);
});
for(const [name,change]of [
 ['embedded head line',s=>s.replace('head: '+head,'not-head: '+head)],
 ['embedded target line',s=>s.replace('target: production','not-target: production')],
 ['duplicate target',s=>s+'\ntarget: feature'],
 ['duplicate head',s=>s+'\nhead: '+old]
])test('approval record rejects '+name+' even with a matching hash',()=>{
 const f=fixture();f.comment.body=change(f.comment.body);
 f.statuses[0].description='optimisation-record-sha256:'+createHash('sha256').update(f.comment.body).digest('hex');
 assert.throws(()=>evaluateApproval(f));
});
test('actual API resolver preserves previous filename and rejects renamed migration',async()=>{
 const f=apiFixture();f.f.pr.changed_files=2;
 f.f.fileChanges=[{filename:path},{filename:'docs/retained.txt',previous_filename:'backend/migrations/0024.sql',status:'renamed'}];
 await assert.rejects(resolveApproval({repo,mergeSha,api:f.api}),/Database/);
});
test('Feature comparison rejects renamed migration and active runtime renamed as configuration',()=>{
 const base={status:'ahead',behind_by:0};
 assert.throws(()=>assertFeatureComparison({...base,files:[{filename:'docs/retained.txt',previous_filename:'migrations/0024.sql'}]},{kind:'release'}),/database/);
 assert.throws(()=>assertFeatureComparison({...base,files:[{filename:'tools/retained.mjs',previous_filename:'js/active.mjs'}]},{kind:'configuration'}),/application/);
});
test('actual Git rename cannot hide an existing migration path',async()=>{
 const f=await productionFixture(
  async({dir})=>{await mkdir(resolve(dir,'docs'));await rename(resolve(dir,'migrations/0001.sql'),resolve(dir,'docs/retained.txt'));},
  async({dir})=>{await mkdir(resolve(dir,'migrations'));await writeFile(resolve(dir,'migrations/0001.sql'),'CREATE TABLE existing_synthetic(id);\n');}
 );
 assert.throws(()=>assertProductionSource(f),/database/);
});

function componentFixture(target='development'){
 const f=fixture();f.plan={schema:1,request:'ui-development-component',kind:'component',target,contains_jwt:false,database_changes:false};
 f.comment.body=f.comment.body.replace('target: production','target: '+target);
 f.statuses[0].description='optimisation-record-sha256:'+createHash('sha256').update(f.comment.body).digest('hex');
 return f;
}
test('Development component in either repository records exact approval and routes none with zero dispatch',async()=>{
 for(const selectedRepo of ['MaktabForlife/Academy','MaktabForlife/AcademyStudio']){
  const f=componentFixture();f.repo=selectedRepo;f.pr.base.repo.full_name=selectedRepo;
  f.pr.html_url='https://github.com/'+selectedRepo+'/pull/7';f.statuses[0].target_url=f.pr.html_url+'#issuecomment-42';
  const proof=evaluateApproval(f);let apiCalls=0;
  const result=await routeApproved(proof,async()=>{apiCalls++;throw Error('No dispatch allowed');});
  assert.equal(result.route,'none');assert.equal(result.plan.target,'development');assert.equal(apiCalls,0);
  assert.equal(result.cloudflareCalls,0);assert.equal(result.hostedDatabaseCalls,0);
 }
});
test('Development release fails closed in validation and routing without production fallback',async()=>{
 const f=fixture();f.plan.target='development';
 assert.throws(()=>validatePlan(f.plan,repo,[path]),/Development release routing is not installed/);
 let calls=0;await assert.rejects(routeApproved({plan:f.plan},async()=>{calls++;}),/Development release routing is not installed/);
 assert.equal(calls,0);
});
test('JWT cannot target Development as component or release',()=>{
 for(const kind of ['component','release'])assert.throws(()=>validatePlan({...componentFixture().plan,kind,contains_jwt:true},'MaktabForlife/Academy',[path]),/JWT is Feature only/);
});
test('Development is not configuration and never weakens the no-DB gate',()=>{
 const p=componentFixture().plan;
 assert.throws(()=>validatePlan({...p,kind:'configuration'},repo,[path]));
 assert.throws(()=>validatePlan({...p,database_changes:true},repo,[path]),/Database changes/);
 assert.throws(()=>validatePlan(p,repo,[path,'migrations/0001.sql']),/Database/);
});
test('established production release and all components retain existing dispatch behavior',async()=>{
 for(const target of ['production','feature','development']){
  const f=componentFixture(target);f.plan.contains_jwt=target==='feature';
  const p=evaluateApproval(f);const result=await routeApproved(p,async()=>{throw Error('No component dispatch');});assert.equal(result.route,'none');
 }
 const result=await routeApproved(evaluateApproval(fixture()),async()=>{throw Error('Production dispatch belongs to target-owning workflow');});
 assert.equal(result.route,'production');assert.equal(result.plan.contains_jwt,false);
});
