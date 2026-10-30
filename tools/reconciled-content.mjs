// Private preparation/local fixture adapter. No Worker or hosted job imports it.
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve,join,extname} from 'node:path';import {createHash} from 'node:crypto';
export const contentHash=value=>createHash('sha256').update(Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const equal=(a,b)=>contentHash(a)===contentHash(b);
export function chooseDraft({base,current,incoming}){
 if(equal(current,incoming))return {document:current,status:'ALREADY_PRESENT'};
 if(equal(base,current))return {document:incoming,status:'INCOMING_DRAFT'};
 if(equal(base,incoming))return {document:current,status:'NEWER_CURRENT_PRESERVED'};
 return {document:current,status:'CONFLICT_CURRENT_PRESERVED',candidate:incoming};
}
export function matchRecording(references,offeringId,source){
 if(!offeringId)return {status:'OFFERING_MAPPING_PENDING',native:null};
 const scoped=references.filter(r=>r.offeringId===offeringId&&r.kind==='YOUTUBE'&&r.linked),named=scoped.filter(r=>r.sourceLessonId===source.lessonId);
 if(named.length&&!named.some(r=>r.youtubeId===source.videoId))return {status:'LESSON_VIDEO_CONFLICT',native:null};
 const candidates=(named.length?named:scoped).filter(r=>r.youtubeId===source.videoId);
 if(candidates.length!==1)return {status:candidates.length?'AMBIGUOUS_NATIVE_REFERENCE':'NATIVE_MAPPING_PENDING',native:null};
 const native=candidates[0];return {status:native.state==='PUBLISHED'?'MATCHED':'SOURCE_'+native.state,native,dateDiscrepancy:Boolean(source.lessonDate&&source.lessonDate!==native.date)};
}
export function reconcileRecording(references,offeringId,source,manifestPending=null){
 const match=matchRecording(references,offeringId,source);
 return {...source,editorialLessonId:source.lessonId,...match,
  sourceNativeMappingPending:typeof source.nativeMappingPending==='boolean'?source.nativeMappingPending:typeof manifestPending==='boolean'?manifestPending:null,
  nativeMappingPending:match.native===null};
}

export async function prepareReconciledContent(config,destination){
 const root=resolve(destination);await mkdir(join(root,'objects'),{recursive:true,mode:0o700});
 const json=async path=>JSON.parse(await readFile(path,'utf8')),assets=new Map();
 const put=async(bytes,suffix)=>{
  const sha256=contentHash(bytes),file='objects/'+sha256+suffix,path=join(root,file);
  try{await writeFile(path,bytes,{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;if(contentHash(await readFile(path))!==sha256)throw Error('BUNDLE_OBJECT_CHANGED');}
  return {file,sha256,bytes:bytes.length};
 };
 const document=async value=>put(Buffer.from(JSON.stringify(value)),'.json');
 const retain=async file=>put(await readFile(file),extname(file)||'.bin');
 const index=await json(config.existingIndex),academy=await json(config.academyCopy),privateRoot=resolve(config.existingRoot),sites=[],pending=[];
 if(!academy.sourceUnchanged||academy.sourceDeleted||academy.targetAccessChanged)throw Error('ACADEMY_COPY_NEEDS_REVIEW');
 const academyRoot=resolve(config.academyRoot),pdfs=new Map();
 for(const item of academy.objects){const bytes=await readFile(join(academyRoot,item.localFile));if(contentHash(bytes)!==item.sha256||bytes.length!==item.bytes)throw Error('ACADEMY_COPY_CHECKSUM_CHANGED');const stored=await put(bytes,item.kind==='PDF'?'.pdf':'.mp4');assets.set(stored.sha256,{...stored,mimeType:item.kind==='PDF'?'application/pdf':'video/mp4'});pdfs.set(item.sha256,stored);}
 for(const item of config.websites){
  const prior=index.websites.find(w=>w.key===item.key);if(!prior)throw Error('EXISTING_WEBSITE_MAPPING_REQUIRED');
  const candidate=await json(item.package),sources=await json(item.sources);if(candidate.websiteId!==prior.websiteId||sources.websiteKey!==item.key)throw Error('BUILDER_WEBSITE_ID_CHANGED');
  const issues=config.validatePackage?.(candidate)||[];if(issues.length)throw Error('BUILDER_PACKAGE_REVIEW_REQUIRED');
  const publishedBytes=await readFile(join(privateRoot,'objects',prior.published.key)),currentBytes=await readFile(join(privateRoot,'objects',prior.draft.key));
  if(contentHash(publishedBytes)!==prior.published.sha256||contentHash(currentBytes)!==prior.draft.sha256)throw Error('EXISTING_EDITION_CHECKSUM_CHANGED');
  const published=JSON.parse(publishedBytes),current=JSON.parse(currentBytes),selection=chooseDraft({base:current,current,incoming:candidate.document});
  const editions={published:await put(publishedBytes,'.json'),existingDraft:await put(currentBytes,'.json'),reviewDraft:await document(selection.document),sourcePackage:await retain(item.package)};
  for(const ref of [...prior.published.media,...prior.draft.media,...candidate.media]){
   if(!ref.byteKey)continue;const path=join(privateRoot,'objects',ref.byteKey),bytes=await readFile(path);if(contentHash(bytes)!==ref.sha256)throw Error('BUILDER_ASSET_CHECKSUM_CHANGED');const saved=await put(bytes,ref.mimeType==='application/pdf'?'.pdf':'.bin');assets.set(saved.sha256,{...saved,mimeType:ref.mimeType});
  }
  const recordings=(sources.recordings||[]).map(source=>reconcileRecording(academy.references,prior.offeringId,source,sources.nativeMappingPending));
  const materials=(sources.materials||[]).map(source=>{
   const native=academy.references.filter(r=>r.offeringId===prior.offeringId&&r.kind==='PDF'&&r.linked&&academy.objects.some(o=>o.sourceObjectKey===r.resolvedObjectKey&&o.sha256===source.sha256));
   return {...source,localObject:pdfs.get(source.sha256)||null,status:native.length===1?'MATCHED':native.length?'MULTIPLE_SOURCE_ATTACHMENTS':'PDF_MAPPING_PENDING',native};
  });
  sites.push({key:item.key,websiteId:prior.websiteId,offeringId:prior.offeringId,title:prior.title,kind:item.key==='kahf'?'COURSE':'TAFSEER',
   editions,sourceManifest:await retain(item.sources),draftSelection:selection.status,publishedPointerUnchanged:prior.published.key,existingDraftPointer:prior.draft.key,
   lessons:selection.document.lessons.length,baseLessons:current.lessons.length,recordings,materials,artwork:candidate.media,existingPublishedArtwork:prior.published.media,
   mediaBindings:recordings.filter(r=>r.status==='MATCHED').map(r=>({editorialLessonId:r.editorialLessonId,nativeLessonId:r.native.sourceLessonId,assetId:'academy-asset-'+contentHash([prior.offeringId,r.native.sourceAssetId])})),
   academyPublishedLessons:academy.references.filter(r=>r.offeringId===prior.offeringId&&r.state==='PUBLISHED').length});
 }
 for(const item of config.pending||[]){
  const wrapper=await json(item.file),nativeDocument=wrapper.document||wrapper.course||wrapper;
  const entry={key:item.key,title:nativeDocument.name,websiteId:item.websiteId||wrapper.websiteId||null,offeringId:null,status:'IDENTITY_AND_ACCESS_MAPPING_PENDING',
   sourceFile:await retain(item.file),document:await document(nativeDocument),lessons:nativeDocument.lessons.length,sourceManifest:item.sources?await retain(item.sources):null,
   runtimeCompatibility:item.runtimeCompatibility||'REVIEW_REQUIRED',assets:[],published:false};
  for(const asset of item.assets||[]){const bytes=await readFile(asset.file);if(asset.sha256&&contentHash(bytes)!==asset.sha256)throw Error('PENDING_ASSET_CHECKSUM_CHANGED');const saved=await put(bytes,extname(asset.file)||'.bin');assets.set(saved.sha256,{...saved,mimeType:asset.mimeType});entry.assets.push({assetId:asset.assetId,...saved,mimeType:asset.mimeType});}
  pending.push(entry);
 }
 const assigned=new Set(sites.flatMap(s=>[...s.recordings.filter(r=>r.native).map(r=>JSON.stringify([r.native.offeringId,r.native.sourceLessonId,r.native.sourceAssetId])),...s.materials.flatMap(m=>m.native.map(r=>JSON.stringify([r.offeringId,r.sourceLessonId,r.sourceAssetId])))]));
 const unassignedAcademyReferences=academy.references.filter(r=>!assigned.has(JSON.stringify([r.offeringId,r.sourceLessonId,r.sourceAssetId]))).map(r=>({...r,associationStatus:'WEBSITE_ASSOCIATION_PENDING'}));
 const manifest={format:'CIRCLES_RECONCILED_CONTENT_V1',date:'2026-10-30',private:true,sourceCopy:await retain(config.academyCopy),sites,pending,unassignedAcademyReferences,objects:[...assets.values()],
  mappingStatusContract:{canonical:'status',eligibleStatus:'MATCHED',identityPending:'nativeMappingPending',sourceDeclarationOnly:'sourceNativeMappingPending'},
  catalogue:config.catalogue||[],sourceDeleted:false,permissionsImported:false,published:false,hostedWrites:0,
  metrics:{academyRowsRead:academy.metrics.rowsRead+academy.metrics.preflightRowsRead,academyRowsWritten:academy.metrics.rowsWritten},
  totals:{websites:sites.length,readings:sites.reduce((n,w)=>n+w.lessons,0),recordings:sites.reduce((n,w)=>n+w.recordings.length,0),
   matchedRecordings:sites.reduce((n,w)=>n+w.recordings.filter(r=>r.status==='MATCHED').length,0),pendingRecordings:sites.reduce((n,w)=>n+w.recordings.filter(r=>r.status!=='MATCHED').length,0),
   academyPdfObjects:academy.objects.filter(o=>o.kind==='PDF').length,pendingStandaloneDrafts:pending.length,unassignedAcademyReferences:unassignedAcademyReferences.length}};
 await writeFile(join(root,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});return manifest;
}

export async function readReconciledEdition(directory,websiteId,{edition='published',authorize}={}){
 const root=resolve(directory),manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
 if(manifest.format!=='CIRCLES_RECONCILED_CONTENT_V1'||!['published','reviewDraft','existingDraft'].includes(edition))throw Error('BUNDLE_EDITION_INVALID');
 const site=manifest.sites.find(w=>w.websiteId===websiteId);if(!site||typeof authorize!=='function'||!await authorize({websiteId,offeringId:site.offeringId,admin:edition!=='published'}))throw Error('BUNDLE_CONTENT_FORBIDDEN');
 const ref=site.editions[edition],file=resolve(root,ref.file);if(!file.startsWith(root+'/'))throw Error('BUNDLE_PATH_INVALID');
 const bytes=await readFile(file);if(contentHash(bytes)!==ref.sha256)throw Error('BUNDLE_EDITION_CHANGED');return JSON.parse(bytes);
}

// Consumer can seed a NEW disposable local fixture; never existing hosted data.
export async function seedReconciledFixture(f,directory,{validateDocument}={}){
 if(f.env.ENVIRONMENT!=='local'||f.env.AUTHORITY_MODE==='ACADEMY'||f.source)throw Error('DISPOSABLE_LOCAL_FIXTURE_REQUIRED');
 if(typeof validateDocument!=='function')throw Error('BUNDLE_VALIDATOR_REQUIRED');
 const root=resolve(directory),manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
 const read=async ref=>{const bytes=await readFile(join(root,ref.file));if(contentHash(bytes)!==ref.sha256)throw Error('BUNDLE_OBJECT_CHANGED');return bytes;};
 for(const site of manifest.sites){if(await f.db.prepare('SELECT 1 FROM websites WHERE website_id=?').bind(site.websiteId).first())throw Error('EXISTING_WEBSITE_WOULD_BE_OVERWRITTEN');}
 let attachments=0;
 for(const site of manifest.sites){
  await f.run('INSERT OR IGNORE INTO offerings(offering_id,kind,title,active) VALUES(?,?,?,1)',site.offeringId,site.kind,site.kind==='TAFSEER'?'Tafseer':site.title);
  const keys={};for(const edition of ['published','existingDraft','reviewDraft']){const ref=site.editions[edition],bytes=await read(ref),doc=JSON.parse(bytes);const issues=validateDocument(doc)||[];if(issues.length)throw Error('BUNDLE_DOCUMENT_INVALID');keys[edition]=`websites/${site.websiteId}/versions/${ref.sha256}.json`;await f.content.put(keys[edition],bytes);}
  await f.run('INSERT INTO websites(website_id,offering_id,title,draft_key,published_key,revision,enabled) VALUES(?,?,?,?,?,2,1)',site.websiteId,site.offeringId,site.title,keys.reviewDraft,keys.published);
  for(const [revision,edition]of ['published','existingDraft','reviewDraft'].entries())await f.run('INSERT INTO website_history VALUES(?,?,?,?,?,?)',site.websiteId,revision,edition,keys[edition],Date.now(),'admin');
  const used=new Set();for(const ref of [...site.existingPublishedArtwork,...site.artwork]){if(used.has(ref.assetId))continue;used.add(ref.assetId);const object=manifest.objects.find(x=>x.sha256===ref.sha256);if(!object)throw Error('BUNDLE_ARTWORK_MISSING');await f.media.put(ref.byteKey,await read(object));
   await f.run('INSERT OR IGNORE INTO objects VALUES(?,?,?,?,?,?,NULL)',ref.assetId,ref.byteKey,ref.mimeType,'Course artwork',ref.size,ref.sha256);await f.run('INSERT OR IGNORE INTO asset_owners VALUES(?,?)',ref.assetId,site.offeringId);
   const published=site.existingPublishedArtwork.some(a=>a.assetId===ref.assetId);await f.run('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?)','bundle-art-'+contentHash([site.websiteId,ref.assetId]),site.offeringId,site.websiteId,ref.assetId,'website-artwork','2026-10-30','','Course artwork','WEBSITE',Number(published));if(published)await f.run('INSERT INTO published_assets VALUES(?,?)',site.websiteId,ref.assetId);
  }
  const deliveries=[...site.recordings.filter(r=>r.native&&r.status==='MATCHED').map(r=>({native:r.native,file:null})),...site.materials.flatMap(m=>m.native.map(native=>({native,file:m.localObject})))],seen=new Set();
  for(const {native,file} of deliveries){const assetId='academy-asset-'+contentHash([site.offeringId,native.sourceAssetId]),cohorts=site.kind==='COURSE'?['']:native.cohorts;if(!cohorts.length)continue;
   if(file)await f.media.put('media-bytes/'+file.sha256,await read(file));await f.run('INSERT OR IGNORE INTO objects VALUES(?,?,?,?,?,?,?)',assetId,file?'media-bytes/'+file.sha256:null,file?'application/pdf':'video/youtube',native.filename||native.name,native.byteSize||0,file?.sha256||null,native.youtubeId);
   for(const cohort of cohorts){const id='academy-media-'+contentHash([site.websiteId,native.sourceLessonId,native.sourceAssetId,cohort]);if(seen.has(id))continue;seen.add(id);await f.run('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?)',id,site.offeringId,site.websiteId,assetId,native.sourceLessonId,native.date,cohort,native.name,'RECORDING',Number(native.state==='PUBLISHED'&&native.linked));attachments++;}
  }
 }
 return {websites:manifest.sites.length,mediaAttachments:attachments,realUsersImported:0,entitlementsImported:0,pendingStandaloneDrafts:manifest.pending.length};
}
