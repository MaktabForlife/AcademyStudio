// Runs exclusively on a disposable GitHub runner.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {buildStudioPackage} from './build-studio-package.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true');
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'.build/studio-hosting-release');
const base='e8fe6ea455537e9a1fba292080921a022f530d12',source='dded14ffbfac5f27e157253e397b3b4e96bf6ecd';
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
const gh=(path,body)=>JSON.parse(execFileSync('gh',['api',...(body?['--method','POST','--input','-']:[]),path],{encoding:'utf8',input:body?JSON.stringify(body):undefined,maxBuffer:2*1024*1024}));
const read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const save=async(n,v)=>{await mkdir(out,{recursive:true});await writeFile(resolve(out,n),JSON.stringify(v,null,2)+'\n');};
const head=git('rev-parse','HEAD'),config=await read('wrangler.production.jsonc'),old=JSON.parse(git('show',base+':wrangler.production.jsonc'));
const additions={PUBLIC_ASSET_SOURCE:'worker',WEBSITE_ALIAS_ORIGINS:'[]',STUDIO_BACKEND_ORIGIN:'https://academy-studio-parallel.naidu-hajira.workers.dev',STUDIO_PROVIDER_ORIGIN:'https://ummabbadacademy.maktab4life.org',STUDIO_REDIRECT_ORIGINS:'["https://www.maktab4life.org"]'};
const expected=structuredClone(old);expected.main='hosting/saas/worker.mjs';Object.assign(expected.vars,additions);assert.deepEqual(config,expected);
assert.equal(git('status','--porcelain'),'');
const latest=gh('repos/MaktabForlife/AcademyStudio/releases/latest'),asset=latest.assets.find(a=>a.name==='paired-release.json');assert(asset&&asset.size<32768);
const baseline=JSON.parse(execFileSync('gh',['api','repos/MaktabForlife/AcademyStudio/releases/assets/'+asset.id,'-H','Accept: application/octet-stream'],{encoding:'utf8'}));
assert.equal(baseline.version,'109.20');assert.equal(baseline.source.commit,source);assert.equal(baseline.studio.commit,base,'Review a changed baseline');
const allowed=new Set(['AGENTS.md','.github/workflows/hosting-check.yml','config/studio-saas.json','config/maktab-domain-transfer.json','docs/STUDIO-SAAS-HOSTING.md','hosting/saas/assets.mjs','hosting/saas/worker.mjs','tests/studio-saas.test.mjs','tools/prepare-studio-saas.mjs','tools/studio-hosting-release.mjs','wrangler.production.jsonc']);
for(const name of git('diff','--name-only',base+'..HEAD').split('\n').filter(Boolean))assert(allowed.has(name),'Unexpected change '+name);
if(process.argv[2]==='check'){
 const r=await read('.build/studio-saas/preparation.json');assert(r.exactReviewedPublicBytes);assert.equal(r.publicFilesVerified,398);assert.equal(r.activated,false);assert.deepEqual(r.verificationSeconds,[43200,43200,60]);
 console.log(JSON.stringify({checked:true,head,source,publicFiles:398,transfer:false,hostedSQL:0}));process.exit(0);
}
assert.equal(process.argv[2],'deploy');assert.equal(process.env.GITHUB_REF,'refs/heads/studio_dev');assert.equal(process.env.REVIEWED_SHA,head);
const ref=repo=>gh('repos/MaktabForlife/'+repo+'/git/ref/heads/studio_dev').object.sha;
const refs=()=>{assert.equal(ref('Academy'),source);assert.equal(ref('AcademyStudio'),head);};
refs();await buildStudioPackage({root});assert.equal(git('status','--porcelain'),'');
const accounts={source:'c9a3e355b3d7a795880b1d36a1dbe123',studio:'2b01ca929611669e032703ff19f7098f'};let managementRequests=0;
async function api(side,path){
 const token=process.env[side==='studio'?'CLOUDFLARE_STUDIO_API_TOKEN':'CLOUDFLARE_SOURCE_API_TOKEN'];assert(token&&token===token.trim());managementRequests++;
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+accounts[side]+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)}),v=await r.json();
 assert(r.ok&&v.success,side+' '+path+' '+r.status+' '+JSON.stringify(v.errors));return v.result;
}
const active=r=>r.deployments[0].versions;
const normal=rows=>rows.map(r=>{const v={name:r.name,type:r.type};if(r.type==='plain_text')v.text=r.text;else if(r.type==='d1')v.id=r.id||r.database_id;else if(r.type==='r2_bucket')v.bucket_name=r.bucket_name;else assert(['secret_text','assets'].includes(r.type));return v;}).sort((a,b)=>a.name.localeCompare(b.name));
async function sourceState(){
 const [w,c,p]=await Promise.all([api('source','/workers/scripts/devrebootworker/deployments'),api('source','/workers/scripts/academy_split_coordinator/deployments'),api('source','/pages/projects/academy-maktab4life')]);
 assert.deepEqual(active(w),[{version_id:baseline.source.workerVersion,percentage:100}]);assert.deepEqual(active(c),[{version_id:baseline.coordinatorVersion,percentage:100}]);assert.equal(p.canonical_deployment.id,baseline.source.pages.id);
 return {worker:baseline.source.workerVersion,coordinator:baseline.coordinatorVersion,pages:p.canonical_deployment.id};
}
const sourceBefore=await sourceState(),[before,deployed]=await Promise.all([api('studio','/workers/scripts/academy-studio-parallel/settings'),api('studio','/workers/scripts/academy-studio-parallel/deployments')]);
assert.deepEqual(active(deployed),[{version_id:baseline.studio.workerVersion,percentage:100}]);assert.equal(before.bindings.length,18);
for(const[n,v]of Object.entries(old.vars))assert.equal(before.bindings.find(b=>b.name===n)?.text,v);
const expectedBindings=[...before.bindings,...Object.entries(additions).map(([name,text])=>({name,text,type:'plain_text'}))];
await save('before.json',{head,baseline,sourceBefore,settings:before,deployment:deployed.deployments[0]});
async function run(args,label){
 let log='';const code=await new Promise((done,reject)=>{const child=spawn(process.execPath,[resolve(root,'node_modules/wrangler/bin/wrangler.js'),...args],{cwd:root,env:{...process.env,CLOUDFLARE_API_TOKEN:process.env.CLOUDFLARE_STUDIO_API_TOKEN,CLOUDFLARE_ACCOUNT_ID:accounts.studio,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:resolve(out,label+'-wrangler.log')},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);child.on('error',reject);child.on('close',done);});
 for(const[n,v]of Object.entries(process.env))if(/TOKEN|SECRET|PASSWORD/.test(n)&&v?.length>7)log=log.split(v).join('[REDACTED]');
 await writeFile(resolve(out,label+'.log'),log);if(code!==0)console.error(log.slice(-5000));assert.equal(code,0,label);return log;
}
const upload=await run(['versions','upload','--config','wrangler.production.jsonc','--tag','studio-hosting-20261104','--message','Studio continuity; V109.20 public files and permissions retained'],'stage');
const versionId=upload.match(/(?:Worker )?Version ID:\s*([a-f0-9-]{36})/i)?.[1];assert(versionId);await save('staged.json',{head,versionId,traffic:0});
await new Promise(done=>setTimeout(done,20000));
const staged=await api('studio','/workers/scripts/academy-studio-parallel/versions/'+versionId);assert.deepEqual(normal(staged.resources.bindings),normal(expectedBindings));
await save('staged-verification.json',{passed:true,versionId,bindings:staged.resources.bindings.length});
refs();assert.deepEqual(await sourceState(),sourceBefore);assert.deepEqual(active(await api('studio','/workers/scripts/academy-studio-parallel/deployments')),active(deployed));
let activated=false;
try{
 activated=true;
 await run(['versions','deploy',versionId+'@100','--config','wrangler.production.jsonc','--yes','--message','Studio hosting continuity; existing public address and storage retained'],'activate');activated=true;
 const [after,d]=await Promise.all([api('studio','/workers/scripts/academy-studio-parallel/settings'),api('studio','/workers/scripts/academy-studio-parallel/deployments')]);
 assert.deepEqual(active(d),[{version_id:versionId,percentage:100}]);assert.deepEqual(normal(after.bindings),normal(expectedBindings));assert.equal(after.compatibility_date,before.compatibility_date);assert.deepEqual(after.compatibility_flags,before.compatibility_flags);assert.deepEqual(await sourceState(),sourceBefore);
 const checks=[];
 for(const[url,headers,status]of [['https://maktab4life.org/studio/',{},200],['https://academy-studio-parallel.naidu-hajira.workers.dev/api/me',{'X-Maktab-Front-Door':'maktab4life.org'},401]]){
  const r=await fetch(url,{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});assert.equal(r.status,status,url);assert.equal(r.headers.get('X-AcademyStudio-Version'),'109.20');
  if(status===200){assert(r.headers.get('Content-Type')?.includes('text/html'));await r.body?.cancel();}else assert.equal((await r.json()).code,'SIGN_IN_REQUIRED');checks.push({url,status:r.status});
 }
 const receipt={...baseline,studio:{...baseline.studio,commit:head,workerVersion:versionId},bindings:{...baseline.bindings,studio:expectedBindings.length},verifiedAt:new Date().toISOString(),hostingRelease:'studio-hosting-20261104',previousRelease:latest.html_url,verificationSeconds:[43200,43200,60],manualLessonAttachment:true,manualLessonPublication:true,localTests:{saas:10,studio:38,academy:40},hostingChecks:{sourceUnchanged:sourceBefore,publicFiles:398,assetSource:'worker',pagesPublished:false,domainTransferred:false,dnsActivation:false,checks,managementRequests,hostedSQL:0,hostedLogins:0,hostedDashboards:0,macWrites:0}};
 await save('paired-release.json',receipt);await save('verification.json',{passed:true,head,versionId,checks,managementRequests,sourceUnchanged:true});
 try{
 const release=gh('repos/MaktabForlife/AcademyStudio/releases',{tag_name:'v109.20-hosting.1',target_commitish:head,name:'V109.20 — Studio hosting continuity',body:'Studio continuity deployed from tested GitHub source. Academy/Homepage and Hifz unchanged. Same 398 public files, storage, cookie and 43200/43200/60 verification. Domain transfer and SaaS activation remain separate.',draft:false,prerelease:false,make_latest:'true'});
 const body=JSON.stringify(receipt,null,2)+'\n';execFileSync('gh',['api','--method','POST',release.upload_url.split('{')[0]+'?name=paired-release.json','-H','Content-Type: application/json','--input','-'],{input:body,stdio:['pipe','ignore','pipe']});
 console.log(JSON.stringify({passed:true,head,versionId,release:release.html_url,unsignedChecks:checks.length,managementRequests,hostedSQL:0,sourceUnchanged:true}));
 }catch(error){await save('receipt-publication-failure.json',{message:'Verified Studio is active; complete GitHub receipt publication',head,versionId});console.error('Verified Studio is active; GitHub receipt publication needs attention.');process.exit(2);}
}catch(error){
 await save('failure.json',{message:error.message,activated,versionId});
 if(activated&&JSON.stringify(active(await api('studio','/workers/scripts/academy-studio-parallel/deployments')))===JSON.stringify([{version_id:versionId,percentage:100}])){
  await run(['versions','deploy',baseline.studio.workerVersion+'@100','--config','wrangler.production.jsonc','--yes','--message','Restore previous Studio after verification failure'],'restore');await save('recovery.json',{restored:baseline.studio.workerVersion});
 }
 throw error;
}
