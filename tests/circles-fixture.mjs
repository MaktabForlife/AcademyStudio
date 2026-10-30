import {accessFixture} from './access-fixture.mjs';
import {newBlock,newLesson} from '../public/shared/model.mjs';
import {sha256} from '../src/protocol.mjs';
import {guideBindingsKey} from '../src/circles.mjs';

// New disposable test data only. No real bundle, identity, right or hosted API.
export async function circlesFixture(f){
 const x=await accessFixture(f),doc=structuredClone(f.doc),lesson=doc.lessons[0];
 doc.name='Synthetic Circles Course';lesson.title='A reading alongside the recording';
 const note={...newBlock('note'),aside:true,sourceKey:'recording:editorial-one',attribution:'A synthetic recorded lesson',text:'A synthetic summary for connection testing.'};
 const topics={...newBlock('list'),sourceKey:'recording-topics:editorial-one',items:['2:15 A synthetic topic']};
 lesson.sections[0].blocks.push(note,topics);doc.lessons.push(newLesson('A separate reading'));
 doc.lessons.at(-1).sections[0].blocks[0].text='A synthetic independent reading for this test.';
 const edition=await sha256(JSON.stringify(doc)),key='websites/site-course/versions/'+edition+'.json';
 await f.content.put(key,JSON.stringify(doc));await f.run("UPDATE websites SET draft_key=?,published_key=? WHERE website_id='site-course'",key,key);
 for(const [asset,type,video]of [['circles-video','video/youtube','abcdefghijk'],['circles-pdf','application/pdf',null]]){
  await f.run('INSERT INTO objects VALUES(?,?,?,?,?,?,?)',asset,type==='application/pdf'?'synthetic.pdf':null,type,'Synthetic material',24,type==='application/pdf'?await sha256('%PDF-1.4\nsynthetic bytes\n'):null,video);
  await f.run('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,1)',asset+'-attachment','course','site-course',asset,'native-one','2024-01-23','','Synthetic material','RECORDING');
 }
 await f.media.put('synthetic.pdf','%PDF-1.4\nsynthetic bytes\n');
 const binding={editorialLessonId:'editorial-one',nativeLessonId:'native-one',assetId:'circles-video'};
 await f.content.put(guideBindingsKey('site-course',edition),JSON.stringify({format:'CIRCLES_RECORDING_BINDINGS_V1',websiteId:'site-course',edition,bindings:[binding,{editorialLessonId:'denied',nativeLessonId:'never-permitted',assetId:'other-video'}]}));
 await f.content.put('public/circles/catalogue.json',JSON.stringify({format:'CIRCLES_PUBLIC_CATALOGUE_V1',items:[
  {key:'foundations',kind:'TAFSEER',title:'Foundations of Tafseer',publicTextPath:'/academy/foundations/'},
  {key:'fatir',kind:'TAFSEER',title:'Surah Fatir',pending:true},
  {key:'yaseen',kind:'TAFSEER',title:'Synthetic Surah',websiteId:'site-surah'},
  {key:'synthetic-course',kind:'COURSE',title:'Synthetic Circles Course',websiteId:'site-course'},
  {key:'unmapped-course',kind:'COURSE',title:'Synthetic unmapped draft',pending:true,websiteId:'must-not-leak',privateContent:'must-not-leak'}
 ]}));
 return {...x,doc,edition,binding};
}
