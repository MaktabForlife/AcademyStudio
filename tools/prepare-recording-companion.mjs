import {readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve,dirname} from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {newBlock,THEMES} from '../public/shared/model.mjs';import {validatePackage} from '../public/shared/content-schema.mjs';
import {recordingTopics} from '../public/shared/recording-companion.mjs';
const [source,guideFile,output]=process.argv.slice(2);if(!source||!guideFile||!output)throw Error('Specify source package, reviewed guide file and a separate local output.');if(resolve(source)===resolve(output))throw Error('Keep the source package unchanged.');
const original=JSON.parse(await readFile(source,'utf8')),result=structuredClone(original),review=JSON.parse(await readFile(guideFile,'utf8')),guides=review.guides,document=result.document;
if(!Array.isArray(guides)||guides.length>80||new Set(guides.map(guide=>guide?.lessonId)).size!==guides.length)throw Error('Choose a bounded set of distinct reviewed recording guides.');
if(review.theme!==undefined){if(!Object.hasOwn(THEMES,review.theme))throw Error('Choose a supported website palette.');document.theme=review.theme;}
const stable=value=>createHash('sha256').update(document.id+':'+value).digest('hex').slice(0,24),added=[];
for(const guide of guides){
 if(guide.status!=='reviewed'||!guide.summary?.trim()||!guide.title?.trim()||!/^[\w:-]{1,160}$/.test(guide.lessonId))throw Error('Each guide needs a reviewed transcript summary and stable lesson reference.');
 const reading=document.lessons.find(reading=>reading.id===guide.readingId);if(!reading)throw Error('Choose an existing companion reading.');
 const key='recording:'+guide.lessonId,block={...newBlock('note'),id:'recording-note-'+stable(guide.lessonId),aside:true,attribution:guide.title,text:guide.summary,sourceKey:key};
 let section=reading.sections.find(section=>section.id==='recording-section-'+stable(guide.lessonId));
 if(!section){section={id:'recording-section-'+stable(guide.lessonId),title:'Recorded lesson companion',label:'TRANSCRIPT SUMMARY',blocks:[]};reading.sections.unshift(section);}
 const replace=value=>{const index=section.blocks.findIndex(row=>row.id===value.id);if(index<0)section.blocks.push(value);else section.blocks[index]=value;};replace(block);
 if(guide.quote?.text){if(!guide.quote.attribution?.trim()||!recordingTopics([guide.quote.timestamp+' Quotation']).length)throw Error('Attribute and timestamp each transcript quotation.');replace({...newBlock('quote'),id:'recording-quote-'+stable(guide.lessonId),text:guide.quote.text,attribution:guide.quote.attribution,caption:guide.quote.timestamp,sourceKey:'recording-quote:'+guide.lessonId});}
 if(guide.topics?.length){const items=guide.topics.map(topic=>topic.time+' '+topic.title);if(recordingTopics(items).length!==items.length)throw Error('Check the recording topic timestamps.');replace({...newBlock('list'),id:'recording-topics-'+stable(guide.lessonId),text:'Follow the recording by topic',items,ordered:false,sourceKey:'recording-topics:'+guide.lessonId});}
 if(guide.application!==undefined){
  if(typeof guide.application!=='string'||!guide.application.trim())throw Error('Check the reviewed practical closing text.');
  const id='recording-application-section-'+stable(guide.lessonId),block={...newBlock('text'),id:'recording-application-'+stable(guide.lessonId),text:guide.application,sourceKey:'recording-application:'+guide.lessonId};
  let closing=reading.sections.find(section=>section.id===id);if(!closing){closing={id,title:'Carry the lesson into daily life',label:'RECORDING REFLECTION',blocks:[]};reading.sections.push(closing);}
  const index=closing.blocks.findIndex(row=>row.id===block.id);if(index<0)closing.blocks.push(block);else closing.blocks[index]=block;
 }
 added.push({lessonId:guide.lessonId,readingId:reading.id,blockId:block.id});
}
const managedSections=new Set(guides.flatMap(guide=>['recording-section-','recording-application-section-'].map(prefix=>prefix+stable(guide.lessonId)))),managedKeys=new Set(guides.flatMap(guide=>['recording:','recording-quote:','recording-topics:','recording-application:'].map(prefix=>prefix+guide.lessonId)));
for(const reading of original.document.lessons){const next=document.lessons.find(row=>row.id===reading.id);assert(next);for(const section of reading.sections){const after=next.sections.find(row=>row.id===section.id);assert(after,'Existing author sections must remain.');if(managedSections.has(section.id)){for(const block of section.blocks.filter(block=>!managedKeys.has(block.sourceKey)))assert.deepEqual(after.blocks.find(row=>row.id===block.id),block,'Unrelated blocks in a recording section must remain unchanged.');}else assert.deepEqual(after,section,'Existing author content must remain unchanged.');}}
document.updatedAt=new Date().toISOString();const errors=validatePackage(document,{review:true});if(errors.length)throw Error(errors.join(' '));await mkdir(dirname(resolve(output)),{recursive:true});await writeFile(output,JSON.stringify(result));
await writeFile(output+'.audit.json',JSON.stringify({localOnly:true,source:resolve(source),guideFile:resolve(guideFile),originalReadingsPreserved:document.lessons.length,originalSectionsUnchanged:true,recordingGuides:added,practicalClosings:guides.filter(guide=>guide.application).length,theme:{previous:original.document.theme,current:document.theme},hostedCalls:0},null,2));console.log(JSON.stringify({localOnly:true,recordingSummaries:guides.length,originalSectionsUnchanged:true}));
