import {fail,id,text,integer,bytes,sha256} from './protocol.mjs';
import {fileKind} from '../public/shared/model.mjs';
import {mediaTeachers} from './media-attribution.mjs';

export const COVER_LIMIT=512*1024;
const presets=['sage','plum','rose','gold','ocean','sunset'];
export const defaultCard=()=>({version:1,style:'default',colour:'#759786',gradient:null,image:null,teacher:null});
const digest=value=>{if(typeof value!=='string'||! /^[a-f0-9]{64}$/.test(value))throw fail('Choose a checked artwork hash.');return value;};
export function cardInput(value){
 if(!value||value.version!==1||!['default','colour','gradient','image'].includes(value.style))throw fail('Choose a supported playlist card design.');
 if(typeof value.colour!=='string'||! /^#[a-f0-9]{6}$/i.test(value.colour))throw fail('Choose a six-digit card colour.');
 if(value.gradient!==null&&!presets.includes(value.gradient))throw fail('Choose a saved gradient preset.');
 if(value.style==='gradient'&&!value.gradient)throw fail('Choose a gradient preset.');
 let image=null;if(value.image){const v=value.image;image={assetId:id(v.assetId),sha256:digest(v.sha256),type:text(v.type,40),size:integer(v.size,1),alt:text(v.alt||'',300)};}
 if(value.style==='image'&&!image)throw fail('Choose a playlist picture.');
 // Teacher labels and URLs are derived, never client authority or fetch targets.
 return {version:1,style:value.style,colour:value.colour.toUpperCase(),gradient:value.gradient,image};
}
export function optionalTeacherIds(value){
 if(!Array.isArray(value)||value.length>10)throw fail('Choose up to ten registered Teachers, or leave this blank.');
 const ids=value.map(id);if(new Set(ids.map(v=>v.toLowerCase())).size!==ids.length)throw fail('Choose each Teacher once.');return ids;
}
export function cardDTO(encoded,{published=false,origin}={}){
 const card=encoded?JSON.parse(encoded):defaultCard();
 return {...card,image:card.image?{...card.image,url:published?new URL('/api/public/circles/covers/'+card.image.sha256,origin).href:null}:null};
}
export async function cardOptions(env,store,actor,offer,fetcher){
 const choices=await mediaTeachers(env,store,actor,offer,undefined,fetcher);return {...choices,teacherRequired:false,cardImageRequired: (await store.scope(actor,offer,{admin:true})).kind==='COURSE',presets,imageUploadLimit:COVER_LIMIT};
}
async function checkedImage(store,offer,playlistId,image){
 if(!image)return null;const a=await store.first('SELECT * FROM playlist_cover_assets WHERE asset_id=? AND offering_id=? AND playlist_id=?',[image.assetId,offer,playlistId]);
 if(!a||a.sha256!==image.sha256||a.mime_type!==image.type||a.size!==image.size)throw fail('Upload decorative artwork for this exact playlist.',409,'CARD_IMAGE_SCOPE');
 return {...image};
}
export async function savedCard(env,store,actor,offer,playlistId,canonical,previous,fetcher){
 const current=previous?JSON.parse(previous.draft_json):defaultCard(),card=canonical.card?{...canonical.card}:current;
 let teacherIds=previous?JSON.parse(previous.teacher_ids_json):[];
 if(Object.hasOwn(canonical,'teacherIds')){
  teacherIds=canonical.teacherIds;card.teacher=null;
  if(teacherIds.length){const checked=await mediaTeachers(env,store,actor,offer,teacherIds,fetcher);teacherIds=checked.selectedTeacherIds;card.teacher=teacherIds.map(key=>checked.teachers.find(t=>t.id===key).name).join(', ');}
 }else card.teacher=current.teacher;
 card.image=await checkedImage(store,offer,playlistId,card.image);return {card,teacherIds};
}
async function coverScope(store,actor,offer,playlistId){
 const scope=await store.scope(actor,offer,{admin:true});if(!['COURSE','TAFSEER'].includes(scope.kind)||store.env.AUTHORITY_MODE==='ACADEMY'&&!scope.studioAuthority)throw fail('Use current Studio ownership for this programme.',403);
 const parent=await store.first('SELECT offering_id FROM websites WHERE website_id=?',[playlistId]),playlist=await store.first('SELECT offering_id,website_id FROM mou_playlists WHERE playlist_id=?',[playlistId]);
 if(playlist?playlist.offering_id!==offer:Boolean(parent))throw fail('Choose this programme’s exact playlist.',409);
}
function encodedBytes(value){
 if(typeof value!=='string'||!value.length||value.length>700*1024||value.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw fail('Choose bounded base64 artwork.',413);
 let decoded;try{decoded=atob(value);}catch{throw fail('Invalid artwork encoding.');}if(decoded.length>COVER_LIMIT)throw fail('Resize the decorative artwork before uploading.',413);
 return Uint8Array.from(decoded,c=>c.charCodeAt(0));
}
export function base64(data){let value='';for(let i=0;i<data.length;i+=8192)value+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(value);}
export async function uploadCover(env,store,actor,offer,input,raw){
 const playlistId=id(input.playlistId);await coverScope(store,actor,offer,playlistId);
 const data=raw||encodedBytes(input.data),type=fileKind(data),hash=await sha256(data);
 if(!data.length||data.length>COVER_LIMIT)throw fail('Resize the decorative artwork before uploading.',413);
 if(!['image/png','image/jpeg','image/webp'].includes(type)||type!==input.type)throw fail('Choose a PNG, JPG or WebP picture with matching file contents.');
 if(hash!==digest(input.sha256))throw fail('The picture changed during upload.',409);
 const canonical={action:'mou-playlist-cover-upload',operationId:id(input.operationId),playlistId,revision:integer(input.revision),type,sha256:hash,size:data.length};
 const old=await store.replay(actor.account_id,canonical.operationId,await store.requestHash(offer,canonical));if(old)return old;
 const assetId='card:'+await sha256(JSON.stringify([offer,playlistId,hash])),key='private/playlist-cards/'+encodeURIComponent(offer)+'/'+encodeURIComponent(playlistId)+'/'+hash;
 await env.CONTENT.put(key,data,{httpMetadata:{contentType:type}});
 const image={assetId,sha256:hash,type,size:data.length,alt:'',url:null};
 return store.mutate(actor,offer,canonical,[store.statement('INSERT INTO playlist_cover_assets VALUES(?,?,?,?,?,?,?) ON CONFLICT(asset_id) DO NOTHING',[assetId,offer,playlistId,hash,type,data.length,key])],{image,revision:canonical.revision},{studio:true,expectedSQL:'COALESCE((SELECT revision FROM access_revisions WHERE offering_id=?),0)=? AND (EXISTS(SELECT 1 FROM mou_playlists p WHERE p.playlist_id=? AND p.offering_id=?) OR NOT EXISTS(SELECT 1 FROM websites WHERE website_id=?)) AND NOT EXISTS(SELECT 1 FROM mou_playlists WHERE playlist_id=? AND offering_id<>?) AND NOT EXISTS(SELECT 1 FROM source_access_master_fences WHERE account_id=? AND offering_id=?)',expectedArgs:[offer,canonical.revision,playlistId,offer,playlistId,playlistId,offer,actor.account_id,offer]});
}
export async function previewCover(env,store,actor,offer,input,{json=false}={}){
 const playlistId=id(input.playlistId);await coverScope(store,actor,offer,playlistId);const a=await store.first('SELECT * FROM playlist_cover_assets WHERE asset_id=? AND offering_id=? AND playlist_id=?',[id(input.assetId),offer,playlistId]);
 if(!a)throw fail('This private artwork is unavailable.',404);const object=await env.CONTENT.get(a.content_key);if(!object||object.size!==a.size)throw fail('This private artwork is unavailable.',503);
 if(json){const data=await bytes(object.body,COVER_LIMIT);return {image:{assetId:a.asset_id,sha256:a.sha256,type:a.mime_type,size:a.size,alt:'',url:null},data:base64(data)};}
 return new Response(object.body,{headers:{'Content-Type':a.mime_type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
export async function cardPublication(store,offer,websiteId){
 const row=await store.first('SELECT c.*,p.offering_id,w.title FROM mou_playlists p JOIN playlist_card_designs c USING(playlist_id) JOIN websites w USING(website_id) WHERE p.website_id=? AND p.offering_id=?',[websiteId,offer]);
 if(!row)return {statements:[],approval:null};
 const card=JSON.parse(row.draft_json);await checkedImage(store,offer,row.playlist_id,card.image);
 if(row.image_required&&row.first_published_at===null&&!card.image)throw fail('Choose a Course picture before first publication.',409,'COURSE_CARD_IMAGE_REQUIRED');
 return {statements:[store.statement('UPDATE playlist_card_designs SET published_json=draft_json,published_title=? WHERE playlist_id=?',[row.title,row.playlist_id])],approval:card.image?{playlistId:row.playlist_id,...card.image}:null};
}
export async function finishCardPublication(env,store,offer,approval){
 if(!approval)return;
 const a=await store.first('SELECT * FROM playlist_cover_assets WHERE asset_id=? AND offering_id=? AND playlist_id=? AND sha256=?',[approval.assetId,offer,approval.playlistId,approval.sha256]);
 if(!a)throw fail('Published artwork is waiting for a retry.',503,'CARD_PUBLICATION_PENDING');
 const object=await env.CONTENT.get(a.content_key);if(!object||object.size!==a.size)throw fail('Published artwork is waiting for a retry.',503,'CARD_PUBLICATION_PENDING');
 const data=await bytes(object.body,COVER_LIMIT);if(await sha256(data)!==a.sha256||fileKind(data)!==a.mime_type)throw fail('Published artwork needs review.',503,'CARD_PUBLICATION_PENDING');
 try{await env.CONTENT.put('public/circles/covers/'+a.sha256,data,{httpMetadata:{contentType:a.mime_type}});}catch{throw fail('Published artwork is waiting for a retry.',503,'CARD_PUBLICATION_PENDING');}
}
