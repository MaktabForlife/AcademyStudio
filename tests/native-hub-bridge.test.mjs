import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';import {accessFixture,signIn,ok} from './access-fixture.mjs';
import {signedHeaders} from '../src/protocol.mjs';
const summary='/internal/studio/hub-summary',join='/internal/studio/hub-join';
async function setup(){
 const f=await fixture({academy:true,authorityMode:'ACADEMY',verification:{accountSeconds:43200,adminSeconds:60,liveSeconds:43200}}),access=await accessFixture(f);await access.recover(2);await signIn(f,'studentA');
 await f.content.put('public/circles/catalogue.json',JSON.stringify({format:'CIRCLES_PUBLIC_CATALOGUE_V1',items:[{key:'synthetic-course',kind:'COURSE',title:'Synthetic Course',websiteId:'site-course'},{key:'synthetic-surah',kind:'TAFSEER',title:'Synthetic Surah',websiteId:'site-surah'}]}));
 await f.run('DELETE FROM sessions');f.source.resetMetrics();
 const account=await f.db.prepare('SELECT * FROM accounts WHERE account_id=?').bind(access.student).first();
 const proof=extra=>({issuedAt:Date.now(),accountId:access.student,epoch:account.epoch,globalAdmin:Boolean(account.global_admin),sessionId:'synthetic-current-native-session',...extra});
 const request=async(path,input,{unsigned=false}={})=>{const signed=await signedHeaders(f.env.ACADEMY_TO_WEBSITE_SECRET,path,input);return f.request(path,{method:'POST',body:signed.payload,headers:unsigned?{}:signed.headers});};
 return {f,access,account,proof,request};
}
test('signed native bootstrap preserves acquired rights without Studio cookies, sessions or grants',async t=>{
 const {f,access,proof,request}=await setup();try{
  const before=await f.db.prepare('SELECT COUNT(*) n FROM participation').first();
  const result=ok(await request(summary,proof({action:'bootstrap'})));
  assert(result.navigation);assert(result.rights.websites.find(x=>x.websiteId==='site-course').canOpen);assert.equal(result.rights.websites.find(x=>x.websiteId==='site-course').accessBasis,'purchase');
  assert(result.rights.websites.find(x=>x.websiteId==='site-surah').canOpen);
  assert(result.websites.some(x=>x.websiteId==='site-course'&&x.offeringId==='course'&&x.kind==='COURSE'));
  assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM sessions').first()).n,0);
  assert.deepEqual(await f.db.prepare('SELECT COUNT(*) n FROM participation').first(),before);assert.equal(f.source.metrics.queries,0);
  const checked=await request(summary,proof({action:'access',websiteIds:['site-course']}));assert.equal(checked.status,200);assert.equal(Number(checked.response.headers.get('X-Local-D1-Rows-Written')),0);assert(checked.queries<=12,JSON.stringify({queries:checked.queries,reads:checked.reads}));t.diagnostic(JSON.stringify({summaryQueries:checked.queries,summaryRowsRead:checked.reads,sourceQueries:0,writes:0}));
 }finally{await f.close();}
});
test('unsigned, stale, mismatched and oversized native proofs cannot read or promote authority',async()=>{
 const {f,proof,request}=await setup();try{
  assert.equal((await request(summary,proof({action:'bootstrap'}),{unsigned:true})).status,401);
  for(const extra of [{issuedAt:Date.now()-60001},{epoch:99},{globalAdmin:true},{sessionId:'bad/identifier'},{websiteIds:Array.from({length:51},(_,i)=>'site-'+i),action:'access'}]){
   const r=await request(summary,proof({action:'bootstrap',...extra}));assert(r.status>=400,JSON.stringify(r.body));
  }
  assert.equal((await request(summary,proof({action:'access',websiteIds:['private-unpublished']}))).status,400);
  await f.run('UPDATE accounts SET active=0 WHERE account_id=?',proof({}).accountId);assert.equal((await request(summary,proof({action:'bootstrap'}))).status,401);
 }finally{await f.close();}
});
test('signed native Join shares current paid/live/class rules and the exact five-minute clock',async()=>{
 const {f,access,proof,request}=await setup();try{
  const session=await f.db.prepare("SELECT session_id FROM timetable WHERE offering_id='course' AND cancelled=0 LIMIT 1").first();assert(session);
  const fields=()=>proof({offeringId:'course',lessonSessionId:session.session_id});
  await f.run('UPDATE timetable SET starts_at=?,ends_at=? WHERE session_id=?',Date.now()+300001,Date.now()+3600000,session.session_id);
  // Keep a full second outside the boundary to avoid test runner clock drift.
  await f.run('UPDATE timetable SET starts_at=? WHERE session_id=?',Date.now()+301000,session.session_id);
  assert.equal((await request(join,fields())).body.code,'JOIN_CLOSED');
  await f.run('UPDATE timetable SET starts_at=? WHERE session_id=?',Date.now()+299000,session.session_id);
  const opened=await request(join,fields());assert.equal(opened.status,200,JSON.stringify(opened.body));assert.match(opened.body.destination,/^https:\/\/.*zoom\.us\//);assert.equal(Number(opened.response.headers.get('X-Local-D1-Rows-Written')),0);
  await f.run('UPDATE participation SET live=0 WHERE account_id=? AND offering_id=?',access.student,'course');assert.equal((await request(join,fields())).status,403);
  await f.run('UPDATE timetable SET cancelled=1 WHERE session_id=?',session.session_id);assert((await request(join,fields())).status>=400);
 }finally{await f.close();}
});
