import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {forthcomingCourseNotices,comingSoonCard,comingSoonLabel} from '../public/shared/course-notices.mjs';

const build=process.env.CIRCLES_UI_BUILD&&resolve(process.env.CIRCLES_UI_BUILD);
test('forthcoming free notices have no website, enrolment or interactive action',()=>{
 assert.equal(comingSoonLabel,'Coming soon إن شاء الله');
 assert.deepEqual(forthcomingCourseNotices.map(c=>c.title),['Parenting for the Aakhirah','Names of Allah']);
 for(const notice of forthcomingCourseNotices){
  assert.deepEqual(Object.keys(notice).sort(),['access','key','title']);assert.equal(notice.access,'free');
  const html=comingSoonCard(notice);assert.match(html,/Coming soon <span lang="ar" dir="rtl">إن شاء الله<\/span>/);
  assert.doesNotMatch(html,/<a\b|<button\b|href=|tabindex=|data-action=|enrol/i);
 }
});
test('the composed catalogue adds notices only to free display, preserving four paid and ten rotating free courses',{skip:!build},async()=>{
 const read=p=>readFile(join(build,p),'utf8'),context={};
 runInNewContext(await read('circles/free-learning-catalogue.js'),context);runInNewContext(await read('circles/free-learning.js'),context);
 assert.equal(context.AcademyPaidCourses.length,4);assert.equal(context.AcademyApprovedFreeCourses.length,10);
 assert.deepEqual(Array.from(context.AcademyPaidCourses,c=>c.key).sort(),['spending','stillness-in-my-salah','surah-al-kahf','tawakkul-mindset']);
 assert(![...context.AcademyPaidCourses,...context.AcademyApprovedFreeCourses].some(c=>c.key==='qanaah'));
 for(const now of [Date.parse('2026-10-31'),Date.parse('2026-11-06')]){
  const home=context.AcademyFreeLearning.homepageCourses(now);assert.equal(home.length,5);
  assert(!home.some(c=>forthcomingCourseNotices.some(n=>n.key===c.key)));assert.equal(context.AcademyFreeLearning.homepagePaidCourses(now).length,1);
 }
 const source=await read('circles/podcast-view.mjs');assert(source.includes("${freeCatalogue.map(coverCard).join('')}${forthcomingCourseNotices.map(comingSoonCard).join('')}"));
 assert.match(await read('circles/free-learning.html'),/href="\/course-notices.css"/);
 assert.doesNotMatch(await read('circles/academy/mothers/surah-al-baqarah/index.html'),/course-notices.css/);
 const imratun=JSON.parse(await read('circles/free-learning/imratun-muminah.json'));
 assert.match(JSON.stringify(imratun),/Qana|Contentment/i,'Existing Qana’ah material remains inside Imra’tun Mu’minah');
});
