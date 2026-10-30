const fail=(message,status=400,code='INVALID_REQUEST')=>Object.assign(new Error(message),{status,code});
import {validateCourse,referencedAssets} from './model.mjs';

// Content packages have no operational escape hatch. Keep this allowlist alongside
// the shared model: new editorial fields need an intentional contract change.
const fields={
 course:'format id name tag theme home lessons pages menu sessionOptions materials updatedAt editorialLayout academyMediaIds sourceEdition',
 home:'headline subtitle description imageId imageAlt caption journeyTitle themes recordingLayout',
 theme:'id label title arabic description lessonId',
 lesson:'id title group summary sections sourceEdition accent moduleId journal',section:'id title label blocks sourceKey sourcePages',
 block:'id type aside text arabic translation reference attribution items leftArabic leftMeaning rightArabic rightMeaning assetId alt caption tint graphic crop presentation ordered emphasis sourceKey sourcePage legacyNoteKey',
 pages:'sessions materials assessments',menu:'home lessons sessions materials assessments',
 sessionOptions:'showTeacher showNotes',materials:'intro files',file:'id assetId title description'
};
const allowed=Object.fromEntries(Object.entries(fields).map(([kind,names])=>[kind,new Set(names.split(' '))]));
const optionalTypes={
 course:{sourceEdition:v=>typeof v==='boolean'},
 lesson:{sourceEdition:v=>typeof v==='boolean',accent:v=>typeof v==='string'&&v.length<=100,moduleId:v=>typeof v==='string'&&v.length<=180,journal:v=>typeof v==='boolean'},
 section:{sourceKey:v=>typeof v==='string'&&v.length<=1000,sourcePages:v=>Array.isArray(v)&&v.length<=1000&&v.every(page=>Number.isSafeInteger(page)&&page>=1&&page<=100000)},
 block:{aside:v=>typeof v==='boolean',sourceKey:v=>typeof v==='string'&&v.length<=1000,sourcePage:v=>Number.isSafeInteger(v)&&v>=1&&v<=100000,legacyNoteKey:v=>typeof v==='string'&&v.length<=1000}
};
function object(value,kind){
 if(!value||typeof value!=='object'||Array.isArray(value))throw fail('Check the website content settings.');
 for(const key of Object.keys(value))if(!allowed[kind].has(key))throw fail('Website content contains an unsupported field: '+key+'.');
 for(const [key,valid] of Object.entries(optionalTypes[kind]||{}))if(Object.hasOwn(value,key)&&!valid(value[key]))throw fail('Check the editorial source field: '+key+'.');
}
function noMeetingLinks(value){
 if(typeof value==='string'&&/(?:https?:\/\/|www\.)(?:[-\w]+\.)*(?:zoom\.us|zoom\.com|zoomgov\.com)(?=[:/?#\s]|$)/i.test(value))throw fail('Keep Zoom links in Academy session settings.');
 if(value&&typeof value==='object')for(const child of Object.values(value))noMeetingLinks(child);
}
export function validatePackage(document,{review=false}={}){
 let errors;try{errors=validateCourse(document,{review});}catch(error){throw fail(error.message);}
 object(document,'course');object(document.home,'home');object(document.pages,'pages');object(document.menu,'menu');object(document.sessionOptions,'sessionOptions');object(document.materials,'materials');
 for(const theme of document.home.themes||[])object(theme,'theme');
 for(const lesson of document.lessons||[]){object(lesson,'lesson');for(const section of lesson.sections||[]){object(section,'section');for(const block of section.blocks||[])object(block,'block');}}
 for(const file of document.materials.files||[])object(file,'file');
 const refs=referencedAssets(document);if(refs.length>100||refs.some(ref=>!/^[-A-Za-z0-9_:]{1,180}$/.test(ref)))throw fail('Choose up to 100 valid website asset references.');
 noMeetingLinks(document);
 return errors;
}
export const contentVersion=key=>key?.split('/').at(-1)?.replace(/\.json$/,'')||null;
