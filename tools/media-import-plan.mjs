// Private operator tooling only. This module never changes D1/R2 or publishes.
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {id,date} from '../src/protocol.mjs';
const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const check=(condition,message)=>{if(!condition)throw Error(message);};
const text=(value,max)=>typeof value==='string'&&value.length<=max&&!/[\x00-\x1f]/.test(value);

export function planMediaPage(page,{associations=[]}={}){
 check(Buffer.byteLength(JSON.stringify(page))<=240_000,'MEDIA_PAGE_TOO_LARGE');
 check(page?.format==='ACADEMY_MEDIA_INVENTORY_V1'&&/^[a-f0-9]{64}$/.test(page.inventoryId),'MEDIA_INVENTORY_INVALID');
 const s=page.source;id(s?.activityKey);id(s.offeringId);check(['COURSE','TAFSEER'].includes(s.kind),'MEDIA_SCOPE_INVALID');
 check(digest(s)===page.inventoryId,'MEDIA_INVENTORY_DIGEST_CHANGED');
 check(Array.isArray(page.lessons)&&page.lessons.length<=25,'MEDIA_LESSON_LIMIT');
 check(Array.isArray(associations)&&associations.length<=25,'MEDIA_ASSOCIATION_LIMIT');
 const mappings=new Map(),seen=new Set(),objects=new Map(),attachments=[],held=[];
 for(const mapping of associations){id(mapping.sourceLessonId);id(mapping.websiteId);check(!mappings.has(mapping.sourceLessonId),'MEDIA_MAPPING_DUPLICATE');mappings.set(mapping.sourceLessonId,mapping.websiteId);}
 for(const lesson of page.lessons){
  const lessonId=id(lesson.sourceLessonId);check(!seen.has(lessonId),'MEDIA_LESSON_DUPLICATE');seen.add(lessonId);
  check(['SESSION','COURSE'].includes(lesson.scope)&&['PUBLISHED','DRAFT','HIDDEN','MISSING'].includes(lesson.state),'MEDIA_LESSON_INVALID');
  check(text(lesson.title,500)&&Array.isArray(lesson.assets)&&lesson.assets.length<=20,'MEDIA_LESSON_INVALID');
  check((lesson.sessionKey===null||text(lesson.sessionKey,1200))&&text(lesson.runId,180)&&
   (lesson.publicationId===null||text(lesson.publicationId,180))&&Number.isSafeInteger(lesson.revision)&&lesson.revision>0,'MEDIA_PROVENANCE_INVALID');
  check(Array.isArray(lesson.cohorts)&&lesson.cohorts.length<=100,'MEDIA_COHORT_LIMIT');lesson.cohorts.forEach(id);
  if(lesson.scope==='SESSION')date(lesson.date);else check(s.kind==='COURSE'&&lesson.date==='','MEDIA_COURSE_COLLECTION_INVALID');
  const websiteId=mappings.get(lessonId)||null,cohorts=s.kind==='COURSE'?['']:[...new Set(lesson.cohorts)],assetIds=new Set();
  for(const asset of lesson.assets){
   id(asset.sourceAssetId);check(!assetIds.has(asset.sourceAssetId),'MEDIA_ASSET_DUPLICATE');assetIds.add(asset.sourceAssetId);
   check(['PDF','MP4','YOUTUBE'].includes(asset.kind)&&text(asset.filename,180)&&text(asset.name,500),'MEDIA_ASSET_INVALID');
   check(typeof asset.linked==='boolean'&&typeof asset.sourceExpired==='boolean','MEDIA_ASSET_INVALID');
   const reasons=[];
   if(lesson.state!=='PUBLISHED')reasons.push('SOURCE_'+lesson.state);
   if(!asset.linked)reasons.push('SOURCE_ATTACHMENT_REMOVED');
   if(asset.sourceExpired)reasons.push('SOURCE_RECORDING_EXPIRED');
   if(!cohorts.length)reasons.push('HISTORICAL_CLASS_REQUIRED');
   if(!websiteId)reasons.push('EXPLICIT_WEBSITE_ASSOCIATION_REQUIRED');
   if(asset.kind==='YOUTUBE')check(/^[A-Za-z0-9_-]{11}$/.test(asset.youtubeId||'')&&!asset.resolvedObjectKey&&!asset.sourceObjectKey,'MEDIA_YOUTUBE_INVALID');
   else{
    check(text(asset.sourceObjectKey,1200)&&asset.sourceObjectKey&&text(asset.resolvedObjectKey,1200)&&asset.resolvedObjectKey,'MEDIA_OBJECT_INVALID');
    check(Number.isSafeInteger(asset.byteSize)&&asset.byteSize>=(asset.kind==='PDF'?5:12)&&asset.byteSize<=(asset.kind==='PDF'?16:512)*1024*1024,'MEDIA_SIZE_INVALID');
    check(asset.expectedSha256===null||/^[a-f0-9]{64}$/.test(asset.expectedSha256),'MEDIA_CHECKSUM_INVALID');
   }
   if(reasons.length){held.push({sourceLessonId:lessonId,sourceAssetId:asset.sourceAssetId,reasons});continue;}
   const assetId='academy-asset-'+digest([s.activityKey,asset.sourceAssetId]),object={assetId,sourceAssetId:asset.sourceAssetId,kind:asset.kind,
    filename:asset.filename,name:asset.name,byteSize:asset.byteSize,sourceObjectKey:asset.sourceObjectKey,resolvedObjectKey:asset.resolvedObjectKey,
    expectedSha256:asset.expectedSha256,youtubeId:asset.youtubeId,verification:asset.kind==='YOUTUBE'?'REFERENCE_ONLY':'BYTES_REQUIRED'};
   if(objects.has(assetId))check(JSON.stringify(objects.get(assetId))===JSON.stringify(object),'MEDIA_ASSET_IDENTITY_CONFLICT');else objects.set(assetId,object);
   for(const cohort of cohorts)attachments.push({attachment_id:'academy-media-'+digest([s.activityKey,lessonId,asset.sourceAssetId,cohort]),offering_id:s.offeringId,website_id:websiteId,
    asset_id:assetId,lesson_id:lessonId,lesson_date:lesson.date,cohort,title:asset.name||lesson.title,audience:'RECORDING',published:0,
    source:{sessionKey:lesson.sessionKey,runId:lesson.runId,publicationId:lesson.publicationId,revision:lesson.revision}});
  }
 }
 for(const lessonId of mappings.keys())check(seen.has(lessonId),'MEDIA_MAPPING_OUTSIDE_PAGE');
 check(attachments.length<=1000,'MEDIA_ATTACHMENT_LIMIT');
 const plan={format:'WEBSITE_MEDIA_PLAN_V1',inventoryId:page.inventoryId,source:s,objects:[...objects.values()],attachments,held,
  readyToPublish:false,remaining:['VERIFY_SOURCE_STILL_CURRENT','VERIFY_PRIVATE_BYTES','CHECK_TARGET_OFFERING_AND_WEBSITE','REHEARSE_ATOMIC_ADMISSION_AND_WITHDRAWAL']};
 return {...plan,planSha256:digest(plan)};
}

export async function verifyLocalMedia(object,file){
 check(object&&['PDF','MP4'].includes(object.kind)&&Number.isSafeInteger(object.byteSize),'MEDIA_VERIFICATION_INVALID');
 const max=(object.kind==='PDF'?16:512)*1024*1024;check(object.byteSize>0&&object.byteSize<=max,'MEDIA_SIZE_INVALID');
 const hash=createHash('sha256'),prefix=Buffer.alloc(12);let size=0,prefixSize=0;
 // Fixed-size chunks bound memory even for a complete recording. Never treat an
 // R2 etag as a SHA-256 checksum, including multipart uploads.
 for await(const chunk of createReadStream(file,{highWaterMark:256*1024})){
  size+=chunk.length;check(size<=object.byteSize&&size<=max,'MEDIA_BYTES_TOO_LARGE');
  if(prefixSize<12){const count=Math.min(12-prefixSize,chunk.length);chunk.copy(prefix,prefixSize,0,count);prefixSize+=count;}hash.update(chunk);
 }
 check(size===object.byteSize,'MEDIA_BYTES_SIZE_CHANGED');
 check(object.kind==='PDF'?prefix.subarray(0,5).toString()==='%PDF-':prefix.subarray(4,8).toString()==='ftyp','MEDIA_BYTES_TYPE_CHANGED');
 const sha256=hash.digest('hex');check(!object.expectedSha256||object.expectedSha256===sha256,'MEDIA_BYTES_CHECKSUM_CHANGED');
 return {format:'WEBSITE_MEDIA_BYTES_V1',assetId:object.assetId,sourceAssetId:object.sourceAssetId,objectSha256:digest(object),size,sha256,
  objectKey:'imports/academy/sha256/'+sha256+(object.kind==='PDF'?'.pdf':'.mp4'),mimeType:object.kind==='PDF'?'application/pdf':'video/mp4'};
}
