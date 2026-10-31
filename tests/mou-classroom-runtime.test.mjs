import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFile,mkdir} from 'node:fs/promises';
import {normalizeMouClassroom,renderMouClassroom,createMouClassroom} from '../public/shared/mou-classroom.mjs';
const backend=process.env.MOU_BACKEND_ROOT&&resolve(process.env.MOU_BACKEND_ROOT);

// Optional paired local acceptance: the backend owner supplies its candidate
// fixture. This never imports or writes a hosted identity, right or media object.
test('the real paired MOU API supplies a compatible account-bound classroom and scoped management metadata',{skip:!backend},async t=>{
 const {fixture}=await import(pathToFileURL(resolve(backend,'tests/fixture.mjs'))),{signIn,ok}=await import(pathToFileURL(resolve(backend,'tests/access-fixture.mjs')));
 const f=await fixture({academy:true,authorityMode:'ACADEMY',mou:true,navigation:{mothers:'programB'},verification:{accountSeconds:43200,adminSeconds:60,liveSeconds:43200}});t.after(()=>f.close());
 const native=async(path,body,token)=>{const response=await f.runtime.dispatchFetch('https://academy.test'+path,{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json','X-Academy-Workspace':'ADMIN',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
 const token=ok(await native('/api/account/login',{uniqueid:'separation-global',pin:'1234'})).token;
 ok(await native('/api/admin/platform/programme-studio/register',{programmeKey:'mothers',accessModel:'MONTHLY',noMediaMigration:true,operationId:crypto.randomUUID()},token));
 for(let i=0;i<12;i++){const response=await f.runtime.dispatchFetch('https://academy.test/__local/recover');assert.equal(response.status,200,await response.text());}
 const receipts=[];
 for(const role of ['studentB','teacherB','adminB','global']){
  const cookie=await signIn(f,role),accountId=f.source.f.actors[role],identity={account:{accountId},generation:0},before={...f.source.metrics},reads=[];let lastReply;
  const controller=createMouClassroom({request:async(path,options={})=>{const result=await f.request(path,{cookie,method:options.body?'POST':'GET',body:options.body});reads.push({path,status:result.status,rowsRead:result.reads,queries:result.queries});lastReply=ok(result);return lastReply;},identity,isCurrent:()=>true,onChange:()=>{},navigate:()=>assert.fail('No Join during a classroom compatibility read')});t.after(()=>controller.clear());
  const data=await controller.load();if(!data&&lastReply)normalizeMouClassroom(lastReply,{accountId});assert(data,role+' receives the V1 classroom');assert.equal(data.context.accountId,accountId);assert.equal(data.monthly.hasCurrentMonth,false);assert.equal(data.subjects.length,10);assert.equal(data.management.canManage,['adminB','global'].includes(role));assert.doesNotMatch(renderMouClassroom(controller.state()),/data-circles-website|zoom.us/);assert(data.timetable.sessions.every(session=>session.timezone&&session.joinPath==='/api/offerings/'+encodeURIComponent(data.programme.offeringId)+'/join'));
  await controller.load();assert.equal(reads.length,1,'Repeated entry uses this active view rather than per-subject queries');assert.equal(f.source.metrics.queries,before.queries,'Classroom reading never calls Academy');controller.clear();
  receipts.push({role,accountBound:true,canManage:data.management.canManage,publishedSessions:data.timetable.sessions.length,requests:reads,academyQueries:f.source.metrics.queries-before.queries});
 }
 const denied=await f.request('/api/circles/classrooms/mothers',{cookie:await signIn(f,'studentA')});assert.equal(denied.status,403);
 assert.throws(()=>normalizeMouClassroom({title:'Old membership-only response',materialsConnected:false},{accountId:'any'}));
 if(process.env.MOU_READ_RECEIPT){const output=resolve(process.env.MOU_READ_RECEIPT);await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,JSON.stringify({schema:'MOU_FRONTEND_PAIRED_READS_V1',localOnly:true,backend,receipts,wrongProgrammeDenied:true,legacySchemaRejected:true,fullMonthlyJoinAcceptance:false},null,2)+'\n');}
});
