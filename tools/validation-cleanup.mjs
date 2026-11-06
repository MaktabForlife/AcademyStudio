// GitHub-only validation ref housekeeping. No application, Cloudflare or DB access.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';
export const CONTEXT='optimisation/validation-cleanup';
export const TITLE='Validation cleanup proposal ';
export const PROPOSAL='<!-- validation-cleanup-proposal:v1 -->';
export const APPROVAL='<!-- validation-cleanup-approval:v1 -->';
export const CLAIM='<!-- validation-cleanup-claim:v1 -->';
export const RECEIPT='<!-- validation-cleanup-receipt:v1 -->';
const REPOS=['MaktabForlife/Academy','MaktabForlife/AcademyStudio'];
const BOT=41898282,REVIEWER=285054382;
const hash=s=>createHash('sha256').update(s).digest('hex');
const sha=s=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);
const exact=(o,keys)=>o&&Object.getPrototypeOf(o)===Object.prototype&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const validBranch=s=>typeof s==='string'&&s.startsWith('validation/')&&s.length<=200&&!/[\s~^:?*[\\@\x00-\x1f\x7f]/.test(s)&&!s.includes('..')&&!s.includes('//')&&!s.endsWith('/')&&!s.endsWith('.')&&!s.split('/').some(p=>p.startsWith('.')||p.endsWith('.lock'));
const trustedBot=c=>c?.user?.id===BOT&&c.user.login==='github-actions[bot]';
const trustedReviewer=c=>c?.user?.id===REVIEWER&&c.user.login==='MaktabForlife';
const immutable=c=>c&&c.created_at===c.updated_at;
export const digest=m=>hash(JSON.stringify(m));
export const proposalBody=m=>PROPOSAL+'\n'+JSON.stringify(m);
export const approvalBody=(m,proposalId,driveReport)=>APPROVAL+'\n'+JSON.stringify({manifest:digest(m),proposalId,completedValidation:true,notActiveWork:true,evidencePreserved:true,driveReport});
function parseBody(c,marker){
 assert(immutable(c),'Edited approval/proposal');
 assert(typeof c.body==='string'&&c.body.startsWith(marker+'\n'),'Invalid record marker');
 const value=JSON.parse(c.body.slice(marker.length+1));
 assert(c.body===marker+'\n'+JSON.stringify(value),'Noncanonical record');
 return value;
}
export function validatePolicy(p,repo){
 assert(exact(p,['schema','repository','anchors','heldPrefixes','activeRefs','reviewerId','reviewerLogin','approvalContext']));
 assert.equal(p.schema,1);assert.equal(p.repository,repo);assert(REPOS.includes(repo));
 assert.equal(p.reviewerId,REVIEWER);assert.equal(p.reviewerLogin,'MaktabForlife');assert.equal(p.approvalContext,CONTEXT);
 assert(Array.isArray(p.anchors)&&p.anchors.length>0&&p.anchors.every(a=>typeof a==='string'&&!a.startsWith('validation/')));
 assert(Array.isArray(p.heldPrefixes)&&p.heldPrefixes.includes('validation/approved-deployment-'));
 assert(Array.isArray(p.activeRefs)&&p.activeRefs.every(x=>typeof x==='string'&&!x.startsWith('validation/')));
 return p;
}
export function validateManifest(m,p,integrity){
 assert(exact(m,['schema','batch','repository','createdAt','integrity','entries']));
 assert.equal(m.schema,1);assert.match(m.batch,/^[a-f0-9-]{36}$/);assert.equal(m.repository,p.repository);
 assert.equal(m.integrity,integrity,'Cleanup implementation/policy changed');
 assert(Number.isFinite(Date.parse(m.createdAt)));
 assert(Array.isArray(m.entries)&&m.entries.length>0&&m.entries.length<=100);
 const names=new Set();
 for(const e of m.entries){
  assert(exact(e,['branch','sha','anchor','anchorSha','runs']));
  assert(validBranch(e.branch)&&!p.heldPrefixes.some(x=>e.branch.startsWith(x)),'Held or non-validation ref');
  assert(!names.has(e.branch));names.add(e.branch);
  assert(sha(e.sha)&&sha(e.anchorSha)&&p.anchors.includes(e.anchor));
  assert(Array.isArray(e.runs)&&e.runs.length>0);
  for(const r of e.runs){
   assert(exact(r,['id','sha','status','conclusion','artifacts']));
   assert(Number.isSafeInteger(r.id)&&r.id>0&&r.sha===e.sha&&r.status==='completed'&&typeof r.conclusion==='string');
   assert(Array.isArray(r.artifacts)&&(r.artifacts.length>0||r.conclusion==='skipped'),'Evidence required for every non-skipped run');
   for(const a of r.artifacts)assert(exact(a,['id','digest','expiresAt'])&&Number.isSafeInteger(a.id)&&/^sha256:[a-f0-9]{64}$/.test(a.digest)&&Number.isFinite(Date.parse(a.expiresAt)));
  }
  assert(e.runs.some(r=>r.conclusion!=='skipped'&&r.artifacts.length>0),'At least one evidenced validation run required');
 }
 return m;
}
export function validateApproval({manifest,proposal,approval,statuses,issue,events,now}){
 assert.equal(issue.state,'open');assert(!events.some(e=>['closed','reopened'].includes(e.event)),'Reopened proposals are terminal');
 assert(trustedBot(proposal)&&immutable(proposal));assert.equal(proposal.issue_url,issue.url);assert.equal(proposal.body,proposalBody(manifest));
 assert(trustedReviewer(approval)&&immutable(approval),'Designated reviewer required');
 assert.equal(approval.issue_url,issue.url);
 assert.equal(approval.html_url,'https://github.com/'+manifest.repository+'/issues/'+issue.number+'#issuecomment-'+approval.id);
 const a=parseBody(approval,APPROVAL);
 assert(exact(a,['manifest','proposalId','completedValidation','notActiveWork','evidencePreserved','driveReport']));
 assert.equal(a.manifest,digest(manifest));assert.equal(a.proposalId,proposal.id);
 assert(a.completedValidation===true&&a.notActiveWork===true&&a.evidencePreserved===true);
 assert(typeof a.driveReport==='string'&&/^https:\/\/docs\.google\.com\/document\/d\/[-\w]+\/edit(?:\?[-\w=&%]+)?$/.test(a.driveReport));
 assert(Date.parse(approval.created_at)>=Date.parse(proposal.created_at)&&Date.parse(approval.created_at)<=now);
 const ids=[];
 for(const head of new Set(manifest.entries.map(e=>e.sha))){
  const records=statuses[head].filter(s=>s.context===CONTEXT).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id-a.id);
  const s=records[0];
  assert(s&&Number.isSafeInteger(s.id)&&s.state==='success'&&s.creator?.id===REVIEWER&&s.creator.login==='MaktabForlife','Missing dedicated cleanup approval');
  assert.equal(s.description,'approve:'+digest(manifest));assert.equal(s.target_url,approval.html_url);
  assert(Date.parse(s.created_at)>=Date.parse(approval.created_at)&&Date.parse(s.created_at)<=now);
  ids.push(s.id);
 }
 return {approvalId:approval.id,bodyHash:hash(approval.body),statusIds:ids,driveReport:a.driveReport};
}
export class GitHub {
 constructor(token,fetcher=fetch){this.token=token;this.fetcher=fetcher;}
 async api(method,path,body){
  assert(/^\/repos\/MaktabForlife\/(?:Academy|AcademyStudio)(?:\/|$|\?)/.test(path),'API scope');
  const r=await this.fetcher('https://api.github.com'+path,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+this.token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!r.ok)throw Object.assign(Error('GitHub '+method+' request failed: '+r.status),{status:r.status});return r.status===204?null:r.json();
 }
 async list(path,key){
  const result=[];
  for(let page=1;page<=30;page++){
   const r=await this.api('GET',path+(path.includes('?')?'&':'?')+'per_page=100&page='+page),rows=key?r[key]:r;
   assert(Array.isArray(rows));result.push(...rows);if(rows.length<100)return result;
  }
  throw Error('Incomplete pagination');
 }
 async getRef(repo,branch,optional=false){try{return await this.api('GET','/repos/'+repo+'/git/ref/heads/'+encodeURIComponent(branch));}catch(error){if(optional&&error.status===404)return null;throw error;}}
 async preserved(repo,oldHead,currentHead){
  if(oldHead===currentHead)return true;
  const c=await this.api('GET','/repos/'+repo+'/compare/'+oldHead+'...'+currentHead);
  return c.behind_by===0&&c.merge_base_commit?.sha===oldHead&&['ahead','identical'].includes(c.status);
 }
}
export function packLines(data){
 const out=[];let pos=0;
 while(pos<data.length){
  assert(pos+4<=data.length);const size=Number.parseInt(data.subarray(pos,pos+4).toString(),16);pos+=4;
  assert(Number.isInteger(size));if(size===0){out.push(null);continue;}
  assert(size>=4&&pos+size-4<=data.length);out.push(data.subarray(pos,pos+size-4));pos+=size-4;
 }
 return out;
}
function packet(s){const b=Buffer.from(s);return Buffer.concat([Buffer.from((b.length+4).toString(16).padStart(4,'0')),b]);}
export function deletionPayload(entries){
 assert(entries.length>0&&entries.every(e=>validBranch(e.branch)&&sha(e.sha)));
 return Buffer.concat([...entries.map((e,i)=>packet(e.sha+' '+'0'.repeat(40)+' refs/heads/'+e.branch+(i===0?'\0report-status atomic':'')+'\n')),Buffer.from('0000')]);
}
export function advertisement(data){
 const refs={},caps=new Set();
 for(let line of packLines(data)){
  if(!line||line[0]===35)continue;
  const zero=line.indexOf(0);
  if(zero>=0){line.subarray(zero+1).toString().trim().split(' ').forEach(x=>caps.add(x));line=line.subarray(0,zero);}
  const [id,ref]=line.toString().trim().split(' ');assert(sha(id)&&ref);refs[ref]=id;
 }
 assert(['atomic','delete-refs','report-status'].every(x=>caps.has(x)));
 return refs;
}
export class GitTransport {
 constructor(repo,token,fetcher=fetch){assert(REPOS.includes(repo));this.repo=repo;this.token=token;this.fetcher=fetcher;}
 async request(body){
  const post=body!==undefined;
  const path=post?'git-receive-pack':'info/refs?service=git-receive-pack';
  const r=await this.fetcher('https://github.com/'+this.repo+'.git/'+path,{method:post?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Basic '+Buffer.from('x-access-token:'+this.token).toString('base64'),Accept:'application/x-git-receive-pack-'+(post?'result':'advertisement'),...(post?{'Content-Type':'application/x-git-receive-pack-request'}:{})},...(post?{body}:{})});
  assert(r.ok,'Git transaction response unknown/rejected: '+r.status);
  assert.equal(r.headers.get('content-type')?.split(';')[0],'application/x-git-receive-pack-'+(post?'result':'advertisement'));
  return Buffer.from(await r.arrayBuffer());
 }
 async refs(){return advertisement(await this.request());}
 async remove(entries){
  const lines=packLines(await this.request(deletionPayload(entries))).filter(Boolean).map(x=>x.toString().trim());
  assert.equal(lines.shift(),'unpack ok');assert.equal(lines.length,entries.length);
  assert.deepEqual([...lines].sort(),entries.map(e=>'ok refs/heads/'+e.branch).sort());
  return lines;
 }
}
export async function activeUses(api,ctx,entries){
 const wanted=new Set(entries.map(e=>e.branch));const own=ctx.repository;
 for(const repo of REPOS){
  const pulls=await api.list('/repos/'+repo+'/pulls?state=open');
  if(repo===own)assert(!pulls.some(p=>wanted.has(p.head.ref)||wanted.has(p.base.ref)),'Open PR dependency');
  for(const status of ['in_progress','queued','waiting','pending','requested']){
   const runs=await api.list('/repos/'+repo+'/actions/runs?status='+status,'workflow_runs');
   assert(!runs.some(r=>!(repo===own&&String(r.id)===ctx.runId)&&!(r.path==='.github/workflows/validation-cleanup.yml'&&r.head_branch==='studio_dev')),'Active paired workflow');
  }
 }
 const heads=new Set(entries.map(e=>e.sha));
 const deployments=await api.list('/repos/'+own+'/deployments');
 for(const d of deployments.filter(x=>wanted.has(x.ref)||wanted.has(x.ref?.replace(/^refs\/heads\//,''))||heads.has(x.ref)||heads.has(x.sha))){
  const statuses=await api.list('/repos/'+own+'/deployments/'+d.id+'/statuses');
  // A successful deployment may still serve an environment. Only explicit inactive retires it.
  assert(statuses[0]?.state==='inactive','Active deployment dependency');
 }
}
export async function evidence(api,repo,e,now,policy){
 for(const name of policy.activeRefs){const r=await api.getRef(repo,name,true);assert(!r||r.object.sha!==e.sha,'Current active work tip');}
 const branch=await api.api('GET','/repos/'+repo+'/branches/'+encodeURIComponent(e.branch));
 assert(!branch.protected&&branch.commit.sha===e.sha,'Moved/protected candidate');
 const anchor=await api.getRef(repo,e.anchor);assert(await api.preserved(repo,e.anchorSha,anchor.object.sha),'Lost anchor');
 assert(await api.preserved(repo,e.sha,anchor.object.sha),'Commit not preserved');
 const all=await api.list('/repos/'+repo+'/actions/runs?branch='+encodeURIComponent(e.branch),'workflow_runs');
 const current=all.filter(r=>r.head_sha===e.sha);
 assert(current.length>0&&current.every(r=>r.status==='completed'),'Unfinished validation');
 for(const saved of e.runs){
  const run=await api.api('GET','/repos/'+repo+'/actions/runs/'+saved.id);
  assert(run.head_sha===e.sha&&run.head_branch===e.branch&&run.status==='completed'&&run.conclusion===saved.conclusion,'Run changed');
  const arts=await api.list('/repos/'+repo+'/actions/runs/'+saved.id+'/artifacts','artifacts');
  for(const a of saved.artifacts){
   const current=arts.find(x=>x.id===a.id);
   assert(current&&!current.expired&&current.digest===a.digest&&current.expires_at===a.expiresAt&&Date.parse(a.expiresAt)>now,'Lost/expired evidence');
  }
 }
}
export async function checkApproval(api,ctx,issue,proposal,m){
 const freshIssue=await api.api('GET','/repos/'+ctx.repository+'/issues/'+issue.number);
 const freshProposal=await api.api('GET','/repos/'+ctx.repository+'/issues/comments/'+proposal.id);
 assert.equal(freshProposal.body,proposal.body);assert.equal(freshProposal.updated_at,proposal.updated_at);
 const comments=await api.list('/repos/'+ctx.repository+'/issues/'+issue.number+'/comments');
 const approvals=comments.filter(c=>trustedReviewer(c)&&c.body?.startsWith(APPROVAL+'\n')).sort((a,b)=>b.id-a.id);
 assert(approvals.length,'Awaiting optimisation');
 const statuses={};for(const head of new Set(m.entries.map(e=>e.sha)))statuses[head]=await api.list('/repos/'+ctx.repository+'/commits/'+head+'/statuses');
 const events=await api.list('/repos/'+ctx.repository+'/issues/'+issue.number+'/events');
 return validateApproval({manifest:m,proposal:freshProposal,approval:approvals[0],statuses,issue:freshIssue,events,now:ctx.now()});
}
export async function executeApproved({api,git,ctx,policy,issue,proposal,staticRefs=[],onClaim}){
 const m=validateManifest(parseBody(proposal,PROPOSAL),policy,ctx.integrity);
 assert(trustedBot(proposal));
 const defaultHead=await api.getRef(ctx.repository,'studio_dev');assert.equal(defaultHead.object.sha,ctx.sourceSha,'Default workflow source moved');
 const comments=await api.list('/repos/'+ctx.repository+'/issues/'+issue.number+'/comments');
 assert(!comments.some(c=>trustedBot(c)&&(c.body?.includes(CLAIM)||c.body?.includes(RECEIPT))),'Batch consumed/claimed');
 const approval=await checkApproval(api,ctx,issue,proposal,m);
 await activeUses(api,ctx,m.entries);
 for(const e of m.entries){assert(!staticRefs.some(s=>s.includes(e.branch)),'Static dependency');await evidence(api,ctx.repository,e,ctx.now(),policy);}
 const before=await git.refs();
 for(const e of m.entries)assert.equal(before['refs/heads/'+e.branch],e.sha);
 // Claim is durable BEFORE attempting deletion. It is never automatically retried.
 await api.api('POST','/repos/'+ctx.repository+'/issues/'+issue.number+'/comments',{body:CLAIM+'\n'+JSON.stringify({manifest:digest(m),proposalId:proposal.id,approval,runId:ctx.runId})});
 if(onClaim)await onClaim();
 const again=await checkApproval(api,ctx,issue,proposal,m);assert.deepEqual(again,approval,'Approval changed/revoked');
 await activeUses(api,ctx,m.entries);
 for(const e of m.entries)await evidence(api,ctx.repository,e,ctx.now(),policy);
 const finalDefault=await api.getRef(ctx.repository,'studio_dev');assert.equal(finalDefault.object.sha,ctx.sourceSha,'Default workflow source moved');
 const latest=await git.refs();for(const e of m.entries)assert.equal(latest['refs/heads/'+e.branch],e.sha);
 await git.remove(m.entries);
 const after=await git.refs();
 for(const e of m.entries)assert(!Object.hasOwn(after,'refs/heads/'+e.branch));
 for(const [ref,id] of Object.entries(before))if(!m.entries.some(e=>ref==='refs/heads/'+e.branch))assert.equal(after[ref],id,'Concurrent retained ref change: '+ref);
 return {manifest:digest(m),deleted:m.entries.map(e=>({branch:e.branch,sha:e.sha})),approval,runId:ctx.runId};
}
async function staticReferences(root){
 const out=[];
 async function scan(dir){
  let files;try{files=await readdir(join(root,dir),{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return;throw error;}
  for(const f of files){const path=join(dir,f.name);if(f.isDirectory())await scan(path);else if(/\.(?:mjs|js|json|ya?ml)$/.test(path)&&!path.includes('validation-cleanup'))out.push(await readFile(join(root,path),'utf8'));}
 }
 for(const dir of ['.github/workflows','tools','backend/tools','config','release','deployment'])await scan(dir);
 return out;
}
export async function discover(api,ctx,p,excluded,staticRefs){
 const branches=await api.list('/repos/'+ctx.repository+'/branches'),entries=[];
 const activeHeads=new Set(branches.filter(b=>p.activeRefs.includes(b.name)).map(b=>b.commit.sha));
 for(const b of branches.filter(b=>validBranch(b.name)&&!b.protected&&!activeHeads.has(b.commit.sha)&&!p.heldPrefixes.some(x=>b.name.startsWith(x))&&!excluded.has(b.name+'@'+b.commit.sha)&&!staticRefs.some(s=>s.includes(b.name)))){
  if(entries.length>=100)break;
  const runs=(await api.list('/repos/'+ctx.repository+'/actions/runs?branch='+encodeURIComponent(b.name),'workflow_runs')).filter(r=>r.head_sha===b.commit.sha);
  if(!runs.length||runs.some(r=>r.status!=='completed'))continue;
  let anchor;
  for(const name of p.anchors){const a=branches.find(b=>b.name===name);if(a&&await api.preserved(ctx.repository,b.commit.sha,a.commit.sha)){anchor=a;break;}}
  if(!anchor)continue;
  const saved=[];let complete=true;
  for(const r of runs){
   const artifacts=await api.list('/repos/'+ctx.repository+'/actions/runs/'+r.id+'/artifacts','artifacts');
   const available=artifacts.filter(a=>!a.expired&&Date.parse(a.expires_at)>ctx.now()&&/^sha256:[a-f0-9]{64}$/.test(a.digest||''));
   if(!available.length&&r.conclusion!=='skipped'){complete=false;break;}
   saved.push({id:r.id,sha:r.head_sha,status:r.status,conclusion:r.conclusion,artifacts:available.map(a=>({id:a.id,digest:a.digest,expiresAt:a.expires_at}))});
  }
  if(complete&&saved.some(r=>r.conclusion!=='skipped'&&r.artifacts.length>0))entries.push({branch:b.name,sha:b.commit.sha,anchor:anchor.name,anchorSha:anchor.commit.sha,runs:saved});
 }
 if(entries.length)await activeUses(api,ctx,entries);
 return entries;
}
export async function daily(api,git,ctx,p,root,dryRun,retryIssue){
 const staticRefs=await staticReferences(root);
 const issues=(await api.list('/repos/'+ctx.repository+'/issues?state=all')).filter(i=>!i.pull_request&&trustedBot(i)&&i.title.startsWith(TITLE));
 const excluded=new Set();let pending=false;const results=[];
 for(const issue of issues){
  const comments=await api.list('/repos/'+ctx.repository+'/issues/'+issue.number+'/comments');
  const proposals=comments.filter(c=>trustedBot(c)&&c.body?.startsWith(PROPOSAL+'\n'));
  if(proposals.length!==1){if(issue.state==='open')pending=true;continue;}
  let m;try{m=validateManifest(parseBody(proposals[0],PROPOSAL),p,ctx.integrity);}catch{if(issue.state==='open')pending=true;continue;}
  if(issue.number!==retryIssue)for(const e of m.entries)excluded.add(e.branch+'@'+e.sha);
  const consumed=comments.some(c=>trustedBot(c)&&(c.body?.includes(CLAIM)||c.body?.includes(RECEIPT)));
  if(issue.state!=='open'||consumed)continue;
  pending=true;
  if(!comments.some(c=>trustedReviewer(c)&&c.body?.startsWith(APPROVAL+'\n')))continue;
  try{await checkApproval(api,ctx,issue,proposals[0],m);}catch{results.push({issue:issue.number,mode:'awaiting-valid-dedicated-approval'});continue;}
  if(dryRun){results.push({issue:issue.number,mode:'dry-run-approved-pending'});continue;}
  let receipt;
  try{receipt={outcome:'verified',...await executeApproved({api,git,ctx,policy:p,issue,proposal:proposals[0],staticRefs})};}
  catch(error){receipt={outcome:'blocked-or-unknown',manifest:digest(m),runId:ctx.runId,error:error.message};}
  await api.api('POST','/repos/'+ctx.repository+'/issues/'+issue.number+'/comments',{body:RECEIPT+'\n'+JSON.stringify(receipt)});
  await api.api('PATCH','/repos/'+ctx.repository+'/issues/'+issue.number,{state:'closed'});
  results.push(receipt);pending=false;
  // One deletion attempt/batch per scheduled run.
  return results;
 }
 if(pending)return results.concat({mode:'awaiting-existing-review'});
 const entries=await discover(api,ctx,p,excluded,staticRefs);
 if(!entries.length)return results.concat({mode:'nothing-eligible'});
 const m={schema:1,batch:randomUUID(),repository:ctx.repository,createdAt:new Date(ctx.now()).toISOString(),integrity:ctx.integrity,entries};
 validateManifest(m,p,ctx.integrity);
 if(dryRun)return results.concat({mode:'dry-run-proposal',manifest:m,digest:digest(m)});
 const issue=await api.api('POST','/repos/'+ctx.repository+'/issues',{title:TITLE+digest(m).slice(0,16),body:'Pending independent optimisation review. No passing test or generic PR approval authorises this batch. Source/evidence are retained; see the immutable proposal comment and docs/VALIDATION-CLEANUP.md.'});
 const proposal=await api.api('POST','/repos/'+ctx.repository+'/issues/'+issue.number+'/comments',{body:proposalBody(m)});
 await api.api('POST','/repos/'+ctx.repository+'/issues/'+issue.number+'/comments',{body:'Manifest digest: '+digest(m)+'\nProposal comment: '+proposal.id+'\nReviewer: copy the manifest to the approved Drive ledger, independently review it, then post the approval record described in docs/VALIDATION-CLEANUP.md and matching dedicated statuses on each unique candidate SHA. A new/edited/revoked record or moved head stops execution. No approval has been issued by this bot.'});
 return results.concat({mode:'proposal-created',issue:issue.number,manifest:digest(m)});
}
export async function main(env=process.env){
 assert(REPOS.includes(env.GITHUB_REPOSITORY));assert.equal(env.GITHUB_REF,'refs/heads/studio_dev');
 assert(['schedule','workflow_dispatch'].includes(env.GITHUB_EVENT_NAME));
 assert(sha(env.GITHUB_SHA)&&env.GITHUB_TOKEN&&/^\d+$/.test(env.GITHUB_RUN_ID||''));
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 const raw=await readFile(join(root,'tools/validation-cleanup-policy.json'),'utf8');
 const policy=validatePolicy(JSON.parse(raw),env.GITHUB_REPOSITORY);
 const integrity=hash((await readFile(fileURLToPath(import.meta.url),'utf8'))+'\0'+raw+'\0'+await readFile(join(root,'.github/workflows/validation-cleanup.yml'),'utf8'));
 const ctx={repository:env.GITHUB_REPOSITORY,runId:env.GITHUB_RUN_ID,sourceSha:env.GITHUB_SHA,integrity,now:()=>Date.now()};
 const retryIssue=Number(env.CLEANUP_RETRY_ISSUE||0);assert(Number.isSafeInteger(retryIssue)&&retryIssue>=0);assert(retryIssue===0||env.GITHUB_EVENT_NAME==='workflow_dispatch');
 const api=new GitHub(env.GITHUB_TOKEN),git=new GitTransport(ctx.repository,env.GITHUB_TOKEN);
 const repo=await api.api('GET','/repos/'+ctx.repository);assert.equal(repo.default_branch,'studio_dev');assert.equal(repo.full_name,ctx.repository);
 const head=await api.getRef(ctx.repository,'studio_dev');assert.equal(head.object.sha,env.GITHUB_SHA,'New default head exists');
 const result=await daily(api,git,ctx,policy,root,env.CLEANUP_DRY_RUN==='true',retryIssue);
 if(env.RUNNER_TEMP){const dir=join(env.RUNNER_TEMP,'validation-cleanup-evidence');await mkdir(dir,{recursive:true});await writeFile(join(dir,'receipt.json'),JSON.stringify({repository:ctx.repository,runId:ctx.runId,scope:{network:'GitHub only',noCloudflareOrDatabaseClient:true},result},null,2));}
 console.log(JSON.stringify({repository:ctx.repository,result}));
 if(result.some(r=>r.outcome==='blocked-or-unknown'))throw Error('Cleanup stopped; inspect preserved GitHub receipt before retry');
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error('Validation cleanup stopped: '+error.message);process.exitCode=1;});
