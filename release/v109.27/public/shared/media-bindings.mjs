// Presentation only: aliases cannot make a recording playable. The input media
// must be the current permission-filtered API response for this website.
export function bindRecordingGuides(guides=[],media=[],bindings=[]){
 if(!Array.isArray(guides)||!Array.isArray(media)||!Array.isArray(bindings)||guides.length>200||media.length>200||bindings.length>200)throw Error('RECORDING_BINDING_LIMIT');
 return guides.map(guide=>{
  const matches=bindings.filter(b=>b.editorialLessonId===guide.lessonId);
  if(matches.length!==1)return guide;
  const binding=matches[0];
  if(!media.some(row=>row.attachment_id&&row.asset_id===binding.assetId&&row.lesson_id===binding.nativeLessonId))return guide;
  return {...guide,editorialLessonId:guide.lessonId,lessonId:binding.nativeLessonId};
 });
}
