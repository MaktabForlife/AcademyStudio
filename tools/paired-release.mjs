import './preserve-local-files.mjs';
import {homedir} from 'node:os';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {waitForReleaseHealth} from './release-health.mjs';
import {assertProductionPages,recoverPair} from './release-safety.mjs';
const root=resolve(process.env.M4L_PROJECT_ROOT||resolve(import.meta.dirname,'../../..')),version=process.argv[2],out=resolve(process.env.M4L_RELEASE_OUTPUT||resolve(import.meta.dirname,'../.build/release-'+version));
assert(/^\d+\.\d+$/.test(version||''),'Choose a reviewed paired release version');
const read=async file=>JSON.parse(await readFile(resolve(out,file),'utf8'));
const save=(file,value)=>writeFile(resolve(out,file),JSON.stringify(value,null,2)+'\n',{mode:0o600});
const scope=await read('approval-and-scope.json'),sha=b=>createHash('sha256').update(b).digest('hex');
const repos={source:resolve(root,scope.source),target:resolve(root,scope.studio)};
const jobs={source:{cwd:resolve(repos.source,'backend'),config:'wrangler.jsonc',account:'c9a3e355b3d7a795880b1d36a1dbe123',profile:'default',worker:'devrebootworker'},target:{cwd:repos.target,config:'wrangler.production.jsonc',account:'2b01ca929611669e032703ff19f7098f',profile:'academy-studio',worker:'academy-studio-parallel'}};
async function manifest(dir){const rows={};async function walk(folder){for(const e of await readdir(folder,{withFileTypes:true})){assert(!e.isSymbolicLink());const p=resolve(folder,e.name);if(e.isDirectory())await walk(p);else rows[relative(dir,p)]=sha(await readFile(p));}}await walk(dir);return Object.fromEntries(Object.entries(rows).sort(([a],[b])=>a.localeCompare(b)));}
const tokens={};let managementRequests=0;
async function api(side,path,method='GET'){
 tokens[side]??=process.env[side==='source'?'CLOUDFLARE_SOURCE_API_TOKEN':'CLOUDFLARE_STUDIO_API_TOKEN']||(await readFile(resolve(homedir(),'.wrangler/config',jobs[side].profile+'.toml'),'utf8')).match(/oauth_token\s*=\s*"([^"]+)"/)?.[1];
 assert(tokens[side]);
 for(let attempt=0;attempt<4;attempt++){
  managementRequests++;
  const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+jobs[side].account+path,{method,headers:{Authorization:'Bearer '+tokens[side]},signal:AbortSignal.timeout(30000)}),v=await r.json();
  if(r.ok&&v.success)return v.result;
  const delay=[2000,5000,10000][attempt];
  if(r.status===404&&v.errors?.some(e=>e.code===100146)&&/^\/workers\/scripts\/[^/]+\/versions\/[a-f0-9-]{36}$/.test(path)&&delay){
   console.log(JSON.stringify({managementRetry:true,side,path,delayMs:delay,reason:'New Worker version not visible yet'}));
   await new Promise(done=>setTimeout(done,delay));continue;
  }
  throw Error('Cloudflare management '+side+' '+path+' '+r.status+' '+JSON.stringify(v.errors));
 }
}
async function run(side,args,label,attempt=0){const j=jobs[side],cloudToken=process.env[side==='source'?'CLOUDFLARE_SOURCE_API_TOKEN':'CLOUDFLARE_STUDIO_API_TOKEN'];if(cloudToken){const clean=[];for(let i=0;i<args.length;i++){if(args[i]==='--profile'){i++;continue;}clean.push(args[i]);}args=clean;}let log='';const code=await new Promise((done,reject)=>{const child=spawn(process.execPath,[resolve(j.cwd,'node_modules/wrangler/bin/wrangler.js'),...args],{cwd:j.cwd,env:{...process.env,...(cloudToken?{CLOUDFLARE_API_TOKEN:cloudToken}:{}),CI:'true',CLOUDFLARE_ACCOUNT_ID:j.account,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:resolve(out,'wrangler-'+label+'.log')},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);child.on('error',reject);child.on('close',done);});for(const [key,value]of Object.entries(process.env))if(/(?:TOKEN|SECRET|PASSWORD)$/.test(key)&&value&&value.length>=8)log=log.split(value).join('[REDACTED]');await writeFile(resolve(out,label+'.log'),log,{mode:0o600});if(code!==0&&args[0]==='versions'&&args[1]==='deploy'&&/code:\s*100146/.test(log)&&attempt<2){const delay=[10000,20000][attempt];console.log(JSON.stringify({deploymentRetry:true,side,label,delayMs:delay,reason:'New version temporarily unavailable to deployment API'}));await new Promise(done=>setTimeout(done,delay));return run(side,args,label,attempt+1);}if(code!==0)process.stderr.write(log.slice(-8000)+'\n');assert.equal(code,0,label+' failed; inspect saved redacted log');return log;}
async function absent(file){try{await readFile(resolve(out,file));throw Error(file+' already exists; inspect before repeating');}catch(e){if(e.code!=='ENOENT')throw e;}}
async function verifyFreeze(plan){for(const [path,expected]of Object.entries(plan.manifests))assert.deepEqual(await manifest(resolve(root,path)),expected,path+' changed since freeze');for(const [path,expected]of Object.entries(plan.configHashes))assert.equal(sha(await readFile(resolve(root,path))),expected,path+' config changed');for(const [side,repo]of Object.entries(repos)){assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),plan.candidates[side].commit);assert.equal(execFileSync('git',['status','--porcelain'],{cwd:repo,encoding:'utf8'}).trim(),'');}}

async function verifyRemoteHeads(){
 for(const [side,repo]of Object.entries(repos)){
  const expected=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
  const remote=execFileSync('git',['ls-remote','--exit-code','origin','refs/heads/studio_dev'],{cwd:repo,encoding:'utf8'}).trim().split(/\s+/)[0];
  assert.equal(remote,expected,side+' canonical source changed before release write');
 }
}
async function recover(error){
 const before=await read('before.json'),staged=await read('staged.json'),plan=await read('release-plan.json');
 const state=await read('activation.json');state.error=error.message;state.status='RESTORING_PREVIOUS_COMPATIBLE_PAIR';await save('activation.json',state);
 const ownedWorker=async(side)=>{
  const j=jobs[side],active=(await api(side,'/workers/scripts/'+j.worker+'/deployments')).deployments[0].versions;
  const old=[{version_id:before.workers[side].version,percentage:100}],ours=[{version_id:staged.versions[side],percentage:100}];
  assert(JSON.stringify(active)===JSON.stringify(old)||JSON.stringify(active)===JSON.stringify(ours),'Concurrent '+side+' deployment; refusing to overwrite it');
  return JSON.stringify(active)===JSON.stringify(old);
 };
 const result=await recoverPair({
  restoreWorker:async(side)=>{
   if(await ownedWorker(side))return;
   const j=jobs[side];await run(side,['versions','deploy',before.workers[side].version+'@100','--config',j.config,'--profile',j.profile,...(side==='source'?['--env','development']:[]),'--yes','--message','Restore verified V'+(await read('baseline.json')).version+' after failed V'+version],'recovery-'+side);
  },
  restorePages:async()=>{
   const current=await api('source','/pages/projects/academy-maktab4life'),page=current.canonical_deployment;
   assert.equal(current.production_branch,'development');
   if(page.id===before.pages.canonical_deployment.id)return;
   assert.equal(page.environment,'production');assert.equal(page.deployment_trigger.metadata.commit_hash,plan.candidates.source.commit,'Concurrent Pages deployment; refusing to overwrite it');
   await api('source','/pages/projects/academy-maktab4life/deployments/'+before.pages.canonical_deployment.id+'/rollback','POST');
  },
  verify:async()=>{
   for(const [key,j]of Object.entries(before.workers)){
    const [settings,deployed]=await Promise.all([api(j.side,'/workers/scripts/'+j.worker+'/settings'),api(j.side,'/workers/scripts/'+j.worker+'/deployments')]);
    assert.deepEqual(deployed.deployments[0].versions,j.active.versions,key+' recovery version mismatch');
    assert.deepEqual(normalBindings(settings.bindings),normalBindings(j.settings.bindings),key+' recovery binding mismatch');
   }
   const baseline=await read('baseline.json');
   assertProductionPages(await api('source','/pages/projects/academy-maktab4life'),baseline);
   assert.deepEqual(await api('source','/workers/scripts/devrebootworker/schedules'),before.schedules);
   await waitForReleaseHealth({url:hosting.academyApiOrigin+'/api/health',expectedVersion:baseline.version,previousVersion:version,onSample:async(sample,samples)=>save('recovery-health.json',{...sample,samples})});
  },
  checkpoint:async(result)=>save('recovery.json',{...result,managementRequests,hostedSQL:0})
 });
 state.status=result.status;state.recovery=result;await save('activation.json',state);return result;
}

const hosting=scope.hosting;
assert(hosting&&new URL(hosting.academyPortalOrigin).origin===hosting.academyPortalOrigin);
const normalBindings=rows=>rows.map(row=>row.name==='RELEASE_VERSION'?{...row,text:'VERSION'}:row).sort((a,b)=>a.name.localeCompare(b.name));
function expectedBindings(side,rows){
 const expected=rows.filter(row=>side!=='target'||row.name!=='ACADEMY_PORTAL_ORIGIN');
 if(side==='target')expected.push({name:'ACADEMY_PORTAL_ORIGIN',type:'plain_text',text:hosting.academyPortalOrigin});
 return expected;
}
async function readyDomain(){
 const domain=await api('source','/pages/projects/academy-maktab4life/domains/'+encodeURIComponent(new URL(hosting.academyPortalOrigin).hostname));
 assert.equal(domain.status,'active','New Academy domain must be active before changing any live application');
 await save('portal-domain.json',{name:domain.name,status:domain.status,validation:domain.validation_data?.status,verification:domain.verification_data?.status,managementRequests});
 return domain;
}

const mode=process.argv[3];
if(mode==='plan'){
 await absent('release-plan.json');const candidates={};for(const [side,repo]of Object.entries(repos)){assert.equal(execFileSync('git',['status','--porcelain'],{cwd:repo,encoding:'utf8'}).trim(),'');candidates[side]={repo:relative(root,repo),commit:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),branch:execFileSync('git',['branch','--show-current'],{cwd:repo,encoding:'utf8'}).trim()};}
 const github=await read('github-verification.json');for(const [side,value]of Object.entries(candidates))assert(github[side].githubVerified&&github[side].commit===value.commit,'Candidate must already be on canonical GitHub');
 const sourcePages=await manifest(resolve(repos.source,'release/v'+version+'/public')),targetPublic=await manifest(resolve(repos.target,'release/v'+version+'/public'));assert.deepEqual(targetPublic,(await read('studio-assets.json')).manifest);assert.equal(Object.keys(targetPublic).length,(await read('studio-assets.json')).files);
 const site=await import(resolve(repos.source,'backend/tools/academy-site.mjs'));assert.equal((await (await site.serveAcademySite(new Request('http://localhost/api/site/health'),{})).json()).version,version);
 const configHashes={};for(const path of [scope.source+'/backend/wrangler.jsonc',scope.source+'/backend/wrangler.split-coordinator.jsonc',scope.studio+'/wrangler.production.jsonc'])configHashes[path]=sha(await readFile(resolve(root,path)));
 const plan={version,candidates,configHashes,manifests:{[scope.source+'/release/v'+version+'/public']:sourcePages,[scope.studio+'/release/v'+version+'/public']:targetPublic},rollback:scope.rollback,coordinatorUnchanged:true,databaseUpdates:scope.databaseUpdates||[],manualLessonAttachment:true,manualLessonPublication:true,localChecks:(await read('local-acceptance.json')).localTests,sourcePagesFiles:Object.keys(sourcePages).length,targetFiles:Object.keys(targetPublic).length};await save('release-plan.json',plan);console.log(JSON.stringify({...plan,manifests:undefined,configHashes:undefined,rollback:undefined}));
}else if(mode==='capture'){
 await absent('before.json');const plan=await read('release-plan.json');await verifyFreeze(plan);const workerSpecs={source:{side:'source',worker:jobs.source.worker,version:scope.baseline.source.workerVersion,count:scope.baselineBindings.source},coordinator:{side:'source',worker:'academy_split_coordinator',version:scope.baseline.source.coordinatorVersion,count:scope.baselineBindings.coordinator},target:{side:'target',worker:jobs.target.worker,version:scope.baseline.studio.workerVersion,count:scope.baselineBindings.studio}};
 const workers=Object.fromEntries(await Promise.all(Object.entries(workerSpecs).map(async([key,j])=>{const [settings,deployed]=await Promise.all([api(j.side,'/workers/scripts/'+j.worker+'/settings'),api(j.side,'/workers/scripts/'+j.worker+'/deployments')]);assert.equal(settings.bindings.length,j.count);assert.deepEqual(deployed.deployments[0].versions,[{version_id:j.version,percentage:100}],key+' baseline changed');return [key,{...j,settings,active:deployed.deployments[0]}];})));
 const [pages,schedules]=await Promise.all([api('source','/pages/projects/academy-maktab4life'),api('source','/workers/scripts/devrebootworker/schedules')]);assertProductionPages(pages,{source:scope.baseline.source});assert.equal(schedules.schedules.length,4);
 await readyDomain();await waitForReleaseHealth({url:hosting.academyApiOrigin+'/api/health',expectedVersion:(await read('baseline.json')).version,onSample:async(sample,samples)=>save('baseline-health.json',{...sample,samples})});await save('before.json',{at:new Date().toISOString(),workers,pages:{canonical_deployment:pages.canonical_deployment,production_branch:pages.production_branch},schedules,managementRequests});console.log(JSON.stringify({captured:true,managementRequests,bindings:Object.values(workers).map(w=>w.count),schedules:4,applicationRequests:0,sql:0}));
}else if(mode==='stage'){
 await read('before.json');const plan=await read('release-plan.json');await verifyFreeze(plan);let staged;try{staged=await read('staged.json');}catch(e){if(e.code!=='ENOENT')throw e;staged={version,versions:{},startedAt:new Date().toISOString()};}
 for(const [side,j]of Object.entries(jobs)){if(staged.versions[side])continue;await verifyRemoteHeads();console.log('Staging '+side+' without traffic');const log=await run(side,['versions','upload','--config',j.config,'--profile',j.profile,'--tag','v'+version.replaceAll('.','')+'-paired-release','--message','V'+version+' tested paired application release; media publication stays manual',...(side==='source'?['--env','development','--keep-vars']:[])],'stage-'+side);const id=log.match(/(?:Worker )?Version ID:\s*([a-f0-9-]{36})/i)?.[1];assert(id);staged.versions[side]=id;await save('staged.json',staged);console.log(JSON.stringify({staged:side,versionId:id}));}staged.status='STAGED_WITHOUT_TRAFFIC';staged.completedAt=new Date().toISOString();await save('staged.json',staged);
}else if(mode==='verify-stage'){
 const before=await read('before.json'),staged=await read('staged.json'),results={};const settle=Math.max(0,20000-(Date.now()-Date.parse(staged.completedAt||staged.startedAt)));if(settle>0){console.log(JSON.stringify({waitingForVersionVisibilityMs:settle}));await new Promise(done=>setTimeout(done,settle));}
 const normal=rows=>rows.map(row=>row.name==='RELEASE_VERSION'?{...row,text:'VERSION'}:row).sort((a,b)=>a.name.localeCompare(b.name));
 for(const [side,id]of Object.entries(staged.versions)){const value=await api(side,'/workers/scripts/'+jobs[side].worker+'/versions/'+id);assert.deepEqual(normalBindings(value.resources.bindings),normalBindings(expectedBindings(side,before.workers[side].settings.bindings)));if(side==='target'){assert.equal(value.resources.bindings.find(b=>b.name==='RELEASE_VERSION').text,version);for(const [name,v]of Object.entries({ACCOUNT_MAX_AGE_SECONDS:'43200',LIVE_ACCESS_MAX_AGE_SECONDS:'43200',ADMIN_MAX_AGE_SECONDS:'60'}))assert.equal(value.resources.bindings.find(b=>b.name===name).text,v);}results[side]={versionId:id,bindings:value.resources.bindings.length};}
 assert.equal(Object.keys(results).length,2);await save('staged-verification.json',{passed:true,results,managementRequests});console.log(JSON.stringify({passed:true,results,managementRequests}));
}else if(mode==='activate'){
 await absent('activation.json');const plan=await read('release-plan.json'),before=await read('before.json'),staged=await read('staged.json');assert((await read('staged-verification.json')).passed);if(plan.databaseUpdates.length){const schema=await read('database-updates.json');assert(schema.passed);assert.deepEqual(schema.updates,plan.databaseUpdates,'Verify only the reviewed database updates before activation');}await verifyFreeze(plan);assert.deepEqual(await manifest(plan.rollback.pagesArtifact),plan.rollback.pagesManifest.manifest);
 for(const [key,j]of Object.entries(before.workers)){const current=await api(j.side,'/workers/scripts/'+j.worker+'/deployments');assert.deepEqual(current.deployments[0].versions,j.active.versions,key+' changed before activation');}assert.equal((await api('source','/pages/projects/academy-maktab4life')).canonical_deployment.id,before.pages.canonical_deployment.id);
 const state={version,status:'ACTIVATING',startedAt:new Date().toISOString(),steps:[],metadataPreflightRequests:managementRequests};const checkpoint=()=>save('activation.json',state);await checkpoint();
 async function activateWorker(side,id,label){await verifyRemoteHeads();const j=jobs[side];await run(side,['versions','deploy',id+'@100','--config',j.config,'--profile',j.profile,...(side==='source'?['--env','development']:[]),'--yes','--message','V'+version+' '+label+' paired dashboard and media release'],'activate-'+label+'-'+side);state.steps.push({side,label,versionId:id});await checkpoint();}
 async function pages(path,commit,label){await verifyRemoteHeads();await run('source',['pages','deploy',path,'--project-name','academy-maktab4life','--branch','development','--profile','default','--commit-hash',commit,'--commit-message','V'+version+' '+label+' coordinated release','--commit-dirty=false'],'activate-'+label+'-pages');state.steps.push({side:'pages',label,commit});await checkpoint();}
 try{console.log('Activating Academy API');await activateWorker('source',staged.versions.source,'candidate');const priorVersion=(await read('baseline.json')).version;await waitForReleaseHealth({url:'https://devrebootworker.maktab4life.workers.dev/api/health',expectedVersion:version,previousVersion:priorVersion,onSample:async(sample,samples)=>{await save('source-health.json',{...sample,samples});console.log(JSON.stringify({academyHealthSample:sample}));}});console.log('Activating Academy website before moving Studio Home');await pages(resolve(repos.source,'release/v'+version+'/public'),plan.candidates.source.commit,'candidate');console.log('Activating Studio');await activateWorker('target',staged.versions.target,'candidate');state.status='PAIR_ACTIVATED_PENDING_VERIFICATION';await checkpoint();console.log(JSON.stringify({status:state.status,steps:state.steps}));}
 catch(error){await recover(error);throw error;}
}else if(mode==='verify-live'){
 try{
 await absent('verification.json');const plan=await read('release-plan.json'),before=await read('before.json'),staged=await read('staged.json'),activation=await read('activation.json');assert.equal(activation.status,'PAIR_ACTIVATED_PENDING_VERIFICATION');const after={};
 for(const [key,j]of Object.entries(before.workers)){const [settings,deployed]=await Promise.all([api(j.side,'/workers/scripts/'+j.worker+'/settings'),api(j.side,'/workers/scripts/'+j.worker+'/deployments')]);assert.equal(settings.bindings.length,expectedBindings(key,j.settings.bindings).length);assert.deepEqual(deployed.deployments[0].versions,[{version_id:key==='coordinator'?j.version:staged.versions[key],percentage:100}]);const normal=rows=>rows.map(row=>row.name==='RELEASE_VERSION'?{...row,text:'VERSION'}:row).sort((a,b)=>a.name.localeCompare(b.name));assert.deepEqual(normalBindings(settings.bindings),normalBindings(expectedBindings(key,j.settings.bindings)));after[key]={versionId:deployed.deployments[0].versions[0].version_id,bindings:settings.bindings.length};}
 const [pages,schedules]=await Promise.all([api('source','/pages/projects/academy-maktab4life'),api('source','/workers/scripts/devrebootworker/schedules')]);assert.equal(pages.canonical_deployment.environment,'production');assert.equal(pages.canonical_deployment.latest_stage.status,'success');assert.equal(pages.production_branch,'development');assert.equal(pages.canonical_deployment.deployment_trigger.metadata.commit_hash,plan.candidates.source.commit);assert.deepEqual(schedules,before.schedules);await save('management-after.json',{after,pages:pages.canonical_deployment,schedules,managementRequests});
 const checks=[];async function get(url,check){const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(15000)}),bytes=new Uint8Array(await response.arrayBuffer());check(response,bytes);checks.push({url,status:response.status,sha256:sha(bytes)});}
 await get(hosting.studioOrigin+'/',(r)=>{assert.equal(r.status,307);assert.equal(r.headers.get('Location'),hosting.academyPortalOrigin+'/');assert.equal(r.headers.get('x-academystudio-version'),version);});
 await get(hosting.academyPortalOrigin+'/',(r,b)=>{assert.equal(r.status,200);assert.match(Buffer.from(b).toString(),new RegExp('academy-release-version[^>]+present'.replace('present',version.replace('.','\\.'))));});
 await get('https://academy-maktab4life.pages.dev/api/site/health',(r,b)=>{assert.equal(r.status,200);assert.equal(JSON.parse(Buffer.from(b)).version,version);});
 const sourceAssets=await read('source-assets.json'),targetAssets=await read('studio-assets.json');
 for(const [base,folder,name,prefix]of [['https://academy-maktab4life.pages.dev',resolve(repos.source,'release/v'+version+'/public'),'js/m4l-academy-workspace.js',sourceAssets.prefix],['https://maktab4life.org',resolve(repos.target,'release/v'+version+'/public'),'api.mjs',targetAssets.prefix]]){const expected=sha(await readFile(resolve(folder,'.'+prefix+name)));await get(base+prefix+name,(r,b)=>{assert.equal(r.status,200);assert.equal(sha(b),expected);assert(r.headers.get('Cache-Control').includes('immutable'));});}
 await get('https://maktab4life.org/api/websites/navigation-check-no-session',(r)=>assert.equal(r.status,401));await save('public-checks.json',{checks,requests:checks.length,login:0,dashboards:0,explicitSQL:0,hostedRowsMeasured:false});
 const receipt={passed:true,version,verifiedAt:new Date().toISOString(),source:{...plan.candidates.source,url:hosting.academyPortalOrigin,legacyOrigin:hosting.academyLegacyOrigins[0],workerVersion:staged.versions.source,pages:{id:pages.canonical_deployment.id,url:pages.canonical_deployment.url}},studio:{...plan.candidates.target,url:'https://maktab4life.org',workerVersion:staged.versions.target},coordinator:after.coordinator,bindings:{source:after.source.bindings,coordinator:after.coordinator.bindings,studio:after.target.bindings},hosting,verificationSeconds:[43200,43200,60],sourceCronCount:4,databaseUpdates:scope.databaseUpdates||[],localChecks:(await read('local-acceptance.json')).localTests,studioPublicFiles:(await read('studio-assets.json')).files,studioVersionOnlyChanges:false,studioOverlayFiles:(await read('studio-assets.json')).overlays,noLocalFilesDeleted:true,githubVerifiedBeforeDeployment:true,sourceCleanup:false,hifzExcluded:true,widerCleanupExcluded:true,unsignedChecks:checks.length,sourceHealthReused:await read('source-health.json'),manualLessonAttachment:true,manualLessonPublication:true,courseReworkExcluded:false,actualContentOrRightsChanges:0,explicitHostedSQL:0,hostedDatabaseMutations:0,hostedRowsMeasured:false,databaseUpdateReceipt:scope.databaseUpdates?.length?'database-updates.json':null,hostedLogins:0,hostedDashboards:0,gitPush:true,dnsChanges:0,limitations:['Hosted checks are limited to management metadata, static assets, health and unsigned denial; authenticated Safari/Chrome acceptance still requires a user visit.','An origin change requires one initial Academy sign-in; Studio keeps its host-only secure cookie. Hifz is unchanged.','Existing native snapshots remain; an unproven combined dashboard cache was excluded. Media attachment/publication remains manual.']};await save('verification.json',receipt);console.log(JSON.stringify(receipt));
 }catch(error){await recover(error);throw error;}
}else throw Error('Choose plan/capture/stage/verify-stage/activate/verify-live');
