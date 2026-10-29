import test from 'node:test';import assert from 'node:assert/strict';
import {recordingOverview,recordingGuides,recordingTopics,recordingStart,recordingMomentLink,recordingTopicGuide,companionReadingEntry,recordingReadingIntro} from '../public/shared/recording-companion.mjs';

test('recording overview uses gated references, chronological lessons and reviewed transcript summaries only',()=>{
 const row=(id,date,asset=id)=>({attachment_id:id,asset_id:asset,lesson_id:id,title:'Lesson '+id,lesson_date:date,type:'video/youtube'});
 const html=recordingOverview({media:[row('second','2026-06-20'),row('first','2026-06-13'),row('duplicate','2026-06-27','first'),{...row('pdf','2026-06-01'),type:'application/pdf'}],guides:[{lessonId:'first',status:'pending',summary:'UNREVIEWED SUMMARY'},{lessonId:'second',status:'reviewed',summary:'A transcript-based summary <with escaped text>.'}],more:true});
 assert(html.indexOf('data-material="first"')<html.indexOf('data-material="second"'));assert.equal((html.match(/class="sp-recorded-lesson"/g)||[]).length,2);assert(!html.includes('UNREVIEWED SUMMARY'));assert(html.includes('A transcript-based summary &lt;with escaped text&gt;.'));assert(!html.includes('data-material="pdf"'));assert(!html.includes('data-material="duplicate"'));assert(!html.includes('youtube.com'));assert(!html.includes('data-sp="complete"'));assert(html.includes('WATCH · LISTEN · <em>FOLLOW ALONG</em>'));assert(!html.includes('Read &amp; reflect'));const home=companionReadingEntry()+html;assert(home.indexOf('Read &amp; reflect')<home.indexOf('class="sp-recorded-lesson"'));assert(companionReadingEntry().includes('data-route="lessons"'));assert(html.includes('Show more recorded lessons'));
 assert.equal(recordingOverview({media:[]}), '');
});

test('editable transcript asides bind to stable recording and reading identities without granting video URLs',()=>{
 const document={lessons:[{id:'reading-one',sections:[{blocks:[{type:'note',aside:true,sourceKey:'recording:original-session',attribution:'Guidance',text:'Reviewed summary.'},{type:'note',aside:false,sourceKey:'recording:ignored',text:'Not an aside.'}]}]}]};
 assert.deepEqual(recordingGuides(document),[{lessonId:'original-session',readingId:'reading-one',title:'Guidance',summary:'Reviewed summary.',status:'reviewed'}]);
 const html=recordingOverview({media:[{attachment_id:'gated',lesson_id:'original-session',title:'Lesson one',type:'video/youtube'}],guides:recordingGuides(document)});assert(html.includes('data-id="reading-one"'));assert(html.includes('Read alongside this lesson'));assert(html.includes('Reviewed summary.'));assert(!html.includes('href="https://'));
 document.lessons[0].sections[0].blocks.push({type:'quote',sourceKey:'recording-quote:original-session',reference:'1:1',text:'An ayah is not a transcript quotation.'},{type:'quote',sourceKey:'recording-quote:original-session',text:'A verified quotation <script>.',attribution:'Speaker · Lesson 01 · 10:00',caption:'10:00'},{type:'list',sourceKey:'recording-topics:original-session',items:['2:15 A supported topic','1:01:30 A later topic']});
 const quoted=recordingOverview({media:[{attachment_id:'gated',lesson_id:'original-session',title:'Lesson one',type:'video/youtube'}],guides:recordingGuides(document)});
 assert(quoted.includes('sp-recorded-quote'));assert(quoted.includes('A verified quotation &lt;script&gt;.'));assert(quoted.includes('Hear this in the recording'));assert(quoted.includes('data-recording-start="600"'));assert(!quoted.includes('Speaker · Lesson 01 · 10:00'));assert(!quoted.includes('An ayah is not a transcript quotation.'));assert(quoted.includes('Follow the recording by topic'));assert(quoted.includes('data-recording-start="3690"'));
});

test('timestamp navigation is bounded, escaped and attached only to authorised video rows',()=>{
 const topics=recordingTopics(['1:02:03 Later <topic>','2:15 First topic','2:15 Duplicate','1:60 Invalid','25:00:00 Too long','0:00   ']);
 assert.deepEqual(topics,[{time:'2:15',start:135,title:'First topic'},{time:'1:02:03',start:3723,title:'Later <topic>'}]);
 for(const invalid of [-1,Infinity,NaN,'-1','0&autoplay=1','2.5',{},null,86401])assert.equal(recordingStart(invalid),0);
 assert.equal(recordingStart('661'),661);
 const row={attachment_id:'gated',type:'video/youtube',title:'Lesson'};
 const html=recordingTopicGuide(row,topics);assert(html.includes('Later &lt;topic&gt;'));assert(html.includes('data-material="gated"'));assert(!html.includes('youtube.com'));
 assert.equal(recordingTopicGuide({...row,type:'application/pdf'},topics),'');assert.equal(recordingTopicGuide({},topics),'');assert.equal(recordingMomentLink(row,'not a time'),'');assert.equal(recordingMomentLink({...row,type:'application/pdf'},'11:01'),'');assert(recordingMomentLink(row,'11:01').includes('data-recording-start="661"'));
});


test('reading overview stays inside its gated recording card before actions and collapsed topics',()=>{
 const row={attachment_id:'gated-video',type:'video/youtube',title:'Original recording'},guide={title:'A living reminder',summary:'Notice the signs <around us>.',status:'reviewed',topics:recordingTopics(['2:15 Begin with reflection'])};
 const html=recordingReadingIntro(row,guide);assert(html.includes('WATCH &amp; FOLLOW ALONG'));assert(html.includes('Notice the signs &lt;around us&gt;.'));assert(html.indexOf('Notice the signs')<html.indexOf('Watch the full video'));assert(html.indexOf('Watch the full video')<html.indexOf('Follow the recording by topic'));assert(!html.includes('<details open'));assert(!html.includes('youtube.com'));assert(!html.includes('<textarea'));assert(!html.includes('Words to carry'));
 assert.equal(recordingReadingIntro({...row,type:'application/pdf'},guide),'');assert.equal(recordingReadingIntro(row,{...guide,status:'pending'}),'');assert.equal(recordingReadingIntro({},guide),'');
});
