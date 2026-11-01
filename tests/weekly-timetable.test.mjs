import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {timetableWeek,weeklyTimetableHTML} from '../public/shared/weekly-timetable.mjs';
const {parseHTML}=createRequire(import.meta.url)('linkedom');
const now=Date.parse('2026-11-01T07:00:00Z');
const row=(day,hour=8,extra={})=>({kind:'PROGRAM',activityId:'a',activityName:'Aalimiyah',subjectName:'Reading <together>',date:day,startsAt:Date.parse(day+`T${String(hour).padStart(2,'0')}:00:00Z`),endsAt:Date.parse(day+`T${String(hour+1).padStart(2,'0')}:00:00Z`),status:'SCHEDULED',nativeJoin:{joinKey:'actual-native-reference',date:day},...extra});
test('weekly timetable retains all seven checked days, simultaneous lessons and original native Join references',()=>{
 const timetable=Array.from({length:7},(_,i)=>row('2026-11-0'+(i+1)));timetable.push(row('2026-11-02',8,{activityId:'b',activityName:'Arabic Intensive'}));
 const data={startDate:'2026-11-01',endDate:'2026-11-07',timezone:'UTC',timetable},before=JSON.stringify(data),week=timetableWeek(data,{now});
 assert.equal(week.days.length,7);assert.equal(week.rows.length,8);assert.equal(JSON.stringify(data),before);
 const {document}=parseHTML(weeklyTimetableHTML(data,{now}));assert.equal(document.querySelectorAll('th[scope=col]').length,8);assert.equal(document.querySelectorAll('.week-lesson').length,8);assert.equal(document.querySelector('th[aria-current=date] time').getAttribute('datetime'),'2026-11-01');assert(!document.querySelector('together'));
 assert.equal(document.querySelectorAll('[data-circle-join]').length,0,'Only a currently open scheduled lesson offers Join');
});
test('weekly display follows the selected timezone and cancelled classes cannot offer Join',()=>{
 const lesson=row('2026-11-01',22,{nativeJoin:{joinKey:'same-reference',date:'2026-11-01'}}),data={startDate:'2026-11-01',timezone:'Asia/Riyadh',timetable:[lesson,{...lesson,activityId:'cancelled',status:'CANCELLED'}]},live=lesson.startsAt+1000;
 const {document}=parseHTML(weeklyTimetableHTML(data,{now:live})),cell=document.querySelector('.week-lesson').closest('td');assert.equal(cell.cellIndex,undefined);assert.match(cell.textContent,/01:00–02:00/);assert.equal(document.querySelectorAll('.week-join').length,1);assert.match(document.querySelector('.is-cancelled').textContent,/CANCELLED/);assert.equal(lesson.nativeJoin.date,'2026-11-01');
});
