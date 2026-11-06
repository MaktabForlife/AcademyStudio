import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {CONTEXT,PROPOSAL,APPROVAL,CLAIM,RECEIPT,digest,proposalBody,approvalBody,validatePolicy,validateManifest,validateApproval,executeApproved,discover,GitHub,GitTransport,packLines,deletionPayload,main,daily,TITLE} from '../tools/validation-cleanup.mjs';
const A='a'.repeat(40),B='b'.repeat(40),C='c'.repeat(40),integrity='d'.repeat(64);
const repo='MaktabForlife/Academy',prefix='/repos/'+repo,now=Date.parse('2026-11-06T12:00:00Z');
const drive='https://docs.google.com/document/d/approved-report/edit';
const policy={schema:1,repository:repo,anchors:['studio_dev'],heldPrefixes:['validation/approved-deployment-'],activeRefs:['feature/jwt-v110-browser-integration-20261105'],reviewerId:285054382,reviewerLogin:'MaktabForlife',approvalContext:CONTEXT};
const clone=x=>structuredClone(x);
function fixture(){
 const e={branch:'validation/synthetic-complete',sha:A,anchor:'studio_dev',anchorSha:B,runs:[{id:21,sha:A,status:'completed',conclusion:'success',artifacts:[{id:31,digest:'sha256:'+'e'.repeat(64),expiresAt:'2026-12-06T00:00:00Z'}]}]};
 const m={schema:1,batch:'11111111-1111-4111-8111-111111111111',repository:repo,createdAt:'2026-11-06T10:00:00Z',integrity,entries:[e]};
 const issue={number:1,state:'open',title:TITLE+'synthetic',user:{id:41898282,login:'github-actions[bot]'},url:'https://api.github.com'+prefix+'/issues/1'};
 const bot={id:41898282,login:'github-actions[bot]'},reviewer={id:285054382,login:'MaktabForlife'};
 const proposal={id:11,user:bot,body:proposalBody(m),created_at:'2026-11-06T10:00:00Z',updated_at:'2026-11-06T10:00:00Z',issue_url:issue.url};
 const approval={id:12,user:reviewer,body:approvalBody(m,11,drive),created_at:'2026-11-06T11:00:00Z',updated_at:'2026-11-06T11:00:00Z',issue_url:issue.url,html_url:'https://github.com/'+repo+'/issues/1#issuecomment-12'};
 const status={id:100,context:CONTEXT,state:'success',creator:reviewer,description:'approve:'+digest(m),target_url:approval.html_url,created_at:'2026-11-06T11:00:01Z'};
 const state={m,e,issue,proposal,approval,statuses:{[A]:[status]},events:[],comments:[proposal,approval],pulls:[],busy:[],branchSHA:A,protected:false,anchor:B,active:C,evidence:true,expiry:'2026-12-06T00:00:00Z',fetches:0,claims:0,deletes:0,mutations:[],refs:{['refs/heads/'+e.branch]:A,'refs/heads/studio_dev':B,'refs/tags/synthetic':C}};
 const ctx={repository:repo,runId:'900',sourceSha:B,integrity,now:()=>now};
 const api={
  async api(method,path,body){
   state.fetches++;
   if(method==='PATCH'){Object.assign(state.issue,body);return clone(state.issue);}
   if(method==='POST'){
    state.mutations.push({method,path,body});
    const comment={id:1000+state.mutations.length,user:bot,body:body.body,created_at:'2026-11-06T12:00:00Z',updated_at:'2026-11-06T12:00:00Z'};
    if(path===prefix+'/issues')return {number:2,user:bot,state:'open'};
    state.comments.push(comment);if(body.body.startsWith(CLAIM))state.claims++;return comment;
   }
   if(path===prefix+'/issues/1')return clone(state.issue);
   if(path===prefix+'/issues/comments/11')return clone(state.proposal);
   if(path===prefix+'/branches/'+encodeURIComponent(e.branch))return {protected:state.protected,commit:{sha:state.branchSHA}};
   if(path===prefix+'/actions/runs/21')return {id:21,head_sha:A,head_branch:e.branch,status:'completed',conclusion:'success'};
   throw Error('Unexpected API '+method+' '+path);
  },
  async list(path,key){
   state.fetches++;
   if(path===prefix+'/issues?state=all')return [clone(state.issue)];
   if(path===prefix+'/issues/1/comments')return clone(state.comments);
   if(path===prefix+'/issues/1/events')return clone(state.events);
   if(path===prefix+'/commits/'+A+'/statuses')return clone(state.statuses[A]);
   if(path.includes('/pulls?'))return path.startsWith(prefix+'/')?clone(state.pulls):[];
   if(/\/actions\/runs\?status=/.test(path))return state.busy.filter(x=>path.includes('status='+x.status));
   if(path===prefix+'/deployments')return [];
   if(path===prefix+'/actions/runs?branch='+encodeURIComponent(e.branch))return [{id:21,head_sha:A,head_branch:e.branch,status:'completed',conclusion:'success'}];
   if(path===prefix+'/actions/runs/21/artifacts')return state.evidence?[{id:31,digest:'sha256:'+'e'.repeat(64),expires_at:state.expiry,expired:false}]:[];
   if(path===prefix+'/branches')return [{name:e.branch,commit:{sha:state.branchSHA},protected:state.protected},{name:'studio_dev',commit:{sha:state.anchor}},{name:policy.activeRefs[0],commit:{sha:state.active}}];
   throw Error('Unexpected list '+path+' '+key);
  },
  async getRef(_repo,name){return {object:{sha:name==='studio_dev'?state.anchor:state.active}};},
  async preserved(_repo,oldHead,currentHead){return [A,B].includes(oldHead)&&currentHead===B;}
 };
 const git={async refs(){return {...state.refs};},async remove(entries){assert.equal(state.claims,1,'Claim must precede Git mutation');state.deletes++;for(const x of entries){assert.equal(state.refs['refs/heads/'+x.branch],x.sha,'Old-ID CAS');delete state.refs['refs/heads/'+x.branch];}return entries.map(e=>'ok '+e.branch);}};
 return {state,ctx,api,git,policy:clone(policy),issue,proposal,m,manifest:m,approval,statuses:state.statuses,now,events:state.events,async execute(options={}){return executeApproved({api,git,ctx,policy,issue,proposal,...options});}};
}
test('A dedicated exact-manifest approval authorises one claimed transaction and retains tags',async()=>{
 const f=fixture();const r=await f.execute();assert.equal(r.deleted.length,1);assert.equal(f.state.deletes,1);assert.equal(f.state.claims,1);assert.equal(f.state.refs['refs/tags/synthetic'],C);
 await assert.rejects(f.execute(),/consumed/);assert.equal(f.state.deletes,1);
});
test('Manifest validation rejects held/non-validation/unsafe names and malformed authority fields',()=>{
 for(const branch of ['studio_dev','feature-preview','feature/jwt-v110-test','rollback/keep','validation/approved-deployment-feature','validation/../bad','validation/a\nb','validation/a.lock']){
  const f=fixture();f.m.entries[0].branch=branch;assert.throws(()=>validateManifest(f.m,f.policy,integrity),branch);
 }
 for(const mutate of [m=>m.repository='other/repo',m=>m.integrity='x',m=>m.entries[0].sha='bad',m=>m.entries[0].runs=[],m=>m.entries[0].runs[0].artifacts=[],m=>m.extra=true,m=>m.entries.push(clone(m.entries[0]))]){
  const f=fixture();mutate(f.m);assert.throws(()=>validateManifest(f.m,f.policy,integrity));
 }
 assert.throws(()=>validatePolicy({...policy,reviewerId:1},repo));assert.throws(()=>validatePolicy({...policy,heldPrefixes:[]},repo));
});
test('The canonical positive reviewer record is checked before negative approval cases',()=>{const f=fixture();const r=validateApproval(f);assert.equal(r.approvalId,12);assert.equal(r.driveReport,drive);});
test('Approval matrix rejects generic, spoofed, edited, revoked, replayed and incorrectly bound records',async t=>{
 const cases={
  'generic PR approval':f=>f.statuses[A][0].context='optimisation/approval',
  'wrong reviewer account':f=>f.approval.user.id=1,
  'spoofed status creator':f=>f.statuses[A][0].creator.id=1,
  'wrong reviewer login':f=>f.approval.user.login='someone',
  'edited approval':f=>f.approval.updated_at='2026-11-06T11:01:00Z',
  'edited proposal':f=>f.proposal.updated_at='2026-11-06T10:01:00Z',
  'wrong proposal issue':f=>f.proposal.issue_url='https://api.github.com/repos/other/repo/issues/1',
  'wrong approval URL':f=>f.approval.html_url+='-edited',
  'wrong status URL':f=>f.statuses[A][0].target_url='https://example.invalid',
  'different manifest hash':f=>f.statuses[A][0].description='approve:'+'f'.repeat(64),
  'latest failure revokes success':f=>f.statuses[A].push({...clone(f.statuses[A][0]),id:101,state:'failure'}),
  'closed proposal':f=>f.issue.state='closed',
  'reopened proposal':f=>f.events.push({event:'reopened'}),
  'missing statuses':f=>f.statuses[A]=[],
  'old status before approval':f=>f.statuses[A][0].created_at='2026-11-06T10:59:59Z',
  'unsupported Drive record':f=>f.approval.body=approvalBody(f.m,11,'https://example.invalid'),
  'approval denial flag':f=>f.approval.body=f.approval.body.replace('"notActiveWork":true','"notActiveWork":false')
 };
 for(const [name,mutate] of Object.entries(cases))await t.test(name,()=>{const f=fixture();mutate(f);assert.throws(()=>validateApproval(f));assert.equal(f.state.deletes,0);});
});
test('Pre-claim guards protect open PRs, paired jobs, active tips, moved/protected refs and missing evidence',async t=>{
 const cases={
  'open PR':f=>f.state.pulls.push({head:{ref:f.state.e.branch},base:{ref:'studio_dev'}}),
  'paired workflow':f=>f.state.busy.push({id:999,status:'in_progress',path:'paired-release.yml',head_branch:'studio_dev'}),
  'current active JWT tip':f=>f.state.active=A,
  'candidate moved':f=>f.state.branchSHA=C,
  'protected ref':f=>f.state.protected=true,
  'lost anchor':f=>f.state.anchor=C,
  'missing artifact':f=>f.state.evidence=false,
  'expired/changed evidence':f=>f.state.expiry='2026-01-01T00:00:00Z'
 };
 for(const [name,mutate] of Object.entries(cases))await t.test(name,async()=>{const f=fixture();mutate(f);await assert.rejects(f.execute());assert.equal(f.state.claims,0);assert.equal(f.state.deletes,0);});
});
test('Exact static tool references stop deletion',async()=>{const f=fixture();await assert.rejects(f.execute({staticRefs:['checkout '+f.state.e.branch]}),/Static dependency/);assert.equal(f.state.claims,0);});
test('Own current cleanup run does not deadlock the global busy guard',async()=>{const f=fixture();f.state.busy.push({id:900,status:'in_progress',path:'.github/workflows/validation-cleanup.yml',head_branch:'studio_dev'});await f.execute();assert.equal(f.state.deletes,1);});
test('Revocation after the durable claim consumes the batch without attempting Git deletion',async()=>{const f=fixture();await assert.rejects(f.execute({onClaim:()=>{f.state.statuses[A].push({...clone(f.state.statuses[A][0]),id:101,state:'failure'});}}));assert.equal(f.state.claims,1);assert.equal(f.state.deletes,0);await assert.rejects(f.execute(),/consumed/);});
test('Head movement after claim never reaches the mutation',async()=>{const f=fixture();await assert.rejects(f.execute({onClaim:()=>{f.state.branchSHA=C;f.state.refs['refs/heads/'+f.state.e.branch]=C;}}));assert.equal(f.state.claims,1);assert.equal(f.state.deletes,0);});
test('A new paired run after claim stops deletion',async()=>{const f=fixture();await assert.rejects(f.execute({onClaim:()=>{f.state.busy.push({id:999,status:'queued',head_branch:'studio_dev',path:'release.yml'});}}));assert.equal(f.state.claims,1);assert.equal(f.state.deletes,0);});
test('A default-workflow source change after claim stops deletion',async()=>{const f=fixture();await assert.rejects(f.execute({onClaim:()=>{f.state.anchor=C;}}));assert.equal(f.state.deletes,0);});
test('A lost successful mutation response cannot be automatically repeated',async()=>{const f=fixture();const original=f.git.remove;f.git.remove=async entries=>{await original(entries);throw Error('unknown HTTP outcome');};await assert.rejects(f.execute(),/unknown/);assert.equal(f.state.deletes,1);await assert.rejects(f.execute(),/consumed/);assert.equal(f.state.deletes,1);});
test('Discovery preserves current active tips and requires terminal runs with preserved artifacts',async()=>{
 const f=fixture();let entries=await discover(f.api,f.ctx,f.policy,new Set(),[]);assert.equal(entries.length,1);
 f.state.active=A;assert.deepEqual(await discover(f.api,f.ctx,f.policy,new Set(),[]),[]);
 f.state.active=C;assert.deepEqual(await discover(f.api,f.ctx,f.policy,new Set([f.state.e.branch+'@'+A]),[]),[]);
 f.state.evidence=false;assert.deepEqual(await discover(f.api,f.ctx,f.policy,new Set(),[]),[]);
});
test('Deletion payload contains only exact old-ID to zero-ID validation deletions, with atomic status capability',()=>{
 const f=fixture(),b=deletionPayload(f.m.entries),lines=packLines(b);assert.equal(lines.at(-1),null);
 assert.equal(lines[0].toString(),A+' '+'0'.repeat(40)+' refs/heads/'+f.state.e.branch+'\0report-status atomic\n');
 assert.throws(()=>deletionPayload([{branch:'feature-preview',sha:A}]));
 assert.throws(()=>packLines(Buffer.from('0008x')));
});
test('Git HTTP transport refuses bad response types, redirects and rejected atomic statuses',async()=>{
 let writes=0;
 const transport=new GitTransport(repo,'synthetic-not-a-real-token',async(url,options)=>{
  assert.equal(options.redirect,'error');assert(url.startsWith('https://github.com/'+repo+'.git/'));
  writes++;return new Response('bad',{status:200,headers:{'content-type':'text/plain'}});
 });
 await assert.rejects(transport.remove([{branch:'validation/test',sha:A}]));
 assert.equal(writes,1);assert.throws(()=>new GitTransport('other/repo','x'));
});
test('GitHub API scope and pagination fail closed instead of inferring missing data',async()=>{
 const api=new GitHub('synthetic-not-a-real-token',async url=>new Response(JSON.stringify(Array.from({length:100},()=>({id:1}))),{status:200,headers:{'content-type':'application/json'}}));
 await assert.rejects(api.list('/repos/'+repo+'/issues'),/Incomplete pagination/);
 await assert.rejects(api.api('GET','/repos/other/repo/issues'),/API scope/);
});
test('The writable entrypoint refuses a feature branch before any network call',async()=>{await assert.rejects(main({GITHUB_REPOSITORY:repo,GITHUB_REF:'refs/heads/feature/untrusted',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SHA:A,GITHUB_TOKEN:'synthetic',GITHUB_RUN_ID:'1'}));});
test('Workflow confines writes to trusted default scheduling/dispatch and cannot grant its own approval',async()=>{
 const yaml=await readFile(new URL('../.github/workflows/validation-cleanup.yml',import.meta.url),'utf8');
 assert(yaml.includes("cron: '17 6 * * *'"));assert(yaml.includes("github.ref == 'refs/heads/studio_dev'"));
 assert(yaml.includes('statuses: read'));assert(!yaml.includes('statuses: write'));
 assert(!/pull_request_target|CF_FEATURE_DEPLOY_TOKEN|CF_API_TOKEN|environment:/.test(yaml));
 assert(yaml.includes('persist-credentials: false'));assert(yaml.includes('set -euo pipefail'));
});
test('Real disposable Git receive-pack proves successful deletion preserves source and tags',async()=>{
 assert.equal(process.env.GITHUB_ACTIONS,'true','Git fixture runs only in disposable GitHub');
 const dir=await mkdtemp(join(tmpdir(),'validation-cleanup-git-'));
 const env={...process.env,GIT_AUTHOR_NAME:'Synthetic',GIT_AUTHOR_EMAIL:'synthetic@example.invalid',GIT_COMMITTER_NAME:'Synthetic',GIT_COMMITTER_EMAIL:'synthetic@example.invalid'};
 const git=(...args)=>execFileSync('git',['--git-dir',dir,...args],{env,encoding:'utf8'});
 execFileSync('git',['init','--bare',dir],{env,stdio:'pipe'});
 const tree=execFileSync('git',['--git-dir',dir,'mktree'],{input:'',env,encoding:'utf8'}).trim();
 const one=git('commit-tree',tree,'-m','synthetic-one').trim(),two=git('commit-tree',tree,'-p',one,'-m','synthetic-two').trim();
 git('update-ref','refs/heads/studio_dev',two);git('update-ref','refs/heads/validation/test',one);git('update-ref','refs/tags/evidence',one);
 const sent=spawnSync('git',['receive-pack','--stateless-rpc',dir],{input:deletionPayload([{branch:'validation/test',sha:one}]),env});
 assert.equal(sent.status,0);const report=packLines(sent.stdout).filter(Boolean).map(x=>x.toString().trim());assert(report.includes('ok refs/heads/validation/test'));
 assert.equal(git('rev-parse','refs/heads/studio_dev').trim(),two);assert.equal(git('rev-parse','refs/tags/evidence').trim(),one);
 assert.notEqual(spawnSync('git',['--git-dir',dir,'show-ref','--verify','refs/heads/validation/test']).status,0);
});
test('Real disposable atomic Git race preserves every candidate if one expected old ID changed',async()=>{
 assert.equal(process.env.GITHUB_ACTIONS,'true');
 const dir=await mkdtemp(join(tmpdir(),'validation-cleanup-race-'));
 const env={...process.env,GIT_AUTHOR_NAME:'Synthetic',GIT_AUTHOR_EMAIL:'synthetic@example.invalid',GIT_COMMITTER_NAME:'Synthetic',GIT_COMMITTER_EMAIL:'synthetic@example.invalid'};
 const git=(...args)=>execFileSync('git',['--git-dir',dir,...args],{env,encoding:'utf8'});
 execFileSync('git',['init','--bare',dir],{env,stdio:'pipe'});
 const tree=execFileSync('git',['--git-dir',dir,'mktree'],{input:'',env,encoding:'utf8'}).trim();
 const one=git('commit-tree',tree,'-m','one').trim(),two=git('commit-tree',tree,'-p',one,'-m','two').trim();
 git('update-ref','refs/heads/studio_dev',two);git('update-ref','refs/heads/validation/one',two);git('update-ref','refs/heads/validation/two',one);
 const sent=spawnSync('git',['receive-pack','--stateless-rpc',dir],{input:deletionPayload([{branch:'validation/one',sha:one},{branch:'validation/two',sha:one}]),env});
 const report=packLines(sent.stdout).filter(Boolean).map(x=>x.toString().trim());assert(report.some(x=>x.startsWith('ng ')));
 assert.equal(git('rev-parse','refs/heads/validation/one').trim(),two);assert.equal(git('rev-parse','refs/heads/validation/two').trim(),one);assert.equal(git('rev-parse','refs/heads/studio_dev').trim(),two);
});

test('Daily execution leaves an incomplete approval open and sends no mutation',async()=>{
 const f=fixture();f.state.statuses[A]=[];
 const result=await daily(f.api,f.git,f.ctx,f.policy,process.cwd(),false,0);
 assert(result.some(x=>x.mode==='awaiting-valid-dedicated-approval'));assert.equal(f.state.issue.state,'open');assert.equal(f.state.mutations.length,0);assert.equal(f.state.deletes,0);
});
test('Repeated daily checks deduplicate one pending proposal without new comments or issues',async()=>{
 const f=fixture();f.state.comments=[f.proposal];
 for(let i=0;i<2;i++){const result=await daily(f.api,f.git,f.ctx,f.policy,process.cwd(),false,0);assert(result.some(x=>x.mode==='awaiting-existing-review'));}
 assert.equal(f.state.mutations.length,0);assert.equal(f.state.deletes,0);
});
test('Manual dry-run cannot consume an already approved batch',async()=>{
 const f=fixture();const result=await daily(f.api,f.git,f.ctx,f.policy,process.cwd(),true,0);
 assert(result.some(x=>x.mode==='dry-run-approved-pending'));assert.equal(f.state.claims,0);assert.equal(f.state.deletes,0);assert.equal(f.state.mutations.length,0);
});
test('Daily execution records and closes one result; recreated old head cannot replay that approval',async()=>{
 const f=fixture();let result=await daily(f.api,f.git,f.ctx,f.policy,process.cwd(),false,0);
 assert.equal(result[0].outcome,'verified');assert.equal(f.state.issue.state,'closed');assert.equal(f.state.deletes,1);assert(f.state.comments.some(c=>c.body.startsWith(RECEIPT)));
 f.state.refs['refs/heads/'+f.state.e.branch]=A;
 result=await daily(f.api,f.git,f.ctx,f.policy,process.cwd(),false,0);
 assert(result.some(x=>x.mode==='nothing-eligible'));assert.equal(f.state.deletes,1);
 result=await daily(f.api,f.git,f.ctx,f.policy,process.cwd(),false,1);
 assert(result.some(x=>x.mode==='proposal-created'));assert.equal(f.state.deletes,1);
 const fresh=f.state.comments.find(c=>c.body.startsWith(PROPOSAL)&&c.id!==11);
 const m=JSON.parse(fresh.body.slice(PROPOSAL.length+1));assert.notEqual(m.batch,f.m.batch);assert.notEqual(digest(m),digest(f.m));
});

test('Skipped non-test runs preserve their terminal record without suppressing evidenced validation',async()=>{
 const f=fixture();const skipped={id:22,sha:A,status:'completed',conclusion:'skipped',artifacts:[]};
 f.m.entries[0].runs.push(skipped);
 f.proposal.body=proposalBody(f.m);f.approval.body=approvalBody(f.m,11,drive);
 f.statuses[A][0].description='approve:'+digest(f.m);
 const list=f.api.list.bind(f.api),api=f.api.api.bind(f.api);
 f.api.list=async(path,key)=>{
  if(path===prefix+'/actions/runs?branch='+encodeURIComponent(f.state.e.branch))return [
   {id:21,head_sha:A,head_branch:f.state.e.branch,status:'completed',conclusion:'success'},
   {id:22,head_sha:A,head_branch:f.state.e.branch,status:'completed',conclusion:'skipped'}
  ];
  if(path===prefix+'/actions/runs/22/artifacts')return [];
  return list(path,key);
 };
 f.api.api=async(method,path,body)=>{
  if(path===prefix+'/actions/runs/22')return {id:22,head_sha:A,head_branch:f.state.e.branch,status:'completed',conclusion:'skipped'};
  return api(method,path,body);
 };
 const entries=await discover(f.api,f.ctx,f.policy,new Set(),[]);
 assert.equal(entries.length,1);assert.deepEqual(entries[0].runs[1],skipped);
 validateManifest(f.m,f.policy,integrity);
 const result=await f.execute();assert.equal(result.deleted.length,1);assert.equal(f.state.deletes,1);
});
test('All-skipped workflows and missing evidence for executed failures cannot become deletion authority',async()=>{
 const f=fixture();f.m.entries[0].runs=[{id:22,sha:A,status:'completed',conclusion:'skipped',artifacts:[]}];
 assert.throws(()=>validateManifest(f.m,f.policy,integrity),/evidenced validation/);
 f.m.entries[0].runs[0].conclusion='failure';
 assert.throws(()=>validateManifest(f.m,f.policy,integrity),/Evidence required/);
 const list=f.api.list.bind(f.api);
 f.api.list=async(path,key)=>{
  if(path===prefix+'/actions/runs?branch='+encodeURIComponent(f.state.e.branch))return [{id:22,head_sha:A,head_branch:f.state.e.branch,status:'completed',conclusion:'skipped'}];
  if(path===prefix+'/actions/runs/22/artifacts')return [];
  return list(path,key);
 };
 assert.deepEqual(await discover(f.api,f.ctx,f.policy,new Set(),[]),[]);
});
