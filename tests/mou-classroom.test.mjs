import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMouClassroom,renderMouClassroom,createMouClassroom,mouJoinIsOpen} from '../public/shared/mou-classroom.mjs';
import {fixtureTime,mouFixture,fixtureWebsite,fixtureSession} from './mou-classroom-fixture.mjs';
const actor={accountId:'synthetic-member'};
const normalize=value=>normalizeMouClassroom(value,actor);
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function harness(request){
 let clock=fixtureTime,active=true;const timers=new Map(),calls=[],views=[],destinations=[],identity={account:{...actor},generation:0};let nextTimer=0;
 const controller=createMouClassroom({request:(path,options)=>{calls.push({path,options});return request(path,options);},identity,isCurrent:()=>active,onChange:view=>views.push(view),navigate:url=>destinations.push(url),now:()=>clock,setTimer:(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,at:clock+delay});return id;},clearTimer:id=>timers.delete(id)});
 return {controller,identity,calls,views,destinations,timers,setActive:value=>{active=value;},advance:time=>{clock=time;const due=[...timers].filter(([,t])=>t.at<=time);for(const [id,timer]of due){timers.delete(id);timer.fn();}}};
}

test('pending MOU response keeps legacy identities inert while the new independent playlist UI waits for access',()=>{
 const data=normalize(mouFixture()),html=renderMouClassroom({phase:'ready',classroom:data,now:fixtureTime});
 assert.equal(data.subjects.length,10);assert.equal(data.subjects.filter(s=>s.first).length,1);
 assert.equal((html.match(/Coming soon <span/g)||[]).length,0);assert.match(html,/Your playlists/);
 assert.match(html,/monthly programme access is being connected/);assert.match(html,/Published classes are being connected/);
 assert.doesNotMatch(html,/data-mou-join|data-circles-website|\/builder\/|data-academy-management|recorded for October/);
});

test('monthly material facts, website-only access and staff management remain distinct',()=>{
 const value=fixtureWebsite(mouFixture({connected:true}),{canEdit:true});value.programme.state='MATERIALS_ONLY';value.timetable.state='LIVE_ACCESS_REQUIRED';value.management.canManage=true;
 let data=normalize(value),html=renderMouClassroom({phase:'ready',classroom:data,now:fixtureTime});
 assert.equal(data.monthly.hasCurrentMonth,false);assert.match(html,/No monthly access is recorded for October 2026/);
 assert.match(html,/href="\/studio\/\?website=synthetic-baqarah"/);assert.match(html,/href="\/builder\/\?website=synthetic-baqarah"/);
 assert.match(html,/data-academy-management/);assert.doesNotMatch(html,/data-mou-join|Tafseer|Free course|recordings unlocked/i);
 value.monthly.hasRetainedMonths=true;data=normalize(value);html=renderMouClassroom({phase:'ready',classroom:data,now:fixtureTime});assert.match(html,/recorded months is retained/);assert.equal(data.monthly.hasCurrentMonth,false);
 value.subjects[0].website.completionMonth=null;assert.equal(normalize(value).subjects[0].website.completionMonth,null,'An ongoing programme does not need a fictional completion date');
});

test('unknown schema, changed actor/epoch, fake subject identities and unsafe operational URLs fail closed',()=>{
 const mutations=[v=>{v.schema='UNKNOWN';},v=>{v.context.accountId='other';},v=>{v.programme.accessModel='COURSE';},v=>{v.subjects[1].website={id:'invented'};},v=>{v.subjects[0].key='guessed';},v=>{v.subjects.reverse();},v=>{v.timetable.sessions[0].joinPath='/api/offerings/other/join';},v=>{v.subjects[0].website.href='https://elsewhere.test/';},v=>{v.subjects[0].website.editorHref='/studio/?mode=builder';},v=>{v.timetable.sessions[0].timezone='Unknown/Zone';},v=>{v.monthly.month='2026-13';}];
 for(const mutate of mutations){const value=fixtureSession(fixtureWebsite(mouFixture({connected:true}),{canEdit:true}));mutate(value);assert.throws(()=>normalize(value));}
 assert.throws(()=>normalizeMouClassroom(mouFixture(),{...actor,epoch:2}));
 assert.throws(()=>normalize({title:'Mothers of the Ummah',materialsConnected:false}));
});

test('session display uses the returned source timezone and escapes labels without rendering raw Zoom data',()=>{
 const value=fixtureSession(mouFixture({connected:true}));value.timetable.sessions[0].title='<img src=x onerror=alert(1)>';value.timetable.sessions[0].teacherLabels=['<teacher>'];value.timetable.sessions[0].zoomUrl='https://zoom.us/private';
 const data=normalize(value),html=renderMouClassroom({phase:'ready',classroom:data,now:fixtureTime});
 assert.match(html,/Africa\/Johannesburg/);assert.match(html,/MOU classroom/);assert.match(html,/&lt;teacher&gt;/);assert.match(html,/&lt;img src=x/);assert.doesNotMatch(html,/<img|zoom.us|zoomUrl|synthetic:mothers/);
 assert.match(html,/data-mou-join="synthetic-class"/);
});

test('one classroom load is coalesced and repeated drawing performs no requests per subject',async()=>{
 const response=deferred(),h=harness(()=>response.promise),first=h.controller.load(),second=h.controller.load();assert.equal(first,second);assert.equal(h.calls.length,1);
 response.resolve(mouFixture());await first;await h.controller.load();assert.equal(h.calls.length,1);assert.equal(h.controller.state().phase,'ready');
 await h.controller.load({refresh:true});assert.equal(h.calls.length,2);
});

test('late classroom responses cannot render after an account or route change',async()=>{
 for(const change of [h=>{h.identity.account={accountId:'other'};h.identity.generation++;},h=>h.setActive(false),h=>h.controller.clear()]){
  const response=deferred(),h=harness(()=>response.promise),load=h.controller.load();const count=h.views.length;change(h);response.resolve(fixtureWebsite(mouFixture({connected:true})));await load;
  assert.equal(h.views.length,count);assert.equal(h.controller.state().classroom,null);
 }
});

test('epoch change on refresh removes every previous website/session action until a new identity generation',async()=>{
 let epoch=1;const h=harness(async()=>fixtureWebsite(mouFixture({connected:true,epoch})));await h.controller.load();assert(h.controller.state().classroom.subjects[0].website.canOpen);
 epoch=2;await h.controller.load({refresh:true});assert.equal(h.controller.state().classroom,null);assert.equal(h.controller.state().phase,'unavailable');
 h.identity.generation++;await h.controller.load();assert.equal(h.controller.state().classroom.context.epoch,2);
});

test('local five-minute boundary can open only existing eligibility and closes at proof/session expiry without polling',async()=>{
 const startsAt=fixtureTime+600_000,endsAt=startsAt+3_600_000,expiry=startsAt+180_000;
 const h=harness(async()=>fixtureSession(mouFixture({connected:true}),{startsAt,endsAt,eligibilityExpiresAt:expiry}));await h.controller.load();
 const data=h.controller.state().classroom,s=data.timetable.sessions[0];assert.equal(s.canJoin,false);assert.equal(s.eligibleToJoin,true);assert(!mouJoinIsOpen(s,fixtureTime));
 h.advance(startsAt-300_000+21);assert.match(renderMouClassroom(h.controller.state()),/data-mou-join/);assert.equal(h.calls.length,1);
 h.advance(expiry+21);assert.doesNotMatch(renderMouClassroom(h.controller.state()),/data-mou-join/);assert.equal(h.calls.length,1);
 h.advance(endsAt+21);assert.match(renderMouClassroom(h.controller.state()),/class has ended/);assert.equal(h.calls.length,1);assert.equal(h.timers.size,0);
 const denied=harness(async()=>fixtureSession(mouFixture({connected:true}),{startsAt,endsAt,eligibleToJoin:false}));await denied.controller.load();denied.advance(startsAt+21);assert.doesNotMatch(renderMouClassroom(denied.controller.state()),/data-mou-join/);assert.equal(await denied.controller.join('synthetic-class'),false);assert.equal(denied.calls.length,1);
});

test('Join posts only the returned native session and coalesces duplicate clicks',async()=>{
 const response=deferred(),h=harness(path=>path.endsWith('/join')?response.promise:Promise.resolve(fixtureSession(mouFixture({connected:true}))));await h.controller.load();
 assert.equal(await h.controller.join('invented'),false);assert.equal(h.calls.length,1);
 const first=h.controller.join('synthetic-class'),second=h.controller.join('synthetic-class');assert.equal(first,second);assert.equal(h.calls.length,2);
 assert.deepEqual(h.calls[1],{path:'/api/offerings/synthetic%3Amothers/join',options:{body:{sessionId:'synthetic-class'}}});
 response.resolve({destination:'https://zoom.us/j/synthetic'});assert.equal(await first,true);assert.deepEqual(h.destinations,['https://zoom.us/j/synthetic']);
});

test('late Join replies cannot navigate after account/route changes, refresh or class expiry',async()=>{
 const changes=[h=>{h.identity.account={accountId:'other'};h.identity.generation++;},h=>h.setActive(false),h=>h.controller.clear(),h=>h.controller.load({refresh:true}),h=>h.advance(fixtureTime+4_000_000)];
 for(const change of changes){const response=deferred(),h=harness(path=>path.endsWith('/join')?response.promise:Promise.resolve(fixtureSession(mouFixture({connected:true}))));await h.controller.load();const joining=h.controller.join('synthetic-class');change(h);response.resolve({destination:'https://zoom.us/j/synthetic'});assert.equal(await joining,false);assert.equal(h.destinations.length,0);}
});

test('cancelled/denied Join and unsafe destinations clear old actions and never refetch automatically',async()=>{
 for(const reply of [()=>{throw Object.assign(Error('Cancelled'),{status:403});},async()=>({url:'https://zoom.us/j/synthetic'}),async()=>({destination:'javascript:alert(1)'}),async()=>({destination:'https://user:secret@zoom.us/j/synthetic'})]){
  const h=harness(path=>path.endsWith('/join')?reply():Promise.resolve(fixtureSession(fixtureWebsite(mouFixture({connected:true})))));await h.controller.load();assert.equal(await h.controller.join('synthetic-class'),false);
  assert.equal(h.controller.state().classroom,null);assert.equal(h.controller.state().phase,'unavailable');assert.equal(h.destinations.length,0);assert.equal(h.calls.length,2);assert.doesNotMatch(renderMouClassroom(h.controller.state()),/data-mou-join|data-circles-website/);
 }
});

test('a synchronous load failure is handled without retaining private state or an unhandled promise',async()=>{
 const h=harness(()=>{throw Error('Network unavailable');});assert.equal(await h.controller.load(),null);assert.equal(h.controller.state().phase,'unavailable');assert.equal(h.controller.state().classroom,null);
});

test('independent playlist names, counts and links use the current account DTO without fixed subject identities',()=>{
 const value=mouFixture({connected:true});value.materialsConnected=true;value.playlists=[{id:'playlist-one',websiteId:'playlist-one',title:'Surah Baqarah — Part 1',closeDate:'2026-10-15',recordings:4,canListen:true,canRead:true,href:'/studio/?website=playlist-one'},{id:'playlist-two',websiteId:'playlist-two',title:'Riyadus Saliheen — Part 1',closeDate:null,recordings:2,canListen:false,canRead:true,href:'/studio/?website=playlist-two'}];
 const data=normalize(value),html=renderMouClassroom({phase:'ready',classroom:data});assert.equal(data.playlists.length,2);assert.match(html,/Surah Baqarah — Part 1/);assert.match(html,/Riyadus Saliheen — Part 1/);assert.match(html,/4 recordings/);assert.match(html,/Reading materials/);assert.match(html,/class="playlist-card-grid"/);assert.match(html,/data-playlist-id="playlist-one"/);assert.equal((html.match(/data-circles-website=/g)||[]).length,2);assert.doesNotMatch(html,/mou-subject-card/);value.playlists[0].href='https://elsewhere.test/';assert.throws(()=>normalize(value));
});

test('playlist table retains exact reading-only and editor actions, with no duplicate legacy website or invented count',()=>{
 const value=fixtureWebsite(mouFixture({connected:true}),{canEdit:true});value.materialsConnected=true;
 value.playlists=[{id:'independent',websiteId:'synthetic-baqarah',title:'Native playlist',closeDate:null,recordings:3,canListen:false,canRead:true,href:'/studio/?website=synthetic-baqarah'}];
 let data=normalize(value),html=renderMouClassroom({phase:'ready',classroom:data});assert.equal((html.match(/data-circles-website="synthetic-baqarah"/g)||[]).length,1);assert.match(html,/Reading materials/);assert.match(html,/href="\/builder\/\?website=synthetic-baqarah"/);assert.doesNotMatch(html,/Listen and read|data-mou-join/);
 value.playlists=[];data=normalize(value);html=renderMouClassroom({phase:'ready',classroom:data});assert.match(html,/href="\/builder\/\?website=synthetic-baqarah"/);assert.match(html,/<td>—<\/td>/);assert.doesNotMatch(html,/0 recordings/);
});
