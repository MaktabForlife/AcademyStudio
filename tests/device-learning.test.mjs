import test from 'node:test';
import assert from 'node:assert/strict';
import {newCourse} from '../public/shared/model.mjs';
import {exportAcademyDeviceLearning,exportDeviceLearning,importDeviceLearning} from '../public/shared/device-learning.mjs';
test('device transfer is account/website bound, filters unknown IDs, and retains newer existing answers',()=>{
 const document=newCourse(),lesson=document.lessons[0];const block={id:'reflection-stable',type:'reflection',text:'Reflect'};lesson.sections[0].blocks.push(block);
 const args={accountId:'learner-a',websiteId:'site-a',document},file=exportDeviceLearning({...args,state:{completed:[lesson.id,'unknown'],reflections:{'reflection-stable':'Older answer',other:'Do not transfer'},readingSize:18}});
 assert.deepEqual(file.completed,[lesson.id]);assert.deepEqual(Object.keys(file.reflections),['reflection-stable']);
 const result=importDeviceLearning(file,{...args,current:{reflections:{'reflection-stable':'Newer answer'}}});assert.equal(result.reflections['reflection-stable'],'Newer answer');
 assert.throws(()=>importDeviceLearning(file,{...args,accountId:'learner-b'}),/this account/);assert.throws(()=>importDeviceLearning(file,{...args,websiteId:'site-b'}),/this account/);
});
test('legacy export uses only the selected reader prefix and maps preserved note IDs without credentials or journal data',()=>{
 const document=newCourse(),lesson=document.lessons[0];lesson.sections[0].blocks.push({id:'preserved-note',type:'reflection',text:'Reflect',legacyNoteKey:'original-prompt'});
 const requested=[],prefix='course-website-selected-reader-',values=new Map([[prefix+'completed',JSON.stringify([lesson.id])],[prefix+'note-'+lesson.id+'-original-prompt','My answer']]);
 const file=exportAcademyDeviceLearning({storage:{getItem(key){requested.push(key);return values.get(key);}},prefix,accountId:'learner-a',websiteId:'site-a',document});
 assert.equal(file.reflections['preserved-note'],'My answer');assert(requested.every(key=>key.startsWith(prefix)));assert(!requested.some(key=>key.includes('token')||key.includes('journal')));
});
