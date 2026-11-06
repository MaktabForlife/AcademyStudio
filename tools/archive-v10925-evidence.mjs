// Archive allowlisted evidence from a completed release; never deploy or call Cloudflare.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
assert.equal(process.env.GITHUB_ACTIONS,'true');
const repo='MaktabForlife/AcademyStudio',run=42158926772,job=127701192544,head='b1c3cec2d9e273ede51660ffc50bb9a159b1ddbe';
const token=process.env.GH_TOKEN;assert(token);
async function get(path){
 const response=await fetch('https://api.github.com/repos/'+repo+path,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(30000)});
 assert(response.ok,'GitHub evidence fetch failed: '+response.status);return response;
}
const runInfo=await (await get('/actions/runs/'+run)).json();assert.equal(runInfo.conclusion,'success');assert.equal(runInfo.head_sha,head);
const response=await get('/actions/jobs/'+job+'/logs'),reader=response.body.getReader(),chunks=[];let total=0;
while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>2*1024*1024){await reader.cancel();throw Error('Release log exceeds bounded archive budget');}chunks.push(value);}
const bytes=Buffer.concat(chunks),text=bytes.toString('utf8').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'');
const entries=[];
for(const line of text.split('\n')){
 const start=line.indexOf('{');if(start<0)continue;
 try{entries.push(JSON.parse(line.slice(start)));}catch{}
}
const pick=(row,keys)=>Object.fromEntries(keys.filter(key=>row[key]!==undefined).map(key=>[key,row[key]]));
const health=row=>{assert(Number.isInteger(row.attempt)&&row.attempt>=1&&row.attempt<=4);assert.equal(row.status,200);assert.equal(row.success,true);assert(['109.24','109.25'].includes(row.version));return pick(row,['attempt','status','success','version']);};
const v=entries.find(row=>row.passed===true&&row.version==='109.25'&&row.source&&row.studio);assert(v);
assert.equal(v.source.commit,'b1ce8b55e2484630dc3cbce86abb22b4e6d08c82');assert.equal(v.studio.commit,head);
assert.deepEqual(v.databaseUpdates,[]);assert.equal(v.explicitHostedSQL,0);assert.equal(v.hostedDatabaseMutations,0);
assert.equal(v.unsignedChecks,6);assert.deepEqual(v.bindings,{source:43,coordinator:3,studio:23});
const source=pick(v.source,['commit','workerVersion','url']);source.pages=pick(v.source.pages,['id','url']);
const studio=pick(v.studio,['commit','workerVersion','url']);
const samples=entries.filter(row=>row.academyHealthSample).map(row=>health(row.academyHealthSample));
assert.equal(samples.at(-1).version,'109.25');assert.deepEqual(samples,v.sourceHealthReused.samples);
const staged=entries.find(row=>row.passed===true&&row.results?.source&&row.results?.target);assert(staged);
const capture=entries.find(row=>row.captured===true);assert(capture);
const activation=entries.find(row=>row.status==='PAIR_ACTIVATED_PENDING_VERIFICATION');assert(activation);
const document={
 originalRun:run,originalJob:job,originalHead:head,originalRunURL:runInfo.html_url,
 originalJobLogSHA256:createHash('sha256').update(bytes).digest('hex'),
 releaseURL:'https://github.com/'+repo+'/releases/tag/v109.25',
 capturedMetadata:pick(capture,['captured','managementRequests','bindings','schedules']),
 staged:staged.results,stageManagementRequests:staged.managementRequests,
 activation:activation.steps.map(step=>pick(step,['side','label','versionId','commit'])),
 verification:{passed:true,version:v.version,verifiedAt:v.verifiedAt,source,studio,
  coordinator:pick(v.coordinator,['versionId','bindings']),bindings:v.bindings,verificationSeconds:v.verificationSeconds,
  sourceCronCount:v.sourceCronCount,databaseUpdates:[],unsignedChecks:v.unsignedChecks,sourceHealthSamples:samples,
  explicitHostedSQL:0,hostedDatabaseMutations:0,hostedRowsMeasured:false,hostedLogins:0,hostedDashboards:0,dnsChanges:0},
 usage:{baselineHealthRequests:1,baselineHealthBasis:'Source-derived: successful exact-only baseline health check; not included in legacy capture applicationRequests console field.',
  candidateHealthRequests:samples.length,unsignedRequests:v.unsignedChecks,totalApplicationHTTPRequests:1+samples.length+v.unsignedChecks,
  broadSyntheticHostedCalls:0,hostedD1RowsMeasured:false},
 qualification:'Deployment attachment was not retained by the original uploader. This archive extracts allowlisted records from completed job logs; it is not the missing original JSON files or a new hosted verification. No redeployment or Cloudflare call.'
};
const dir=resolve(process.env.RUNNER_TEMP,'v10925-retained-evidence');await mkdir(dir,{recursive:true});
await writeFile(resolve(dir,'verified-release-evidence.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({archived:true,originalRun:run,healthSamples:samples.length,unsignedChecks:v.unsignedChecks,hostedCalls:0,cloudflareCalls:0}));
