export function reflectionText(course,id,answers={}){
 for(const lesson of course.lessons)for(const section of lesson.sections)for(const block of section.blocks)if(block.type==='reflection'&&block.id===id){
  const answer=typeof answers[id]==='string'?answers[id].trim():'';
  return [course.name,lesson.title,'Pause & reflect',block.text,...(answer?['My reflection',answer]:[])].filter(Boolean).join('\n\n');
 }
 throw Error('This reflection is unavailable.');
}

export async function reflectionAction({course,id,answers,action,copy,share}){
 const text=reflectionText(course,id,answers);
 if(action==='share-reflection'&&share){try{await share({title:course.name,text});return 'Shared';}catch(error){if(error.name==='AbortError')return '';throw error;}}
 await copy(text);
 return action==='share-reflection'?'Copied · paste into the app you want to share with':'Copied';
}

export async function handleReflectionAction({course,id,answers,action,host,active=()=>true}){
 const status=host?.querySelector('.sp-reflection-action-status');
 try{
  if(!active())return;
  const message=await reflectionAction({course,id,answers,action,copy:async text=>{
   if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}
   const field=document.createElement('textarea');field.value=text;field.style.cssText='position:fixed;opacity:0';document.body.append(field);field.select();const ok=document.execCommand('copy');field.remove();if(!ok)throw Error('Copy is unavailable in this browser.');
  },share:navigator.share?payload=>navigator.share(payload):null});
  if(active()&&status)status.textContent=message;
 }catch(error){if(active()&&status)status.textContent=error.message||'Please try again.';}
}
