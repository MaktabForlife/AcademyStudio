import test from 'node:test';
import assert from 'node:assert/strict';
import {tafseerCourseCover,tafseerDisplayCourse} from '../public/shared/tafseer-cover.mjs';
import {recordingWebsiteTabs} from '../public/shared/recording-website.mjs';

test('explicit source offering kind keeps Course pictures and scheduling even when its title matches a Tafseer name',()=>{
 const course={name:'Surah Yaseen',home:{},pages:{sessions:true,materials:true},displayIdentity:{kind:'COURSE'}};
 assert.equal(tafseerCourseCover(course),'');assert.deepEqual(recordingWebsiteTabs(course).map(([,label])=>label),['Listen','Read'],'Course uses the common Listen/Read tabs; scheduled Join remains separately gated');
 const tafseer={...course,name:'A source title',displayIdentity:{kind:'TAFSEER',key:'foundations'}};
 assert.equal(tafseerDisplayCourse(tafseer).name,'Introduction to Qur’anic Studies');assert(tafseerCourseCover(tafseer).includes('علوم القرآن'));assert(!recordingWebsiteTabs(tafseer).some(([key])=>key==='sessions'));
 assert.equal(tafseer.name,'A source title','Canonical display identity does not rewrite the saved source');
});
