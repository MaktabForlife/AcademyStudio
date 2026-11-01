import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {approvedCourseCover} from '../public/shared/approved-course-artwork.mjs';
import {circlesCatalogue} from '../public/shared/circles-catalogue.mjs';
import {purchasedCourseCards} from '../public/shared/circles-course-row.mjs';
import {replaceTafseerArtwork} from '../public/shared/tafseer-cover.mjs';
const {parseHTML}=createRequire(import.meta.url)('linkedom');
test('explicit owner-approved cover keys replace stale artwork across catalogues, My courses and reader headers without changing rights or saved editions',()=>{
 for(const key of ['tawakkul','tawakkul-mindset','imratun-muminah']){
  const item={key,kind:'COURSE',websiteId:'actual',title:key,label:key,href:'/studio/?website=actual',cover:'/old-cover.png'},before=JSON.stringify(item),approved=approvedCourseCover(key);
  assert(approved);assert(circlesCatalogue([item],[],{kind:'COURSE'}).includes(approved));assert(purchasedCourseCards([item]).includes(approved));assert.equal(JSON.stringify(item),before);
  const {document}=parseHTML('<main><div class="rs-series-cover"><img data-course-image="cover" src="/old"></div><img data-course-image="reading-image" src="/keep"></main>'),course={displayIdentity:{kind:'COURSE',key},home:{imageId:'cover'}};
  replaceTafseerArtwork(document.querySelector('main'),course);assert.equal(document.querySelector('.rs-series-cover img').getAttribute('src'),approved);assert(!document.querySelector('.rs-series-cover img').hasAttribute('data-course-image'));assert.equal(document.querySelector('[data-course-image=reading-image]').getAttribute('src'),'/keep');
 }
 assert.equal(approvedCourseCover('__proto__'),null);assert.equal(approvedCourseCover('unrelated'),null);
});
