import test from 'node:test';
import assert from 'node:assert/strict';
import {learnCourses} from '../public/shared/circles-learn-courses.mjs';

test('Admin Learn includes existing paid-course access without relabelling or duplicating purchases',()=>{
 const purchase={href:'/studio/?website=one',label:'Purchased course'},other={href:'/studio/?website=two',label:'Another paid course',accessLabel:'Admin access'};
 const navigation={purchasedCourses:[purchase],adminCourses:[{...purchase,accessLabel:'Admin access'},other]},before=JSON.stringify(navigation);
 assert.deepEqual(learnCourses(navigation,'learn'),[purchase,other]);
 assert.deepEqual(learnCourses(navigation,'admin'),[purchase]);assert.deepEqual(learnCourses(navigation,'teach'),[purchase]);
 assert.deepEqual(learnCourses({purchasedCourses:[purchase],adminCourses:[]},'learn'),[purchase]);
 assert.equal(learnCourses(null,'learn'),null);assert.equal(learnCourses({adminCourses:[other]},'learn'),null);
 assert.equal(JSON.stringify(navigation),before);
});
