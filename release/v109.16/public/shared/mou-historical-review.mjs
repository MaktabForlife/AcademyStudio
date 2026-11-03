import {learnerCompanion} from './learner-companion.mjs';
import {youtubeSource,pendingMedia,saveMediaDraft} from './media-workflow.mjs';
const check=(ok,message)=>{if(!ok)throw Error(message);};
const stable=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(value);
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),n=>n.toString(16).padStart(2,'0')).join('');
export function historicalMouPackage(value){
 check(value?.schema==='MOU_HISTORICAL_REVIEW_V1'&&stable(value.reviewId)&&Array.isArray(value.lessons)&&value.lessons.length>0&&value.lessons.length<=50,'Choose a processed historical review with one to fifty lessons and a stable reviewId.');
 check(new TextEncoder().encode(JSON.stringify(value)).length<=1500000,'Choose a processed review no larger than 1.5 MB.');
 const keys=new Set(),sources=new Set();
 return {schema:value.schema,reviewId:value.reviewId,lessons:value.lessons.map(row=>{
  check(stable(row.key)&&!keys.has(row.key),'Use each stable lesson key once.');keys.add(row.key);
  const videoId=youtubeSource(row.sourceURL);check(!sources.has(videoId),'Review each recording source once per batch.');sources.add(videoId);
  check(typeof row.title==='string'&&row.title.trim()&&row.title.length<=240,'Each recording needs its actual title.');
  const date=new Date(row.recordedDate+'T00:00:00Z');check(/^\d{4}-\d{2}-\d{2}$/.test(row.recordedDate||'')&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===row.recordedDate,'Keep the exact original recording date.');
  const companion=learnerCompanion(row.companion);check(companion.summary.trim()&&companion.topics.length&&Number.isSafeInteger(row.durationSeconds)&&row.durationSeconds>0&&row.durationSeconds<=86400&&companion.topics.every(t=>t.start<row.durationSeconds),'Each lesson needs its reviewed full summary, topic guide and actual duration.');
  return {key:row.key,title:row.title.trim(),recordedDate:row.recordedDate,durationSeconds:row.durationSeconds,videoId,sourceURL:'https://www.youtube.com/watch?v='+videoId,companion};
 })};
}
export async function prepareHistoricalMou({value,offeringId,playlistId,cohort,teacherIds,choices,api,current=()=>{}}){
 current();const plan=historicalMouPackage(value);check(choices.programmeKey==='mothers'&&choices.playlists?.some(p=>p.id===playlistId&&p.enabled===0),'Choose a private independent MOU playlist explicitly.');check(choices.classes?.some(c=>c.id===cohort),'Choose the named original recording class explicitly.');
 check(Array.isArray(teacherIds)&&teacherIds.length>0&&teacherIds.length<=10&&new Set(teacherIds).size===teacherIds.length&&teacherIds.every(id=>choices.teachers.some(t=>t.id===id)),'Choose current registered Teachers for the new recordings.');
 const facts={assets:[]};let scopeSignature;for(let offset=0;offset<plan.lessons.length;offset+=8){const query=new URLSearchParams();for(const row of plan.lessons.slice(offset,offset+8))query.append('source',row.videoId);const part=await api('/api/admin/'+encodeURIComponent(offeringId)+'/recording-attachments?'+query);current();check(part.offeringId===offeringId&&part.scope?.programme_key==='mothers'&&part.scope.authority==='WEBSITE'&&JSON.parse(part.scope.classes_json).includes(cohort),'MOU ownership or the original class changed. Reopen this review.');const signature=JSON.stringify(part.scope);check(!scopeSignature||signature===scopeSignature,'The programme changed during batch preparation. Reopen the review.');scopeSignature=signature;facts.assets.push(...part.assets);}
 const items=[];for(const row of plan.lessons){
  const native=facts.assets.filter(a=>a.youtube_id===row.videoId);check(native.length<=1,'A source has multiple existing native associations. Review it separately.');
  const key=(await hash([offeringId,plan.reviewId,row.key])).slice(0,40),existing=native[0],attachmentId='mou-history-recording-'+key;
  const pending=pendingMedia({sourceKind:'YOUTUBE',sourceURL:row.sourceURL,title:row.title,playlistId,teacherIds:[...teacherIds],cohort,lessonDate:row.recordedDate,durationSeconds:row.durationSeconds,companion:row.companion,supportingFiles:[]});
  Object.assign(pending,{assetId:existing?.asset_id||'mou-history-asset-'+key,attachmentId,sourceOperation:'mou-history-source-'+key,attachOperation:'mou-history-attach-'+key,companionOperation:'mou-history-companion-'+key,reuseSource:Boolean(existing)});
  // Existing historical associations retain their own identity, Teacher,
  // companion, publication and original rights; only playlist membership is new.
  const reference=existing?.attachment_id&&existing.attachment_id!==attachmentId?existing.attachment_id:null;
  if(reference)check(existing.lesson_date===row.recordedDate&&existing.cohort===cohort,'An existing recording has different original metadata. Review its saved association separately; this batch will not rewrite it.');
  items.push({...row,pending,reference,referenceOperation:'mou-history-member-'+(await hash([offeringId,plan.reviewId,row.key,playlistId])).slice(0,40),state:'READY'});
 }
 return {schema:'MOU_HISTORICAL_PRIVATE_PLAN_V1',reviewId:plan.reviewId,offeringId,playlistId,cohort,teacherIds:[...teacherIds],items};
}
export async function attachHistoricalMouItem({plan,index,api,current=()=>{},report=()=>{}}){
 current();const item=plan.items[index];check(item,'Choose a reviewed historical lesson.');const path='/api/admin/'+encodeURIComponent(plan.offeringId);
 if(item.reference){
  if(!item.referenceRequest){const table=await api(path+'/playlists?attachment='+encodeURIComponent(item.reference));current();if(table.memberOf?.includes(plan.playlistId)){item.state='ATTACHED';return {attached:true,reused:true};}const row=table.playlists.find(p=>p.id===plan.playlistId);check(row&&row.enabled===0,'Keep this historical review in a private playlist. Review publication separately.');item.referenceRequest={action:'mou-playlist-add',operationId:item.referenceOperation,playlistId:plan.playlistId,attachmentId:item.reference,requirePrivate:true,revision:table.revision,playlistRevision:row.revision};}
  await api(path,{body:item.referenceRequest});current();item.state='ATTACHED';return {attached:true,referenced:true};
 }
 await saveMediaDraft({pending:item.pending,api,path,current,report});current();item.state='ATTACHED';return {attached:true,published:false,attachmentId:item.pending.attachmentId};
}
