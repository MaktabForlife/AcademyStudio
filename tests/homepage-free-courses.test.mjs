import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {activeHomepageFreeCourseKeys,homepageFreeCourseHref} from '../public/shared/homepage-free-courses.mjs';
import {nativeCourseIndex,withNativeCourseLink} from '../public/shared/native-course-links.mjs';
import {activateHomepageFreeCourseCards} from '../tools/circles-ui-adaptation.mjs';

const build=process.env.CIRCLES_UI_BASE&&resolve(process.env.CIRCLES_UI_BASE);
const read=path=>readFile(resolve(build,path),'utf8');

test('only the five owner-selected free cards get canonical Course bookmarks',()=>{
 assert.equal(activeHomepageFreeCourseKeys.length,5);
 for(const key of activeHomepageFreeCourseKeys)assert.equal(homepageFreeCourseHref(key),'/circles/free-learning.html?course='+key);
 for(const key of ['spending','surah-al-kahf','mothers-baqarah','parenting-for-the-aakirah','mawaddah-wah-rahma','https://outside.test',null])assert.equal(homepageFreeCourseHref(key),null);
});

test('actual frozen homepage renders active cards from the first frame and each rotation; other cards stay inert',{skip:!build},async()=>{
 const before=await read('circles/app.js'),after=activateHomepageFreeCourseCards(before),context={esc:String};
 const code=after.split('\n').filter(line=>/^function (?:inactiveFreeCourseCard|freeCourseCard)\(/.test(line)).join('\n');
 runInNewContext(code,context);
 for(const key of activeHomepageFreeCourseKeys){
  const html=context.freeCourseCard({key,title:key,cover:'cover.png',coverAlt:'Cover',href:'https://outside.test'});
  assert.match(html,new RegExp('href="/circles/free-learning.html\\?course='+key+'"'));
  assert.match(html,/>Free<\/span>/);assert.doesNotMatch(html,/circles-free-inactive|aria-disabled|Inactive|outside\.test/);
 }
 for(const key of ['spending','mawaddah-wah-rahma','unknown']){
  const html=context.freeCourseCard({key,title:key,cover:'cover.png',coverAlt:'Cover'});
  assert.match(html,/aria-disabled="true"/);assert.doesNotMatch(html,/<a\b|href=|data-free-course=/);
 }
 assert.equal(activateHomepageFreeCourseCards(after),after);
 assert(before.includes('function refreshFeaturedCourses()')&&after.includes('function refreshFeaturedCourses()'));
});

test('the five bookmarks resolve through exact current native Course keys, without author/media fallback',{skip:!build},async()=>{
 const context={};runInNewContext(await read('circles/free-learning-catalogue.js'),context);
 const index=nativeCourseIndex(activeHomepageFreeCourseKeys.map(key=>({key,kind:'COURSE',title:key,websiteId:'native-'+key,pending:false})));
 for(const key of activeHomepageFreeCourseKeys){
  const item=context.AcademyApprovedFreeCourses.find(row=>row.key===key);assert(item);
  const linked=withNativeCourseLink(item,index);assert.equal(linked.href,'/studio/?website=native-'+key);
  assert.equal(linked.access,'free');assert.equal(linked.canOpen,undefined);assert.equal(linked.videoId,undefined);
 }
 const podcast=await read('circles/podcast-view.mjs');
 assert.match(podcast,/if\(selected\?\.nativeWebsiteId\).*location.replace\(selected.href\)/);
 assert.match(podcast,/if\(nativeCourseIssue\)throw Error\(nativeCourseIssue\)/);
});
