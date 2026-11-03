// Hosted integration supplies an authorised adapter; private preview data stays outside dist/.
export const isLocalPreview = () => false;

export async function localCourseCatalogue(){return [];}

export async function loadCourseSource(selected,{location=globalThis.location,fetcher=globalThis.fetch,adapter=globalThis.AcademyCourseSource}={}){
 if(adapter?.loadCourse){
  try{
   const result=await adapter.loadCourse(selected.key);
   if(result?.access==='granted'&&result.bundle?.course)return {mode:'authorised',bundle:result.bundle};
   return {mode:'locked'};
  }catch(error){if([401,403].includes(error.status))return {mode:'locked'};throw error;}
 }
 if(selected.access==='free'){
  const response=await fetcher('free-learning/'+selected.key+'.json');
  if(response.status===404)return {mode:'pending'};if(!response.ok)throw Error('The course could not be opened.');
  return {mode:'public',bundle:await response.json()};
 }
 return {mode:'locked'};
}

export async function resolveCoursePlayback(course,entry,start=0,{location=globalThis.location,adapter=globalThis.AcademyCourseSource}={}){
 const seconds=Math.max(0,Math.floor(Number(start)||0));
 if(adapter?.resolveRecording){
  try{
   const result=await adapter.resolveRecording({courseKey:course.key,recordingId:entry.studioRecordingId||null,sourceVideoId:entry.id,start:seconds});
   if(result?.access!=='granted')return {mode:'locked'};
   const media=result.media;
   if(media?.kind==='youtube'&&/^[\w-]{11}$/.test(media.videoId||''))return {mode:'ready',media:{kind:'youtube',videoId:media.videoId},start:seconds};
   if(['audio','video'].includes(media?.kind)){
    const url=new URL(media.url);if(url.protocol==='https:'&&!url.username&&!url.password)return {mode:'ready',media:{kind:media.kind,url:url.href},start:seconds};
   }
  }catch(error){if([401,403].includes(error.status))return {mode:'locked'};}
  return {mode:'pending'};
 }
 return {mode:'pending'};
}
