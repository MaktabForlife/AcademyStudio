// Check-only component routing. This module cannot approve, merge or deploy.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validatePlan,changedPaths} from './approved-deployment.mjs';
export const registry=JSON.parse(readFileSync(new URL('../deployment/development-component-counterparts.json',import.meta.url),'utf8'));
const repos=['MaktabForlife/Academy','MaktabForlife/AcademyStudio'],sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
export const digest=value=>createHash('sha256').update(value).digest('hex');
export function assertRegistry(value){
 assert.equal(value.schema,1,'REGISTRY_SCHEMA');assert.equal(value.version,'109.27','REGISTRY_VERSION');
 assert.equal(value.checker.repository,repos[1],'CHECKER_REPO');assert(sha(value.checker.sha),'CHECKER_PIN');
 assert.equal(value.components.length,5,'REGISTRY_COMPONENTS');const keys=new Set();
 for(const item of value.components){
  assert(repos.includes(item.repository),'SOURCE_REPO');assert(Number.isSafeInteger(item.pr)&&item.pr>0,'SOURCE_PR');
  assert.match(item.request,/^ui-bugs-[A-Za-z0-9._-]+$/,'REQUEST');
  assert(repos.includes(item.counterpart.repository)&&item.repository!==item.counterpart.repository,'COUNTERPART_REPO');
  assert(sha(item.counterpart.sha),'COUNTERPART_PIN');assert.equal(typeof item.requiresSameTab,'boolean','CAPABILITY');
  const key=item.repository+'#'+item.pr;assert(!keys.has(key),'DUPLICATE_COMPONENT');keys.add(key);
 }
 return value;
}
assertRegistry(registry);
export function selectComponent({repository,prNumber,sourceSha,pr,plan,files,selectionRegistry=registry}){
 assertRegistry(selectionRegistry);assert(sha(sourceSha),'ACTUAL_SOURCE_PIN');
 const selected=selectionRegistry.components.find(x=>x.repository===repository&&x.pr===Number(prNumber));assert(selected,'UNSELECTED_COMPONENT');
 assert.equal(pr.number,Number(prNumber),'PR_NUMBER');assert.equal(pr.state,'open','PR_CLOSED');assert.equal(pr.merged,false,'PR_MERGED');
 assert.equal(pr.base.ref,'studio_dev','PR_BASE');assert.equal(pr.base.repo.full_name,repository,'PR_BASE_REPO');
 assert.equal(pr.head.repo.full_name,repository,'FORK_SOURCE');assert.equal(pr.head.sha,sourceSha,'PR_SOURCE_CHANGED');
 const paths=changedPaths(files);const checked=validatePlan(plan,repository,paths);
 const classifier=files.find(x=>x.filename==='tools/cloud-release-check.mjs');
 if(classifier)assert.equal(classifier.sha,'5e7067a2701bfaf4f3cb4511efbcd62c46161978','EXACT_REVIEWED_CHECKER_DELTA');
 assert.equal(checked.request,selected.request,'REQUEST_MISMATCH');assert.equal(checked.kind,'component','COMPONENT_ONLY');
 assert.equal(checked.target,'development','DEVELOPMENT_ONLY');assert.equal(checked.contains_jwt,false,'NO_JWT');
 if(checked.version!==undefined)assert.equal(checked.version,selectionRegistry.version,'COMPONENT_VERSION_MISMATCH');
 assert.equal(checked.database_changes,false,'NO_DB_EFFECTS');assert(!paths.some(x=>/jwt|v110/i.test(x)),'NO_JWT_PATHS');
 assert(!paths.some(x=>/^(?:config\/hosting\.json|(?:backend\/)?wrangler[^/]*|tools\/(?:approved-deployment|paired-release|release-health|release-safety)\.mjs|\.github\/workflows\/(?:paired-release|approved-deployment)[^/]*)$/.test(x)),'NO_RELEASE_CONTROLS');
 return {schema:1,repository,pr:Number(prNumber),actualSourceSha:sourceSha,sourcePlan:checked,counterpart:structuredClone(selected.counterpart),checker:structuredClone(selectionRegistry.checker),version:selectionRegistry.version,requiresSameTab:selected.requiresSameTab,registrySHA256:digest(JSON.stringify(selectionRegistry)),approval:false,deployable:false};
}
export function assertContext({event,repository,ref,proposalOnly,prNumber,eventPR}){
 if(proposalOnly){
  assert.equal(repository,'MaktabForlife/AcademyStudio','PROPOSAL_REPO');assert.equal(event,'push','PROPOSAL_EVENT');
  assert.equal(ref,'refs/heads/validation/development-component-pair-check-20261107','PROPOSAL_BRANCH');
 }else{
  assert.equal(event,'pull_request','PR_EVENT');assert.equal(eventPR.number,Number(prNumber),'PR_EVENT_NUMBER');
  assert.equal(eventPR.base.repo.full_name,repository,'PR_EVENT_REPO');assert.equal(eventPR.head.repo.full_name,repository,'PR_EVENT_FORK');assert(sha(eventPR.head.sha),'PR_EVENT_SOURCE');
  assert.equal(eventPR.base.ref,'studio_dev','PR_EVENT_BASE');assert.match(ref,new RegExp('^refs/pull/'+Number(prNumber)+'/merge$'),'PR_EVENT_REF');
 }
 return true;
}
export function assertSafeEnvironment(env){
 for(const name of ['CLOUDFLARE_API_TOKEN','CF_FEATURE_DEPLOY_TOKEN','CLOUDFLARE_SOURCE_API_TOKEN','CLOUDFLARE_STUDIO_API_TOKEN','FEATURE_TEST_ADMIN_PIN','PIN_SECRET','SESSION_SECRET'])
  assert(!env[name],'PRIVATE_ENVIRONMENT_FORBIDDEN');
}
export function preflightPair({academyView,studioView,academyNative,requiresSameTab}){
 if(requiresSameTab)assert(/sameTab\s*:\s*true/.test(academyNative),'DEPENDENCY_ACADEMY_SAME_TAB');
 const translated=studioView.replaceAll("'./existing-media-view.mjs'","'./m4l-existing-media-view.mjs'").replaceAll("'./video-processing.mjs'","'./m4l-video-processing.mjs'");
 assert.equal(academyView,translated,'DEPENDENCY_EXACT_SHARED_MODULE');
 return true;
}

export function assertRetainedVersionState(before,after){assert.deepEqual(after,before,'RETAINED_V10925_STATE_CHANGED');return true;}

export function assertSelectionBinding(selected,{repository,prNumber,sourceSha},selectionRegistry=registry){
 assertRegistry(selectionRegistry);
 const item=selectionRegistry.components.find(x=>x.repository===repository&&x.pr===Number(prNumber));assert(item,'UNSELECTED_COMPONENT');
 assert.equal(selected.repository,repository,'SELECTION_REPO_CHANGED');assert.equal(selected.pr,Number(prNumber),'SELECTION_PR_CHANGED');assert.equal(selected.actualSourceSha,sourceSha,'SELECTION_SOURCE_CHANGED');
 assert.deepEqual(selected.counterpart,item.counterpart,'COUNTERPART_BINDING_CHANGED');assert.deepEqual(selected.checker,selectionRegistry.checker,'CHECKER_BINDING_CHANGED');
 assert.equal(selected.version,selectionRegistry.version,'SELECTION_VERSION_CHANGED');assert.equal(selected.requiresSameTab,item.requiresSameTab,'CAPABILITY_CHANGED');
 assert.equal(selected.registrySHA256,digest(JSON.stringify(selectionRegistry)),'REGISTRY_BINDING_CHANGED');
 assert.equal(selected.sourcePlan.request,item.request);assert.equal(selected.sourcePlan.kind,'component');assert.equal(selected.sourcePlan.target,'development');assert.equal(selected.sourcePlan.contains_jwt,false);assert.equal(selected.sourcePlan.database_changes,false);
 if(selected.sourcePlan.version!==undefined)assert.equal(selected.sourcePlan.version,selectionRegistry.version);
 return true;
}
export function assertSourcePreservation({side,changes,readOriginal,readCurrent}){
 const versionFiles=side==='Academy'?['version.json','js/version.json','backend/tools/academy-site.mjs','backend/src/academy/d1/worker.js']:[];
 for(const path of changes){
  if(path.startsWith('release/v109.27/')||['release/current.json',...(side==='AcademyStudio'?['release/manifest.json']:[])].includes(path))continue;
  assert(versionFiles.includes(path),'NONPACKAGE_SOURCE_CHANGED');
  const before=readOriginal(path),after=readCurrent(path);
  if(path.endsWith('version.json')){const a=JSON.parse(before),b=JSON.parse(after);assert.equal(a.version,'109.25');assert.equal(b.version,'109.27');a.version='109.27';assert.deepEqual(b,a,'VERSION_METADATA_CHANGED');}
  else{const needle=path.endsWith('academy-site.mjs')?"siteVersion='109.25'":"version:'109.25'";assert.equal(before.split(needle).length,2);assert.equal(after,before.replace(needle,needle.replace('109.25','109.27')),'VERSION_CODE_CHANGED');}
 }
 return true;
}
