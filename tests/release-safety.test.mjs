import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {recoveredBaseline,assertProductionPages,recoverPair} from '../tools/release-safety.mjs';
const record=JSON.parse(await readFile(new URL('../release/production-baseline-v109.25.json',import.meta.url)));
function receipt(){return {version:record.baselineVersion,source:{commit:record.sourceCommit,workerVersion:record.sourceWorkerVersion,pages:{id:record.receiptPagesId}},studio:{commit:record.studioCommit,workerVersion:record.studioWorkerVersion},coordinatorVersion:record.coordinatorVersion};}
function project(){return {production_branch:'development',canonical_deployment:{id:record.recoveredPagesId,environment:'production',latest_stage:{status:'success'},deployment_trigger:{metadata:{commit_hash:record.sourceCommit}}}};}
test('explicit Pages recovery preserves original paired source, workers and receipt',()=>{
 const prior=receipt(),snapshot=structuredClone(prior),base=recoveredBaseline(prior,record,'109.25');
 assert.deepEqual(prior,snapshot);assert.equal(base.source.pages.id,record.recoveredPagesId);
 assert.equal(base.source.workerVersion,prior.source.workerVersion);assertProductionPages(project(),base);
});
for(const [name,change]of [
 ['source commit',r=>r.source.commit='changed'],['source Worker',r=>r.source.workerVersion='changed'],
 ['Studio commit',r=>r.studio.commit='changed'],['Studio Worker',r=>r.studio.workerVersion='changed'],
 ['coordinator',r=>r.coordinatorVersion='changed'],['receipt Pages',r=>r.source.pages.id='changed'],
 ['version',r=>r.version='109.23']
])test('recovery record rejects changed '+name,()=>{const prior=receipt();change(prior);assert.throws(()=>recoveredBaseline(prior,record,'109.25'));});
for(const [name,change]of [
 ['live Pages ID',p=>p.canonical_deployment.id='changed'],['live Pages commit',p=>p.canonical_deployment.deployment_trigger.metadata.commit_hash='changed'],
 ['preview target',p=>p.canonical_deployment.environment='preview'],['failed target',p=>p.canonical_deployment.latest_stage.status='failure'],
 ['production branch',p=>p.production_branch='feature-preview']
])test('capture refuses '+name,()=>{const p=project();change(p);assert.throws(()=>assertProductionPages(p,recoveredBaseline(receipt(),record,'109.25')));});
test('recovery verifies all three components before declaring restored',async()=>{
 const calls=[];const result=await recoverPair({restoreWorker:async s=>calls.push(s),restorePages:async()=>calls.push('pages'),verify:async()=>calls.push('verify')});
 assert.deepEqual(calls,['source','target','pages','verify']);assert.equal(result.status,'PREVIOUS_COMPATIBLE_PAIR_RESTORED');assert(result.verified);
});
for(const broken of ['source','target','pages','verify'])test('recovery continues and reports attention after '+broken+' failure',async()=>{
 const calls=[];const step=async name=>{calls.push(name);if(name===broken)throw Error('injected '+name);};
 const result=await recoverPair({restoreWorker:step,restorePages:()=>step('pages'),verify:()=>step('verify')});
 assert.deepEqual(calls,['source','target','pages','verify']);assert.equal(result.status,'RECOVERY_NEEDS_ATTENTION');assert.equal(result.errors.length,1);
});

async function cliFixture(failRecovery){
 assert.equal(process.env.GITHUB_ACTIONS,'true','Synthetic release execution belongs only in GitHub');
 const dir=await mkdtemp(resolve(process.env.RUNNER_TEMP,'release-recovery-')),out=resolve(dir,'out');
 await mkdir(out);
 const bindings=[{name:'ENVIRONMENT',type:'plain_text',text:'unchanged'}];
 const old={source:record.sourceWorkerVersion,target:record.studioWorkerVersion,coordinator:record.coordinatorVersion};
 const candidate={source:'11111111-1111-4111-8111-111111111111',target:'22222222-2222-4222-8222-222222222222'};
 const sourceCommit='a'.repeat(40),oldPage=project().canonical_deployment;
 const workers=Object.fromEntries(Object.entries(old).map(([side,version])=>[side,{side:side==='coordinator'?'source':side,worker:side==='source'?'devrebootworker':side==='target'?'academy-studio-parallel':'academy_split_coordinator',version,count:1,settings:{bindings},active:{versions:[{version_id:version,percentage:100}]}}]));
 const state={active:{...candidate,coordinator:old.coordinator},bindings:{source:[...bindings,{name:'BROKEN',type:'plain_text',text:'injected'}],target:bindings,coordinator:bindings},page:{...oldPage,id:'33333333-3333-4333-8333-333333333333',deployment_trigger:{metadata:{commit_hash:sourceCommit}}},calls:[],failRecovery,old,bindingsBefore:bindings,oldPage,sql:0};
 const statePath=resolve(dir,'state.json');await writeFile(statePath,JSON.stringify(state));
 const save=async(name,value)=>writeFile(resolve(out,name),JSON.stringify(value));
 const scope={source:'Academy',studio:'AcademyStudio',hosting:{academyPortalOrigin:'https://portal.test',academyApiOrigin:'https://academy.test'}};
 await save('approval-and-scope.json',scope);await save('before.json',{workers,pages:{canonical_deployment:oldPage},schedules:{schedules:[]}});
 await save('staged.json',{versions:candidate});await save('release-plan.json',{candidates:{source:{commit:sourceCommit}}});
 await save('activation.json',{status:'PAIR_ACTIVATED_PENDING_VERIFICATION'});await save('baseline.json',recoveredBaseline(receipt(),record,'109.25'));
 const stub=String.raw`import {readFile,writeFile} from 'node:fs/promises';
const path=process.env.M4L_MOCK_STATE,s=JSON.parse(await readFile(path));
const side=process.env.CLOUDFLARE_ACCOUNT_ID==='c9a3e355b3d7a795880b1d36a1dbe123'?'source':'target';
s.calls.push({kind:'wrangler',side,args:process.argv.slice(2)});
if(s.failRecovery&&side==='source'){await writeFile(path,JSON.stringify(s));process.exit(1);}
s.active[side]=process.argv[4].split('@')[0];s.bindings[side]=s.bindingsBefore;
await writeFile(path,JSON.stringify(s));
`;
 for(const folder of ['Academy/backend','AcademyStudio']){
  const target=resolve(dir,folder,'node_modules/wrangler/bin');await mkdir(target,{recursive:true});
  await writeFile(resolve(target,'wrangler.js'),stub);
 }
 const preloader=resolve(dir,'mock-cloudflare.mjs');
 await writeFile(preloader,String.raw`import {readFile,writeFile} from 'node:fs/promises';
globalThis.fetch=async(url,options={})=>{
 const path=process.env.M4L_MOCK_STATE,s=JSON.parse(await readFile(path)),u=new URL(url);
 s.calls.push({kind:'http',path:u.pathname,method:options.method||'GET'});let result;
 const side=u.pathname.includes('academy-studio-parallel')?'target':u.pathname.includes('academy_split_coordinator')?'coordinator':'source';
 if(u.hostname==='academy.test'&&u.pathname==='/api/health'){
  await writeFile(path,JSON.stringify(s));return Response.json({success:true,version:s.active.source===s.old.source?'109.24':'109.25'});
 }
 if(u.hostname!=='api.cloudflare.com')throw Error('Unexpected synthetic network destination');
 if(u.pathname.endsWith('/settings'))result={bindings:s.bindings[side]};
 else if(u.pathname.endsWith('/deployments'))result={deployments:[{versions:[{version_id:s.active[side],percentage:100}]}]};
 else if(u.pathname.endsWith('/rollback')&&options.method==='POST'){s.page=s.oldPage;result=s.page;}
 else if(u.pathname.endsWith('/pages/projects/academy-maktab4life'))result={production_branch:'development',canonical_deployment:s.page};
 else if(u.pathname.endsWith('/schedules'))result={schedules:[]};
 else throw Error('Unexpected synthetic Cloudflare operation '+u.pathname);
 await writeFile(path,JSON.stringify(s));return Response.json({success:true,result});
};
`);
 const child=spawnSync(process.execPath,['--import',pathToFileURL(preloader).href,resolve(import.meta.dirname,'../tools/paired-release.mjs'),'109.25','verify-live'],{encoding:'utf8',timeout:30000,env:{...process.env,M4L_PROJECT_ROOT:dir,M4L_RELEASE_OUTPUT:out,M4L_MOCK_STATE:statePath,CLOUDFLARE_SOURCE_API_TOKEN:'synthetic-source-token',CLOUDFLARE_STUDIO_API_TOKEN:'synthetic-studio-token'}});
 assert.notEqual(child.status,0,'Original final verification failure must still fail the release');
 const after=JSON.parse(await readFile(statePath)),recovery=JSON.parse(await readFile(resolve(out,'recovery.json')));
 assert.equal(after.sql,0);assert.equal(after.calls.filter(c=>c.path?.includes('/d1/')).length,0);
 assert.equal(after.calls.filter(c=>c.kind==='wrangler').length,2,'Both Worker recovery operations attempted');
 assert.equal(after.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/rollback')).length,1);
 assert.equal(after.page.id,record.recoveredPagesId);
 assert.equal(after.active.target,old.target);
 return {after,recovery,old};
}
test('actual release CLI recovers and verifies Workers and exact Pages rollback after final live-check failure',async()=>{
 const {after,recovery,old}=await cliFixture(false);
 assert.equal(recovery.status,'PREVIOUS_COMPATIBLE_PAIR_RESTORED');assert.equal(recovery.verified,true);
 assert.equal(after.active.source,old.source);assert.equal(after.active.coordinator,old.coordinator);
});
test('actual release CLI records recovery failure and still attempts Studio and Pages',async()=>{
 const {recovery}=await cliFixture(true);assert.equal(recovery.status,'RECOVERY_NEEDS_ATTENTION');assert.equal(recovery.verified,false);
});
