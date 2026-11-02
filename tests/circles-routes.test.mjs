import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyStudioDestination,collectionKind} from '../public/shared/circles-routes.mjs';
import {circlesCatalogue} from '../public/shared/circles-catalogue.mjs';
import {learningDestination} from '../public/shared/circles-sign-in.mjs';

test('existing reader/editing bookmarks keep their exact website, edition and reading destination when Circles becomes home',()=>{
 for(const suffix of ['?website=original-surah&edition=published#reading/original-lesson','?view=collections','?manage=1','?destination=academy'])assert.equal(legacyStudioDestination(new URL('https://website.test/'+suffix)),'/studio/'+suffix);
 for(const suffix of ['','?login=1&area=tafseer','?next=https://outside.test'])assert.equal(legacyStudioDestination(new URL('https://website.test/'+suffix)),null);
 assert.equal(legacyStudioDestination(new URL('https://website.test/?concept=circle&view=website')),'/');
 for(const path of ['/api/me?website=foo','/auth/exchange?manage=1','/studio/?website=original-surah','/builder/?website=original-surah'])assert.equal(legacyStudioDestination(new URL('https://website.test'+path)),null);
 assert.equal(legacyStudioDestination(new URL('https://website.test/?website=original&next=https://outside.test')),'/studio/?website=original&next=https://outside.test');
});

test('Circles Tafseer and Courses select their native collection and preserve real catalogue links and lock state',()=>{
 const items=[{key:'yaseen',kind:'TAFSEER',title:'Surah Yaseen',websiteId:'original-surah'},{key:'course',kind:'COURSE',title:'Original Course',websiteId:'original-course'}];
 assert.equal(learningDestination('tafseer'),'/studio/?view=collections&collection=tafseer');assert.equal(learningDestination('courses'),'/studio/?view=collections&collection=courses');
 const html=circlesCatalogue(items,[],{applicationPath:'/studio/',kind:collectionKind('tafseer')});
 assert(html.includes('href="/studio/?website=original-surah"'));assert(html.includes('data-circles-tab="TAFSEER" aria-current="page"'));assert(html.includes('aria-label="Courses" hidden'));assert(html.includes('Subscription required'));
 const course=circlesCatalogue(items,[{websiteId:'original-course',subscriptionStatus:'subscribed'}],{applicationPath:'/studio/',kind:collectionKind('courses')});
 assert(course.includes('data-circles-tab="COURSE" aria-current="page"'));assert(course.includes('aria-label="Tafseer" hidden'));assert(course.includes('Original Course · Subscribed'));
 const unsafe=circlesCatalogue(items,[],{applicationPath:'https://outside.test/',kind:'admin'});assert(!unsafe.includes('https://outside.test'));assert(unsafe.includes('href="/?website=original-surah"'));
});
