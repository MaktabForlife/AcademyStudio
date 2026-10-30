import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';import {resolve,dirname,join} from 'node:path';import {runInNewContext} from 'node:vm';
const build=process.env.CIRCLES_UI_BUILD&&resolve(process.env.CIRCLES_UI_BUILD),options={skip:!build};
const read=path=>readFile(join(build,path),'utf8');
test('the complete podcast UI has its local module dependencies, native login and dashboard',options,async()=>{
 const files=[];async function visit(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())await visit(path);else if(/\.(mjs|html)$/.test(path))files.push(path);}}await visit(join(build,'circles'));
 for(const file of files){const source=await readFile(file,'utf8'),refs=file.endsWith('.mjs')?[...source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)].map(m=>m[1]):[...source.matchAll(/(?:src|href)="([^"?]+)(?:\?[^\"]*)?"/g)].map(m=>m[1]).filter(p=>/\.(?:m?js|css)$/.test(p)&&!p.startsWith('/'));
  for(const ref of refs)assert((await stat(resolve(dirname(file),ref.split(/[?#]/)[0]))).isFile(),file+' → '+ref);
 }
 const index=await read('index.html');assert(index.includes('homepage-layout.js'));assert(index.includes('/circles-login.mjs'));assert(!/src="(?:layout|text)-editor/.test(index));
 for(const path of ['api.mjs','circles-login.mjs','circles-dashboard.mjs','shared/pin-entry.mjs'])assert.equal(await read(path),await readFile(new URL('../public/'+path,import.meta.url),'utf8'),path);
 const native=await read('studio/index.html');assert.match(native,/<main[^>]+aria-busy="true"[^>]+hidden>/);
});
test('the connected composition keeps private course/MOU payloads and localhost playback out',options,async()=>{
 const source=await import('file://'+join(build,'circles/course-source.mjs'));globalThis.AcademyConnectedCirclesUI=true;
 try{
  assert.equal(source.isLocalPreview({hostname:'localhost'}),false);const calls=[];
  assert.deepEqual(await source.loadCourseSource({key:'resilience',access:'free'},{location:{hostname:'localhost'},fetcher:async path=>{calls.push(path);return {ok:false,status:404};}}),{mode:'pending'});
  assert.deepEqual(calls,['free-learning/resilience.json']);
  assert.deepEqual(await source.resolveCoursePlayback({key:'resilience'},{id:'abcdefghijk'},0,{location:{hostname:'localhost'}}),{mode:'pending'});
  assert.deepEqual(await source.loadCourseSource({key:'surah-al-kahf',access:'paid'},{location:{hostname:'localhost'},fetcher:()=>assert.fail('No private payload fallback'),adapter:{loadCourse:async()=>({access:'denied'})}}),{mode:'locked'});
 }finally{delete globalThis.AcademyConnectedCirclesUI;}
 const publicPayloads=await readdir(join(build,'circles/free-learning'));assert.deepEqual(publicPayloads.sort(),['imratun-muminah.json','ulumul-quran-notes.pdf','ulumul-quran.json']);
 assert((await read('circles/free-learning.html')).includes('AcademyConnectedCirclesUI=true'));assert((await read('circles/podcast-view.mjs')).includes('Materials coming soon'));
 const subject=await read('circles/academy/mothers/surah-al-baqarah/index.html');assert(subject.includes('AcademyConnectedCirclesUI=true'));assert(subject.includes('/studio/?classroom=mothers'));
});
test('course presentation preserves the corrected categories and six-day five-free/one-paid rotation',options,async()=>{
 const context={};runInNewContext(await read('circles/free-learning-catalogue.js'),context);runInNewContext(await read('circles/free-learning.js'),context);
 assert.deepEqual(Array.from(context.AcademyPaidCourses,c=>c.key),['surah-al-kahf','tawakkul-mindset','stillness-in-my-salah','spending']);
 assert(context.AcademyApprovedFreeCourses.some(c=>c.key==='resilience'&&c.access==='free'));assert(context.AcademyTafseerStudies.some(c=>c.key==='ulumul-quran'));
 for(const now of [Date.parse('2026-10-30'),Date.parse('2026-11-06')]){const free=context.AcademyFreeLearning.homepageCourses(now),paid=context.AcademyFreeLearning.homepagePaidCourses(now);assert.equal(free.length,5);assert.equal(paid.length,1);assert(!free.some(c=>['ulumul-quran','mothers-baqarah'].includes(c.key)));}
 const card=(await read('circles/app.js')).split('\n').find(line=>line.startsWith('function freeCourseCard('));
 const inactive=runInNewContext(card+";freeCourseCard({key:'review',title:'Review',cover:'test.png',coverAlt:'Test'})",{esc:String});
 assert.match(inactive,/aria-disabled="true"/);assert.match(inactive,/>Inactive<\/span>/);assert.doesNotMatch(inactive,/<a\b|href=|data-action=|data-free-course=/,'Free placeholders are inactive from the first render and every rotation');
});
