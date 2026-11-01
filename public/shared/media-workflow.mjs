import {learnerCompanion} from './learner-companion.mjs';
export function youtubeSource(value){
 let url;try{url=new URL(value);}catch{throw Error('Enter the recording’s full YouTube link.');}
 if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error('Use a secure YouTube recording link.');
 const videoId=url.hostname==='youtu.be'?url.pathname.slice(1):['youtube.com','www.youtube.com','www.youtube-nocookie.com'].includes(url.hostname)?url.pathname==='/watch'?url.searchParams.get('v'):/^\/(embed|shorts|live)\//.test(url.pathname)?url.pathname.split('/')[2]:null:null;
 if(!/^[\w-]{11}$/.test(videoId||''))throw Error('Choose the exact YouTube recording link.');return videoId;
}
export function reviewedCompanion({summary,topics,application,lessonReference,imported,durationSeconds}){
 const lines=topics.split(/\r?\n/).filter(t=>t.trim()),rows=lines.map(line=>{const match=line.trim().match(/^(\d{1,3}:[0-5]\d(?::[0-5]\d)?)\s+(.+)$/);if(!match)throw Error('Use one topic per line, such as 00:00 Introduction.');return {time:match[1],title:match[2]};});
 if(!summary.trim()||!rows.length)throw Error('Add the reviewed full summary and topic guide before saving.');
 const value=learnerCompanion({...imported,schema:'LEARNER_COMPANION_V1',summary,topics:rows,application,lessonReference});
 if(!Number.isInteger(durationSeconds)||durationSeconds<1||durationSeconds>86400||value.topics.some(t=>t.start>=durationSeconds))throw Error('Confirm the recording length and keep all topics within it.');return value;
}
const uuid=()=>crypto.randomUUID();
export function pendingMedia(input){return {input,assetId:uuid(),attachmentId:uuid(),sourceOperation:uuid(),attachOperation:uuid(),companionOperation:uuid(),uploadStartOperation:uuid(),uploadCompleteOperation:uuid(),parts:[],supports:input.supportingFiles.map(file=>({file,assetId:uuid(),attachmentId:uuid(),operationId:uuid()}))};}
export async function saveMediaDraft({pending:p,api,path,current=()=>{},report=()=>{}}){
 const input=p.input,checked=()=>current();checked();
 if(input.sourceKind==='YOUTUBE'){
  report('Saving the recording source privately…');await api(path,{body:{action:'youtube',operationId:p.sourceOperation,assetId:p.assetId,videoId:youtubeSource(input.sourceURL),title:input.title}});checked();
 }else{
  const file=input.recordingFile;if(!file||file.type!=='video/mp4')throw Error('Choose an MP4 recording.');
  await api(path+'/recording',{body:{action:'start',operationId:p.uploadStartOperation,assetId:p.assetId,filename:file.name}});checked();
  for(let offset=p.parts.length*5*1024*1024;offset<file.size;offset+=5*1024*1024){checked();report('Saving recording part '+(p.parts.length+1)+'…');p.parts.push(await api(path+'/recording?'+new URLSearchParams({assetId:p.assetId,partNumber:p.parts.length+1}),{method:'PUT',body:file.slice(offset,offset+5*1024*1024)}));checked();}
  await api(path+'/recording',{body:{action:'complete',operationId:p.uploadCompleteOperation,assetId:p.assetId,parts:p.parts}});checked();
 }
 for(const support of p.supports){checked();report('Saving supporting file: '+support.file.name);await api(path+'/files?'+new URLSearchParams({assetId:support.assetId,operationId:support.operationId,filename:support.file.name}),{method:'PUT',body:support.file});checked();}
 await api(path,{body:{action:'media-attach',operationId:p.attachOperation,attachmentId:p.attachmentId,assetId:p.assetId,title:input.title,teacherIds:input.teacherIds,playlistId:input.playlistId||null,websiteId:input.websiteId||null,cohort:input.cohort||'',lessonDate:input.lessonDate||'',supportingFiles:p.supports.map(s=>({assetId:s.assetId,attachmentId:s.attachmentId}))}});checked();
 report('Saving the reviewed summary and topic guide…');await api(path,{body:{action:'media-companion-save',operationId:p.companionOperation,attachmentId:p.attachmentId,revision:0,durationSeconds:input.durationSeconds,companion:input.companion}});checked();return {attachmentId:p.attachmentId};
}
export async function publishMediaDraft({detail,operations,api,path,current=()=>{}}){
 current();const choices=await api(path+'/media-options');current();if(!detail.recordedContext?.teacherIds.every(id=>choices.teachers.some(t=>t.id===id)))throw Error('Refresh the checked Teacher selection before publishing.');
 await api(path,{body:{action:'media-publication',operationId:operations.recording,attachmentId:detail.attachmentId,revision:detail.attributionRevision,draftContext:detail.draftContext,...(detail.companion?{sourceRevision:detail.sourceRevision,companionKey:detail.companionDraftKey,companionRevision:detail.companionRevision}:{})}});current();
}
