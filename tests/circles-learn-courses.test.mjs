import test from 'node:test';
import assert from 'node:assert/strict';
import {learnCourses} from '../public/shared/circles-learn-courses.mjs';
import {coursePreview,purchasedCourseCards} from '../public/shared/circles-course-row.mjs';

test('Admin Learn includes existing paid-course access without relabelling or duplicating purchases',()=>{
 const purchase={href:'/studio/?website=one',label:'Purchased course'},other={href:'/studio/?website=two',label:'Another paid course',accessLabel:'Admin access'};
 const navigation={purchasedCourses:[purchase],adminCourses:[{...purchase,accessLabel:'Admin access'},other]},before=JSON.stringify(navigation);
 assert.deepEqual(learnCourses(navigation,'learn'),[purchase,other]);
 assert.deepEqual(learnCourses(navigation,'admin'),[purchase]);assert.deepEqual(learnCourses(navigation,'teach'),[purchase]);
 assert.deepEqual(learnCourses({purchasedCourses:[purchase],adminCourses:[]},'learn'),[purchase]);
 assert.equal(learnCourses(null,'learn'),null);assert.equal(learnCourses({adminCourses:[other]},'learn'),null);
 assert.equal(JSON.stringify(navigation),before);
});

test('course preview retains current supplied order and distinguishes Admin access in visible and accessible labels',()=>{
 const courses=Array.from({length:8},(_,i)=>({href:'/studio/?website='+i,label:'Course '+i,...(i%2?{accessLabel:'Admin access'}:{})}));
 assert.deepEqual(coursePreview(courses),courses.slice(0,6));
 const html=purchasedCourseCards(coursePreview(courses));
 assert.equal((html.match(/class="circles-purchased-course"/g)||[]).length,6);
 assert.match(html,/aria-label="Course 1 · Admin access"/);assert.match(html,/<small>Admin access<\/small>/);
 assert.match(html,/aria-label="Course 0 · Your paid course"/);assert(!html.includes('Course 6'));
});
