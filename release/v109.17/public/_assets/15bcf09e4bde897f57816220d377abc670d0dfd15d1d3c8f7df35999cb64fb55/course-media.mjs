import {mountCourseMedia,courseMediaReadActions} from './shared/course-media-workflow.mjs';
import * as cardTools from './shared/playlist-card.mjs';
import {api,mutate,identity} from './api.mjs';

export function mountNativeCourseMedia(host,{offeringId,courseName,current=()=>true}){
 for(const href of ['/_assets/15bcf09e4bde897f57816220d377abc670d0dfd15d1d3c8f7df35999cb64fb55/shared/course-media-workflow.css','/_assets/15bcf09e4bde897f57816220d377abc670d0dfd15d1d3c8f7df35999cb64fb55/shared/playlist-card.css'])if(!document.querySelector('link[href="'+href+'"]')){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);}
 const generation=identity.generation;
 const request=async(action,input={})=>{
  if(action==='mou-playlist-card-options')return api('/api/admin/'+encodeURIComponent(offeringId)+'/playlist-card-options');
  if(action==='mou-playlist-cover-upload'){const {file,image,playlistId,revision}=input;return api('/api/admin/'+encodeURIComponent(offeringId)+'/playlist-cover?'+new URLSearchParams({playlistId,revision,operationId:crypto.randomUUID(),sha256:image.sha256}),{method:'PUT',body:file,headers:{'Content-Type':file.type}});}
  if(action==='mou-playlist-cover-preview')return api('/api/admin/'+encodeURIComponent(offeringId)+'/playlist-cover?'+new URLSearchParams({playlistId:input.playlistId,assetId:input.image.assetId}),{blob:true});
  if(courseMediaReadActions.has(action))return api('/api/admin/'+encodeURIComponent(offeringId)+'/course-playlists?'+new URLSearchParams({action,...input}));
  return mutate('/api/admin/'+encodeURIComponent(offeringId),{action,...input});
 };
 return mountCourseMedia(host,{request,cardTools,courseName,initialPlaylistId:new URLSearchParams(location.search).get('playlist'),current:()=>generation===identity.generation&&current()});
}
