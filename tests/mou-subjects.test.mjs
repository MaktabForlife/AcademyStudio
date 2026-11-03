import test from 'node:test';
import assert from 'node:assert/strict';
import {mouSubjects,mouSubjectsHTML} from '../public/shared/mou-subjects.mjs';
import {renderMouClassroom} from '../public/shared/mou-classroom.mjs';

test('MOU has Baqarah first, once, followed by the nine confirmed forthcoming subjects',()=>{
 assert.equal(mouSubjects.length,10);assert.equal(new Set(mouSubjects.map(s=>s.key)).size,10);
 assert.deepEqual(mouSubjects[0],{key:'surah-al-baqarah',title:'Tadabbur: Surah al-Baqarah',first:true});
 assert.equal(mouSubjects.filter(s=>s.first).length,1);
 const html=mouSubjectsHTML();assert.equal(html.split('Coming soon <span lang="ar" dir="rtl">إن شاء الله</span>').length-1,9);
 for(const subject of mouSubjects){assert.match(html,new RegExp(subject.title));assert.deepEqual(Object.keys(subject).sort(),['first','key','title']);}
 assert.doesNotMatch(html,/<a\b|<button\b|<iframe\b|href=|src=|data-website|data-enrol|data-media|data-join/);
});
test('the current classroom does not infer material or Join rights before access is checked',()=>{
 const html=renderMouClassroom({phase:'ready'});
 assert.match(html,/Your available playlists will appear after your access is checked/);
 assert.doesNotMatch(html,/membership is active|Free course|Subscribed|data-mou-join=|\.pdf|youtube|Published edition/i);
 assert.match(html,/data-circles-dashboard-home/);
});
