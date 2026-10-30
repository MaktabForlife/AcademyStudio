import test from 'node:test';
import assert from 'node:assert/strict';
import {seriesRecordings,independentReadings,recordingDetail,recordingList,authorRecordings,parseSeriesRoute,seriesRoute} from '../public/shared/recording-website.mjs';
import {bindRecordingGuides} from '../public/shared/media-bindings.mjs';
import {catalogueLock,circlesReviewPage} from '../tools/circles-review-page.mjs';
const row=(id,date='2026-01-01')=>({attachment_id:'attachment-'+id,asset_id:'asset-'+id,lesson_id:id,title:'Native '+id,lesson_date:date,type:'video/youtube'});
const guide=(id,readingId='reading-'+id)=>({lessonId:id,readingId,title:'Reviewed '+id,summary:'Original <summary> '+id,status:'reviewed',topics:[{time:'2:15',start:135,title:'First <topic>'}]});

test('series entries preserve permitted native identities and do not make denied guides playable',()=>{
 const media=[row('second','2026-02-01'),row('first'),{...row('duplicate'),asset_id:'asset-first'},{...row('pdf'),type:'application/pdf'}];
 const guides=[guide('editorial-first'),guide('denied'),guide('pending')];
 const mapped=bindRecordingGuides(guides,media,[{editorialLessonId:'editorial-first',nativeLessonId:'first',assetId:'asset-first'},{editorialLessonId:'denied',nativeLessonId:'missing',assetId:'asset-missing'}]);
 const entries=seriesRecordings({media,guides:mapped,pendingIds:['pending']});
 assert.deepEqual(entries.map(e=>e.id),['attachment-first','attachment-second','pending:pending']);
 assert.equal(entries[0].title,'Reviewed editorial-first');assert.deepEqual(entries[0].readingIds,['reading-editorial-first']);
 assert.equal(entries[2].row,undefined);assert(!recordingList({entries}).includes('data-material="attachment-missing"'));
 assert(!seriesRecordings({guides,pendingIds:[]}).length);
});

test('Read contains only readings without an explicit recording association and leaves the source intact',()=>{
 const course={lessons:[{id:'separate',title:'Separate reading'},{id:'linked',title:'Linked reading'},{id:'pending',title:'Pending companion'},{id:'other',title:'No guessed association'}]};
 const before=structuredClone(course),guides=[guide('one','linked'),guide('two','pending')];
 assert.deepEqual(independentReadings(course,guides).map(l=>l.id),['separate','other']);assert.deepEqual(course,before);
 assert.deepEqual(independentReadings(course,[],[{readingIds:['other']}]).map(l=>l.id),['separate','linked','pending']);
});

test('episode details expose full reviewed summary and native timed topics, while pending details have no playback',()=>{
 const course={lessons:[{id:'reading-one',title:'Read this'}]},g=guide('one');
 const [entry]=seriesRecordings({media:[row('one')],guides:[g]});
 const html=recordingDetail(entry,course);
 assert(html.includes('Original &lt;summary&gt; one'));assert(html.includes('Follow along by topic'));assert(html.includes('data-recording-start="135"'));assert(html.includes('data-material="attachment-one"'));assert(!html.includes('Transcript'));assert(!html.includes('youtube.com'));
 const [pending]=seriesRecordings({guides:[g],pendingIds:['one']}),pendingHTML=recordingDetail(pending,course);
 assert(pendingHTML.includes('Recording link pending'));assert(pendingHTML.includes('First &lt;topic&gt;'));assert(!pendingHTML.includes('data-material'));assert(!pendingHTML.includes('data-author-video'));assert(pendingHTML.includes('Read this'));
 assert(!recordingDetail(null,course).includes('data-material'));
});

test('author-only recording adapter deduplicates videos, retains explicit reading links and timed topics, and rejects unsafe sources',()=>{
 const v=(videoUrl,items=[])=>({type:'video',videoUrl,text:'Workshop',durationSeconds:3600,items});
 const course={lessons:[{id:'one',summary:'Reviewed author summary',sections:[{blocks:[v('https://www.youtube.com/watch?v=abcdefghijk'),v('https://www.youtube.com/watch?v=abcdefghijk',['1:01 A topic'])]}]},{id:'two',sections:[{blocks:[v('https://youtu.be/abcdefghijk?t=300s')]}]},{id:'three',sections:[{blocks:[v('https://youtube.com.evil.test/watch?v=abcdefghijk'),v('http://youtube.com/watch?v=zzzzzzzzzzz'),v('https://user@youtube.com/watch?v=zzzzzzzzzzz')]}]}]};
 const before=structuredClone(course),entries=authorRecordings(course);
 assert.equal(entries.length,1);assert.equal(entries[0].authorVideo,'abcdefghijk');assert.deepEqual(entries[0].readingIds,['one','two']);assert.equal(entries[0].topics[0].start,61);assert.equal(entries[0].row,undefined);assert.deepEqual(independentReadings(course,[],entries).map(l=>l.id),['three']);assert.deepEqual(course,before);
});

test('series navigation round trips stable detail and reading keys and rejects unknown views',()=>{
 for(const [route,id,field]of [['recording','native:one&two','recordingId'],['lesson','reading/one','lessonId']])assert.deepEqual(parseSeriesRoute('#'+seriesRoute(route,id)),{route,[field]:id});
 assert.deepEqual(parseSeriesRoute('#view=about'),{route:'about'});assert.deepEqual(parseSeriesRoute('#view=admin&id=anything'),{route:'home'});
});

test('catalogue cards carry names, pending text and subscription symbols without inventory copy',()=>{
 assert.equal(catalogueLock({key:'foundations'}),'');assert.equal(catalogueLock({subscriptionStatus:'free'}),'');
 assert(catalogueLock({subscriptionStatus:'required'}).includes('Subscription required'));assert(catalogueLock({subscriptionStatus:'subscribed'}).includes('Subscribed'));
 const item={key:'yaseen',title:'Surah Yaseen',kind:'TAFSEER',accent:'#805764',soft:'#eee2df',url:'/?website=synthetic',meta:'5 linked recordings · 12 readings',status:'Private mapping detail'},fatir={...item,key:'fatir',title:'Surah Fatir',url:''};
 const html=circlesReviewPage({websites:[item,fatir],courses:[],catalogue:[{key:'yaseen'},{key:'fatir'}]});
 assert(html.includes('class="tafseer-english" lang="en" dir="ltr">Surah Yaseen'));assert(html.includes('class="tafseer-english" lang="en" dir="ltr">Text pending'));assert(!html.includes('5 linked'));assert(!html.includes('Private mapping detail'));assert(!html.includes('collection-hero'));assert(!html.includes('collection-copy'));assert(html.includes('aria-label="Surah Yaseen · Subscription required"'));
});
