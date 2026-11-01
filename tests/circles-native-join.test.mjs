import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {sha256,verify,envelopePurpose} from '../src/protocol.mjs';

const input={mode:'learn',joinKey:JSON.stringify(['PROGRAM','native-program','publication',0,'2026-11-01']),date:'2026-11-01'};
const url='https://example.zoom.us/j/123456789?pwd=synthetic';
const ok=result=>{assert.equal(result.status,200,JSON.stringify(result.body));return result.body;};
async function setup(t){
 let f,reply=async()=>Response.json({success:true,joinUrl:url});const calls=[];
 f=await fixture({verification:{accountSeconds:43200,adminSeconds:60},nativeTeacherHandler:async request=>{
  const path=new URL(request.url).pathname,payload=await request.text();
  assert(await verify(f.env.WEBSITE_TO_ACADEMY_SECRET,envelopePurpose('POST',path),payload,request.headers.get('X-Maktab-Signature')));
  const body=JSON.parse(payload);calls.push({path,body});return reply(body);
 }});t.after(()=>f.close());
 const cookie=(await f.login()).cookie;
 await f.run("UPDATE sessions SET source_ref='current-native-learner' WHERE account_id='learner'");
 const proof={epoch:1,verifiedAt:Date.now(),programmes:'[]'};
 await f.run("INSERT INTO circles_navigation VALUES('learner',?,?,?)",proof.epoch,proof.verifiedAt,proof.programmes);
 return {...f,cookie,proof,calls,setReply(fn){reply=fn;},join:(body=input,options={})=>f.request('/api/circles/lesson-join',{method:'POST',cookie,body,...options})};
}

test('dashboard Join is an explicit Origin/authenticated call, signs its native identity and never writes or caches the returned URL',async t=>{
 const f=await setup(t);
 assert.equal((await f.join(input,{cookie:undefined})).status,401);
 assert.equal((await f.join(input,{headers:{Origin:'https://other.test'}})).status,403);
 for(const bad of [{...input,sourceRef:'another-user'},{...input,joinKey:'x'.repeat(1201)},{...input,date:'2026-02-30'},{...input,mode:'owner'}])assert.equal((await f.join(bad)).status,400);
 assert.equal(f.calls.length,0);
 const result=await f.join();assert.deepEqual(ok(result),{joinUrl:url});assert.equal(result.response.headers.get('Cache-Control'),'private, no-store');
 assert.equal(Number(result.response.headers.get('X-Local-D1-Rows-Written')),0);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].path,'/internal/website/lesson-join');assert.equal(f.calls[0].body.sourceRef,'current-native-learner');
 assert.deepEqual(Object.keys(f.calls[0].body).sort(),['date','issuedAt','joinKey','mode','sourceRef']);
 assert.equal((await f.content.list({prefix:'private/dashboard/'})).objects.length,0);
});

test('sign-out, epoch/admission/account changes and navigation invalidation during the native await fence the returned URL',async t=>{
 const f=await setup(t);
 const changes=[
  "UPDATE sessions SET revoked=1 WHERE account_id='learner'",
  "UPDATE accounts SET epoch=2 WHERE account_id='learner'",
  "UPDATE accounts SET active=0 WHERE account_id='learner'",
  "UPDATE accounts SET admitted=0 WHERE account_id='learner'",
  "UPDATE sessions SET source_ref='other-source' WHERE account_id='learner'",
  "UPDATE accounts SET global_admin=1 WHERE account_id='learner'",
  "UPDATE circles_navigation SET verified_at=0 WHERE account_id='learner'",
  "UPDATE circles_navigation SET programmes_json='[\"reboot\"]' WHERE account_id='learner'"
 ];
 for(const sql of changes){
  f.setReply(async()=>{await f.run(sql);return Response.json({success:true,joinUrl:url});});
  const result=await f.join();assert([401,409].includes(result.status),JSON.stringify(result.body));assert(!result.body.joinUrl);
  await f.run("UPDATE sessions SET revoked=0,source_ref='current-native-learner' WHERE account_id='learner'");
  await f.run("UPDATE accounts SET epoch=1,active=1,admitted=1,global_admin=0 WHERE account_id='learner'");
  await f.run("UPDATE circles_navigation SET epoch=1,verified_at=?,programmes_json='[]' WHERE account_id='learner'",f.proof.verifiedAt);
 }
 assert.equal(f.calls.length,changes.length);
});

test('native timing/ownership/permission denials are preserved and malformed native responses never return a link',async t=>{
 const f=await setup(t);
 for(const [status,code] of [[409,'LESSON_NOT_OPEN'],[409,'STUDIO_JOIN_REQUIRED'],[403,'LESSON_UNAVAILABLE'],[401,'SESSION_ENDED']]){
  f.setReply(async()=>Response.json({error:'Synthetic native denial',code},{status}));const result=await f.join();assert.equal(result.status,status);assert.equal(result.body.code,code);assert(!result.body.joinUrl);
 }
 for(const value of [{success:true,joinUrl:'http://example.zoom.us/j/1'},{success:true,joinUrl:'https://user:secret@example.zoom.us/j/1'},{success:true,joinUrl:'javascript:alert(1)'},{success:true},{joinUrl:url}]){
  f.setReply(async()=>Response.json(value));const result=await f.join();assert.equal(result.status,503);assert.equal(result.body.code,'INVALID_NATIVE_JOIN');assert(!result.body.joinUrl);
 }
});

test('Target Join account/session/proof reads remain bounded beside4000 unrelated accounts, sessions and navigation proofs',async t=>{
 const f=await setup(t),before=await f.join();ok(before);
 const rows=JSON.stringify(Array.from({length:4000},(_,n)=>n)),now=Date.now();
 await f.run("INSERT INTO accounts SELECT 'join-growth-'||value,'Synthetic unrelated',1,1,1,?,0 FROM json_each(?)",now,rows);
 await f.run("INSERT INTO sessions SELECT printf('%064x',value),'join-growth-'||value,1,?,0,'unrelated-native-'||value FROM json_each(?)",now+3600000,rows);
 await f.run("INSERT INTO circles_navigation SELECT 'join-growth-'||value,1,?,'[]' FROM json_each(?)",now,rows);
 const after=await f.join();ok(after);assert.equal(after.queries,before.queries);assert.equal(after.reads,before.reads);
 assert.equal(Number(after.response.headers.get('X-Local-D1-Rows-Written')),0);
 t.diagnostic(JSON.stringify({before:{queries:before.queries,rowsRead:before.reads},after:{queries:after.queries,rowsRead:after.reads},unrelatedRowsPerTable:4000,scope:'Target HTTP only; Source reply synthetic, not full paired Source growth or hosted billing'}));
});

test('an old dashboard shape upgrades once per account/mode, then returns from the existing private cache without polling',async t=>{
 const f=await setup(t),dashboard={nativeJoinVersion:1,mode:'learn',availableModes:['learn'],programmeNavigation:[],activities:[],timetable:[{kind:'PROGRAM',activityId:'native-program',nativeJoin:{joinKey:input.joinKey,date:input.date}}]};
 f.setReply(async()=>Response.json({dashboard}));
 const key='private/dashboard/'+await sha256('learner')+'/learn.json';
 const saved={accountId:'learner',epoch:1,permissionVerifiedAt:f.proof.verifiedAt,coursePolicyEpoch:0,checkedAt:Date.now(),dashboard:{...dashboard,nativeJoinVersion:undefined}};
 await f.content.put(key,JSON.stringify(saved));
 const load=()=>f.request('/api/circles/dashboard',{cookie:f.cookie,method:'POST',body:{mode:'learn'}});
 assert.equal(ok(await load()).cached,false);assert.equal(f.calls.length,1);
 assert.equal(ok(await load()).cached,true);assert.equal(ok(await load()).cached,true);assert.equal(f.calls.length,1);
 const stored=await (await f.content.get(key)).json();assert.equal(stored.dashboard.nativeJoinVersion,1);assert(!JSON.stringify(stored).includes('zoom.'));
 await f.content.put(key,JSON.stringify({...stored,dashboard:{...stored.dashboard,mode:'admin'}}));
 assert.equal(ok(await load()).mode,'learn');assert.equal(f.calls.length,2,'A wrong-mode saved snapshot must be rebuilt once');
});
