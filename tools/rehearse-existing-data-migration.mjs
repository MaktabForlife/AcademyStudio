// Replays the supplied existing-data copy in disposable local Workers/D1/R2.
// Archived source pages are fixture data, never a fresh production attestation.
import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fixture} from '../tests/fixture.mjs';
import {accessFixture,signIn} from '../tests/access-fixture.mjs';
import {Store} from '../src/database.mjs';
import {sha256} from '../src/protocol.mjs';
import {seedReviewedWebsites} from './seed-reviewed-websites.mjs';
import {contentHash} from './reconciled-content.mjs';
import {existingMediaMigration} from './migrate-existing-media.mjs';

export async function rehearseExistingData(projectDirectory,destination){
 const root=resolve(projectDirectory),out=resolve(destination),copy=join(root,'outputs/academy-content-copy-20261030'),staging=join(root,'outputs/circles-existing-data-migration-20261030/prepared-final');
 const load=async file=>JSON.parse(await readFile(file,'utf8')),plan=await load(join(staging,'private-media-plan.json')),receipt=await load(join(staging,'staged/transfer-receipt.json'));
 const pageNames=(await readdir(join(copy,'academy'))).filter(n=>/^scope-\d+-page-\d+\.json$/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const pages=await Promise.all(pageNames.map(n=>load(join(copy,'academy',n))));
 await mkdir(out,{recursive:false,mode:0o700});const f=await fixture({academy:true,authorityMode:'ACADEMY'});
 try{
  await accessFixture(f);
  // Match the nine sites already present in the real parallel release, with no
  // preview participants/grants, no review-draft promotion and no new courses.
  await seedReviewedWebsites({run:f.run,content:f.content,media:f.media},join(root,'outputs/independent-websites-20261028'));
  const admin=await signIn(f,'global'),former=await signIn(f),grant=await signIn(f,'studentB');
  const accountIds=f.source.f.actors,accounts=[accountIds.global,accountIds.studentA,accountIds.studentB],now=Date.now();
  for(const source of plan.sources){
   await f.run('INSERT INTO source_access_scopes VALUES(?,?,?,?,1,1,?,?)',source.offeringId,'ACADEMY',source.generation,1,'UTC','[]');
   for(const account of accounts)await f.run('INSERT INTO source_access_people VALUES(?,?,?,?,?,1,?,0,?)',account,source.offeringId,source.generation,1,now,'[]',Number(source.kind==='COURSE'));
   for(const site of plan.editions.filter(e=>plan.attachments.some(a=>a.offering_id===source.offeringId&&a.website_id===e.websiteId)))if(source.kind==='TAFSEER')await f.run('INSERT INTO source_access_websites VALUES(?,?,1)',site.websiteId,source.offeringId);
  }
  const course=plan.sources.find(s=>s.kind==='COURSE'),tafseer=plan.sources.find(s=>s.kind==='TAFSEER');
  await f.run('INSERT INTO participation VALUES(?,?,0,0,1,?)',accountIds.studentA,course.offeringId,'');
  const pdfs=plan.objects.filter(o=>o.object.kind==='PDF'),historic=plan.attachments.find(a=>a.offering_id===tafseer.offeringId&&pdfs.some(p=>p.object.assetId===a.asset_id));
  await f.run('INSERT INTO paid_months VALUES(?,?,?,?,?)',accountIds.studentA,tafseer.offeringId,historic.lesson_date.slice(0,7),historic.cohort,'Synthetic original month/class acceptance');
  await f.run('INSERT INTO surah_grants VALUES(?,?,?)',accountIds.studentB,historic.website_id,'Synthetic website-only acceptance');
  const env={...f.env,DB:f.db,CONTENT:f.content,MEDIA:f.media};f.source.resetMetrics();
  const actor=await new Store(env).actor(await sha256(admin.slice(admin.indexOf('=')+1)));
  const unchangedTables=['websites','website_history','published_assets','accounts','participation','paid_months','surah_grants','offerings'];
  const snapshots=async()=>Object.fromEntries(await Promise.all(unchangedTables.map(async table=>[table,(await f.db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()).results])));
  const before=await snapshots(),beforeAssets=(await f.db.prepare('SELECT * FROM objects ORDER BY asset_id').all()).results,beforeAttachments=(await f.db.prepare('SELECT * FROM attachments ORDER BY attachment_id').all()).results;
  const migration=existingMediaMigration({env,actor,plan,receipt,stagedDirectory:join(staging,'staged'),async openInventory(source){
   const archive=pages.filter(p=>p.source.offeringId===source.offeringId);assert(archive.length);return {source:archive[0].source,inventoryId:archive[0].inventoryId,async page({after=''}){const previous=after?archive.findIndex(p=>p.checkpoint.afterLessonId===after):-1;assert(!after||previous>=0);const index=previous+1;assert(index<archive.length);return structuredClone(archive[index]);}};
  }});
  const admitted=[];
  for(const source of plan.sources){const result=await migration.admit({offeringId:source.offeringId,operationId:'existing-copy-'+contentHash(source.offeringId)});admitted.push(result);assert.equal((await migration.admit({offeringId:source.offeringId,operationId:result.admissionId})).replayed,true);}
  assert.deepEqual(await snapshots(),before);const admissionMetrics={...migration.store.metrics};
  for(const result of admitted)await migration.activate({admissionId:result.admissionId});
  let ranges=0,videos=0,maxMediaReads=0;
  for(const attachment of plan.attachments){
   const object=plan.objects.find(o=>o.object.assetId===attachment.asset_id).object,isPdf=object.kind==='PDF';
   const response=await f.request('/api/media/'+attachment.attachment_id,{cookie:admin,...(isPdf?{headers:{Range:'bytes=0-4'}}:{})});maxMediaReads=Math.max(maxMediaReads,response.reads);
   if(isPdf){assert.equal(response.status,206);assert.equal(Buffer.from(response.body).toString(),'%PDF-');ranges++;}else{assert.equal(response.status,200);assert.equal(response.body.videoId,object.youtubeId);videos++;}
  }
  assert.equal((await f.request('/api/media/'+historic.attachment_id,{cookie:former,headers:{Range:'bytes=0-4'}})).status,206);
  assert.equal((await f.request('/api/media/'+historic.attachment_id,{cookie:grant})).status,403);
  const coursePdf=plan.attachments.find(a=>a.offering_id===course.offeringId&&pdfs.some(p=>p.object.assetId===a.asset_id));
  assert.equal((await f.request('/api/media/'+coursePdf.attachment_id,{cookie:former,headers:{Range:'bytes=0-4'}})).status,206);
  assert.deepEqual(await snapshots(),before);assert.equal(f.source.metrics.queries,0);
  for(const result of admitted)await migration.retire({admissionId:result.admissionId});
  for(const a of plan.attachments)assert.equal((await f.request('/api/media/'+a.attachment_id,{cookie:admin})).status,404);
  for(const r of receipt.receipts)assert(await f.media.head(r.objectKey));
  for(const original of beforeAssets)assert.deepEqual(await f.db.prepare('SELECT * FROM objects WHERE asset_id=?').bind(original.asset_id).first(),original);
  for(const original of beforeAttachments)assert.deepEqual(await f.db.prepare('SELECT * FROM attachments WHERE attachment_id=?').bind(original.attachment_id).first(),original);
  assert.deepEqual(await snapshots(),before);
  const report={date:'2026-10-30',format:'EXISTING_DATA_MIGRATION_REHEARSAL_V1',localOnly:true,existingSites:plan.editions.length,mediaMappings:admitted.reduce((n,a)=>n+a.mappings.length,0),pdfRanges:ranges,recordingReferences:videos,
   savedDraftsAndPublicationsUnchanged:true,accountsAndRightsUnchanged:true,originalArtworkUnchanged:true,exactRetries:true,rollbackVerified:true,originalBytesRetained:true,
   newCoursesCreated:0,newTeachingDataAdded:0,reviewDraftsPromoted:0,standaloneDraftsImported:0,liveSourceRevalidated:false,sourceArchiveReplay:true,hostedReads:0,hostedWrites:0,
   sourceRevalidation:'LIVE_PREFLIGHT_REQUIRED_BEFORE_REAL_ADMISSION',admissionMetrics,maxMediaRowsRead:maxMediaReads,planSha256:plan.planSha256,bundleSha256:plan.bundleSha256,
   heldSourceReferences:plan.held.length,unresolvedCompanions:plan.unresolved.length,acceptedHostedMappings:0};
  await writeFile(join(out,'existing-data-rehearsal.json'),jsonReport(report),{mode:0o600,flag:'wx'});return report;
 }finally{await f.close();}
}
const jsonReport=value=>JSON.stringify(value,null,2)+'\n';
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){assert.equal(process.argv.length,4,'Provide project root and new private evidence directory.');const report=await rehearseExistingData(process.argv[2],process.argv[3]);console.log(JSON.stringify({existingSites:report.existingSites,pdfRanges:report.pdfRanges,recordingReferences:report.recordingReferences,rollback:report.rollbackVerified,hostedWrites:0}));}
