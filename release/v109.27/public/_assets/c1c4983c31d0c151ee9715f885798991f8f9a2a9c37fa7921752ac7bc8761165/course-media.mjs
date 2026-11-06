import {mountCourseMedia,courseMediaReadActions} from './shared/course-media-workflow.mjs';
import * as cardTools from './shared/playlist-card.mjs';
import {api,mutate,identity} from './api.mjs';

export function mountNativeCourseMedia(host,{offeringId,courseName,current=()=>true}){
 for(const href of ['/_assets/c1c4983c31d0c151ee9715f885798991f8f9a2a9c37fa7921752ac7bc8761165/shared/course-media-workflow.css','/_assets/c1c4983c31d0c151ee9715f885798991f8f9a2a9c37fa7921752ac7bc8761165/shared/playlist-card.css'])if(!document.querySelector('link[href="'+href+'"]')){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);}
 const generation=identity.generation;
 const request=async(action,input={})=>{
  if(action==='mou-playlist-card-options')return api('/api/admin/'+encodeURIComponent(offeringId)+'/playlist-card-options');
  if(action==='mou-playlist-cover-upload'){const {file,image,playlistId,revision}=input;return api('/api/admin/'+encodeURIComponent(offeringId)+'/playlist-cover?'+new URLSearchParams({playlistId,revision,operationId:crypto.randomUUID(),sha256:image.sha256}),{method:'PUT',body:file,headers:{'Content-Type':file.type}});}
  if(action==='mou-playlist-cover-preview')return api('/api/admin/'+encodeURIComponent(offeringId)+'/playlist-cover?'+new URLSearchParams({playlistId:input.playlistId,assetId:input.image.assetId}),{blob:true});
  if(courseMediaReadActions.has(action))return api('/api/admin/'+encodeURIComponent(offeringId)+'/course-playlists?'+new URLSearchParams({action,...input}));
  return mutate('/api/admin/'+encodeURIComponent(offeringId),{action,...input});
 };
 const processingRequest=async(action,input={})=>{
  if(generation!==identity.generation||!current())throw new DOMException('The account or Course changed.','AbortError');
  if(action==='video-source-upload-part'){
   const {file,...fields}=input;if(!(file instanceof Blob)||file.size>5*1024*1024)throw Error('Choose a valid recording part.');
   const bytes=new Uint8Array(await file.arrayBuffer());if(generation!==identity.generation||!current())throw new DOMException('The account or Course changed.','AbortError');
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));input={...fields,data:btoa(raw),sha256:hash};
  }
  const value=await api('/api/admin/'+encodeURIComponent(offeringId)+'/processing',{body:{action,...input}});
  if(generation!==identity.generation||!current())throw new DOMException('The account or Course changed.','AbortError');return value;
 };
 return mountCourseMedia(host,{request,processingRequest,offeringId,cardTools,courseName,initialPlaylistId:new URLSearchParams(location.search).get('playlist'),current:()=>generation===identity.generation&&current()});
}
