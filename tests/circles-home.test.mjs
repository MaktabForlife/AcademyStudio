import test from 'node:test';
import assert from 'node:assert/strict';
import {circlesHome,learningBranches,homeBranch} from '../public/shared/circles-home.mjs';
import {tafseerCourseCover,tafseerDisplayCourse} from '../public/shared/tafseer-cover.mjs';
import {recordingWebsiteTabs} from '../public/shared/recording-website.mjs';

test('the public single-circle presentation links to connected collections and Academy without adopting prototype workflows',()=>{
 const home=circlesHome('studio');assert.equal((home.match(/class="circle-home-orb"/g)||[]).length,1);
 assert(home.includes('href="/?view=collections"'));assert(home.includes('data-home-replay'));
 const navigation=learningBranches('studio');assert.equal((navigation.match(/data-home-branch=/g)||[]).length,3);assert(navigation.includes('Self-paced learning'));assert(!navigation.includes('>Studio<'));
 assert(circlesHome('academy').includes('data-home-academy'));assert(circlesHome('hifz').includes('data-home-academy'));
 assert.equal(homeBranch('<script>'),'studio');assert(!circlesHome('<script>').includes('<script>'));
 assert(!home.includes('data-action=')&&!home.includes('attendance')&&!home.includes('sample session'));
});

test('explicit source offering kind keeps Course pictures and scheduling even when its title matches a Tafseer name',()=>{
 const course={name:'Surah Yaseen',home:{},pages:{sessions:true,materials:true},displayIdentity:{kind:'COURSE'}};
 assert.equal(tafseerCourseCover(course),'');assert(recordingWebsiteTabs(course).some(([key])=>key==='sessions'));
 const tafseer={...course,name:'A source title',displayIdentity:{kind:'TAFSEER',key:'foundations'}};
 assert.equal(tafseerDisplayCourse(tafseer).name,'Qur’anic Studies');assert(tafseerCourseCover(tafseer).includes('علوم القرآن'));assert(!recordingWebsiteTabs(tafseer).some(([key])=>key==='sessions'));
 assert.equal(tafseer.name,'A source title','Canonical display identity does not rewrite the saved source');
});
