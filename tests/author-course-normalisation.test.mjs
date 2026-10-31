import test from 'node:test';
import assert from 'node:assert/strict';
import {newCourse,newBlock,clone} from '../public/shared/model.mjs';
import {normaliseAuthorCourse,authorYouTube} from '../tools/normalise-author-course.mjs';
import {validatePackage} from '../public/shared/content-schema.mjs';

test('several supporting readings stay associated with one recording lesson without publishing its URL',()=>{
 const source=newCourse();source.recordingCompanion=true;
 for(let index=0;index<2;index++){
  const lesson=index?clone(source.lessons[0]):source.lessons[0];
  if(index){lesson.id='reading-two';lesson.sections[0].id='section-two';for(const block of lesson.sections[0].blocks)block.id='two-'+block.id;source.lessons.push(lesson);}
  lesson.sections[0].blocks.push({...newBlock('text'),id:'video-'+index,type:'video',text:'The original recording',videoUrl:'https://www.youtube.com/watch?v=abcdefghijk',items:['0:15 First topic'],durationSeconds:90,topicsOnly:true,sourcePages:[]});
 }
 const original=JSON.stringify(source),result=normaliseAuthorCourse(source,{key:'example'});
 assert.equal(result.recordings.length,1);assert.equal(result.recordings[0].readingIds.length,2);
 assert.equal(result.proof.recordingLessons,1);assert.equal(result.proof.originalReadings,2);
 assert.equal(JSON.stringify(source),original);assert.equal(result.proof.originalAuthorTextAndIdsPreserved,true);
 assert.doesNotMatch(JSON.stringify(result.document),/youtube|videoUrl|topicsOnly/);
 assert.deepEqual(validatePackage(result.document),[]);
 assert.equal(result.document.lessons.flatMap(l=>l.sections.flatMap(s=>s.blocks)).filter(b=>b.sourceKey?.startsWith('recording:')).every(b=>b.text===''),true,'No invented transcript summary');
});

test('unknown fields and non-YouTube playback cannot enter the native publishing schema',()=>{
 for(const url of ['https://evil.test/watch?v=abcdefghijk','javascript:alert(1)','https://www.youtube.com@evil.test/watch?v=abcdefghijk','https://zoom.us/j/123'])assert.throws(()=>authorYouTube(url));
 const course=newCourse();course.permissions={public:true};assert.throws(()=>normaliseAuthorCourse(course,{key:'example'}),/Unreviewed course field/);
 assert.throws(()=>normaliseAuthorCourse(newCourse(),{key:'../example'}));
});

test('an explicitly supplied recording can own several readings or have none without a timetable or fabricated date',()=>{
 const source=newCourse(),other=clone(source.lessons[0]);other.id='second-reading';for(const section of other.sections){section.id='other-'+section.id;for(const block of section.blocks)block.id='other-'+block.id;}source.lessons.push(other);
 const options={key:'spending',additionalRecordings:[{url:'https://youtu.be/UzKY4mmZTPQ?si=tracking',title:'The Qur’anic Framework of Spending',readingIds:source.lessons.map(row=>row.id)}]};
 const result=normaliseAuthorCourse(source,options),recording=result.recordings[0];
 assert.equal(recording.sourceVideoId,'UzKY4mmZTPQ');assert.equal(recording.recordingDate,null);assert.equal(result.proof.recordingLessons,1);assert.equal(recording.readingIds.length,2);
 assert.equal(Object.hasOwn(recording,'sessionId'),false);assert.deepEqual(validatePackage(result.document,{review:true}),[]);assert.doesNotMatch(JSON.stringify(result.document),/youtu\.be|UzKY4mmZTPQ|tracking/);
 const withoutReading=normaliseAuthorCourse(source,{...options,additionalRecordings:[{...options.additionalRecordings[0],readingIds:[]}]});assert.equal(withoutReading.recordings.length,1);assert.deepEqual(withoutReading.recordings[0].readingIds,[]);assert.deepEqual(withoutReading.document.lessons,source.lessons);
 assert.throws(()=>normaliseAuthorCourse(source,{...options,additionalRecordings:[{...options.additionalRecordings[0],readingIds:['missing']}]}),/exact supporting readings/);
 assert.throws(()=>normaliseAuthorCourse(source,{...options,additionalRecordings:[{...options.additionalRecordings[0],permissions:'FREE'}]}),/exact supporting readings/);
});
