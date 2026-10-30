// Existing accepted Academy data only; no new course, content or access creation.
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {buildCirclesMediaPlan} from './prepare-circles-media.mjs';
import {planMediaPage} from './media-import-plan.mjs';
import {stageMediaTransfer} from './stage-media-transfer.mjs';
import {contentHash} from './reconciled-content.mjs';
const check=(value,message)=>{if(!value)throw Error(message);};
const key=(offering,lesson,asset)=>JSON.stringify([offering,lesson,asset]);

export function buildExistingDataMediaPlan(bundle,copy,pages,options){
 const reviewed=buildCirclesMediaPlan(bundle,copy,pages,options),mapped=new Map();
 for(const a of reviewed.attachments){
  const sourceAsset=reviewed.objects.find(o=>o.object.assetId===a.asset_id).object.sourceAssetId;
  mapped.set(key(a.offering_id,a.lesson_id,sourceAsset),a.website_id);
 }
 const pagePlans=pages.map(page=>planMediaPage(page,{associations:page.lessons.flatMap(lesson=>lesson.assets.map(asset=>{
  const websiteId=mapped.get(key(page.source.offeringId,lesson.sourceLessonId,asset.sourceAssetId));
  return {sourceLessonId:lesson.sourceLessonId,sourceAssetId:asset.sourceAssetId,...(websiteId?{websiteId}:{offeringOnly:true})};
 }))}));
 const objects=new Map(),attachments=[],held=[];
 for(const page of pagePlans){
  for(const object of page.objects){
   let localFile=reviewed.objects.find(o=>o.object.assetId===object.assetId)?.localFile||null;
   if(object.kind==='PDF'&&!localFile){const original=copy.objects.find(o=>o.sourceAssetId===object.sourceAssetId&&o.sourceObjectKey===object.resolvedObjectKey);const stored=bundle.objects.find(o=>o.sha256===original?.sha256&&o.bytes===original.bytes&&o.mimeType==='application/pdf');check(stored,'EXISTING_PDF_COPY_REQUIRED');localFile={file:stored.file,sha256:stored.sha256,bytes:stored.bytes};}
   const value={object,localFile},old=objects.get(object.assetId);check(!old||isDeepStrictEqual(old,value),'MEDIA_OBJECT_IDENTITY_CONFLICT');objects.set(object.assetId,value);
  }
  attachments.push(...page.attachments);held.push(...page.held.map(h=>({...h,offeringId:page.source.offeringId})));
 }
 check(new Set(attachments.map(a=>a.attachment_id)).size===attachments.length,'MEDIA_ATTACHMENT_DUPLICATE');
 const offeringOnly=new Map();for(const a of attachments.filter(a=>!a.website_id)){const identity=key(a.offering_id,a.lesson_id,a.asset_id),entry=offeringOnly.get(identity)||{offeringId:a.offering_id,sourceLessonId:a.lesson_id,assetId:a.asset_id,cohorts:[],websiteAssociation:'PENDING',originalRecordingRights:true};entry.cohorts.push(a.cohort);offeringOnly.set(identity,entry);}
 const plan={format:'CIRCLES_MEDIA_TRANSFER_PLAN_V1',localOnly:true,migrationPhase:'EXISTING_DATA_ONLY',bundleSha256:options.bundleSha256,sources:reviewed.sources,
  objects:[...objects.values()],attachments,held,editions:reviewed.editions.map(({websiteId,published,existingDraft})=>({websiteId,published,existingDraft})),
  guideCandidates:reviewed.guideCandidates,unresolved:reviewed.unresolved,
  offeringOnlyAssociations:[...offeringOnly.values()],
  excludedNextPhase:{standaloneDrafts:bundle.pending.map(p=>p.key),reviewDraftPromotion:true,newCourseCreation:true,newTeachingData:true},
  readyToAdmit:false,readyToPublish:false,remaining:['CURRENT_SOURCE_AND_TARGET_PREFLIGHT','APPROVED_EXISTING_DATA_IMPORT','REAL_ACCESS_ACCEPTANCE']};
 return {...plan,planSha256:contentHash(plan)};
}

export async function prepareExistingData(copyDirectory,destination){
 const root=resolve(copyDirectory),bundleRoot=join(root,'circles-bundle'),out=resolve(destination);check(out!==root&&!out.startsWith(root+'/'),'MEDIA_STAGE_MUST_BE_SEPARATE');
 const bundleBytes=await readFile(join(bundleRoot,'manifest.json')),bundle=JSON.parse(bundleBytes),sourcePath=resolve(bundleRoot,bundle.sourceCopy.file);
 check(sourcePath.startsWith(bundleRoot+'/'),'MEDIA_COPY_PATH_INVALID');const copyBytes=await readFile(sourcePath);check(contentHash(copyBytes)===bundle.sourceCopy.sha256,'MEDIA_COPY_CHECKSUM_CHANGED');
 const names=(await readdir(join(root,'academy'))).filter(n=>/^scope-\d+-page-\d+\.json$/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const pages=await Promise.all(names.map(async name=>{const b=await readFile(join(root,'academy',name));check(b.length<=240_000,'MEDIA_INPUT_TOO_LARGE');return JSON.parse(b);}));
 const plan=buildExistingDataMediaPlan(bundle,JSON.parse(copyBytes),pages,{bundleSha256:contentHash(bundleBytes)});
 await mkdir(out,{recursive:false,mode:0o700});await writeFile(join(out,'private-media-plan.json'),JSON.stringify(plan,null,2),{flag:'wx',mode:0o600});
 const receipt=await stageMediaTransfer(plan,{sourceRoot:bundleRoot,destination:join(out,'staged')});
 const summary={existingSites:plan.editions.length,pdfObjects:receipt.receipts.length,recordingReferences:receipt.referenceOnly.length,attachments:plan.attachments.length,
  originalProgrammeAssociations:plan.offeringOnlyAssociations.length,unresolvedGuideAssociations:plan.unresolved.length,excludedStandaloneDrafts:plan.excludedNextPhase.standaloneDrafts.length,
  verifiedBytes:receipt.summary.verifiedBytes,newCoursesCreated:0,reviewDraftsPromoted:0,hostedWrites:0};
 await writeFile(join(out,'summary.json'),JSON.stringify(summary,null,2),{flag:'wx',mode:0o600});return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){check(process.argv.length===4,'Provide the existing private copy directory and a new output directory.');console.log(JSON.stringify(await prepareExistingData(process.argv[2],process.argv[3])));}
