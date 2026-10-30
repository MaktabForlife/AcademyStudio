import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,stat,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {contentHash} from '../tools/reconciled-content.mjs';
import {planMediaPage} from '../tools/media-import-plan.mjs';
import {buildCirclesMediaPlan} from '../tools/prepare-circles-media.mjs';
import {stageMediaTransfer} from '../tools/stage-media-transfer.mjs';
import {buildExistingDataMediaPlan} from '../tools/prepare-existing-data-migration.mjs';

import {sampleMediaTransfer as sample} from './media-transfer-fixture.mjs';
const build=data=>buildCirclesMediaPlan(data.bundle,data.copy,data.pages,{bundleSha256:'f'.repeat(64)});

test('exact asset associations preserve original audiences without associating neighbouring media',()=>{
 const data=sample(),plan=build(data);
 assert.equal(plan.objects.length,3);assert.equal(plan.attachments.length,6);assert.equal(plan.held.length,1);
 assert.equal(plan.held[0].sourceAssetId,'unassigned-video');assert.deepEqual(plan.held[0].reasons,['EXPLICIT_WEBSITE_ASSOCIATION_REQUIRED']);
 assert(plan.attachments.every(a=>a.published===0&&a.audience==='RECORDING'&&a.lesson_date==='2024-01-12'));
 assert.deepEqual(new Set(plan.attachments.map(a=>a.cohort)),new Set(['original-class','second-class']));
 assert.equal(plan.guideCandidates[0].targetMediaAdmission,'PENDING');assert.equal(plan.unresolved.length,1);assert.equal(plan.readyToAdmit,false);assert.equal(plan.readyToPublish,false);
 assert.deepEqual(build(data),plan);
 const page=data.pages[0],mapping={sourceLessonId:'original-lesson',sourceAssetId:'video',websiteId:'site-surah'};
 assert.throws(()=>planMediaPage(page,{associations:[mapping,{sourceLessonId:'original-lesson',websiteId:'site-surah'}]}),/MEDIA_MAPPING_AMBIGUOUS/);
 assert.throws(()=>planMediaPage(page,{associations:[{...mapping,sourceAssetId:'not-in-page'}]}),/MEDIA_MAPPING_OUTSIDE_PAGE/);
 assert.throws(()=>planMediaPage(page,{associations:[mapping,mapping]}),/MEDIA_MAPPING_DUPLICATE/);
});

test('existing-data preparation explicitly preserves programme media while leaving new content out',()=>{
 const data=sample(),options={bundleSha256:'f'.repeat(64)},plan=buildExistingDataMediaPlan(data.bundle,data.copy,data.pages,options);
 assert.equal(plan.migrationPhase,'EXISTING_DATA_ONLY');assert.equal(plan.objects.length,4);assert.equal(plan.attachments.length,8);assert.equal(plan.held.length,0);
 assert.equal(plan.offeringOnlyAssociations.length,1);assert.equal(plan.offeringOnlyAssociations[0].websiteAssociation,'PENDING');
 const unmapped=plan.objects.find(o=>o.object.sourceAssetId==='unassigned-video').object;
 assert.equal(plan.attachments.filter(a=>a.asset_id===unmapped.assetId&&a.website_id===null&&a.audience==='RECORDING').length,2);
 assert.deepEqual(plan.excludedNextPhase.standaloneDrafts,['unmapped-course']);assert(plan.editions.every(e=>!('reviewDraft'in e)));
 const page=data.pages[0],mapping={sourceLessonId:'original-lesson',sourceAssetId:'unassigned-video',offeringOnly:true};
 assert.equal(planMediaPage(page,{associations:[mapping]}).objects.length,1);
 assert.throws(()=>planMediaPage(page,{associations:[{...mapping,sourceAssetId:undefined}]}),/MEDIA_OFFERING_ONLY_MAPPING_INVALID/);
 assert.throws(()=>planMediaPage(page,{associations:[{...mapping,websiteId:'invented-site'}]}),/MEDIA_OFFERING_ONLY_MAPPING_INVALID/);
 assert.throws(()=>planMediaPage(page,{associations:[{sourceLessonId:'original-lesson',sourceAssetId:'unassigned-video',websiteId:null}]}));
});

test('copy reconciliation refuses incomplete snapshots, changed native identity and competing website mappings',()=>{
 let data=sample();data.copy.snapshots[0].totalLessons++;assert.throws(()=>build(data),/MEDIA_PAGES_INCOMPLETE/);
 data=sample();data.pages[0].more=true;assert.throws(()=>build(data),/MEDIA_PAGE_CHECKPOINT_INVALID/);
 data=structuredClone(sample());data.pages[0].source.writeVersion++;assert.throws(()=>build(data),/MEDIA_SOURCE_SNAPSHOT_CHANGED/);
 data=structuredClone(sample());data.bundle.sites[0].recordings[0].native.cohorts=['current-class'];assert.throws(()=>build(data),/MEDIA_COPY_REFERENCE_CHANGED|MEDIA_NATIVE_REFERENCE_CHANGED/);
 data=structuredClone(sample());data.bundle.sites[0].recordings[0].videoId='zyxwvutsrqp';assert.throws(()=>build(data),/MEDIA_RECORDING_IDENTITY_CHANGED/);
 data=sample();data.bundle.sites.push({...data.bundle.sites[0],websiteId:'different-site'});assert.throws(()=>build(data),/MEDIA_WEBSITE_ASSOCIATION_CONFLICT/);
 data=sample();data.bundle.sites[0].materials[0].localObject={...data.files[0],sha256:'0'.repeat(64)};assert.throws(()=>build(data),/MEDIA_PDF_MAPPING_REQUIRED/);
 data=sample();data.copy.references=[...data.copy.references.slice(0,3),data.copy.references[0]];assert.throws(()=>build(data),/MEDIA_COPY_REFERENCE_CHANGED/);
});

test('private staging resumes an interrupted transfer, verifies retries and never creates admission mappings',async()=>{
 const data=sample(),plan=build(data),directory=await mkdtemp(join(tmpdir(),'circles-media-stage-')),source=join(directory,'source'),output=join(directory,'staged');
 try{
  await mkdir(join(source,'objects'),{recursive:true,mode:0o700});
  for(const [i,file]of data.files.entries())await writeFile(join(source,file.file),data.originals[i],{mode:0o600});
  await assert.rejects(stageMediaTransfer(plan,{sourceRoot:source,destination:output,onCheckpoint:async()=>{throw Error('SIMULATED_INTERRUPTION');}}),/SIMULATED_INTERRUPTION/);
  assert.equal((await readdir(join(output,'receipts'))).length,1);
  const first=join(output,data.files[0].file),before=await stat(first);
  const resumed=await stageMediaTransfer(plan,{sourceRoot:source,destination:output});
  assert.equal(resumed.receipts.length,2);assert.equal(resumed.referenceOnly[0].youtubeId,'abcdefghijk');assert.equal(resumed.summary.verifiedBytes,data.originals.reduce((n,b)=>n+b.length,0));
  assert.equal((await stat(first)).ino,before.ino,'An exact resume does not replace already verified bytes');
  assert.equal((await stat(first)).mtimeMs,before.mtimeMs);assert.equal((await stat(first)).mode&0o077,0);assert.equal((await stat(output)).mode&0o077,0);
  assert.deepEqual(resumed.acceptedTargetMappings,[]);assert.equal(resumed.sourceRevalidation,'REQUIRED');assert.equal(resumed.hostedWrites,0);
  assert.deepEqual(await stageMediaTransfer(plan,{sourceRoot:source,destination:output}),resumed);
  const changed=structuredClone(plan);changed.editions[0].published='d'.repeat(64);const {planSha256,...payload}=changed;changed.planSha256=contentHash(payload);
  await assert.rejects(stageMediaTransfer(changed,{sourceRoot:source,destination:output}),/MEDIA_CHECKPOINT_CHANGED/);
  await writeFile(first,Buffer.alloc(data.originals[0].length));await assert.rejects(stageMediaTransfer(plan,{sourceRoot:source,destination:output}),/MEDIA_BYTES_TYPE_CHANGED/);
  assert.equal((await readFile(join(source,data.files[0].file))).toString(),data.originals[0].toString(),'The copied source remains untouched');
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('staging rejects changed plans and a source symlink outside the private bundle',async()=>{
 const data=sample(),plan=build(data),directory=await mkdtemp(join(tmpdir(),'circles-media-path-')),source=join(directory,'source');
 try{
  await mkdir(join(source,'objects'),{recursive:true,mode:0o700});const outside=join(directory,'outside.pdf');await writeFile(outside,data.originals[0]);await symlink(outside,join(source,data.files[0].file));
  await assert.rejects(stageMediaTransfer(plan,{sourceRoot:source,destination:join(directory,'staged')}),/MEDIA_SOURCE_PATH_INVALID/);
  const changed=structuredClone(plan);changed.attachments[0].published=1;
  await assert.rejects(stageMediaTransfer(changed,{sourceRoot:source,destination:join(directory,'other')}),/MEDIA_TRANSFER_PLAN_CHANGED/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
