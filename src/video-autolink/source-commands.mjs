import {fail,id,integer,sha256} from '../protocol.mjs';
import {mediaAdmin,mediaOptions,mediaDetail,attachMedia} from '../media-attribution.mjs';
import {change,recording} from '../admin.mjs';
export const VIDEO_PART_BYTES=5*1024*1024;
export const VIDEO_ENVELOPE_BYTES=8*1024*1024;
export const VIDEO_COMMAND_BYTES=768*1024;
export const VIDEO_RESPONSE_BYTES=1024*1024;
const shapes={
 'video-source-capabilities':['action'],
 'video-source-options':['action'],
 'video-source-recordings':['action','playlistId','after'],
 'video-source-detail':['action','attachmentId'],
 'video-source-youtube':['action','operationId','assetId','videoId','title'],
 'video-source-attach':['action','operationId','attachmentId','assetId','title','teacherIds','playlistId','websiteId','lessonId','lessonDate','cohort'],
 'video-source-upload-start':['action','operationId','assetId','filename'],
 'video-source-upload-part':['action','assetId','partNumber','data','sha256'],
 'video-source-upload-complete':['action','operationId','assetId','parts']
};
export const sourceActions=new Set(Object.keys(shapes));
export function videoTransportEnabled(env){return env.VIDEO_AUTOLINK_HTTP_ENABLED==='1';}
export function uploadMaximum(env){
 const value=env.VIDEO_UPLOAD_MAX_BYTES;
 if(typeof value!=='string'||!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)<1||Number(value)>VIDEO_PART_BYTES*10000)throw fail('Recording upload limits are not configured.',503,'VIDEO_UPLOAD_UNCONFIGURED');
 return Number(value);
}
export function checkSourceCommand(command){
 const keys=shapes[command?.action];
 if(!keys||!command||typeof command!=='object'||Array.isArray(command)||Object.keys(command).some(k=>!keys.includes(k)))throw fail('Choose a supported recording command.',400,'PROCESSING_COMMAND_INVALID');
 const size=new TextEncoder().encode(JSON.stringify(command)).length;
 if(size>(command.action==='video-source-upload-part'?VIDEO_ENVELOPE_BYTES:VIDEO_COMMAND_BYTES))throw fail('This recording command is too large.',413,'PROCESSING_INPUT_TOO_LARGE');
}
export async function sourceCommand(env,store,actor,offer,command,fetcher){
 if(!videoTransportEnabled(env))throw fail('Video processing is not enabled.',404,'PROCESSOR_DISABLED');
 checkSourceCommand(command);offer=id(offer);const scope=await mediaAdmin(store,actor,offer,{readOnly:['video-source-capabilities','video-source-options','video-source-recordings','video-source-detail'].includes(command.action)});
 const native={...command};delete native.action;
 switch(command.action){
 case 'video-source-capabilities':{
  let maximum=null;try{maximum=uploadMaximum(env);}catch{}
  return {sourceAvailable:true,maxPartBytes:VIDEO_PART_BYTES,maxUploadBytes:maximum,maxTranscriptBytes:512*1024,transcriptFormats:['VTT','SRT'],manualTranscript:true,automaticZoomImport:false};
 }
 case 'video-source-options':return mediaOptions(env,store,actor,offer,fetcher);
 case 'video-source-recordings':{
  const playlist=id(command.playlistId),after=command.after?id(command.after):'';
  if(!await store.first('SELECT 1 FROM mou_playlists WHERE playlist_id=? AND offering_id=?',[playlist,offer]))throw fail('Choose the current Course playlist.',403);
  // Page the native owning offering first. Private Course source attribution
  // records its exact destination without entering published mou membership.
  const rows=await store.all("SELECT x.attachment_id id,x.title,x.lesson_date recordedDate,x.published,o.mime_type mime,t.draft_json attribution,EXISTS(SELECT 1 FROM mou_playlist_items p WHERE p.attachment_id=x.attachment_id AND p.playlist_id=?) member FROM attachments x JOIN objects o USING(asset_id) LEFT JOIN media_attributions t USING(attachment_id) WHERE x.offering_id=? AND x.audience='RECORDING' AND o.mime_type IN('video/mp4','video/youtube') AND x.attachment_id>? ORDER BY x.attachment_id LIMIT 26",[playlist,offer,after]);
  const selected=rows.slice(0,25).filter(r=>{try{return r.member===1||JSON.parse(r.attribution).playlist?.id===playlist;}catch{return r.member===1;}});
  return {recordings:selected.map(({attribution,member,...r})=>r),more:rows.length>25,next:rows.length>25?rows[24].id:null};
 }
 case 'video-source-detail':return mediaDetail(env,store,actor,offer,id(command.attachmentId));
 case 'video-source-youtube':return change(env,store,actor,offer,{...native,action:'youtube'});
 case 'video-source-attach':return attachMedia(env,store,actor,offer,{...native,action:'media-attach'},fetcher,change,{privateCourseSource:scope.kind==='COURSE'});
 case 'video-source-upload-start':uploadMaximum(env);return recording(env,store,actor,offer,{...native,action:'start'});
 case 'video-source-upload-complete':{
  uploadMaximum(env);return recording(env,store,actor,offer,{...native,action:'complete'});
 }
 case 'video-source-upload-part':{
  const maximum=uploadMaximum(env),part=integer(command.partNumber,1,10000),data=command.data;
  if(typeof data!=='string'||!data||data.length>Math.ceil(VIDEO_PART_BYTES/3)*4||data.length%4!==0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)||!/^[a-f0-9]{64}$/.test(command.sha256||''))throw fail('Choose a valid recording part.',400,'VIDEO_PART_INVALID');
  const decoded=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
  if(!decoded.length||decoded.length>VIDEO_PART_BYTES||(part-1)*VIDEO_PART_BYTES+decoded.length>maximum)throw fail('This recording exceeds the configured upload limit.',413,'PROCESSING_INPUT_TOO_LARGE');
  if(await sha256(decoded)!==command.sha256)throw fail('This recording part changed.',409,'VIDEO_PART_INVALID');
  return recording(env,store,actor,offer,{action:'part',assetId:id(command.assetId),partNumber:part},new Request('https://native.invalid/recording',{method:'PUT',body:decoded}));
 }

 }
}
