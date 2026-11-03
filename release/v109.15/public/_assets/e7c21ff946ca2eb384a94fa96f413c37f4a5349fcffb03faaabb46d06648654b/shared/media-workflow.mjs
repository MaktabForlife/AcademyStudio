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
const nativeId=value=>typeof value==='string'&&/^[-A-Za-z0-9_:]{1,180}$/.test(value);
export function checkedMediaTeacherIds(options,selected){
 if(!Array.isArray(selected)||selected.length<1||selected.length>10||selected.some(id=>!nativeId(id))||new Set(selected.map(id=>id.toLowerCase())).size!==selected.length)throw Error('Choose one to ten distinct registered Teachers.');
 if(!Array.isArray(options?.teachers))throw Error('Refresh the checked Teacher choices.');
 return selected.map(id=>{const matches=options.teachers.filter(t=>typeof t.id==='string'&&t.id.toLowerCase()===id.toLowerCase());if(matches.length!==1)throw Error('Refresh the checked Teacher selection.');return matches[0].id;});
}
export function checkedMediaPlaylist(options,playlistId){
 if(!nativeId(playlistId))throw Error('Choose a playlist before saving this recording.');
 const matches=Array.isArray(options?.playlists)?options.playlists.filter(p=>p.id===playlistId):[];
 if(matches.length!==1||matches[0].legacy===true||!nativeId(matches[0].id)||typeof matches[0].name!=='string'||!matches[0].name.trim()||matches[0].websiteId!=null&&!nativeId(matches[0].websiteId))throw Error('Choose a current playlist from the checked choices.');
 return matches[0];
}
export function checkedMediaSelection(options,input){
 const playlist=checkedMediaPlaylist(options,input.playlistId),teacherIds=checkedMediaTeacherIds(options,input.teacherIds);
 if(options.kind!=='COURSE'&&(!nativeId(input.cohort)||!options.classes?.some(c=>c.id===input.cohort)))throw Error('Choose a current native recorded class.');
 if(options.kind!=='COURSE'||input.lessonDate){const date=input.lessonDate;let parsed;try{parsed=new Date(date+'T00:00:00Z').toISOString().slice(0,10);}catch{}if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||parsed!==date)throw Error('Use the actual original recording date.');}
 if(input.websiteId&&playlist.websiteId&&input.websiteId!==playlist.websiteId)throw Error('The saved recording parent differs from the selected playlist. Reopen the recording.');
 return {playlist,teacherIds,websiteId:playlist.websiteId||input.websiteId||null};
}
function freezeCompanion(value){for(const item of Object.values(value))if(item&&typeof item==='object')freezeCompanion(item);return Object.freeze(value);}
export function pendingMedia(input){
 if(!nativeId(input.playlistId))throw Error('Choose a playlist before saving this recording.');
 const snapshot=Object.freeze({...input,teacherIds:Object.freeze([...input.teacherIds]),supportingFiles:Object.freeze([...input.supportingFiles]),companion:freezeCompanion(structuredClone(input.companion))});
 return {input:snapshot,assetId:uuid(),attachmentId:uuid(),sourceOperation:uuid(),attachOperation:uuid(),companionOperation:uuid(),uploadStartOperation:uuid(),uploadCompleteOperation:uuid(),parts:[],supports:snapshot.supportingFiles.map(file=>({file,assetId:uuid(),attachmentId:uuid(),operationId:uuid()}))};
}
export async function saveMediaDraft({pending:p,api,path,current=()=>{},report=()=>{}}){
 const input=p.input,checked=()=>current();checked();
 if(p.path&&p.path!==path)throw Error('Resume this private save in its original programme or Course.');p.path=path;
 // One fresh selection read per explicit Save; never per file or background poll.
 const options=await api(path+'/media-options');checked();const selected=checkedMediaSelection(options,input);
 const association=JSON.stringify([selected.playlist.id,selected.websiteId]);if(p.association&&p.association!==association)throw Error('The playlist parent changed. Reopen the saved recording before continuing.');p.association=association;
 if(input.sourceKind==='YOUTUBE'&&!p.reuseSource){
  report('Saving the recording source privately…');await api(path,{body:{action:'youtube',operationId:p.sourceOperation,assetId:p.assetId,videoId:youtubeSource(input.sourceURL),title:input.title}});checked();
 }else if(input.sourceKind!=='YOUTUBE'){
  const file=input.recordingFile;if(!file||file.type!=='video/mp4')throw Error('Choose an MP4 recording.');
  await api(path+'/recording',{body:{action:'start',operationId:p.uploadStartOperation,assetId:p.assetId,filename:file.name}});checked();
  for(let offset=p.parts.length*5*1024*1024;offset<file.size;offset+=5*1024*1024){checked();report('Saving recording part '+(p.parts.length+1)+'…');p.parts.push(await api(path+'/recording?'+new URLSearchParams({assetId:p.assetId,partNumber:p.parts.length+1}),{method:'PUT',body:file.slice(offset,offset+5*1024*1024)}));checked();}
  await api(path+'/recording',{body:{action:'complete',operationId:p.uploadCompleteOperation,assetId:p.assetId,parts:p.parts}});checked();
 }
 for(const support of p.supports){checked();report('Saving supporting file: '+support.file.name);await api(path+'/files?'+new URLSearchParams({assetId:support.assetId,operationId:support.operationId,filename:support.file.name}),{method:'PUT',body:support.file});checked();}
 await api(path,{body:{action:'media-attach',operationId:p.attachOperation,attachmentId:p.attachmentId,assetId:p.assetId,title:input.title,teacherIds:selected.teacherIds,playlistId:selected.playlist.id,websiteId:selected.websiteId,cohort:input.cohort||'',lessonDate:input.lessonDate||'',supportingFiles:p.supports.map(s=>({assetId:s.assetId,attachmentId:s.attachmentId}))}});checked();
 report('Saving the reviewed summary and topic guide…');await api(path,{body:{action:'media-companion-save',operationId:p.companionOperation,attachmentId:p.attachmentId,revision:0,durationSeconds:input.durationSeconds,companion:input.companion}});checked();return {attachmentId:p.attachmentId};
}
export async function publishMediaDraft({detail,operations,api,path,current=()=>{}}){
 current();const choices=await api(path+'/media-options');current();checkedMediaTeacherIds(choices,detail.recordedContext?.teacherIds);
 const playlist=detail.recordedContext?.playlist;if(playlist){const selected=checkedMediaPlaylist(choices,playlist.id);if(selected.websiteId&&selected.websiteId!==playlist.websiteId)throw Error('The saved playlist parent changed. Review this recording again.');}else if(!detail.published)throw Error('Choose and save a playlist before publishing this recording.');
 await api(path,{body:{action:'media-publication',operationId:operations.recording,attachmentId:detail.attachmentId,revision:detail.attributionRevision,draftContext:detail.draftContext,...(detail.companion?{sourceRevision:detail.sourceRevision,companionKey:detail.companionDraftKey,companionRevision:detail.companionRevision}:{})}});current();
}
