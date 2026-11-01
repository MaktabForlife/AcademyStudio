import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {dashboardHTML,attentionRows,timetableProgrammes} from '../public/shared/circles-dashboard-view.mjs';
import {sessionKey,mayOfferJoin,sessionSubject,sessionTime,localDay} from '../public/shared/learning-circle.mjs';
import {createDashboardJoin} from '../public/shared/dashboard-join.mjs';
import {esc} from '../public/shared/model.mjs';
const require=createRequire(import.meta.url),{parseHTML}=require('linkedom'),RealDate=Date;
const script=readFileSync(new URL('../public/circles-dashboard.mjs',import.meta.url),'utf8').replace(/^import .*$/gm,'').replace('export function circlesDashboard','function circlesDashboard')+'\nwindow.create=circlesDashboard;';
const start=Date.parse('2026-11-01T08:05:00Z');
const session=(index=0,extra={})=>({kind:'PROGRAM',activityId:'one',activityName:'Native programme',date:'2026-11-01',title:'Session '+index,subjectName:'Subject '+index,status:'SCHEDULED',startsAt:start+index*3600000,endsAt:start+index*3600000+3000000,nativeJoin:{joinKey:'native-'+index,date:'2026-11-01'},...extra});
const summary=()=>({nativeJoinVersion:1,studioJoinVersion:1,programmeNavigation:[{navigationKey:'alimiyah',activityKey:'PROGRAM:one'}],mode:'learn',availableModes:['learn','teach','admin'],adminBadge:'Global Admin',timezone:'Africa/Johannesburg',checkedAt:start-300000,activities:[{kind:'PROGRAM',id:'one',name:'Native programme',activityKey:'PROGRAM:one',accessOwner:'ACADEMY'},{kind:'PROGRAM',id:'two',name:'Mothers of the Ummah',activityKey:'PROGRAM:two',accessOwner:'STUDIO',websiteOfferingId:'mothers'}],timetable:Array.from({length:9},(_,i)=>session(i)),calendar:[{description:'Term event <text>',startDate:'2026-11-02',endDate:'2026-11-03'}],assessments:[],dueNotes:Array.from({length:5},(_,i)=>({id:'note'+i,title:'Native note '+i,activityKey:'PROGRAM:one',activityName:'Native programme',date:'2026-11-01'})),messages:{counts:{unread:1},notices:[]},enrolmentRequests:null,warnings:[]});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture({mode='learn',initial=start-300000,rows,global=true}={}){
 const {window,document}=parseHTML('<html><body><header class="public-home-header"><nav class="site-nav"><a>Our story</a></nav></header><div id="learning-circles"></div><section id="programmes" class="circles-dashboard-courses"></section></body></html>');
 let time=initial,visible=true,next=0,joinResolve;const timers=new Map(),calls=[],handoffs=[],navigations=[],popups=[],identity={account:{accountId:'current',globalAdmin:global},generation:1};
 Object.defineProperty(document,'visibilityState',{value:'visible',writable:true});
 window.HTMLElement.prototype.showModal=function(){this.open=true;};window.HTMLElement.prototype.close=function(){this.open=false;};window.HTMLElement.prototype.scrollIntoView=function(){this.dataset.scrolled='true';};
 window.location={assign:value=>navigations.push(value)};window.open=()=>{const popup={opener:window,closed:false,location:{replace:value=>navigations.push(value)},close(){this.closed=true;}};popups.push(popup);return popup;};
 class FixtureDate extends RealDate{static now(){return time;}constructor(...args){super(...(args.length?args:[time]));}}
 const api=async(path,options={})=>{calls.push({path,...options});if(path==='/api/circles/dashboard'){const data=summary();data.mode=options.body.mode||mode;if(rows)data.timetable=rows;return data;}if(path.includes('/join')||path==='/api/circles/lesson-join')return new Promise(resolve=>{joinResolve=resolve;});throw Error('Unexpected API request '+path);};
 vm.runInNewContext(script,{window,document,identity,api,dashboardHTML,attentionRows,timetableProgrammes,sessionKey,mayOfferJoin,sessionSubject,sessionTime,localDay,createDashboardJoin,esc,Date:FixtureDate,Intl,JSON,Map,Set,WeakMap,URL,setTimeout:(fn,delay)=>{const id=++next;timers.set(id,{fn:()=>{timers.delete(id);fn();},delay});return id;},clearTimeout:id=>timers.delete(id)});
 let dashboard;dashboard=window.create({onUpdate:()=>dashboard.refresh(),openAcademy:(...args)=>handoffs.push(args),show:()=>visible,getNavigation:()=>({academia:[{key:'alimiyah',label:'Aalimiyah'}],tafseer:'/studio/?collection=tafseer',mothers:true,hifz:null})});
 const click=selector=>{const element=document.querySelector(selector);assert(element,selector);const event=new window.Event('click',{bubbles:true});Object.defineProperty(event,'button',{value:0});element.dispatchEvent(event);};
 await dashboard.load(mode);return {window,document,dashboard,identity,calls,handoffs,navigations,popups,timers,click,setTime:value=>{time=value;},public:()=>{visible=false;dashboard.refresh();},resolveJoin:result=>joinResolve(result)};
}
test('adapter places the actual dashboard before the course rail, receives checked programme navigation and keeps clock redraws local',async()=>{
 const f=await fixture();assert(f.document.body.classList.contains('circles-dashboard-active'));assert.equal(f.document.getElementById('learning-circles').nextElementSibling.id,'circles-dashboard');assert.equal(f.document.getElementById('circles-dashboard').nextElementSibling.id,'programmes');assert(f.document.querySelector('[data-programme-key=alimiyah]'));assert.equal(f.calls.length,1);
 let mutations=0;const observer=new f.window.MutationObserver(records=>{mutations+=records.filter(row=>row.type==='childList').length;});observer.observe(f.document.body,{subtree:true,childList:true});f.dashboard.refresh();await flush();assert.equal(mutations,0,'Unchanged observer refreshes must not rewrite nodes or status text');observer.disconnect();
 f.setTime(start);[...f.timers.values()][0].fn();assert.equal(f.calls.length,1,'A visual clock never polls the API');assert.equal(f.document.querySelectorAll('#circles-dashboard').length,1);
 f.public();assert.equal(f.document.querySelector('#circles-dashboard'),null);assert.equal(f.timers.size,0);assert(!f.document.body.classList.contains('circles-dashboard-active'));assert.equal(f.document.body.dataset.circlesDashboardMode,undefined);
});
test('Join becomes active exactly at -5min, uses one current resolver, and mode changes close a delayed placeholder',async()=>{
 const f=await fixture({initial:start-300001});assert.equal(f.document.querySelector('[data-circle-join]'),null);f.setTime(start-300000);[...f.timers.values()][0].fn();assert(f.document.querySelector('[data-circle-join]'));
 f.click('[data-circle-join]');assert.equal(f.popups.length,1);assert.equal(f.calls.at(-1).path,'/api/circles/lesson-join');assert.equal(f.calls.at(-1).body.mode,'learn');
 await f.dashboard.load('teach');assert(f.popups[0].closed);f.resolveJoin({joinUrl:'https://zoom.test/stale'});await flush();assert.equal(f.navigations.length,0);
});
test('a checked public Free programme outside personal activities appears at the Join boundary without adding a programme card',async()=>{
 const row=session(0,{activityId:'public-free',activityName:'Steps to My Rabb',subjectName:undefined,title:'Steps to My Rabb'}),f=await fixture({global:false,initial:start-300001,rows:[row]});
 assert.equal(f.document.querySelector('[data-circle-join]'),null);assert.equal(f.dashboard.data.activities.some(a=>a.id==='public-free'),false);
 f.setTime(start-300000);[...f.timers.values()][0].fn();assert.match(f.document.querySelector('[data-circle-session]').textContent,/Steps to My Rabb/);f.click('[data-circle-join]');assert.equal(f.calls.at(-1).path,'/api/circles/lesson-join');
 assert.equal(f.document.querySelector('[data-programme-key="public-free"]'),null);assert.equal(f.dashboard.data.activities.some(a=>a.id==='public-free'),false);
 f.resolveJoin({joinUrl:'https://zoom.test/current-free'});await flush();assert.equal(f.navigations.length,1);
});
test('session, all sessions and attention dialogs expose every permitted entry without six-item truncation',async()=>{
 const f=await fixture({global:false});f.click('[data-circle-session]');assert(f.document.querySelector('dialog').textContent.includes('Subject 0'));f.click('[data-circle-dialog-close]');f.click('[data-circle-all]');assert.equal(f.document.querySelectorAll('dialog .circle-session-detail').length,9);f.click('[data-circle-dialog-close]');f.click('[data-circle-attention-all]');assert.equal(f.document.querySelectorAll('dialog article').length,6);
 const admin=await fixture({mode:'admin',rows:[...summary().timetable,session(10,{status:'CANCELLED',subjectName:'Cancelled lesson'}),session(11,{date:'2026-10-31',subjectName:'Earlier lesson'})]});assert.equal(admin.document.querySelectorAll('.wheel-session').length,1,'Global Admin shows one programme entry');admin.click('[data-circle-session]');assert.equal(admin.document.querySelectorAll('dialog .circle-session-detail').length,11,'Its info reveals all real programme sessions including cancelled and earlier dates');
});
test('Learn and Teach Calendar are viewing popups while Admin retains the checked edit-calendar route',async()=>{
 for(const mode of ['learn','teach']){const f=await fixture({mode});f.click('[data-circles-academy-action*="calendar"]');assert.match(f.document.querySelector('dialog').textContent,/Term event <text>/);assert.equal(f.document.querySelectorAll('dialog input,dialog textarea').length,0);assert.equal(f.handoffs.length,0);}
 const admin=await fixture({mode:'admin'});admin.click('[data-circles-academy-action*="calendar"]');assert.equal(admin.handoffs[0][1].mode,'admin');assert.equal(admin.handoffs[0][1].tool,'calendar');
});
test('Admin Media selects named current-scope ownership and never falls back from Studio or frozen ownership',async()=>{
 const f=await fixture({mode:'admin'});f.click('[data-circle-media]');f.click('[data-circle-media-choice="PROGRAM:two"]');assert.equal(f.navigations[0],'/studio/?manage=1&offering=mothers&section=media');assert.equal(f.handoffs.length,0);
 f.click('[data-circle-media-choice="PROGRAM:one"]');assert.equal(f.handoffs[0][1].tool,'media');assert.equal(f.handoffs[0][1].activityKey,'PROGRAM:one');
 f.dashboard.data.activities[1].accessOwner='FROZEN';const count=f.navigations.length;f.click('[data-circle-media-choice="PROGRAM:two"]');assert.equal(f.navigations.length,count);
});
test('refresh and account/public changes remove private dialogs and prevent stale Join navigation',async()=>{
 const f=await fixture();f.click('[data-circle-session]');assert(f.document.querySelector('dialog'));f.click('dialog [data-circle-join]');f.identity.generation++;f.identity.account={accountId:'other',globalAdmin:false};f.dashboard.clear();f.resolveJoin({joinUrl:'https://zoom.test/stale'});await flush();assert.equal(f.navigations.length,0);assert.equal(f.document.querySelector('dialog'),null);assert.equal(f.dashboard.data,null);assert.equal(f.timers.size,0);
});

test('cross-midnight circle and popup use the displayed date while Join retains its native source date',async()=>{
 const row=session(0,{date:'2026-10-31',startsAt:Date.parse('2026-10-31T22:30:00Z'),endsAt:Date.parse('2026-10-31T23:30:00Z'),nativeJoin:{joinKey:'native-midnight',date:'2026-10-31'}}),f=await fixture({initial:row.startsAt-300000,rows:[row]});
 assert(f.document.querySelector('[data-circle-session]'),'The session belongs to1NovinSAST');f.click('[data-circle-session]');assert.match(f.document.querySelector('dialog').textContent,/2026-11-01/);assert.match(f.document.querySelector('dialog').textContent,/00:30/);f.click('dialog [data-circle-join]');assert.equal(f.calls.at(-1).body.date,'2026-10-31');f.resolveJoin({joinUrl:'https://zoom.test/native-midnight'});await flush();assert.equal(f.navigations.length,1);
});

test('programme cards follow the currently checked mode and handoff errors remain visible on the active dashboard',async()=>{
 const f=await fixture({mode:'teach'});assert(f.document.querySelector('[data-programme-key=alimiyah]'));f.dashboard.data.programmeNavigation=[];f.dashboard.refresh();assert.equal(f.document.querySelector('[data-programme-key=alimiyah]'),null);f.dashboard.message('Your current programme access changed. Refresh your dashboard.');assert.match(f.document.querySelector('[data-circle-status]').textContent,/programme access changed/);f.public();assert.equal(f.document.querySelector('[data-circle-status]'),null);
});

test('verified Global Admin grouping spans Learn Teach and Admin while every original session and Join reference remains in info',async()=>{
 const rows=[...summary().timetable,session(10,{status:'CANCELLED',subjectName:'Cancelled lesson'}),session(11,{date:'2026-10-31',startsAt:start-86400000,endsAt:start-83400000,subjectName:'Earlier lesson'})],before=JSON.stringify(rows);
 for(const mode of ['learn','teach','admin']){const f=await fixture({mode,global:true,rows});assert.equal(f.document.querySelectorAll('.wheel-session').length,1);f.click('[data-circle-session]');assert.equal(f.document.querySelectorAll('dialog .circle-session-detail').length,11);assert.match(f.document.querySelector('dialog').textContent,/Earlier lesson/);assert.match(f.document.querySelector('dialog').textContent,/Cancelled lesson/);f.click('dialog [data-circle-join]');assert.equal(f.calls.at(-1).body.mode,mode);assert.equal(f.calls.at(-1).body.joinKey,rows[0].nativeJoin.joinKey);f.resolveJoin({joinUrl:'https://zoom.test/checked'});await flush();assert.equal(f.navigations.length,1);}
 assert.equal(JSON.stringify(rows),before);
 for(const mode of ['learn','teach','admin']){const f=await fixture({mode,global:false,rows:summary().timetable.slice(0,2)});assert.equal(f.document.querySelectorAll('.wheel-session').length,2);f.click('[data-circle-session]');assert.equal(f.document.querySelectorAll('dialog .circle-session-detail').length,1);}
});
