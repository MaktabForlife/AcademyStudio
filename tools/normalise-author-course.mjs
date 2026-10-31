import {createHash} from 'node:crypto';
import {newBlock} from '../public/shared/model.mjs';
import {validatePackage} from '../public/shared/content-schema.mjs';

const fields = {
 course:'format id name tag theme home lessons pages menu sessionOptions materials updatedAt editorialLayout academyMediaIds sourceEdition',
 home:'headline subtitle description imageId imageAlt caption journeyTitle themes recordingLayout',
 theme:'id label title arabic description lessonId',
 lesson:'id title group summary sections sourceEdition accent moduleId journal',
 section:'id title label blocks sourceKey sourcePages',
 block:'id type aside text arabic translation reference attribution items leftArabic leftMeaning rightArabic rightMeaning assetId alt caption tint graphic crop presentation ordered emphasis sourceKey sourcePage legacyNoteKey',
 pages:'sessions materials assessments',menu:'home lessons sessions materials assessments',
 sessionOptions:'showTeacher showNotes',materials:'intro files',file:'id assetId title description'
};
const authorFields = {
 course:new Set(['recordingCompanion','quotationStyle']),
 home:new Set(['imageLayout']),
 lesson:new Set(['sourcePages','companionReading']),
 section:new Set(['transcriptSummary']),
 block:new Set(['sourcePages','videoUrl','durationSeconds','topicsOnly'])
};
const allowed = Object.fromEntries(Object.entries(fields).map(([kind,value])=>[kind,new Set(value.split(' '))]));
const hash = value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,32);

export function authorYouTube(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error('Review the author recording URL.');
 const videoId=url.hostname==='youtu.be'?url.pathname.slice(1):['youtube.com','www.youtube.com','www.youtube-nocookie.com'].includes(url.hostname)?url.pathname==='/watch'?url.searchParams.get('v'):/^\/(?:embed|shorts|live)\//.test(url.pathname)?url.pathname.split('/')[2]:null:null;
 if(!/^[A-Za-z0-9_-]{11}$/.test(videoId||''))throw Error('Choose an exact reviewed YouTube recording.');
 return videoId;
}

// An offline adapter only. It cannot create identities, rights, attachments,
// publication pointers or hosted media. Originals stay immutable in the source.
export function normaliseAuthorCourse(input,{key,additionalRecordings=[]}={}){
 if(!/^[a-z0-9-]+$/.test(key||''))throw Error('Choose a stable reviewed Course key.');
 const source=structuredClone(input.document||input.course||input),recordings=new Map(),editorial=[];
 const select=(value,kind)=>{
  const output={},extra={};
  for(const [name,item] of Object.entries(value)){
   if(allowed[kind].has(name))output[name]=structuredClone(item);
   else if(authorFields[kind]?.has(name))extra[name]=structuredClone(item);
   else throw Error(`Unreviewed ${kind} field: ${name}`);
  }
  if(Object.keys(extra).length)editorial.push({kind,id:value.id||null,fields:extra});
  return output;
 };
 for(const reading of source.lessons)for(const section of reading.sections)for(const block of section.blocks){
  if(block.type!=='video')continue;
  const videoId=authorYouTube(block.videoUrl);
  if(!recordings.has(videoId))recordings.set(videoId,{sourceVideoId:videoId,lessonId:'recording-'+hash([key,videoId]),assetId:'recording-asset-'+hash([key,videoId]),title:block.text||reading.title,recordingDate:null,readingIds:[],sourceBlocks:[],durationSeconds:block.durationSeconds??null});
  const recording=recordings.get(videoId);
  if(!recording.readingIds.includes(reading.id))recording.readingIds.push(reading.id);
  recording.sourceBlocks.push(block.id);
 }
 if(!Array.isArray(additionalRecordings)||additionalRecordings.length>80)throw Error('Review the additional recording list.');
 const readingIds=new Set(source.lessons.map(reading=>reading.id));
 for(const supplied of additionalRecordings){
  if(!supplied||Object.keys(supplied).some(field=>!['url','title','readingIds'].includes(field))||typeof supplied.title!=='string'||!supplied.title.trim()||supplied.title.length>200||!Array.isArray(supplied.readingIds)||supplied.readingIds.some(readingId=>!readingIds.has(readingId)))throw Error('Review the supplied recording and its exact supporting readings.');
  const videoId=authorYouTube(supplied.url);
  if(recordings.has(videoId))throw Error('This recording is already present in the author document.');
  recordings.set(videoId,{sourceVideoId:videoId,lessonId:'recording-'+hash([key,videoId]),assetId:'recording-asset-'+hash([key,videoId]),title:supplied.title.trim(),recordingDate:null,readingIds:[...new Set(supplied.readingIds)],sourceBlocks:[],durationSeconds:null});
  editorial.push({kind:'supplied-recording',id:videoId,fields:{url:'https://youtu.be/'+videoId,title:supplied.title.trim(),readingIds:[...new Set(supplied.readingIds)]}});
 }
 const document=select(source,'course');
 document.home=select(source.home,'home');document.home.themes=source.home.themes.map(theme=>select(theme,'theme'));
 for(const kind of ['pages','menu','sessionOptions'])document[kind]=select(source[kind],kind);
 document.materials=select(source.materials,'materials');document.materials.files=source.materials.files.map(file=>select(file,'file'));
 document.lessons=source.lessons.map(reading=>{
  const lesson=select(reading,'lesson');
  lesson.sections=reading.sections.map(section=>{
   const result=select(section,'section');result.blocks=[];
   for(const original of section.blocks){
    const block=select(original,'block');
    if(original.type==='list'&&['quote-cards','alternating'].includes(original.presentation)){
     // Retain the original decorative layout in private provenance. All list
     // text and order remain readable in the native editor's supported layout.
     editorial.push({kind:'block',id:original.id,fields:{presentation:original.presentation},nativePresentation:'list'});
     block.presentation='list';
    }
    if(original.sourcePages?.length&&!block.sourcePage)block.sourcePage=original.sourcePages[0];
    if(original.type==='video'){
     const recording=recordings.get(authorYouTube(original.videoUrl));
     // Preserve the original title/caption/text/ID. Playback is a separately
     // guarded native attachment, never a URL in the published document.
     block.type='note';block.aside=false;
     result.blocks.push({...newBlock('note'),id:'guide-'+hash([key,original.id]),aside:true,text:'',attribution:recording.title,sourceKey:'recording:'+recording.lessonId});
     result.blocks.push(block);
     if(original.items?.length)result.blocks.push({...newBlock('list'),id:'topics-'+hash([key,original.id]),text:'Follow the recording by topic',items:structuredClone(original.items),sourceKey:'recording-topics:'+recording.lessonId});
    }else{
     // Timestamp references remain in the private provenance ledger. A native
     // quote link is added only for an exact recording already in this Course.
     if(original.videoUrl){
      const recording=recordings.get(authorYouTube(original.videoUrl));
      if(!recording)throw Error('A quoted recording has no reviewed Course lesson.');
      if(original.type==='quote')block.sourceKey='recording-quote:'+recording.lessonId;
     }
     result.blocks.push(block);
    }
   }
   return result;
  });
  return lesson;
 });
 for(const supplied of additionalRecordings){
  const recording=recordings.get(authorYouTube(supplied.url));
  for(const readingId of recording.readingIds){
   const reading=document.lessons.find(row=>row.id===readingId);
   reading.sections.push({id:'supplied-recording-'+hash([key,readingId,recording.sourceVideoId]),title:'Recorded lesson',label:'',blocks:[{...newBlock('note'),id:'guide-'+hash([key,readingId,recording.sourceVideoId]),aside:true,text:'',attribution:recording.title,sourceKey:'recording:'+recording.lessonId}]});
  }
 }
 // Use actual explicitly reviewed transcript prose as the overview summary;
 // a PDF reading, title or date is never turned into a transcript summary.
 for(let index=0;index<source.lessons.length;index++){
  const original=source.lessons[index],reading=document.lessons[index];
  const prose=original.sections.filter(section=>section.transcriptSummary===true).flatMap(section=>section.blocks).find(block=>block.type==='text'&&block.text?.trim());
  if(prose){const overview=reading.sections.flatMap(section=>section.blocks).find(block=>block.sourceKey?.startsWith('recording:'));if(overview)overview.text=prose.text;}
 }
 const issues=validatePackage(document,{review:true});
 const blocks=new Map(document.lessons.flatMap(lesson=>lesson.sections.flatMap(section=>section.blocks.map(block=>[block.id,block]))));
 for(const lesson of source.lessons)for(const section of lesson.sections)for(const original of section.blocks){
  const converted=blocks.get(original.id);if(!converted)throw Error('An original author block was lost.');
  for(const field of ['text','arabic','translation','reference','attribution','items','assetId','alt','caption','leftArabic','leftMeaning','rightArabic','rightMeaning']){
   if(Object.hasOwn(original,field)&&JSON.stringify(original[field])!==JSON.stringify(converted[field]))throw Error('Original author content changed: '+original.id+'/'+field);
  }
 }
 return {document,recordings:[...recordings.values()],editorial,issues,proof:{originalReadings:source.lessons.length,originalBlocks:source.lessons.reduce((sum,lesson)=>sum+lesson.sections.reduce((n,section)=>n+section.blocks.length,0),0),recordingLessons:recordings.size,originalAuthorTextAndIdsPreserved:true,operationalChanges:false}};
}
