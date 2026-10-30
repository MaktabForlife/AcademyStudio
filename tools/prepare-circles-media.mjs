// Private, offline migration preparation. No Worker, database or network adapter.
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {contentHash} from './reconciled-content.mjs';
import {planMediaPage} from './media-import-plan.mjs';
import {stageMediaTransfer} from './stage-media-transfer.mjs';

const check=(value,message)=>{if(!value)throw Error(message);};
const identity=r=>JSON.stringify([r.offeringId,r.sourceLessonId,r.sourceAssetId]);
const fileIdentity=r=>JSON.stringify([r.offeringId,r.sourceAssetId]);
const readJSON=async(file,max=2_000_000)=>{const bytes=await readFile(file);check(bytes.length<=max,'MEDIA_INPUT_TOO_LARGE');return JSON.parse(bytes);};

export function buildCirclesMediaPlan(bundle,copy,pages,{bundleSha256}={}){
 check(bundle?.format==='CIRCLES_RECONCILED_CONTENT_V1'&&bundle.private&&!bundle.sourceDeleted&&!bundle.permissionsImported&&!bundle.hostedWrites,'PRIVATE_COPIED_BUNDLE_REQUIRED');
 check(copy?.format==='ACADEMY_PRIVATE_COPY_REVIEW_V1'&&copy.sourceUnchanged&&!copy.sourceDeleted&&!copy.targetPublished&&!copy.targetAccessChanged,'PRIVATE_ACCEPTED_COPY_REQUIRED');
 check(Array.isArray(copy.snapshots)&&copy.snapshots.length<=20&&pages.length===copy.pages&&pages.length<=100,'MEDIA_PAGES_INCOMPLETE');
 const references=new Map(),pageLessons=new Set(),sources=new Map();
 for(const snapshot of copy.snapshots){
  const source=snapshot.source,group=pages.filter(p=>p.source?.activityKey===source.activityKey);
  check(group.length&&group.reduce((n,p)=>n+p.lessons.length,0)===snapshot.totalLessons,'MEDIA_PAGES_INCOMPLETE');
  let previous='';
  for(const [index,page]of group.entries()){
   check(isDeepStrictEqual(page.source,source)&&page.inventoryId===contentHash(source),'MEDIA_SOURCE_SNAPSHOT_CHANGED');
   check(page.more===(index<group.length-1)&&page.checkpoint?.inventoryId===page.inventoryId&&page.checkpoint.afterLessonId===(page.lessons.at(-1)?.sourceLessonId||null),'MEDIA_PAGE_CHECKPOINT_INVALID');
   // Also validate pages without a selected website association.
   planMediaPage(page);
   for(const lesson of page.lessons){
    const key=JSON.stringify([source.activityKey,lesson.sourceLessonId]);
    check(!pageLessons.has(key)&&lesson.sourceLessonId>previous,'MEDIA_PAGE_ORDER_INVALID');pageLessons.add(key);previous=lesson.sourceLessonId;
    for(const asset of lesson.assets){
     const ref={offeringId:source.offeringId,sourceLessonId:lesson.sourceLessonId,state:lesson.state,date:lesson.date,cohorts:lesson.cohorts,...asset},key=identity(ref);
     check(!references.has(key),'MEDIA_REFERENCE_DUPLICATE');references.set(key,ref);
    }
   }
  }
  check(!sources.has(source.activityKey),'MEDIA_SCOPE_DUPLICATE');sources.set(source.activityKey,source);
 }
 check(pages.every(p=>sources.has(p.source?.activityKey))&&references.size===copy.references.length,'MEDIA_COPY_REFERENCE_CHANGED');
 check(new Set(copy.references.map(identity)).size===copy.references.length,'MEDIA_COPY_REFERENCE_CHANGED');
 for(const ref of copy.references)check(isDeepStrictEqual(references.get(identity(ref)),ref),'MEDIA_COPY_REFERENCE_CHANGED');

 const selected=new Map(),files=new Map(),guides=[],unresolved=[];
 const associate=(site,native)=>{
  check(native.offeringId===site.offeringId&&isDeepStrictEqual(references.get(identity(native)),native),'MEDIA_NATIVE_REFERENCE_CHANGED');
  const key=identity(native),old=selected.get(key);
  check(!old||old.websiteId===site.websiteId,'MEDIA_WEBSITE_ASSOCIATION_CONFLICT');
  selected.set(key,{sourceLessonId:native.sourceLessonId,sourceAssetId:native.sourceAssetId,websiteId:site.websiteId,offeringId:site.offeringId});
 };
 for(const site of bundle.sites){
  for(const recording of site.recordings){
   if(recording.status!=='MATCHED'){unresolved.push({websiteId:site.websiteId,editorialLessonId:recording.editorialLessonId,status:recording.status});continue;}
   check(recording.native?.kind==='YOUTUBE'&&recording.videoId===recording.native.youtubeId,'MEDIA_RECORDING_IDENTITY_CHANGED');
   associate(site,recording.native);
   guides.push({websiteId:site.websiteId,editorialLessonId:recording.editorialLessonId,sourceLessonId:recording.native.sourceLessonId,sourceAssetId:recording.native.sourceAssetId});
  }
  for(const material of site.materials){
   if(material.status!=='MATCHED'){unresolved.push({websiteId:site.websiteId,status:material.status});continue;}
   check(material.native?.length===1&&material.localObject?.sha256===material.sha256,'MEDIA_PDF_MAPPING_REQUIRED');
   const native=material.native[0];associate(site,native);
   const original=copy.objects.find(o=>o.sourceAssetId===native.sourceAssetId&&o.sourceObjectKey===native.resolvedObjectKey);
   check(native.kind==='PDF'&&original?.sha256===material.sha256&&original.bytes===native.byteSize&&material.localObject.bytes===original.bytes,'MEDIA_PDF_COPY_CHANGED');
   check(bundle.objects.some(o=>isDeepStrictEqual(o,{...material.localObject,mimeType:'application/pdf'})),'MEDIA_PDF_COPY_CHANGED');
   const old=files.get(fileIdentity(native));check(!old||isDeepStrictEqual(old,material.localObject),'MEDIA_PDF_COPY_CHANGED');files.set(fileIdentity(native),material.localObject);
  }
 }
 const plans=pages.map(page=>planMediaPage(page,{associations:[...selected.values()].filter(a=>a.offeringId===page.source.offeringId&&page.lessons.some(l=>l.sourceLessonId===a.sourceLessonId))}));
 const objects=new Map(),attachments=[],held=[];
 for(const plan of plans){
  for(const object of plan.objects){
   const existing=objects.get(object.assetId),file=files.get(fileIdentity({offeringId:plan.source.offeringId,sourceAssetId:object.sourceAssetId}));
   const entry={object,localFile:file||null};check(!existing||isDeepStrictEqual(existing,entry),'MEDIA_OBJECT_IDENTITY_CONFLICT');objects.set(object.assetId,entry);
  }
  attachments.push(...plan.attachments);held.push(...plan.held.map(h=>({...h,offeringId:plan.source.offeringId})));
 }
 check(new Set(attachments.map(a=>a.attachment_id)).size===attachments.length,'MEDIA_ATTACHMENT_DUPLICATE');
 for(const guide of guides){
  const source=copy.snapshots.find(s=>s.source.offeringId===bundle.sites.find(s=>s.websiteId===guide.websiteId).offeringId).source;
  guide.plannedAssetId='academy-asset-'+contentHash([source.activityKey,guide.sourceAssetId]);
  check(attachments.some(a=>a.asset_id===guide.plannedAssetId&&a.website_id===guide.websiteId&&a.lesson_id===guide.sourceLessonId),'MEDIA_GUIDE_NOT_ELIGIBLE');
  guide.targetMediaAdmission='PENDING';
 }
 const plan={format:'CIRCLES_MEDIA_TRANSFER_PLAN_V1',localOnly:true,bundleSha256,sources:[...sources.values()],pagePlanHashes:plans.map(p=>p.planSha256),
  objects:[...objects.values()],attachments,held,guideCandidates:guides,unresolved,
  editions:bundle.sites.map(s=>({websiteId:s.websiteId,published:s.editions.published.sha256,existingDraft:s.editions.existingDraft.sha256,reviewDraft:s.editions.reviewDraft.sha256})),
  pendingCourses:bundle.pending.map(s=>({key:s.key,status:s.status})),readyToAdmit:false,readyToPublish:false,
  remaining:['REVALIDATE_CURRENT_SOURCE','VERIFY_TARGET_OWNERSHIP_AND_EDITION','REHEARSE_ATOMIC_ADMISSION_WITHDRAWAL_AND_ROLLBACK','APPROVED_HOSTED_TRANSFER_AND_ACCESS_ACCEPTANCE']};
 return {...plan,planSha256:contentHash(plan)};
}

export async function prepareCirclesMedia(copyDirectory,destination){
 const root=resolve(copyDirectory),bundleRoot=join(root,'circles-bundle'),bytes=await readFile(join(bundleRoot,'manifest.json')),bundle=JSON.parse(bytes);
 check(resolve(destination)!==root&&!resolve(destination).startsWith(root+'/'),'MEDIA_STAGE_MUST_BE_SEPARATE');
 const copyPath=resolve(bundleRoot,bundle.sourceCopy.file);check(copyPath.startsWith(bundleRoot+'/'),'MEDIA_COPY_PATH_INVALID');
 const copyBytes=await readFile(copyPath);check(contentHash(copyBytes)===bundle.sourceCopy.sha256,'MEDIA_COPY_CHECKSUM_CHANGED');
 const names=(await readdir(join(root,'academy'))).filter(n=>/^scope-\d+-page-\d+\.json$/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const pages=await Promise.all(names.map(n=>readJSON(join(root,'academy',n),240_000)));
 const plan=buildCirclesMediaPlan(bundle,JSON.parse(copyBytes),pages,{bundleSha256:contentHash(bytes)});
 await mkdir(resolve(destination),{recursive:false,mode:0o700});
 await writeFile(join(destination,'private-media-plan.json'),JSON.stringify(plan,null,2),{mode:0o600,flag:'wx'});
 const staged=await stageMediaTransfer(plan,{sourceRoot:bundleRoot,destination:join(destination,'staged')});
 return {plannedObjects:plan.objects.length,pdfObjects:plan.objects.filter(o=>o.object.kind==='PDF').length,recordingReferences:plan.guideCandidates.length,
  historicalAttachments:plan.attachments.length,heldSourceReferences:plan.held.length,unresolvedCompanions:plan.unresolved.length,...staged.summary,hostedWrites:0,rightsImported:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){check(process.argv.length===4,'Provide the private Academy copy directory and a new output directory.');console.log(JSON.stringify(await prepareCirclesMedia(process.argv[2],process.argv[3])));}
