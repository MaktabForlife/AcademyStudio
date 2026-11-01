import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardHTML,timetableProgrammes} from '../public/shared/circles-dashboard-view.mjs';

const lesson=(overrides={})=>({kind:'PROGRAM',activityId:'a',activityName:'Programme A',date:'2050-01-03',startTime:'10:00',endTime:'11:00',startsAt:Date.parse('2050-01-03T10:00:00Z'),endsAt:Date.parse('2050-01-03T11:00:00Z'),status:'SCHEDULED',subjectName:'First lesson',moduleName:'Level 1',...overrides});
const summary=overrides=>({mode:'admin',adminBadge:'Global Admin',timezone:'UTC',checkedAt:Date.now(),activities:[],assessments:[],dueNotes:[],messages:{counts:{unread:0,toAcknowledge:0},notices:[]},enrolmentRequests:{count:0},calendar:[],warnings:[],timetable:[],...overrides});

test('programme grouping combines dates, preserves every session, separates identities and keeps the snapshot unchanged',()=>{
 const rows=[lesson({subjectName:'Later lesson',startTime:'12:00',endTime:'13:00',startsAt:Date.parse('2050-01-03T12:00:00Z')}),lesson(),lesson({date:'2050-01-04'}),lesson({activityId:'b',activityName:'Programme A'}),lesson({kind:'COURSE'})],before=JSON.stringify(rows);
 const groups=timetableProgrammes(rows);
 assert.equal(groups.length,3);assert.equal(groups.reduce((n,g)=>n+g.lessons.length,0),5);
 assert.deepEqual(groups.find(g=>g.activityKey==='PROGRAM:a').lessons.map(r=>r.subjectName),['First lesson','Later lesson','First lesson']);
 assert.equal(JSON.stringify(rows),before);
});

test('Global Admin circle shows one entry per exact programme identity for today',()=>{
 const now=Date.parse('2050-01-03T09:00:00Z'),rows=[lesson(),lesson({subjectName:'Second lesson'}),lesson({activityId:'b',activityName:'Programme B'}),lesson({subjectName:'<Cancelled lesson>',status:'CANCELLED'})];
 const html=dashboardHTML(summary({timetable:rows}),{now});
 assert.equal((html.match(/class="wheel-session /g)||[]).length,2);
 assert(html.includes('Programme A'));assert(html.includes('Programme B'));
 assert(!html.includes('<Cancelled lesson>'));assert(!html.includes('zoom.'));
 // The actual consumer test opens programme info and verifies all rows,
 // including earlier/cancelled sessions, beyond the six-slice summary.
});

test('Learn, Teach and scoped Admin retain individual session entries in the circle',()=>{
 for(const [mode,adminBadge] of [['learn','Global Admin'],['teach','Global Admin'],['admin','Admin']]){
  const html=dashboardHTML(summary({mode,adminBadge,timetable:[lesson(),lesson({subjectName:'Second lesson'})]}),{now:Date.parse('2050-01-03T09:00:00Z')});
  assert.equal((html.match(/class="wheel-session /g)||[]).length,2);assert(html.includes('First lesson'));assert(html.includes('Second lesson'));
 }
});

test('today’s circle uses the display timezone across midnight without changing the native Join date',()=>{
 const row=lesson({date:'2050-01-02',startTime:'23:30',endTime:'00:30',startsAt:Date.parse('2050-01-02T21:30:00Z'),endsAt:Date.parse('2050-01-02T22:30:00Z'),nativeJoin:{joinKey:'original-reference',date:'2050-01-02'}}),before=JSON.stringify(row),data=summary({mode:'learn',timezone:'Asia/Riyadh',timetable:[row]});
 const displayed=dashboardHTML(data,{now:Date.parse('2050-01-02T21:28:00Z')});
 assert.equal((displayed.match(/class="wheel-session /g)||[]).length,1);assert(displayed.includes('00:30–01:30'));assert(displayed.includes('data-circle-join='));
 const yesterday=dashboardHTML(data,{now:Date.parse('2050-01-02T20:59:00Z')});assert.equal((yesterday.match(/class="wheel-session /g)||[]).length,0);
 assert.equal(JSON.stringify(row),before);assert.equal(row.nativeJoin.date,'2050-01-02');
});

test('Admin has only the five checked management actions below the circle; other views use permitted programme links',()=>{
 const activities=[{activityKey:'PROGRAM:one',name:'Private programme',roles:['PROGRAM_ADMIN']},{activityKey:'COURSE:two',name:'Private course',roles:['ADMIN']}];
 for(const adminBadge of ['Global Admin','Admin']){
  const html=dashboardHTML(summary({adminBadge,activities})),section=html.split('<section class="circles-manage"')[1].split('</section>')[0];
  for(const label of ['Users','Access','Curriculum','Intehaan','Media'])assert(section.includes('>'+label+'</button>'));
  assert.equal((section.match(/&quot;tool&quot;:&quot;curriculum&quot;/g)||[]).length,1);
  assert(!section.includes('<ul>'));assert(!section.includes('Private programme'));assert(!section.includes('Private course'));assert(!html.includes('circles-programme-links'));
 }
 for(const mode of ['learn','teach']){
  const html=dashboardHTML(summary({mode,activities}),{navigation:{academia:[{key:'alimiyah',label:'Permitted programme'}]}});
  assert(html.includes('data-programme-key="alimiyah"'));assert(html.includes('Permitted programme'));assert(!html.includes('circles-manage'));
 }
});

test('Arabic Adventures is visible only for a verified Global Admin in checked Learn mode',()=>{
 for(const mode of ['learn','teach','admin'])for(const globalAdmin of [true,false,undefined]){
  const html=dashboardHTML(summary({mode,adminBadge:'Global Admin',availableModes:['learn','teach','admin']}),{globalAdmin});
  assert.equal(html.includes('data-circles-arabic-coming-soon'),mode==='learn'&&globalAdmin===true);
  assert(!html.includes('ARABIC_ADVENTURES'));assert(!html.includes('tool&quot;:&quot;arabic'));
 }
});
