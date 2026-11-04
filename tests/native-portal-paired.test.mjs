import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';import {accessFixture,signIn,ok} from './access-fixture.mjs';
import {hosting} from '../../Academy/backend/src/academy/hosting.mjs';
const portal=hosting().academyPortalOrigin;
async function setup(){
 const f=await fixture({academy:true,authorityMode:'ACADEMY',dashboard:true,verification:{accountSeconds:43200,adminSeconds:60,liveSeconds:43200}}),access=await accessFixture(f);await access.recover(2);await signIn(f,'studentA');
 await f.content.put('public/circles/catalogue.json',JSON.stringify({format:'CIRCLES_PUBLIC_CATALOGUE_V1',items:[{key:'synthetic-course',kind:'COURSE',title:'Synthetic Course',websiteId:'site-course'},{key:'synthetic-surah',kind:'TAFSEER',title:'Synthetic Surah',websiteId:'site-surah'}]}));
 const source=async(path,body={},token='',origin=portal)=>{
  const response=await f.runtime.dispatchFetch('https://academy.test'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
  return {response,status:response.status,body:await response.json()};
 };
 const login=async(who='studentA')=>ok(await source('/api/account/login',{uniqueid:'separation-'+who,pin:'1234'}));
 return {f,access,source,login};
}
test('real native Source session reaches signed Studio summaries and Join without Studio cookies',async t=>{
 const {f,access,source,login}=await setup();try{
  const native=await login(),token=native.token;assert(token);await f.run('DELETE FROM sessions');
  const start=await source('/api/academy/hub/read',{kind:'access',input:{websiteIds:['site-course','site-surah']}},token);assert.equal(start.status,200,JSON.stringify(start.body));
  assert(start.body.websites.find(x=>x.websiteId==='site-course').canOpen);assert(start.body.websites.find(x=>x.websiteId==='site-surah').canOpen);
  const repeat=await source('/api/academy/hub/read',{kind:'navigation',input:{}},token);assert.equal(repeat.status,200,JSON.stringify(repeat.body));
  assert((repeat.body.purchasedCourses||[]).some(x=>x.href.includes('site-course')));
  assert.equal((await f.db.prepare('SELECT COUNT(*) n FROM sessions').first()).n,0);
  const session=await f.db.prepare("SELECT session_id FROM timetable WHERE offering_id='course' AND cancelled=0 LIMIT 1").first();assert(session);
  await f.run('UPDATE timetable SET starts_at=?,ends_at=? WHERE session_id=?',Date.now()+299000,Date.now()+3600000,session.session_id);
  const joined=await source('/api/academy/hub/studio-join',{offeringId:'course',sessionId:session.session_id},token);assert.equal(joined.status,200,JSON.stringify(joined.body));assert.match(joined.body.destination,/^https:\/\/.*zoom\.us\//);
  await f.run('UPDATE timetable SET starts_at=? WHERE session_id=?',Date.now()+301000,session.session_id);
  const closed=await source('/api/academy/hub/studio-join',{offeringId:'course',sessionId:session.session_id},token);assert.equal(closed.body.code,'JOIN_CLOSED');
  await source('/api/account/logout',{},token);
  const ended=await source('/api/academy/hub/read',{kind:'navigation',input:{}},token);assert.equal(ended.status,401,JSON.stringify(ended.body));
  t.diagnostic(JSON.stringify({pairedNativeSession:true,studioCookies:0,hostedSQL:0,cloudflareRequests:0}));
 }finally{await f.close();}
});
test('Global Admin Learn projection preserves raw master authority in signed proof; untrusted origins are rejected',async()=>{
 const {f,source,login}=await setup();try{
  await signIn(f,'global');const native=await login('global');
  const boot=await source('/api/academy/hub/read',{kind:'bootstrap',input:{}},native.token);assert.equal(boot.status,200,JSON.stringify(boot.body));
  assert.equal(boot.body.account.globalAdmin,true);assert(boot.body.navigation,JSON.stringify(boot.body.errors));
  assert((boot.body.navigation.adminCourses||[]).some(x=>x.href.includes('site-course')));
  const forged=await source('/api/academy/hub/read',{kind:'navigation',input:{}},native.token,'https://untrusted.example');assert.equal(forged.status,403);
  const noToken=await source('/api/academy/hub/read',{kind:'navigation',input:{}});assert.equal(noToken.status,401);
 }finally{await f.close();}
});
