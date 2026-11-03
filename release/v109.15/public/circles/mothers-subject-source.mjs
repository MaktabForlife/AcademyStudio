import {resolveCoursePlayback} from './course-source.mjs';

// Academy programme access is independent of Studio's course catalogue and adapter.
export async function loadMothersSubject(subject,{location=globalThis.location,fetcher=globalThis.fetch,adapter=globalThis.AcademyMothersSource}={}){
 if(adapter?.loadSubject){
  try{
   const result=await adapter.loadSubject(subject.key);
   return result?.access==='granted'&&result.bundle?.course?{mode:'authorised',bundle:result.bundle}:{mode:'locked'};
  }catch(error){if([401,403].includes(error.status))return {mode:'locked'};throw error;}
 }
 return {mode:'locked'};
}

export function resolveMothersPlayback(subject,entry,start=0,{location=globalThis.location,adapter=globalThis.AcademyMothersSource}={}){
 return resolveCoursePlayback(subject,entry,start,{location,adapter:adapter?.resolveRecording?{
  resolveRecording:request=>adapter.resolveRecording({subjectKey:subject.key,recordingId:entry.academyRecordingId||null,
   sourceVideoId:request.sourceVideoId,start:request.start})
 }:{}});
}

export const isMothersArabicNoteCrop=block=>block.type==='image'&&(
 String(block.assetId||'').startsWith('mothers-arabic-sheet-')||
 Boolean(block.crop&&/Arabic passage from the author[’']s notes/i.test(block.alt||''))
);

export function mothersReadingSections(lesson,sourceLessonId){
 return lesson.sections.flatMap(section=>{
  // Generated recording summaries/quotes/topics already appear in the podcast UI.
  // Preserve original author notes and the selected recording's existing application.
  if(sourceLessonId&&section.id.startsWith('reflection-local-mothers-')&&!section.id.endsWith(sourceLessonId))return [];
  const blocks=section.blocks.filter(block=>{
   // Use the existing typed Arabic passages, never the cropped scans of notes.
   if(isMothersArabicNoteCrop(block))return false;
   if(['text','quote'].includes(block.type)&&!block.text?.trim()&&!block.arabic&&!block.translation)return false;
   const key=block.sourceKey||'';
   if(['recording:','recording-quote:','recording-topics:'].some(prefix=>key.startsWith(prefix)))return false;
   if(key.startsWith('recording-application:')||key.startsWith('recording-reflection:'))return !sourceLessonId||key.endsWith(sourceLessonId);
   return true;
  });
  return blocks.length?[{...section,blocks}]:[];
 });
}

export function mothersReadingGroups(sections){
 const groups=[];
 for(const section of sections){
  const first=section.blocks[0],primary=first?.type==='ayah'?first.reference:null;
  let group=groups.at(-1);
  if(!group||(primary&&primary!==group.primary)){
   group={primary,sections:[],ayahs:[]};groups.push(group);
  }
  const commentary=section.blocks.flatMap(block=>block.type!=='ayah'?[block]:block.text?[{...block,type:'text',arabic:'',translation:''}]:[]);
  if(commentary.length)group.sections.push({...section,blocks:commentary});
  for(const ayah of section.blocks.filter(block=>block.type==='ayah')){
   const existing=group.ayahs.find(item=>item.arabic===ayah.arabic&&item.reference===ayah.reference);
   if(!existing)group.ayahs.push(ayah);
  }
 }
 return groups;
}
