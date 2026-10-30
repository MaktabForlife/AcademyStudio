import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardHTML,timetableDays} from '../public/shared/circles-dashboard-view.mjs';

const lesson=(overrides={})=>({kind:'PROGRAM',activityId:'a',activityName:'Programme A',date:'2050-01-03',startTime:'10:00',endTime:'11:00',startsAt:Date.parse('2050-01-03T10:00:00Z'),endsAt:Date.parse('2050-01-03T11:00:00Z'),status:'SCHEDULED',subjectName:'First lesson',moduleName:'Level 1',...overrides});
const summary=overrides=>({mode:'admin',adminBadge:'Global Admin',timezone:'UTC',checkedAt:Date.now(),activities:[],assessments:[],dueNotes:[],messages:{counts:{unread:0,toAcknowledge:0},notices:[]},enrolmentRequests:{count:0},calendar:[],warnings:[],timetable:[],...overrides});
const panel=(html,name)=>html.split('<h3>'+name+'</h3>')[1].split('</section>')[0];

test('programme-day grouping preserves every lesson, separates identities/dates and keeps the snapshot unchanged',()=>{
 const rows=[lesson({subjectName:'Later lesson',startTime:'12:00',endTime:'13:00',startsAt:Date.parse('2050-01-03T12:00:00Z')}),lesson(),lesson({date:'2050-01-04'}),lesson({activityId:'b',activityName:'Programme A'}),lesson({kind:'COURSE'})],before=JSON.stringify(rows);
 const groups=timetableDays(rows);
 assert.equal(groups.length,4);assert.equal(groups.reduce((n,g)=>n+g.lessons.length,0),5);
 assert.deepEqual(groups.find(g=>g.activityKey==='PROGRAM:a'&&g.date==='2050-01-03').lessons.map(r=>r.subjectName),['First lesson','Later lesson']);
 assert.equal(JSON.stringify(rows),before);
});

test('Global Admin gets one daily entry with Info containing all lessons, including earlier or cancelled sessions',()=>{
 const rows=[lesson({subjectName:'Earlier lesson',startsAt:1,endsAt:2}),lesson({subjectName:'Upcoming lesson'}),lesson({subjectName:'<Cancelled lesson>',status:'CANCELLED'}),lesson({activityId:'b',activityName:'Programme B'})];
 const html=dashboardHTML(summary({timetable:rows}));
 for(const name of ['Coming up next','This week']){
  const section=panel(html,name);
  assert.equal((section.match(/class="circles-programme-day"/g)||[]).length,2);
  assert(section.includes('3 lessons'));assert(section.includes('Info</span>'));
  for(const title of ['Earlier lesson','Upcoming lesson','&lt;Cancelled lesson&gt;'])assert(section.includes(title));
  assert(section.includes('CANCELLED'));assert(section.includes('Level 1'));assert(section.includes('10:00–11:00'));
  assert(!section.includes('<Cancelled lesson>'));assert(section.includes('Open programme timetable'));
 }
});

test('learning, teaching and programme Admin dashboards retain their individual session entries',()=>{
 for(const [mode,adminBadge] of [['learn','Global Admin'],['teach','Global Admin'],['admin','Admin']]){
  const html=dashboardHTML(summary({mode,adminBadge,timetable:[lesson(),lesson({subjectName:'Second lesson'})]}));
  for(const name of ['Coming up next','This week']){
   const section=panel(html,name);assert(section.includes('First lesson'));assert(section.includes('Second lesson'));assert(!section.includes('circles-programme-day'));assert(!section.includes('<details>'));
  }
 }
});
