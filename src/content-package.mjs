import {fail} from './protocol.mjs';
import {validateCourse} from '../public/shared/model.mjs';

// Content packages have no operational escape hatch. Keep this allowlist alongside
// the shared model: new editorial fields need an intentional contract change.
const fields={
 course:'format id name tag theme home lessons pages menu sessionOptions materials updatedAt editorialLayout academyMediaIds',
 home:'headline subtitle description imageId imageAlt caption journeyTitle themes',
 theme:'id label title arabic description lessonId',
 lesson:'id title group summary sections',section:'id title label blocks',
 block:'id type aside text arabic translation reference attribution items leftArabic leftMeaning rightArabic rightMeaning assetId alt caption tint graphic presentation ordered emphasis',
 pages:'sessions materials assessments',menu:'home lessons sessions materials assessments',
 sessionOptions:'showTeacher showNotes',materials:'intro files',file:'id assetId title description'
};
const allowed=Object.fromEntries(Object.entries(fields).map(([kind,names])=>[kind,new Set(names.split(' '))]));
function object(value,kind){
 if(!value||typeof value!=='object'||Array.isArray(value))throw fail('Check the website content settings.');
 for(const key of Object.keys(value))if(!allowed[kind].has(key))throw fail('Website content contains an unsupported field: '+key+'.');
}
function noMeetingLinks(value){
 if(typeof value==='string'&&/(?:https?:\/\/|www\.)(?:[-\w]+\.)*(?:zoom\.us|zoomgov\.com)(?=[:/?#\s]|$)/i.test(value))throw fail('Keep Zoom links in Academy session settings.');
 if(value&&typeof value==='object')for(const child of Object.values(value))noMeetingLinks(child);
}
export function validatePackage(document,{review=false}={}){
 let errors;try{errors=validateCourse(document,{review});}catch(error){throw fail(error.message);}
 object(document,'course');object(document.home,'home');object(document.pages,'pages');object(document.menu,'menu');object(document.sessionOptions,'sessionOptions');object(document.materials,'materials');
 for(const theme of document.home.themes||[])object(theme,'theme');
 for(const lesson of document.lessons||[]){object(lesson,'lesson');for(const section of lesson.sections||[]){object(section,'section');for(const block of section.blocks||[])object(block,'block');}}
 for(const file of document.materials.files||[])object(file,'file');
 noMeetingLinks(document);
 return errors;
}
export const contentVersion=key=>key?.split('/').at(-1)?.replace(/\.json$/,'')||null;
