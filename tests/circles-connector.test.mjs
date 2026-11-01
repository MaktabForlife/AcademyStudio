import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';
const {academyDestination}=await import(pathToFileURL(resolve(process.env.ACADEMY_SOURCE||'../Academy-combined-candidate','academy/website-platform/connect/destinations.mjs')));
test('Academy connector accepts only the reviewed fixed destinations and preserves Hifz',()=>{
 const base='https://academy.test';for(const path of ['/academy/#activity/PROGRAM/program-one/learn','/academy/#activity/COURSE/course-one/teach/planning','/academy/admin/#assessment-admin/PROGRAM/program-one','/academy/?circlesTool=messages#timetable/learn','/academy/admin/?circlesTool=messages#administration','/academy/library/','/academy/calendar/?view=learn','/academy/enrolment/manage/?view=requests','/recorder/?academy=1'])assert.equal(academyDestination(path,base),base+path,path);
 for(const path of ['https://evil.test/academy/','javascript:alert(1)','/academy/?next=https://evil.test#timetable/learn','/admin/','//evil.test/academy/','/academy/#activity/PROGRAM/id/learn/delete','/academy/calendar/?view=admin&next=evil','/academy/#activity/PROGRAM/a%2Fb/learn'])assert.equal(academyDestination(path,base),null,path);assert.equal(academyDestination('https://hifz.maktab4life.org/',base),'https://hifz.maktab4life.org/');
});

test('Access accepts only the exact Admin route without foreign origins or alternate workspace paths',()=>{
 const base='https://academy.test',path='/academy/admin/#administration/access';assert.equal(academyDestination(path,base),base+path);
 for(const value of ['/academy/#administration/access','/academy/admin/?next=other#administration/access','/academy/admin/#administration/access/extra','https://evil.test'+path])assert.equal(academyDestination(value,base),null);
});
