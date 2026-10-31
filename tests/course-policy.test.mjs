import test from 'node:test';import assert from 'node:assert/strict';
import {studioFixture} from './studio-access-fixture.mjs';import {signIn,ok} from './access-fixture.mjs';import {sha256} from '../src/protocol.mjs';

test('native FREE/PAID policy changes preserve purchases, default free lessons/media, fences and immutable first-publication metadata',async t=>{
 const {f,x,good,proxy,handover}=await studioFixture();t.after(()=>f.close());await handover();
 await f.run("INSERT INTO course_publications VALUES('course','synthetic-registration',?,'synthetic-run','synthetic-publication','PAID',?)",x.courseA,Date.now());
 await f.run("INSERT INTO objects VALUES('policy-recording',NULL,'video/youtube','Synthetic recording',0,NULL,'abcdefghijk')");await f.run("INSERT INTO asset_owners VALUES('policy-recording','course')");
 await f.run("INSERT INTO attachments VALUES('policy-recording-link','course','site-course','policy-recording','independent-recorded-lesson','2026-10-31','','Synthetic recording','RECORDING',1)");
 const buyer=await signIn(f,'studentA'),member=await signIn(f,'studentB'),a=f.source.f.actors.studentA,b=f.source.f.actors.studentB;
 const access=()=>f.request('/api/circles/access?website=site-course',{cookie:member});
 const initial=ok(await access());assert.equal(initial.websites[0].canOpen,false);assert.equal(initial.websites[0].coursePolicy.model,'PAID');
 const participants=await f.db.prepare("SELECT count(*) n FROM participation WHERE account_id=? AND offering_id='course'").bind(b).first('n');
 const change=async model=>{const read=await good({action:'read'});const command={action:'save',revision:read.revision,change:{action:'course-policy',operationId:crypto.randomUUID(),accessModel:model}};return {command,result:await good(command)};};
 const free=await change('FREE');assert.equal(free.result.coursePolicy.model,'FREE');assert.equal((await good(free.command)).replayed,true);
 assert.equal(await x.db.prepare('SELECT legacy_access_model FROM course_settings WHERE activity_key=?').bind(x.courseA).first('legacy_access_model'),'FREE');
 assert.equal((await proxy(free.command,{who:'adminB'})).status,403);assert.equal((await proxy(free.command,{who:'studentA'})).status,403);
 f.source.resetMetrics();const open=await access();ok(open);assert.equal(open.body.websites[0].subscriptionStatus,'free');assert.equal(open.body.websites[0].accessBasis,'free');assert.equal(open.body.websites[0].coursePolicy.model,'FREE');assert(open.body.coursePolicyEpoch>initial.coursePolicyEpoch);
 ok(await f.request('/api/websites/site-course',{cookie:member}));ok(await f.request('/api/media/policy-recording-link',{cookie:member}));
 const session=await f.db.prepare("SELECT session_id FROM timetable WHERE offering_id='course' AND cancelled=0 AND ends_at>? ORDER BY starts_at LIMIT 1").bind(Date.now()).first();assert(session);
 const joined=await f.request('/api/offerings/course/join',{cookie:member,method:'POST',body:{sessionId:session.session_id}});ok(joined);assert.equal(joined.body.destination,'https://example.zoom.us/j/123456789');
 assert.equal(f.source.metrics.queries,0,'Free reading, media and classless protected Join reuse the account proof');
 assert.equal(await f.db.prepare("SELECT count(*) n FROM participation WHERE account_id=? AND offering_id='course'").bind(b).first('n'),participants,'Free visits create no participation or purchase');assert.equal(await f.db.prepare("SELECT count(*) n FROM source_access_people WHERE account_id=? AND offering_id='course'").bind(b).first('n'),0,'No unnecessary per-user free proof');
 await f.run("INSERT INTO source_access_master_fences VALUES(?,'course',1,0,1,0)",b);assert.equal((await f.request('/api/media/policy-recording-link',{cookie:member})).body.code,'ACCESS_REFRESH_REQUIRED');assert.equal(ok(await access()).websites[0].canOpen,false);await f.run("DELETE FROM source_access_master_fences WHERE account_id=? AND offering_id='course'",b);
 await f.run('UPDATE source_session_audiences SET class_ids_json=? WHERE session_id=?','["unconfirmed-class"]',session.session_id);assert.equal((await f.request('/api/offerings/course/join',{cookie:member,method:'POST',body:{sessionId:session.session_id}})).body.code,'ACCESS_REFRESH_REQUIRED');
 await f.run('UPDATE source_session_audiences SET class_ids_json=? WHERE session_id=?','[]',session.session_id);
 const paid=await change('PAID');assert(paid.result.coursePolicy.revision>free.result.coursePolicy.revision);const closed=ok(await access());assert.equal(closed.websites[0].canOpen,false);assert(closed.coursePolicyEpoch>open.body.coursePolicyEpoch);assert.equal((await f.request('/api/media/policy-recording-link',{cookie:member})).status,403);
 ok(await f.request('/api/media/policy-recording-link',{cookie:buyer}));assert.equal(await f.db.prepare("SELECT purchased FROM participation WHERE account_id=? AND offering_id='course'").bind(a).first('purchased'),1);
 assert.equal(await f.db.prepare("SELECT access_model FROM course_publications WHERE offering_id='course'").first('access_model'),'PAID','First publication evidence remains immutable');
 await f.run('UPDATE accounts SET verified_at=? WHERE account_id=?',Date.now()-43200_001,b);ok(await f.request('/auth/access',{cookie:member,method:'POST',body:{offeringId:'course'}}));assert.equal((await f.request('/api/media/policy-recording-link',{cookie:member})).status,403,'Exact scope renewal refreshes an expired master proof without granting paid material');
 const stream='access:'+await sha256(JSON.stringify(['course',''])),generation=await f.db.prepare("SELECT generation FROM source_access_scopes WHERE offering_id='course'").first('generation');
 const late=await f.deliver({type:'access-scope',offering:{id:'course',kind:'COURSE',title:'Late native projection'},generation,enabled:true,liveEnabled:true,accessModel:'FREE',timezone:'UTC',classes:[],websites:[]},{stream});assert.equal(late.response.status,200,JSON.stringify(late.body));assert.equal(ok(await access()).websites[0].coursePolicy.model,'PAID','Late Source policy cannot overwrite current Studio ownership');
 t.diagnostic(JSON.stringify({freeCatalogue:{rowsRead:open.reads,queries:open.queries},freeJoin:{rowsRead:joined.reads,queries:joined.queries},ordinaryFreeAcademyQueries:0,noAutomaticGrants:true}));
});

test('trusted policy display stays separate from staff access and the public reading mechanism',async()=>{
 const {circlesCatalogue}=await import('../public/shared/circles-catalogue.mjs');
 const item={key:'paid-course',kind:'COURSE',title:'Course',websiteId:'site',pending:false,publicTextUrl:'https://academy.test/academy/public-reading'};
 const staff=circlesCatalogue([item],[{websiteId:'site',canOpen:true,accessBasis:null,subscriptionStatus:'required',coursePolicy:{model:'PAID',revision:2}}],{kind:'COURSE'});assert(staff.includes('Subscription required'));assert(!staff.includes('Subscribed</'));
 const free=circlesCatalogue([item],[{websiteId:'site',canOpen:true,accessBasis:'free',subscriptionStatus:'free',coursePolicy:{model:'FREE',revision:3}}],{kind:'COURSE'});assert(!free.includes('collection-lock'));
 const publicReading=circlesCatalogue([{...item,kind:'TAFSEER',key:'foundations'}],[],{kind:'TAFSEER'});assert(!publicReading.includes('collection-lock'),'Existing deliberately public text remains separate');
});

test('policy revisions invalidate cached dashboard allow and deny links without another Academy request',async t=>{
 const {f,x,good,handover}=await studioFixture({dashboard:true});t.after(()=>f.close());await handover();
 await f.content.put('public/circles/catalogue.json',JSON.stringify({format:'CIRCLES_PUBLIC_CATALOGUE_V1',items:[{key:'course',kind:'COURSE',title:'Synthetic Course',websiteId:'site-course'}]}));
 const cookie=await signIn(f,'studentA');
 const model=async accessModel=>{const read=await good({action:'read'});return good({action:'save',revision:read.revision,change:{action:'course-policy',operationId:crypto.randomUUID(),accessModel}});};
 // Explicitly withdraw only this synthetic purchase; no policy change ever removes it.
 let read=await good({action:'read'});await good({action:'save',revision:read.revision,change:{action:'participant',operationId:crypto.randomUUID(),accountId:x.student,enrolled:true,live:true,purchased:false,reason:'Synthetic cache test removal'}});
 await model('FREE');const first=ok(await f.request('/api/circles/dashboard',{cookie,method:'POST',body:{mode:'learn'}}));assert(first.activities.some(a=>a.websiteKind==='COURSE'&&a.destinationHref==='/studio/?website=site-course'));
 await model('PAID');f.source.resetMetrics();const denied=ok(await f.request('/api/circles/dashboard',{cookie,method:'POST',body:{mode:'learn'}}));assert(!denied.activities.some(a=>a.websiteKind==='COURSE'&&a.destinationHref));assert.equal(f.source.metrics.queries,0);
 await model('FREE');f.source.resetMetrics();const allowed=ok(await f.request('/api/circles/dashboard',{cookie,method:'POST',body:{mode:'learn'}}));assert(allowed.activities.some(a=>a.websiteKind==='COURSE'&&a.destinationHref==='/studio/?website=site-course'));assert.equal(f.source.metrics.queries,0);
});
