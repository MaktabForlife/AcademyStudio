import {readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve,dirname} from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {newBlock} from '../public/shared/model.mjs';import {validatePackage} from '../public/shared/content-schema.mjs';
import {recordingTopics} from '../public/shared/recording-companion.mjs';
const [source,guideFile,output]=process.argv.slice(2);if(!source||!guideFile||!output)throw Error('Specify source package, reviewed guide file and a separate local output.');if(resolve(source)===resolve(output))throw Error('Keep the source package unchanged.');
const original=JSON.parse(await readFile(source,'utf8')),result=structuredClone(original),guides=JSON.parse(await readFile(guideFile,'utf8')).guides,document=result.document;
if(!Array.isArray(guides)||guides.length>80)throw Error('Choose a bounded set of reviewed recording guides.');
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
 added.push({lessonId:guide.lessonId,readingId:reading.id,blockId:block.id});
}
for(const reading of original.document.lessons){const next=document.lessons.find(row=>row.id===reading.id);assert(next);for(const section of reading.sections.filter(row=>!row.id.startsWith('recording-section-')))assert.deepEqual(next.sections.find(row=>row.id===section.id),section,'Existing author content must remain unchanged.');}
document.updatedAt=new Date().toISOString();const errors=validatePackage(document,{review:true});if(errors.length)throw Error(errors.join(' '));await mkdir(dirname(resolve(output)),{recursive:true});await writeFile(output,JSON.stringify(result));
await writeFile(output+'.audit.json',JSON.stringify({localOnly:true,source:resolve(source),guideFile:resolve(guideFile),originalReadingsPreserved:document.lessons.length,originalSectionsUnchanged:true,recordingGuides:added,hostedCalls:0},null,2));console.log(JSON.stringify({localOnly:true,recordingSummaries:guides.length,originalSectionsUnchanged:true}));
