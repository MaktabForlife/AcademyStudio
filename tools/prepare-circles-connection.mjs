// Offline preparation only: no network, credentials, identity import or hosted writes.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {contentHash} from './reconciled-content.mjs';
import {THEMES} from '../public/shared/model.mjs';

export async function prepareCirclesConnection(directory,destination){
 const root=resolve(directory),output=resolve(destination),manifestBytes=await readFile(join(root,'manifest.json')),bundle=JSON.parse(manifestBytes);
 if(bundle.format!=='CIRCLES_RECONCILED_CONTENT_V1'||!bundle.private||bundle.sourceDeleted||bundle.hostedWrites)throw Error('PRIVATE_COPIED_BUNDLE_REQUIRED');
 const read=async ref=>{const file=resolve(root,ref.file);if(!file.startsWith(root+'/'))throw Error('BUNDLE_PATH_INVALID');const bytes=await readFile(file);if(contentHash(bytes)!==ref.sha256)throw Error('BUNDLE_CHECKSUM_CHANGED');return bytes;};
 const source=JSON.parse(await read(bundle.sourceCopy)),items=[],covers=[];
 await mkdir(output,{recursive:false,mode:0o700});await mkdir(join(output,'public/circles/covers'),{recursive:true,mode:0o700});
 const presentation=async(site,pending=false)=>{
  const document=JSON.parse(await read(pending?site.document:site.editions.reviewDraft)),palette=THEMES[document.theme]||THEMES.rose;
  const item={key:site.key,title:site.title,kind:pending?'COURSE':site.kind,websiteId:pending?null:site.websiteId,pending,accent:palette.accent,soft:palette.soft};
  if(item.kind==='COURSE'){
   const declared=(pending?site.assets:site.artwork).find(a=>a.assetId===document.home.imageId),object=pending?declared:bundle.objects.find(o=>o.sha256===declared?.sha256);
   if(document.home.imageId&&(!declared||!object||!['image/png','image/jpeg','image/webp'].includes(object.mimeType)))throw Error('ORIGINAL_COURSE_COVER_REQUIRED');
   const bytes=object?await read(object):await readFile(new URL('../public/shared/assets/lilac-600.webp',import.meta.url)),sha256=contentHash(bytes);
   item.coverSha256=sha256;const key='public/circles/covers/'+sha256;
   if(!covers.some(c=>c.key===key)){await writeFile(join(output,key),bytes,{flag:'wx',mode:0o600});covers.push({key,sha256,bytes:bytes.length,contentType:object?.mimeType||'image/webp'});}
  }
  return item;
 };
 for(const entry of bundle.catalogue){
  const site=bundle.sites.find(s=>s.key===entry.key);
  if(!site){items.push({key:entry.key,title:entry.name,kind:'TAFSEER',pending:true});continue;}
  const item=await presentation(site);
  if(site.key==='foundations'){
   const native=source.snapshots.find(s=>s.source.offeringId===site.offeringId)?.source;
   if(!native?.activityKey?.startsWith('PROGRAM:')||!entry.nativeSurahId)throw Error('FOUNDATIONS_PUBLIC_SOURCE_MAPPING_REQUIRED');
   item.publicTextPath='/academy/course-websites/public/?'+new URLSearchParams({program:native.activityKey.slice(8),surah:entry.nativeSurahId});
  }
  items.push(item);
 }
 for(const site of bundle.pending.filter(s=>s.key!=='mothers-of-the-ummah'))items.push(await presentation(site,true));
 for(const site of bundle.sites.filter(s=>s.kind==='COURSE'))items.push(await presentation(site));
 const publicSnapshot={format:'CIRCLES_PUBLIC_CATALOGUE_V1',items};
 await writeFile(join(output,'public/circles/catalogue.json'),JSON.stringify(publicSnapshot,null,2),{flag:'wx',mode:0o600});
 await writeFile(join(output,'cover-objects.json'),JSON.stringify(covers,null,2),{flag:'wx',mode:0o600});
 const plan={format:'CIRCLES_CONNECTION_PREPARATION_V1',localOnly:true,bundleSha256:contentHash(manifestBytes),publicCards:items.length,courseCardsWithOriginalArt:items.filter(i=>i.kind==='COURSE'&&i.coverSha256).length,uniqueCoverObjects:covers.length,
  sites:bundle.sites.map(s=>({key:s.key,websiteId:s.websiteId,offeringId:s.offeringId,publishedEdition:s.editions.published.sha256,reviewDraft:s.editions.reviewDraft.sha256,
   matchedSourceRecordings:s.recordings.filter(r=>r.status==='MATCHED').map(r=>({editorialLessonId:r.editorialLessonId,sourceLessonId:r.native.sourceLessonId,sourceAssetId:r.native.sourceAssetId,targetMediaAdmission:'PENDING'})),
   unresolvedRecordings:s.recordings.filter(r=>r.status!=='MATCHED').map(r=>({editorialLessonId:r.editorialLessonId,status:r.status}))})),
  pendingCourses:bundle.pending.filter(s=>s.key!=='mothers-of-the-ummah').map(s=>({key:s.key,status:s.status})),mothersRetainedAtAcademy:true,
  unassignedSourceReferences:bundle.unassignedAcademyReferences.length,rightsImported:0,recordingsAdmitted:0,hostedWrites:0};
 await writeFile(join(output,'private-connection-plan.json'),JSON.stringify(plan,null,2),{flag:'wx',mode:0o600});
 return {publicCards:items.length,courseCardsWithOriginalArt:plan.courseCardsWithOriginalArt,uniqueCoverObjects:covers.length,knownWebsites:plan.sites.length,pendingCourses:plan.pendingCourses.length,sourceRecordingMatches:plan.sites.reduce((n,s)=>n+s.matchedSourceRecordings.length,0),unresolvedRecordings:plan.sites.reduce((n,s)=>n+s.unresolvedRecordings.length,0),unassignedSourceReferences:plan.unassignedSourceReferences,hostedWrites:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){if(process.argv.length!==4)throw Error('Provide the private bundle directory and a new local output directory.');console.log(JSON.stringify(await prepareCirclesConnection(process.argv[2],process.argv[3])));}
