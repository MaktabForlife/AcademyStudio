import test from 'node:test';import assert from 'node:assert/strict';
import {recordingOverview,recordingGuides} from '../public/shared/recording-companion.mjs';

test('recording overview uses gated references, chronological lessons and reviewed transcript summaries only',()=>{
 const row=(id,date,asset=id)=>({attachment_id:id,asset_id:asset,lesson_id:id,title:'Lesson '+id,lesson_date:date,type:'video/youtube'});
 const html=recordingOverview({media:[row('second','2026-06-20'),row('first','2026-06-13'),row('duplicate','2026-06-27','first'),{...row('pdf','2026-06-01'),type:'application/pdf'}],guides:[{lessonId:'first',status:'pending',summary:'UNREVIEWED SUMMARY'},{lessonId:'second',status:'reviewed',summary:'A transcript-based summary <with escaped text>.'}],more:true});
 assert(html.indexOf('data-material="first"')<html.indexOf('data-material="second"'));assert.equal((html.match(/class="sp-recorded-lesson"/g)||[]).length,2);assert(!html.includes('UNREVIEWED SUMMARY'));assert(html.includes('A transcript-based summary &lt;with escaped text&gt;.'));assert(!html.includes('data-material="pdf"'));assert(!html.includes('data-material="duplicate"'));assert(!html.includes('youtube.com'));assert(!html.includes('data-sp="complete"'));assert(html.includes('Open companion reading'));assert(html.includes('Show more recorded lessons'));
 assert.equal(recordingOverview({media:[]}), '');
});

test('editable transcript asides bind to stable recording and reading identities without granting video URLs',()=>{
 const document={lessons:[{id:'reading-one',sections:[{blocks:[{type:'note',aside:true,sourceKey:'recording:original-session',attribution:'Guidance',text:'Reviewed summary.'},{type:'note',aside:false,sourceKey:'recording:ignored',text:'Not an aside.'}]}]}]};
 assert.deepEqual(recordingGuides(document),[{lessonId:'original-session',readingId:'reading-one',title:'Guidance',summary:'Reviewed summary.',status:'reviewed'}]);
 const html=recordingOverview({media:[{attachment_id:'gated',lesson_id:'original-session',title:'Lesson one',type:'video/youtube'}],guides:recordingGuides(document)});assert(html.includes('data-id="reading-one"'));assert(html.includes('Read alongside this lesson'));assert(html.includes('Reviewed summary.'));assert(!html.includes('href="https://'));
});
