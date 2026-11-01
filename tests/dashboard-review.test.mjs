import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {recordingDetail,recordingList,presentRecordingWebsite} from '../public/shared/recording-website.mjs';
import {renderCourse} from '../public/shared/student.mjs';
import {newCourse,newLesson,newBlock} from '../public/shared/model.mjs';
const {parseHTML}=createRequire(import.meta.url)('linkedom');


test('recording detail keeps player/topics together and all companion/read-along text in a separate pane',()=>{
 const entry={id:'one',title:'One recording',summary:'The actual published summary',readingIds:['read'],topics:[{start:60,time:'1:00',title:'First topic'}],row:{attachment_id:'allowed',type:'video/youtube'},companion:{application:'Practice from this lesson',quotations:[{text:'Actual quotation',speaker:'Teacher',time:'1:00'}]}};
 const {document}=parseHTML(recordingDetail(entry,{lessons:[{id:'read',title:'Actual reading'}]}));
 assert(document.querySelector('.rs-watch-pane .rs-player-slot'));assert(document.querySelector('.rs-watch-pane details.rs-topics'));assert(!document.querySelector('.rs-watch-pane .rs-description'));assert.match(document.querySelector('.rs-read-pane').textContent,/The actual published summary/);assert.match(document.querySelector('.rs-read-pane').textContent,/Actual quotation/);assert(document.querySelector('.rs-read-pane [data-id=read]'));
 const list=parseHTML(recordingList({entries:[entry]})).document,card=list.querySelector('.rs-episode-card');assert(card.querySelector('.rs-card-main .rs-card-summary'));assert(card.querySelector(':scope > .rs-card-quotation'));
});
test('side-by-side presentation avoids duplicate transcript blocks while preserving original text and reflection identities in Read',()=>{
 const course=newCourse(),lesson=newLesson('A source-backed lesson','Companion'),note={...newBlock('note'),aside:true,sourceKey:'recording:native',attribution:'A source-backed lesson',text:'Actual recording summary'},quote={...newBlock('quote'),sourceKey:'recording-quote:native',text:'Exact source words'},topics={...newBlock('list'),sourceKey:'recording-topics:native',items:['1:00 Actual topic']},practice={...newBlock('text'),text:'A practical passage that must remain'},reflection={...newBlock('reflection'),id:'existing-reflection',text:'An original reflection'};
 lesson.sections[0].blocks=[note,quote,topics,practice,reflection];course.lessons=[lesson];course.pages.materials=true;const before=JSON.stringify(course),ui={portal:true,route:'recording',recordingId:'one',reflections:{},readingSize:18,completed:[]},assets=new Map(),{document}=parseHTML('<main class="student-course"></main>'),root=document.querySelector('main');root.innerHTML=renderCourse(course,ui,assets);
 const entry={id:'one',title:lesson.title,summary:note.text,quote:{text:quote.text},topics:[{start:60,time:'1:00',title:'Actual topic'}],readingIds:[lesson.id],row:{attachment_id:'allowed',type:'video/youtube'}};
 presentRecordingWebsite(root,{course,ui,assets,entries:[entry]});
 assert.deepEqual([...root.querySelectorAll('.rs-tabs button')].map(b=>b.textContent),['Listen','Read']);assert(root.querySelector('.rs-series-header [data-route=about]'));assert(root.querySelector('.rs-series-header [data-route=materials]'));assert.match(root.querySelector('.rs-read-pane').textContent,/A practical passage that must remain/);assert.equal(root.querySelectorAll('.rs-read-pane [data-recording-intro],.rs-read-pane [data-recording-topics],.rs-read-pane [data-recording-quote]').length,0);assert(root.querySelector('[data-sp-note=existing-reflection]'));assert.equal(JSON.stringify(course),before);
});
