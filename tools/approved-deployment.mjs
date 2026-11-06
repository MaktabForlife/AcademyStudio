// Reviewed PR provenance and target routing. GitHub API only; never D1 or Cloudflare.
import assert from 'node:assert/strict';
import {appendFile,readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const OWNER='MaktabForlife',ACADEMY=OWNER+'/Academy',STUDIO=OWNER+'/AcademyStudio';
export const PLAN_PATH='deployment/release-plan.json',APPROVAL_CONTEXT='optimisation/approval';
const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const automationPath=path=>/^(?:\.github\/|tools\/|backend\/tools\/|tests\/|backend\/tests\/|docs\/)/.test(path)||path===PLAN_PATH;
const databasePath=path=>!/(^|\/)(?:tests?|fixtures)\//.test(path)&&(/(^|\/)(?:migrations?|schema|seeds?|backfills?)(?:\/|[.-])/i.test(path)||/\.(?:sql|sqlite|db)$/i.test(path));
const controlPath=path=>new Set(['tools/approved-deployment.mjs','tools/approved-feature-setup.mjs','tools/cloud-release-check.mjs','tools/paired-release.mjs','tools/release-health.mjs','tools/release-safety.mjs','tools/archive-v10925-evidence.mjs']).has(path)||/^(?:\.github\/|docs\/|tests\/|backend\/tests\/|deployment\/)/.test(path);
export const activeRuntime=(path,version)=>!controlPath(path)&&(!path.startsWith('release/')||path.startsWith('release/v'+version+'/public/'));
const jwtRuntime=(path,version)=>activeRuntime(path,version)&&/(?:v110|jwt-v110)/i.test(path);
export function changedPaths(rows){
 return rows.flatMap(row=>{
  assert(typeof row.filename==='string'&&row.filename);
  return row.previous_filename?[row.previous_filename,row.filename]:[row.filename];
 });
}
export function assertFeatureComparison(comparison,plan){
 assert(['ahead','identical'].includes(comparison.status)&&comparison.behind_by===0,'Feature promotion must be a fast-forward');
 assert(comparison.files.length<300,'Feature comparison must be complete');
 const paths=changedPaths(comparison.files);
 assert(!paths.some(databasePath),'Feature database changes are prohibited, including renames');
 if(plan.kind==='configuration')assert(paths.every(automationPath),'Feature pipeline update includes application changes');
 return true;
}
export function validatePlan(plan,repo,files){
 assert([ACADEMY,STUDIO].includes(repo));assert(plan&&typeof plan==='object'&&!Array.isArray(plan));
 const keys=['schema','request','kind','target','contains_jwt','database_changes','version','source_sha','studio_sha','feature_sha','feature_base_sha'];
 assert(Object.keys(plan).every(k=>keys.includes(k)),'Unknown deployment plan field');
 for(const key of ['source_sha','studio_sha','feature_sha','feature_base_sha'])if(plan[key]!==undefined)assert(sha(plan[key]),'Invalid pinned commit: '+key);
 assert.equal(plan.schema,1);assert.match(plan.request||'',/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/);
 assert(['configuration','component','release'].includes(plan.kind));assert(['none','feature','production','development'].includes(plan.target));
 assert.equal(plan.database_changes,false,'Database changes are prohibited');
 assert.equal(typeof plan.contains_jwt,'boolean');
 assert(files.length>0&&files.includes(PLAN_PATH),'Each release PR must include a fresh reviewed plan');
 assert(!files.some(databasePath),'Database/schema/seed/backfill files require separate authorisation');
 if(files.some(path=>jwtRuntime(path,plan.version)))assert.equal(plan.contains_jwt,true,'Known V110 runtime paths cannot be classified non-JWT');
 if(plan.kind==='configuration'){
  assert.equal(plan.target,'none');assert.equal(plan.contains_jwt,false);
  assert(files.every(automationPath),'Configuration-only route includes application files');
  if(plan.feature_sha){assert.equal(repo,ACADEMY);assert(sha(plan.feature_sha)&&sha(plan.feature_base_sha));}
 }else{
  if(plan.contains_jwt)assert.equal(plan.target,'feature','JWT is Feature only');
  else if(plan.target==='development')assert.equal(plan.kind,'component','Development release routing is not installed; review the exact physical target first');
  else assert.equal(plan.target,'production','Non-JWT releases require the reviewed production route');
  if(plan.kind==='release'){
   assert.match(plan.version||'',/^\d+(?:\.\d+)?$/);
   if(plan.target==='feature'){
    assert.equal(repo,ACADEMY,'Academy owns the existing Feature credential');
    assert(sha(plan.feature_sha)&&sha(plan.feature_base_sha));
    assert(Number(plan.version.split('.')[0])>=110,'First JWT Feature deployment must be V110');
   }else{
    assert.equal(repo,STUDIO,'AcademyStudio owns paired production credentials');
    assert(sha(plan.source_sha)&&sha(plan.studio_sha));
   }
  }
 }
 return structuredClone(plan);
}
export function evaluateApproval({repo,mergeSha,currentSha,pr,merge,head,statuses,plan,files,comment}){
 assert(sha(mergeSha));assert.equal(currentSha,mergeSha,'A newer canonical commit exists');
 assert.equal(pr.state,'closed');assert(pr.merged_at&&pr.merged===true,'Only a merged PR can deploy');
 assert.equal(pr.merge_commit_sha,mergeSha);assert.equal(pr.base.ref,'studio_dev');
 assert.equal(pr.base.repo.full_name,repo);assert.equal(pr.merged_by.login,OWNER);
 assert.equal(merge.sha,mergeSha);assert.equal(head.sha,pr.head.sha);
 assert.equal(merge.tree.sha,head.tree.sha,'Merged tree differs from the reviewed PR head');
 const approval=statuses.find(s=>s.context===APPROVAL_CONTEXT);
 assert(approval&&approval.state==='success','Optimisation approval is missing or not successful');
 assert.equal(approval.creator.login,OWNER,'Approval must be recorded by MaktabForlife');
 assert(Date.parse(approval.created_at)<=Date.parse(pr.merged_at),'Approval must predate the merge');
 const expected=pr.html_url+'#issuecomment-'+comment.id;assert.equal(approval.target_url,expected);
 assert.equal(comment.user.login,OWNER);
 const revised=Date.parse(comment.updated_at||comment.created_at),issued=Date.parse(approval.created_at);
 assert(Date.parse(comment.created_at)<=issued&&revised<=issued,'Approval record changed after its successful status');
 const recordHash=createHash('sha256').update(comment.body).digest('hex');
 assert.equal(approval.description,'optimisation-record-sha256:'+recordHash,'Status is not bound to this exact approval record');
 const selected=validatePlan(plan,repo,files);
 const lines=comment.body.split(/\r?\n/).map(line=>line.trim());
 for(const line of ['Optimisation approval','head: '+pr.head.sha,'target: '+selected.target,'db-changes: none'])
  assert(lines.includes(line),'Approval record requires exact head/target/no-DB lines');
 for(const prefix of ['head:','target:','db-changes:'])assert.equal(lines.filter(line=>line.startsWith(prefix)).length,1,'Ambiguous approval field');
 return {schema:1,repo,mergeSha,pr:pr.number,headSha:pr.head.sha,approvalStatusId:approval.id,approvalURL:approval.target_url,commentId:comment.id,commentHash:createHash('sha256').update(comment.body).digest('hex'),plan:selected};
}
export function githubClient(token,fetcher=fetch){
 assert(token,'GitHub read credential required');
 return async(path,{method='GET',body}={})=>{
  assert(path.startsWith('/repos/MaktabForlife/'),'Unexpected GitHub API scope');
  const response=await fetcher('https://api.github.com'+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  assert(response.ok,'GitHub '+method+' failed: '+response.status);
  if(response.status===204)return null;
  return response.json();
 };
}
export async function resolveApproval({repo,mergeSha,api}){
 assert([ACADEMY,STUDIO].includes(repo));assert(sha(mergeSha));
 const related=await api('/repos/'+repo+'/commits/'+mergeSha+'/pulls?per_page=100');
 const matched=related.filter(p=>p.merge_commit_sha===mergeSha&&p.base.ref==='studio_dev'&&p.state==='closed');
 assert.equal(matched.length,1,'Exactly one merged release PR must match the pushed commit');
 const pr=await api('/repos/'+repo+'/pulls/'+matched[0].number);
 assert(pr.changed_files<=1000,'Use a small release-plan PR for prepared immutable sources');
 const changes=[];
 for(let page=1;changes.length<pr.changed_files;page++){
  assert(page<=10);const rows=await api('/repos/'+repo+'/pulls/'+pr.number+'/files?per_page=100&page='+page);
  assert(rows.length,'Incomplete PR file list');changes.push(...rows);
 }
 assert.equal(changes.length,pr.changed_files);const files=changedPaths(changes);
 const statuses=await api('/repos/'+repo+'/commits/'+pr.head.sha+'/statuses?per_page=100');
 const approval=statuses.find(s=>s.context===APPROVAL_CONTEXT);assert(approval);
 const match=approval.target_url?.match(new RegExp('^https://github\\.com/'+repo+'/pull/'+pr.number+'#issuecomment-(\\d+)$'));assert(match,'Link approval status to the exact PR approval comment');
 const [current,merge,head,file,comment]=await Promise.all([
  api('/repos/'+repo+'/git/ref/heads/studio_dev'),api('/repos/'+repo+'/git/commits/'+mergeSha),
  api('/repos/'+repo+'/git/commits/'+pr.head.sha),api('/repos/'+repo+'/contents/'+PLAN_PATH+'?ref='+pr.head.sha),
  api('/repos/'+repo+'/issues/comments/'+match[1])
 ]);
 assert(file.size<16384&&file.encoding==='base64');
 const plan=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
 return evaluateApproval({repo,mergeSha,currentSha:current.object.sha,pr,merge,head,statuses,plan,files,comment});
}
export async function freshApproval(proof,api){
 const [current,statuses,comment]=await Promise.all([
  api('/repos/'+proof.repo+'/git/ref/heads/studio_dev'),
  api('/repos/'+proof.repo+'/commits/'+proof.headSha+'/statuses?per_page=100'),api('/repos/'+proof.repo+'/issues/comments/'+proof.commentId)
 ]);
 assert.equal(current.object.sha,proof.mergeSha,'New canonical work superseded this release');
 assert.equal(createHash('sha256').update(comment.body).digest('hex'),proof.commentHash,'Approval record changed');assert.equal(comment.user.login,OWNER);
 const status=statuses.find(s=>s.context===APPROVAL_CONTEXT);
 assert(status&&status.state==='success'&&status.id===proof.approvalStatusId&&status.creator.login===OWNER&&status.description==='optimisation-record-sha256:'+proof.commentHash,'Approval changed or was withdrawn');
 return true;
}
export function assertProductionSource({root,baseline,plan}){
 const git=(dir,...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8'}).trim();
 for(const [side,repo,commit,base]of [
  ['Academy',resolve(root,'work/Academy'),plan.source_sha,baseline.source.commit],
  ['Studio',resolve(root,'work/AcademyStudio'),plan.studio_sha,baseline.studio.commit]
 ]){
  assert.equal(git(repo,'rev-parse','HEAD'),commit);
  const names=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).split('\0').filter(Boolean);
  const paths=names('ls-tree','-r','-z','--name-only','HEAD');
  assert(!paths.some(p=>jwtRuntime(p,plan.version)),side+' contains V110 runtime code; production is prohibited');
  const entries=names('diff','--name-status','--find-renames','-z',base+'..HEAD'),changes=[];
  for(let index=0;index<entries.length;){
   const status=entries[index++];assert(/^[ACDMRTUXB][0-9]*$/.test(status),'Unknown Git change status');
   const count=/^[RC]/.test(status)?2:1;
   for(let n=0;n<count;n++){assert(index<entries.length);changes.push(entries[index++]);}
  }
  assert(!changes.some(databasePath),side+' contains database changes');
  for(const path of changes.filter(p=>activeRuntime(p,plan.version)&&/\.[cm]?js$/.test(p))){
   const diff=git(repo,'diff','--unified=0',base+'..HEAD','--',path).split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n');
   assert(!/\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|INDEX|VIEW|TRIGGER)\b|\bJWT_V110_|\bauth\/v110\b/i.test(diff),'Unapproved runtime schema/V110 change: '+path);
  }
  const config=side==='Academy'?'backend/wrangler.jsonc':'wrangler.production.jsonc';
  const old=JSON.parse(git(repo,'show',base+':'+config)),next=JSON.parse(git(repo,'show','HEAD:'+config));
  const vars=v=>Object.fromEntries(Object.entries(v||{}).filter(([name])=>name!=='RELEASE_VERSION'));
  const bindings=c=>({vars:vars(c.vars),d1:c.d1_databases,r2:c.r2_buckets,do:c.durable_objects,kv:c.kv_namespaces,services:c.services,migrations:c.migrations,...(side==='Academy'?{environmentVars:vars(c.env?.development?.vars),environmentD1:c.env?.development?.d1_databases,environmentDO:c.env?.development?.durable_objects}:{})});
  assert.deepEqual(bindings(next),bindings(old),side+' storage bindings/migrations changed');
 }
 return true;
}
export function featureReleaseWorkflow(plan){
 if(plan.kind==='release'&&plan.target==='feature'){
  assert.equal(plan.contains_jwt,true,'Feature release must declare JWT');
  return 'feature-jwt-release.yml';
 }
 assert.equal(plan.kind,'configuration');assert.equal(plan.contains_jwt,false);
 return 'feature-isolation-check.yml';
}
async function promoteFeature(proof,api){
 assert.equal(proof.repo,ACADEMY);const plan=proof.plan;assert(plan.feature_sha&&plan.feature_base_sha);
 const ref='/repos/'+ACADEMY+'/git/refs/heads/feature-preview';
 const current=(await api('/repos/'+ACADEMY+'/git/ref/heads/feature-preview')).object.sha;
 assert([plan.feature_base_sha,plan.feature_sha].includes(current),'Feature branch changed');
 const comparison=await api('/repos/'+ACADEMY+'/compare/'+plan.feature_base_sha+'...'+plan.feature_sha);
 assertFeatureComparison(comparison,plan);
 await freshApproval(proof,api);
 if(current!==plan.feature_sha)await api(ref,{method:'PATCH',body:{sha:plan.feature_sha,force:false}});
 const dispatchName='Approved Feature '+proof.mergeSha,workflow=featureReleaseWorkflow(plan);
 const prior=await api('/repos/'+ACADEMY+'/actions/workflows/'+workflow+'/runs?branch=feature-preview&event=workflow_dispatch&per_page=30');
 if(prior.workflow_runs.some(r=>r.head_sha===plan.feature_sha&&r.display_title===dispatchName&&(['queued','in_progress','waiting','pending'].includes(r.status)||r.conclusion==='success')))return {promotion:'ALREADY_DISPATCHED',featureSha:plan.feature_sha};
 await freshApproval(proof,api);
 await api('/repos/'+ACADEMY+'/actions/workflows/'+workflow+'/dispatches',{method:'POST',body:{ref:'feature-preview',inputs:{approval_pr:String(proof.pr),approval_merge_sha:proof.mergeSha,check_only:plan.kind==='configuration'?'true':'false'}}});
 return {promotion:'DISPATCHED',featureSha:plan.feature_sha,checkOnly:plan.kind==='configuration'};
}
export async function loadProductionApproval(){
 assert.equal(process.env.GITHUB_ACTIONS,'true');
 const proof=await resolveApproval({repo:STUDIO,mergeSha:process.env.M4L_APPROVAL_MERGE_SHA,api:githubClient(process.env.GH_TOKEN)});
 assert.equal(proof.plan.kind,'release');assert.equal(proof.plan.target,'production');assert.equal(proof.plan.contains_jwt,false);
 return proof;
}
export async function loadFeatureApproval(){
 assert.equal(process.env.GITHUB_ACTIONS,'true');
 const proof=await resolveApproval({repo:ACADEMY,mergeSha:process.env.APPROVAL_MERGE_SHA,api:githubClient(process.env.GITHUB_TOKEN||process.env.GH_TOKEN)});
 assert.equal(proof.pr,Number(process.env.APPROVAL_PR));assert.equal(proof.plan.kind,'release');assert.equal(proof.plan.target,'feature');
 assert.equal(proof.plan.feature_sha,process.env.GITHUB_SHA);assert.equal(proof.plan.version,String(JSON.parse(await readFile(resolve(process.cwd(),'version.json'),'utf8')).version));
 return proof;
}
export async function routeApproved(proof,api){
 assert(!(proof.plan.kind==='release'&&proof.plan.target==='development'),'Development release routing is not installed');
 const evidence={...proof,hostedDatabaseCalls:0,cloudflareCalls:0};
 if(proof.plan.feature_sha&&(proof.plan.kind==='configuration'||(proof.plan.kind==='release'&&proof.plan.target==='feature')))Object.assign(evidence,await promoteFeature(proof,api));
 const route=proof.plan.kind==='release'&&proof.plan.target==='production'?'production':'none';
 return {...evidence,route};
}
async function main(){
 assert.equal(process.env.GITHUB_ACTIONS,'true');const mode=process.argv[2];
 if(mode==='select'){
  let plan;try{plan=JSON.parse(await readFile(PLAN_PATH,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(plan)validatePlan(plan,process.env.GITHUB_REPOSITORY,[PLAN_PATH]);
  const pinned=plan?.kind==='release'&&plan.target==='production';
  const source=pinned?plan.source_sha:'studio_dev',studio=pinned?plan.studio_sha:process.env.GITHUB_SHA;
  assert(source==='studio_dev'||sha(source));assert(sha(studio));
  if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'source_ref='+source+'\n'+'studio_ref='+studio+'\n');
  return;
 }
 const repo=process.env.GITHUB_REPOSITORY,mergeSha=process.env.APPROVAL_MERGE_SHA||process.env.GITHUB_SHA;
 const api=githubClient(process.env.GITHUB_TOKEN||process.env.GH_TOKEN),proof=await resolveApproval({repo,mergeSha,api});
 if(mode==='feature-check'){assert.equal(proof.repo,ACADEMY);assert.equal(proof.plan.feature_sha,process.env.GITHUB_SHA);assert.equal(proof.pr,Number(process.env.APPROVAL_PR));return;}
 assert.equal(mode,'route');assert.equal(process.env.GITHUB_REF,'refs/heads/studio_dev');
 const evidence=await routeApproved(proof,api),route=evidence.route;
 if(process.env.GITHUB_OUTPUT)for(const [key,value]of Object.entries({route,source_sha:proof.plan.source_sha||'',studio_sha:proof.plan.studio_sha||'',approval_merge_sha:proof.mergeSha}))await appendFile(process.env.GITHUB_OUTPUT,key+'='+value+'\n');
 if(process.env.RUNNER_TEMP){await mkdir(resolve(process.env.RUNNER_TEMP,'approved-route'),{recursive:true});await writeFile(resolve(process.env.RUNNER_TEMP,'approved-route','route.json'),JSON.stringify(evidence,null,2)+'\n');}
 console.log(JSON.stringify({route,kind:proof.plan.kind,target:proof.plan.target,request:proof.plan.request,promotion:evidence.promotion||null,cloudflareCalls:0,hostedDatabaseCalls:0,componentWaitingForPairedRelease:proof.plan.kind==='component'}));
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname)await main();
