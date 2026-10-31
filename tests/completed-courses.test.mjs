import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {ok,signIn} from './access-fixture.mjs';

async function setup(t){
 const f=await fixture({academy:true,authorityMode:'ACADEMY',coursePublication:true,verification:{accountSeconds:43200,adminSeconds:60,liveSeconds:43200}});t.after(()=>f.close());
 const db=await f.runtime.getD1Database('ACADEMY_DB','academy');
 const call=async(path,body,token)=>{const response=await f.runtime.dispatchFetch('https://academy.test'+path,{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json','X-Academy-Workspace':'ADMIN',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
 const login=async who=>ok(await call('/api/account/login',{uniqueid:'separation-'+who,pin:'1234'})).token;
 const token=await login('global'),register=(input,who=token)=>call('/api/admin/platform/courses/register-completed',input,who);
 const recover=async(n=25)=>{for(let i=0;i<n;i++){const response=await f.runtime.dispatchFetch('https://academy.test/__local/recover');assert.equal(response.status,200,await response.text());}};
 const proxy=(activityKey,command)=>call('/api/admin/platform/studio-access',{activityKey,command},token);
 return {f,db,call,login,register,recover,proxy,token};
}
const input=()=>({operationId:crypto.randomUUID(),name:'Reviewed historical Course',accessModel:'PAID',confirmCompleted:true,websiteId:crypto.randomUUID(),packageSha256:'a'.repeat(64)});

test('Global Admin registers a completed recording Course without timetable, purchases or automatic ownership change',async t=>{
 const {f,db,register,recover,proxy}=await setup(t),body=input(),made=ok(await register(body)),activity=made.activityKey;
 assert.equal(made.liveEnabled,false);assert.equal(ok(await register(body)).replayed,true);
 assert.equal(await db.prepare('SELECT count(*) n FROM course_runs WHERE activity_key=?').bind(activity).first('n'),0);
 assert.equal(await db.prepare('SELECT count(*) n FROM timetable_publications WHERE activity_key=?').bind(activity).first('n'),0);
 assert.equal(await db.prepare('SELECT count(*) n FROM course_subscription_decisions WHERE activity_key=?').bind(activity).first('n'),0);
 assert.equal(await db.prepare('SELECT count(*) n FROM website_platform_course_jobs WHERE activity_key=?').bind(activity).first('n'),0);
 const student=f.source.f.actors.studentA;await db.prepare("INSERT INTO course_subscription_decisions(account_id,activity_key,active,updated_at,updated_by_account_id) VALUES(?,?,1,'2026-10-31',?)").bind(student,activity,f.source.f.actors.global).run();
 const acquiredBefore=(await db.prepare('SELECT * FROM course_subscription_decisions WHERE activity_key=?').bind(activity).all()).results;
 await recover();assert.equal(await f.db.prepare('SELECT live_enabled FROM source_access_scopes WHERE offering_id=?').bind(made.courseId).first('live_enabled'),0,JSON.stringify({dirty:(await db.prepare('SELECT * FROM website_platform_access_dirty WHERE activity_key=?').bind(activity).all()).results,outbox:(await db.prepare('SELECT * FROM website_platform_outbox WHERE access_scope=?').bind(activity).all()).results,timetable:(await db.prepare('SELECT * FROM website_platform_timetable_scopes WHERE activity_key=?').bind(activity).all()).results}));
 assert.equal(await f.db.prepare('SELECT website_id FROM completed_course_registrations WHERE offering_id=?').bind(made.courseId).first('website_id'),body.websiteId);
 assert.equal(await f.db.prepare('SELECT count(*) n FROM websites WHERE website_id=?').bind(body.websiteId).first('n'),0,'Registration does not publish teaching material.');
 assert.equal((await proxy(activity,{action:'read'})).body.legacyOnly,true);
 const admin=await signIn(f,'global');assert.equal(ok(await f.request('/api/admin/'+made.courseId,{cookie:admin})).canManageContent,false);
 const transferId=crypto.randomUUID();ok(await proxy(activity,{action:'handover-start',transferId}));
 let done=false;for(let i=0;i<30;i++){const step=ok(await proxy(activity,{action:'handover-reconcile',transferId}));await recover(2);if(step.reconciliation.done&&!step.reconciliation.dataset){done=true;break;}}assert(done);
 let page;for(let i=0;i<20;i++){page=ok(await proxy(activity,{action:'handover-page',transferId}));if(!page.more)break;}assert.equal(page.more,false);ok(await proxy(activity,{action:'handover-commit',transferId}));
 assert.equal(await f.db.prepare('SELECT authority FROM source_access_scopes WHERE offering_id=?').bind(made.courseId).first('authority'),'WEBSITE');
 assert.equal(await db.prepare('SELECT state FROM website_platform_access_ownership WHERE activity_key=?').bind(activity).first('state'),'STUDIO');
 assert.equal(ok(await f.request('/api/admin/'+made.courseId,{cookie:admin})).canManageContent,true);
 assert.equal(await f.db.prepare('SELECT purchased FROM participation WHERE offering_id=? AND account_id=?').bind(made.courseId,student).first('purchased'),1);
 assert.deepEqual((await db.prepare('SELECT * FROM course_subscription_decisions WHERE activity_key=?').bind(activity).all()).results,acquiredBefore);
 ok(await f.request('/api/admin/'+made.courseId,{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'youtube',assetId:'completed-recording',title:'Completed recording',videoId:'UzKY4mmZTPQ'}}));
 ok(await f.request('/api/admin/'+made.courseId,{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'attachment',attachmentId:'completed-attachment',assetId:'completed-recording',lessonId:'completed-independent-lesson',title:'Completed recording',audience:'RECORDING',published:true}}));
 assert.equal((await f.request('/api/media/completed-attachment',{cookie:await signIn(f,'studentA')})).status,200);
 assert.equal((await f.request('/api/media/completed-attachment',{cookie:await signIn(f,'studentB')})).status,403);
});

test('completed registration requires actual Global Admin and preserves independent Course identities and acquired purchases',async t=>{
 const {f,db,register,login,recover}=await setup(t),scoped=await login('adminA');assert.equal((await register(input(),scoped)).status,403);
 const first=ok(await register(input())),second=ok(await register({...input(),name:'Different historical identity'}));assert.notEqual(first.courseId,second.courseId);
 const actor=f.source.f.actors.studentA;await db.prepare("INSERT INTO course_subscription_decisions(account_id,activity_key,active,updated_at,updated_by_account_id) VALUES(?,?,1,'2026-10-31',?)").bind(actor,first.activityKey,f.source.f.actors.global).run();
 const saved=(await db.prepare('SELECT * FROM course_subscription_decisions WHERE activity_key=?').bind(first.activityKey).all()).results;
 const conflict=await register({...input(),courseId:first.courseId});assert.equal(conflict.status,409);
 assert.deepEqual((await db.prepare('SELECT * FROM course_subscription_decisions WHERE activity_key=?').bind(first.activityKey).all()).results,saved);
 await recover();assert.equal(await f.db.prepare('SELECT count(*) n FROM participation WHERE offering_id=? AND purchased=1').bind(second.courseId).first('n'),0);
});
