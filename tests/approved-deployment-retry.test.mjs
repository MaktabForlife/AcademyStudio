import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

async function fixture(kind){
 assert.equal(process.env.GITHUB_ACTIONS,'true','Actual CLI race tests run only in disposable GitHub');
 const root=await mkdtemp(resolve(process.env.RUNNER_TEMP,'approved-retry-')),out=resolve(root,'out');await mkdir(out);
 const commits={},old={source:'11111111-1111-4111-8111-111111111111',target:'22222222-2222-4222-8222-222222222222',coordinator:'33333333-3333-4333-8333-333333333333'};
 const candidate={source:'44444444-4444-4444-8444-444444444444',target:'55555555-5555-4555-8555-555555555555'},foreign='66666666-6666-4666-8666-666666666666';
 const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',env:{...process.env,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1'}}).trim();
 const configHashes={};
 for(const [side,folder]of [['source','Academy'],['target','AcademyStudio']]){
  const dir=resolve(root,folder),config=side==='source'?'backend/wrangler.jsonc':'wrangler.production.jsonc';await mkdir(resolve(dir,'backend'),{recursive:true});
  git(dir,'init','-q');git(dir,'config','user.email','synthetic@example.invalid');git(dir,'config','user.name','Synthetic');
  await writeFile(resolve(dir,'.gitignore'),'node_modules/\nbackend/node_modules/\n');
  await writeFile(resolve(dir,config),JSON.stringify({name:side==='source'?'devrebootworker':'academy-studio-parallel'}));
  await writeFile(resolve(dir,'worker.mjs'),'export const version="109.25";\n');git(dir,'add','.');git(dir,'commit','-qm','synthetic old');
  const base=git(dir,'rev-parse','HEAD');await writeFile(resolve(dir,'worker.mjs'),'export const version="109.26";\n');git(dir,'add','.');git(dir,'commit','-qm','synthetic candidate');
  commits[side]={base,commit:git(dir,'rev-parse','HEAD'),dir};
  configHashes[folder+'/'+config]=createHash('sha256').update(await readFile(resolve(dir,config))).digest('hex');
 }
 const rollback=resolve(root,'rollback');await mkdir(rollback);
 const bindings=[{name:'MODE',type:'plain_text',text:'same'}],controlMerge='b'.repeat(40),controlHead='a'.repeat(40),controlTree='c'.repeat(40);
 const plan={schema:1,request:'synthetic-retry',kind:'release',target:'production',contains_jwt:false,database_changes:false,version:'109.26',source_sha:commits.source.commit,studio_sha:commits.target.commit};
 const comment={id:42,user:{login:'MaktabForlife'},created_at:'2026-11-06T00:00:00Z',body:'Optimisation approval\nhead: '+controlHead+'\ntarget: production\ndb-changes: none'};
 const status={id:12,context:'optimisation/approval',state:'success',creator:{login:'MaktabForlife'},created_at:'2026-11-06T00:00:01Z',target_url:'https://github.com/MaktabForlife/AcademyStudio/pull/7#issuecomment-42',description:'optimisation-record-sha256:'+createHash('sha256').update(comment.body).digest('hex')};
 const pr={number:7,changed_files:1,state:'closed',merged:true,merged_at:'2026-11-06T00:00:02Z',merge_commit_sha:controlMerge,head:{sha:controlHead},base:{ref:'studio_dev',repo:{full_name:'MaktabForlife/AcademyStudio'}},merged_by:{login:'MaktabForlife'},html_url:'https://github.com/MaktabForlife/AcademyStudio/pull/7'};
 const oldPage={id:'77777777-7777-4777-8777-777777777777',environment:'production',latest_stage:{status:'success'},deployment_trigger:{metadata:{commit_hash:commits.source.base}}};
 const recovery=kind==='recovery-owner';
 const state={kind,old,candidate,foreign,active:{...(recovery?candidate:{source:old.source,target:old.target}),coordinator:old.coordinator},bindings:{source:recovery?[...bindings,{name:'BROKEN',type:'plain_text',text:'injected'}]:bindings,target:bindings,coordinator:bindings},bindingsBefore:bindings,oldPage,page:recovery?{...oldPage,id:'88888888-8888-4888-8888-888888888888',deployment_trigger:{metadata:{commit_hash:commits.source.commit}}}:oldPage,controlMerge,controlHead,controlTree,currentCanonical:controlMerge,plan,comment,status,pr,sourceFile:resolve(commits.source.dir,'worker.mjs'),calls:[],pending:false,mutations:[],sql:0};
 const stateFile=resolve(root,'state.json');await writeFile(stateFile,JSON.stringify(state));
 const workers=Object.fromEntries(Object.entries(old).map(([key,version])=>[key,{side:key==='coordinator'?'source':key,worker:key==='source'?'devrebootworker':key==='target'?'academy-studio-parallel':'academy_split_coordinator',version,count:1,settings:{bindings},active:{versions:[{version_id:version,percentage:100}]}}]));
 const save=async(name,value)=>writeFile(resolve(out,name),JSON.stringify(value));
 await save('approval-and-scope.json',{source:'Academy',studio:'AcademyStudio',hosting:{academyPortalOrigin:'https://portal.test',academyApiOrigin:'https://academy.test'}});
 await save('before.json',{workers,pages:{canonical_deployment:oldPage},schedules:{schedules:[]}});
 await save('staged.json',{versions:candidate});await save('staged-verification.json',{passed:true});
 await save('baseline.json',{version:'109.25',source:{commit:commits.source.base,pages:{id:oldPage.id}},studio:{commit:commits.target.base}});
 await save('release-plan.json',{version:'109.26',candidates:{source:{commit:commits.source.commit},target:{commit:commits.target.commit}},configHashes,manifests:{},databaseUpdates:[],rollback:{pagesArtifact:rollback,pagesManifest:{manifest:{}}}});
 if(recovery)await save('activation.json',{status:'PAIR_ACTIVATED_PENDING_VERIFICATION'});
 const stub=String.raw`import {readFile,writeFile} from 'node:fs/promises';
const path=process.env.MOCK_RELEASE_STATE,s=JSON.parse(await readFile(path));
const side=process.env.CLOUDFLARE_ACCOUNT_ID==='c9a3e355b3d7a795880b1d36a1dbe123'?'source':'target';
const id=process.argv[4]?.split('@')[0],isVersion=process.argv[2]==='versions';
s.calls.push({kind:'wrangler',side,id,args:process.argv.slice(2)});
const selected=(s.kind==='recovery-owner'&&id===s.old.source)||(s.kind!=='recovery-owner'&&id===s.candidate.source);
if(isVersion&&side==='source'&&selected&&!s.failedOnce){s.failedOnce=true;s.pending=true;await writeFile(path,JSON.stringify(s));console.log('code: 100146');process.exit(1);}
if(isVersion){s.active[side]=id;s.bindings[side]=s.bindingsBefore;}
else if(process.argv[2]==='pages'){s.page={...s.oldPage,id:'88888888-8888-4888-8888-888888888888',deployment_trigger:{metadata:{commit_hash:s.plan.source_sha}}};}
await writeFile(path,JSON.stringify(s));
`;
 for(const dir of [resolve(root,'Academy/backend/node_modules/wrangler/bin'),resolve(root,'AcademyStudio/node_modules/wrangler/bin')]){await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'wrangler.js'),stub);}
 const preload=resolve(root,'mock-api.mjs');
 await writeFile(preload,String.raw`import {readFile,writeFile} from 'node:fs/promises';import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
const nativeSetTimeout=globalThis.setTimeout;
globalThis.setTimeout=(callback,ms,...args)=>{
 if(ms===10000||ms===20000){
  const path=process.env.MOCK_RELEASE_STATE,s=JSON.parse(readFileSync(path));if(s.pending){
   if(s.kind==='approval')s.status.state='failure';
   if(s.kind==='canonical')s.currentCanonical='d'.repeat(40);
   if(s.kind==='freeze')appendFileSync(s.sourceFile,'\n// unexpected concurrent edit\n');
   if(s.kind==='recovery-owner')s.active.source=s.foreign;
   s.pending=false;s.mutations.push({duringDelay:ms,kind:s.kind});writeFileSync(path,JSON.stringify(s));
  }return nativeSetTimeout(callback,0,...args);
 }return nativeSetTimeout(callback,ms,...args);
};
let serial=Promise.resolve();
globalThis.fetch=(...args)=>{const next=serial.then(()=>mock(...args));serial=next.catch(()=>{});return next;};
async function mock(url,options={}){
 const path=process.env.MOCK_RELEASE_STATE,s=JSON.parse(await readFile(path)),u=new URL(url);s.calls.push({kind:'http',host:u.hostname,path:u.pathname,method:options.method||'GET'});let result;
 if(u.hostname==='api.github.com'){
  if(u.pathname.endsWith('/commits/'+s.controlMerge+'/pulls'))result=[s.pr];
  else if(u.pathname.endsWith('/pulls/7'))result=s.pr;
  else if(u.pathname.endsWith('/pulls/7/files'))result=[{filename:'deployment/release-plan.json'}];
  else if(u.pathname.endsWith('/statuses'))result=[s.status];
  else if(u.pathname.endsWith('/git/ref/heads/studio_dev'))result={object:{sha:s.currentCanonical}};
  else if(u.pathname.endsWith('/git/commits/'+s.controlMerge))result={sha:s.controlMerge,tree:{sha:s.controlTree}};
  else if(u.pathname.endsWith('/git/commits/'+s.controlHead))result={sha:s.controlHead,tree:{sha:s.controlTree}};
  else if(u.pathname.endsWith('/contents/deployment/release-plan.json'))result={size:1024,encoding:'base64',content:Buffer.from(JSON.stringify(s.plan)).toString('base64')};
  else if(u.pathname.endsWith('/issues/comments/42'))result=s.comment;
  else throw Error('Unexpected synthetic GitHub path '+u.pathname);
  await writeFile(path,JSON.stringify(s));return Response.json(result);
 }
 if((u.hostname==='academy.test'||u.hostname==='devrebootworker.maktab4life.workers.dev')&&u.pathname==='/api/health'){
  await writeFile(path,JSON.stringify(s));return Response.json({success:true,version:s.active.source===s.old.source?'109.25':'109.26'});
 }
 if(u.hostname!=='api.cloudflare.com')throw Error('Unexpected network request blocked');
 const side=u.pathname.includes('academy-studio-parallel')?'target':u.pathname.includes('academy_split_coordinator')?'coordinator':'source';
 if(u.pathname.endsWith('/settings'))result={bindings:s.bindings[side]};
 else if(u.pathname.endsWith('/deployments'))result={deployments:[{versions:[{version_id:s.active[side],percentage:100}]}]};
 else if(u.pathname.endsWith('/schedules'))result={schedules:[]};
 else if(u.pathname.endsWith('/rollback')&&options.method==='POST'){s.page=s.oldPage;result=s.page;}
 else if(u.pathname.endsWith('/pages/projects/academy-maktab4life'))result={production_branch:'development',canonical_deployment:s.page};
 else throw Error('Unexpected Cloudflare operation blocked');
 await writeFile(path,JSON.stringify(s));return Response.json({success:true,result});
}
`);
 const child=spawnSync(process.execPath,['--import',pathToFileURL(preload).href,resolve(import.meta.dirname,'../tools/paired-release.mjs'),'109.26',recovery?'verify-live':'activate'],{encoding:'utf8',timeout:30000,env:{...process.env,M4L_PROJECT_ROOT:root,M4L_RELEASE_OUTPUT:out,MOCK_RELEASE_STATE:stateFile,M4L_APPROVAL_MERGE_SHA:controlMerge,GH_TOKEN:'synthetic-github-only',CLOUDFLARE_SOURCE_API_TOKEN:'synthetic-source-only',CLOUDFLARE_STUDIO_API_TOKEN:'synthetic-studio-only'}});
 assert.notEqual(child.status,0,'The interrupted release must fail');
 const after=JSON.parse(await readFile(stateFile)),record=JSON.parse(await readFile(resolve(out,'recovery.json')));
 assert.equal(after.sql,0);assert(after.calls.every(c=>c.kind==='wrangler'||['api.github.com','api.cloudflare.com','academy.test','devrebootworker.maktab4life.workers.dev'].includes(c.host)));
 assert.equal(after.mutations.length,1,'The race must occur during the explicit retry delay');
 return {after,record,candidate,old,foreign,stdout:child.stdout,stderr:child.stderr};
}
for(const kind of ['approval','canonical','freeze'])test('actual candidate CLI retry stops before a second write after '+kind+' changes during delay',async()=>{
 const {after,record,candidate,old}=await fixture(kind);
 assert.equal(after.calls.filter(c=>c.kind==='wrangler'&&c.side==='source'&&c.id===candidate.source).length,1,'No second candidate activation is authorised');
 assert.equal(after.active.source,old.source);assert.equal(record.status,'PREVIOUS_COMPATIBLE_PAIR_RESTORED');assert.equal(record.verified,true);
});
test('actual recovery retry renews ownership and preserves a foreign deployment',async()=>{
 const {after,record,old,foreign}=await fixture('recovery-owner');
 assert.equal(after.calls.filter(c=>c.kind==='wrangler'&&c.side==='source'&&c.id===old.source).length,1);
 assert.equal(after.active.source,foreign);assert.equal(record.status,'RECOVERY_NEEDS_ATTENTION');
 assert.equal(after.active.target,old.target);assert.equal(after.page.id,after.oldPage.id);
});
