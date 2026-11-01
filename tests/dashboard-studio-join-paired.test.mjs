import test from 'node:test';
import assert from 'node:assert/strict';
import {studioFixture} from './studio-access-fixture.mjs';
import {signIn,ok} from './access-fixture.mjs';

test('a real dashboard Studio reference matches the projected session and retains the separate current live gate after handover',{timeout:60000},async t=>{
 const {f,x,handover,good}=await studioFixture({dashboardStudioJoinTest:true,dashboard:true,navigation:{alimiyah:'programA',reboot:'programB'}});t.after(()=>f.close());
 await x.run("INSERT INTO course_run_access(activity_key,run_id,access_model) VALUES(?,'ws-run','PAID')",x.courseA);
 await handover();const admin=await signIn(f,'global'),learner=await signIn(f);
 const data=ok(await f.request('/api/circles/dashboard',{cookie:admin,method:'POST',body:{mode:'admin'}}));assert.equal(data.studioJoinVersion,1);assert(!JSON.stringify(data).includes('zoom.'));
 const row=data.timetable.find(row=>row.kind==='COURSE'&&row.activityId===x.courseA.slice(7)&&row.studioJoin&&row.startsAt-300000<=Date.now()&&row.endsAt>Date.now());assert(row,JSON.stringify({message:'The current Studio-owned course has an exact dashboard reference',expected:x.courseA,activities:data.activities.map(r=>({key:r.activityKey,owner:r.accessOwner})),rows:data.timetable.filter(r=>r.kind==='COURSE').map(r=>({activityId:r.activityId,title:r.title,date:r.date,startsAt:r.startsAt,studioJoin:r.studioJoin}))}));assert.equal(row.nativeJoin,undefined);assert.equal(row.studioJoin.offeringId,'course');
 const projected=await f.db.prepare('SELECT session_id FROM timetable WHERE offering_id=? AND session_id=?').bind(row.studioJoin.offeringId,row.studioJoin.sessionId).first();assert(projected,'Dashboard reference and native projector identify the same session');
 const path='/api/offerings/'+row.studioJoin.offeringId+'/join',body={sessionId:row.studioJoin.sessionId};assert.match(ok(await f.request(path,{cookie:learner,method:'POST',body})).destination,/^https:\/\//);
 const before=await good({action:'read',accountId:x.student});await good({action:'save',revision:before.revision,change:{action:'access-batch',operationId:crypto.randomUUID(),changes:[{action:'participant',accountId:x.student,enrolled:true,live:false,purchased:true,cohort:''}]}});
 const denied=await f.request(path,{cookie:learner,method:'POST',body});assert.equal(denied.status,403);assert.equal(denied.body.destination,undefined,'Owning the paid course must not bypass the current live gate');
 t.diagnostic(JSON.stringify({source:f.source.root,reference:'exact projected session',hostedActions:0,meetingsOpened:0}));
});
