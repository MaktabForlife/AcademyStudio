import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardHTML,timetableProgrammes} from '../public/shared/circles-dashboard-view.mjs';

const lesson=(overrides={})=>({kind:'PROGRAM',activityId:'a',activityName:'Programme A',date:'2050-01-03',startTime:'10:00',endTime:'11:00',startsAt:Date.parse('2050-01-03T10:00:00Z'),endsAt:Date.parse('2050-01-03T11:00:00Z'),status:'SCHEDULED',subjectName:'First lesson',moduleName:'Level 1',...overrides});
const summary=overrides=>({mode:'admin',adminBadge:'Global Admin',timezone:'UTC',checkedAt:Date.now(),activities:[],assessments:[],dueNotes:[],messages:{counts:{unread:0,toAcknowledge:0},notices:[]},enrolmentRequests:{count:0},calendar:[],warnings:[],timetable:[],...overrides});
const panel=(html,name)=>html.split('<h3>'+name+'</h3>')[1].split('</section>')[0];

test('programme grouping combines dates, preserves every session, separates identities and keeps the snapshot unchanged',()=>{
 const rows=[lesson({subjectName:'Later lesson',startTime:'12:00',endTime:'13:00',startsAt:Date.parse('2050-01-03T12:00:00Z')}),lesson(),lesson({date:'2050-01-04'}),lesson({activityId:'b',activityName:'Programme A'}),lesson({kind:'COURSE'})],before=JSON.stringify(rows);
 const groups=timetableProgrammes(rows);
 assert.equal(groups.length,3);assert.equal(groups.reduce((n,g)=>n+g.lessons.length,0),5);
 assert.deepEqual(groups.find(g=>g.activityKey==='PROGRAM:a').lessons.map(r=>r.subjectName),['First lesson','Later lesson','First lesson']);
 assert.equal(JSON.stringify(rows),before);
});

test('Global Admin gets one entry per programme with an info icon for all dates, including earlier or cancelled sessions',()=>{
 const rows=[lesson({subjectName:'Earlier lesson',startsAt:1,endsAt:2}),lesson({subjectName:'Upcoming lesson',date:'2050-01-04'}),lesson({subjectName:'<Cancelled lesson>',status:'CANCELLED'}),lesson({activityId:'b',activityName:'Programme B'})];
 const html=dashboardHTML(summary({timetable:rows}));
 for(const name of ['Coming up next','This week']){
  const section=panel(html,name);
  assert.equal((section.match(/class="circles-programme-day circles-programme-entry"/g)||[]).length,2);
  assert(section.includes('3 sessions'));assert(section.includes('ⓘ</span>'));assert(section.includes('Show session details'));
  for(const title of ['Earlier lesson','Upcoming lesson','&lt;Cancelled lesson&gt;'])assert(section.includes(title));
  assert(section.includes('CANCELLED'));assert(section.includes('Level 1'));assert(section.includes('10:00–11:00'));
  assert(section.includes('2050-01-03'));assert(section.includes('2050-01-04'));
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

test('Admin curriculum is one checked navigation action without an activity list; Learn and Teach keep their own areas',()=>{
 const activities=[{activityKey:'PROGRAM:one',name:'Private programme',roles:['PROGRAM_ADMIN']},{activityKey:'COURSE:two',name:'Private course',roles:['ADMIN'],destinationHref:'/studio/?website=owned'}];
 for(const adminBadge of ['Global Admin','Admin']){
  const html=dashboardHTML(summary({adminBadge,activities}));
  const section=html.split('<section class="circles-dashboard-panel circles-areas circles-curriculum">')[1].split('</section>')[0];
  assert.equal((section.match(/data-circles-academy-action=/g)||[]).length,1);
  assert(section.includes('Manage Curriculum'));assert(section.includes('&quot;tool&quot;:&quot;curriculum&quot;'));
  assert(!section.includes('<ul>'));assert(!section.includes('Private programme'));assert(!section.includes('Private course'));
  assert(!html.includes('Manage programmes and courses'));
 }
 for(const mode of ['learn','teach']){
  const html=dashboardHTML(summary({mode,activities})),section=panel(html,mode==='learn'?'Continue learning':'Continue teaching');
  assert(section.includes('Private programme'));assert(section.includes('Private course'));assert(!html.includes('circles-curriculum'));
 }
});
