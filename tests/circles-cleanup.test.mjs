import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canonicalCirclesDestination as route} from '../public/shared/canonical-circles.mjs';
import {publicCirclesRoute} from '../src/public-circles-routes.mjs';
import {launch} from '../src/launch-worker.mjs';
import {hasHistoricalLessonContext} from '../public/shared/native-course-links.mjs';
const origin='https://maktab4life.org',dest=value=>route(origin+value);
test('Course metadata never guesses old recording, reading, time or edition identities',()=>{
 assert.equal(hasHistoricalLessonContext(origin+'/circles/free-learning.html?course=imratun-muminah'),false);
 for(const suffix of ['&id=old-reading','&view=read','&start=120','&edition=original','#reading/original'])assert.equal(hasHistoricalLessonContext(origin+'/circles/free-learning.html?course=imratun-muminah'+suffix),true);
});

test('public aliases retain exact functional reader/editor/query/hash identities',()=>{
 for(const input of ['/?website=surah-original&edition=published#view=lesson&id=original','/circles/?website=original&offering=offer&playlist=playlist&recording=rec#view=recording&id=attachment','/?view=collections&collection=courses','/?manage=1&offering=scope','/?classroom=mothers']){
  const actual=new URL(dest(input),origin),before=new URL(input,origin);assert.equal(actual.pathname,'/studio/');assert.equal(actual.search,before.search);assert.equal(actual.hash,before.hash);
 }
 assert.equal(dest('/circles/?concept=journal&view=website&branch=academy&role=admin&workspace=teach&public=1#academy-story'),'/?workspace=teach&public=1#academy-story');
 assert.equal(dest('/?website=real&view=recording&id=exact&concept=courtyard#original'),'/studio/?website=real&view=recording&id=exact#original');
 assert.equal(dest('/studio/?website=real&view=recording&id=exact#original'),null);
 assert.equal(dest('/builder/?website=exact&revision=4'),null);
});
test('legacy dashboard intent uses checked hub and native tool bookmarks keep fixed Source origin',()=>{
 for(const suffix of ['#overview','#dashboard','?view=dashboard&role=admin','?view=academy'])assert.equal(new URL(dest('/'+suffix),origin).searchParams.get('dashboard'),'1');
 assert.equal(dest('/?workspace=admin'),null);assert.equal(dest('/?public=1#overview'),null);
 assert.equal(dest('/?public=1#story'),'/?public=1#academy-story');assert.equal(dest('/#login'),'/?login=1');
 assert.equal(dest('/?public=1#prospectus'),'/prospectus-2027.html?public=1');
 assert.equal(dest('/?program=exact#activity/PROGRAM:exact/learn'),'https://academy-maktab4life.pages.dev/academy/?program=exact#activity/PROGRAM:exact/learn');
 assert.equal(dest('/#administration/access'),'https://academy-maktab4life.pages.dev/academy/admin/#administration/access');
 assert.equal(dest('/?next=https://outside.test#unknown'),null,'Untrusted next does not become a destination');
 assert.equal(dest('/?next=https://outside.test#timetable/learn'),'https://academy-maktab4life.pages.dev/academy/?next=https://outside.test#timetable/learn');
});
test('no API, auth, signed media, file or one-use bridge query is rewritten',()=>{
 for(const path of ['/api/me?role=admin','/api/media/exact?branch=studio','/auth/exchange?concept=circle','/internal/content?view=website','/api/admin/offer/import?role=admin']){
  assert.equal(dest(path),null);assert.equal(publicCirclesRoute(new Request(origin+path)),null);
 }
});
test('aliases and retired operator paths add zero database, object-storage or asset reads',async()=>{
 let reads=0;const env=new Proxy({WEBSITE_ORIGIN:origin,RELEASE_VERSION:'109.11'}, {get(target,key){if(key in target)return target[key];reads++;throw Error('Unexpected binding '+String(key));}});
 for(const path of ['/circles/?concept=circle&view=website','/index.html','/circles/prospectus-2027.html','/programs/timetable.html?program=exact&tab=week','/users/?workspace=ADMIN','/recorder/?draft=keep','/activities/kaaba-puzzle/','/pdf-viewer/web/viewer.html?file=exact','/admin/#administration','/student.html','/preview/','/preview/websites/','/import/']){
  for(const method of ['GET','HEAD']){const result=await launch(new Request(origin+path,{method}),env,{});assert([307,410].includes(result.status),path);assert.equal(result.headers.get('cache-control'),'no-store');if(result.status===307){const url=new URL(result.headers.get('location'));assert([origin,'https://academy-maktab4life.pages.dev'].includes(url.origin));}if(method==='HEAD')assert.equal(await result.text(),'');}
 }
 assert.equal(reads,0);
 assert.equal(publicCirclesRoute(new Request(origin+'/programs/',{method:'POST'})),null,'Do not redirect native mutations');
});
test('approved root composition uses connected dashboard only; reader and builder retain dirty/account guards',async()=>{
 const [html,home,app,builder]=await Promise.all(['public/index.html','public/circles/app.js','public/app.mjs','public/builder/admin.mjs'].map(path=>readFile(new URL('../'+path,import.meta.url),'utf8')));
 assert(!/concept=|view=website|branch=studio/.test(html+home));assert(!/journalWebsite|courtyardWebsite|communityDashboard|Sample learner|Demo assignments/.test(home));
 assert(html.includes('/circles-home-entry.mjs'));assert(home.includes('Making space'));assert(home.includes('academyNews()'));assert(home.includes('freeCourseHomeSection()'));
 assert(!app.includes("show('homepage')"));assert(!app.includes('renderPublicCircle'));assert(!app.includes('./preview/homepage.mjs'));
 assert(app.includes('canLeaveWorkspace()'));assert(app.includes('protectAccountHistory'));assert(app.includes('signInFromCircles')===false);assert(app.includes("api('/auth/exchange'"));
 assert(builder.includes('!editing?.pending'));assert(builder.includes('studio.canLeave()'));assert(builder.includes('header(null)'));assert(builder.includes('pageHistory.update(identity.account)'));
});
