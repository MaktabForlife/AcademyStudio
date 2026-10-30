import test from 'node:test';
import assert from 'node:assert/strict';
import {existingMediaFixture} from './existing-media-fixture.mjs';
import {existingMediaMigration} from '../tools/migrate-existing-media.mjs';
import {contentHash} from '../tools/reconciled-content.mjs';

const currentSites=async f=>(await f.db.prepare('SELECT * FROM websites ORDER BY website_id').all()).results;
const rights=async f=>({participation:(await f.db.prepare('SELECT * FROM participation ORDER BY account_id,offering_id').all()).results,months:(await f.db.prepare('SELECT * FROM paid_months ORDER BY account_id,offering_id,month,cohort').all()).results,grants:(await f.db.prepare('SELECT * FROM surah_grants ORDER BY account_id,website_id').all()).results});
const pdfAttachment=x=>x.plan.attachments.find(a=>a.cohort==='historic-cohort'&&x.plan.objects.some(o=>o.object.assetId===a.asset_id&&o.object.kind==='PDF'));

test('existing-media import preserves current data, supports safe retries and permanently retires a rolled-back run',async t=>{
 const x=await existingMediaFixture(),{f,migration}=x;
 try{
  const beforeSites=await currentSites(f),beforeRights=await rights(f),operationId=crypto.randomUUID();f.source.resetMetrics();
  const result=await migration.admit({operationId,offeringId:'tafseer'}),admission={...migration.store.metrics},source={...x.source.metrics};
  assert.equal(result.createdAttachmentIds.length,4);assert.equal(result.mappings.length,2);assert.equal(result.published,false);
  assert.equal((await migration.admit({operationId,offeringId:'tafseer'})).replayed,true);assert.deepEqual(x.source.metrics,source,'Exact retry does not reread Academy');
  const row=pdfAttachment(x);assert.equal((await f.request('/api/media/'+row.attachment_id,{cookie:x.learner})).status,404);
  const activated=await migration.activate({admissionId:operationId});assert.equal(activated.changedAttachmentIds.length,4);
  const opened=await f.request('/api/media/'+row.attachment_id,{cookie:x.learner,headers:{Range:'bytes=0-4'}});assert.equal(opened.status,206);assert.equal(Buffer.from(opened.body).toString(),'%PDF-');
  assert.equal((await f.request('/api/media/'+row.attachment_id,{cookie:x.grant})).status,403);
  assert.equal((await migration.activate({admissionId:operationId})).replayed,true);
  const retired=await migration.retire({admissionId:operationId});assert.equal(retired.mode,'ROLLBACK');assert.equal((await f.request('/api/media/'+row.attachment_id,{cookie:x.learner})).status,404);
  assert(await f.media.head(x.receipt.receipts[0].objectKey));assert.equal((await migration.retire({admissionId:operationId})).replayed,true);
  // A lost/repeated activation response never performs another update after rollback.
  assert.equal((await migration.activate({admissionId:operationId})).replayed,true);assert.equal((await f.request('/api/media/'+row.attachment_id,{cookie:x.learner})).status,404);
  assert.deepEqual(await currentSites(f),beforeSites);assert.deepEqual(await rights(f),beforeRights);
  assert.equal(f.source.metrics.queries,0,'Routine target requests do not contact Academy');assert(opened.reads<=12);
  t.diagnostic(JSON.stringify({admission,sourceRevalidation:source,targetPdfRangeRows:opened.reads,websitesUnchanged:true,rightsUnchanged:true,rollbackPreservesBytes:true}));
 }finally{await x.close();}
});

test('an interrupted byte copy resumes without replacing it, while source changes prevent admission and activation',async()=>{
 const x=await existingMediaFixture(),{f}=x;
 try{
  let interrupted=false;const media={get:key=>f.media.get(key),async put(...args){const result=await f.media.put(...args);if(!interrupted){interrupted=true;throw Error('SIMULATED_LOST_COPY_REPLY');}return result;}};
  const migration=existingMediaMigration({...x.options,env:{...x.options.env,MEDIA:media}}),operationId=crypto.randomUUID();
  await assert.rejects(migration.admit({operationId,offeringId:'tafseer'}),/SIMULATED_LOST_COPY_REPLY/);
  assert.equal(await f.db.prepare('SELECT count(*) n FROM attachments').first('n'),0);
  const copied=await f.media.head(x.receipt.receipts[0].objectKey);
  await migration.admit({operationId,offeringId:'tafseer'});assert.equal((await f.media.head(copied.key)).etag,copied.etag);
  await x.x.run('UPDATE academy_write_state SET version=version+1 WHERE singleton=1');
  await assert.rejects(migration.activate({admissionId:operationId}),/MEDIA_SOURCE_SNAPSHOT_CHANGED/);
  await assert.rejects(migration.admit({operationId:crypto.randomUUID(),offeringId:'tafseer'}),/MEDIA_SOURCE_SNAPSHOT_CHANGED/);
  assert.equal(await f.db.prepare('SELECT sum(published) n FROM attachments').first('n'),0,'Stale source leaves every migrated attachment private');
  await migration.retire({admissionId:operationId});await assert.rejects(migration.activate({admissionId:operationId}),/MEDIA_MIGRATION_RETIRED/);
 }finally{await x.close();}
});

test('target races and ownership conflicts reject the whole admission; recovery remains available when source scope closes',async()=>{
 const x=await existingMediaFixture(),{f}=x;
 try{
  const operationId=crypto.randomUUID();let race=true;
  const migration=existingMediaMigration({...x.options,async openInventory(source){if(race){race=false;await f.run("UPDATE websites SET revision=revision+1 WHERE website_id='site-surah'");}return x.options.openInventory(source);}});
  await assert.rejects(migration.admit({operationId,offeringId:'tafseer'}),/permissions or this record changed/);assert.equal(await f.db.prepare('SELECT count(*) n FROM attachments').first('n'),0);
  const object=x.plan.objects.find(o=>o.object.kind==='YOUTUBE').object;
  await f.run('INSERT INTO objects VALUES(?,NULL,?,?,0,NULL,?)',object.assetId,'video/youtube','Wrong owner',object.youtubeId);await f.run('INSERT INTO asset_owners VALUES(?,?)',object.assetId,'course');
  await assert.rejects(migration.admit({operationId,offeringId:'tafseer'}),/TARGET_MEDIA_OWNERSHIP_OR_OBJECT_CONFLICT/);
  await f.run('DELETE FROM asset_owners WHERE asset_id=?',object.assetId);await f.run('DELETE FROM objects WHERE asset_id=?',object.assetId);
  await migration.admit({operationId,offeringId:'tafseer'});await migration.activate({admissionId:operationId});
  await f.run("UPDATE source_access_scopes SET enabled=0 WHERE offering_id='tafseer'");
  await migration.retire({admissionId:operationId,mode:'WITHDRAW'});assert.equal(await f.db.prepare('SELECT sum(published) n FROM attachments').first('n'),0);
  assert(await f.media.head(x.receipt.receipts[0].objectKey));
 }finally{await x.close();}
});

test('migration excludes new websites and hosted execution',async()=>{
 assert.throws(()=>existingMediaMigration({env:{ENVIRONMENT:'production',AUTHORITY_MODE:'ACADEMY'}}),/LOCAL_EXISTING_DATA_MIGRATION_REQUIRED/);
 const x=await existingMediaFixture();
 try{
  const changed=structuredClone(x.plan);changed.attachments.forEach(a=>a.website_id='new-website');changed.editions[0].websiteId='new-website';const {planSha256,...payload}=changed;changed.planSha256=contentHash(payload);
  const migration=existingMediaMigration({...x.options,plan:changed,receipt:{...x.receipt,planSha256:changed.planSha256,receipts:x.receipt.receipts.map(r=>({...r,planSha256:changed.planSha256}))}});
  await assert.rejects(migration.admit({operationId:crypto.randomUUID(),offeringId:'tafseer'}),/EXISTING_TARGET_WEBSITE_REQUIRED/);
  assert.equal(await x.f.db.prepare('SELECT count(*) n FROM websites').first('n'),2);assert.equal(await x.f.db.prepare('SELECT count(*) n FROM attachments').first('n'),0);
 }finally{await x.close();}
});

test('programme-only originals retain recording rights, reused publication and bounded reads after unrelated growth',async t=>{
 const x=await existingMediaFixture({offeringOnlyVideo:true}),{f}=x;
 try{
  const video=x.plan.objects.find(o=>o.object.kind==='YOUTUBE').object,row=x.plan.attachments.find(a=>a.asset_id===video.assetId&&a.cohort==='historic-cohort');
  assert.equal(row.website_id,null);
  await f.run('INSERT INTO objects VALUES(?,NULL,?,?,0,NULL,?)',video.assetId,'video/youtube',video.filename,video.youtubeId);
  await f.run('INSERT INTO asset_owners VALUES(?,?)',video.assetId,'tafseer');
  await f.run('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,1)',row.attachment_id,row.offering_id,row.website_id,row.asset_id,row.lesson_id,row.lesson_date,row.cohort,row.title,row.audience);
  const operationId=crypto.randomUUID(),before=await rights(f),admitted=await x.migration.admit({operationId,offeringId:'tafseer'});assert.equal(admitted.createdAttachmentIds.length,3);
  await x.migration.activate({admissionId:operationId});
  const opened=await f.request('/api/media/'+row.attachment_id,{cookie:x.learner});assert.equal(opened.status,200);assert.equal(opened.body.videoId,video.youtubeId);
  assert.equal((await f.request('/api/media/'+row.attachment_id,{cookie:x.grant})).status,403,'Website-only rights cannot open programme recordings');
  await x.migration.retire({admissionId:operationId});assert.equal((await f.request('/api/media/'+row.attachment_id,{cookie:x.learner})).status,200,'Rollback preserves a publication that predated this migration');
  const baseline=existingMediaMigration(x.options);await baseline.admit({operationId:crypto.randomUUID(),offeringId:'tafseer'});const beforeGrowth={...baseline.store.metrics};
  const values=JSON.stringify(Array.from({length:4000},(_,i)=>'unrelated-'+i));
  await f.run("INSERT INTO objects SELECT value,NULL,'video/youtube','Unrelated recording',0,NULL,'abcdefghijk' FROM json_each(?)",values);
  await f.run("INSERT INTO asset_owners SELECT value,'course' FROM json_each(?)",values);
  await f.run("INSERT INTO attachments SELECT value,'course','site-course',value,'unrelated-lesson','2024-01-12','','Unrelated recording','RECORDING',1 FROM json_each(?)",values);
  const grown=existingMediaMigration(x.options);await grown.admit({operationId:crypto.randomUUID(),offeringId:'tafseer'});
  assert(grown.store.metrics.rowsRead<=beforeGrowth.rowsRead+2,JSON.stringify({beforeGrowth,after:grown.store.metrics}));
  assert.deepEqual(await rights(f),before);t.diagnostic(JSON.stringify({before4000Unrelated:beforeGrowth,after4000Unrelated:grown.store.metrics,programmeOnlyRecordingDeniedToWebsiteGrant:true,reusedPublicationPreserved:true}));
 }finally{await x.close();}
});
