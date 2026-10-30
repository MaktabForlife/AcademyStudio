import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {controlPlaneAdmission,admissionVerification,verifyAdmission} from '../tools/existing-media-control-plane.mjs';
import {contentHash} from '../tools/reconciled-content.mjs';

// Synthetic full-size package, without private data or real resource identifiers.
function packageData(){
 const sources=['COURSE','TAFSEER'].map((kind,i)=>({activityKey:'activity-'+i,offeringId:'offering-'+i,kind,generation:3}));
 const editions=Array.from({length:9},(_,i)=>({websiteId:'site-'+i,published:contentHash('published-'+i),existingDraft:contentHash('draft-'+i)}));
 const objects=Array.from({length:49},(_,i)=>({object:{assetId:'asset-'+i,sourceAssetId:'source-'+i,filename:'file-'+i,kind:i<11?'PDF':'YOUTUBE',...(i<11?{expectedSha256:contentHash('pdf-'+i)}:{youtubeId:'abc12345678'})}}));
 const attachments=objects.map(({object:o},i)=>({attachment_id:'attachment-'+i,asset_id:o.assetId,offering_id:'offering-'+(i<4?0:1),website_id:i>=43?null:'site-'+(i<4?0:1+i%8),lesson_id:'lesson-'+i,lesson_date:'2026-10-01',cohort:'original-class',title:'Lesson '+i,audience:'RECORDING',published:0}));
 const payload={format:'CIRCLES_MEDIA_TRANSFER_PLAN_V1',migrationPhase:'EXISTING_DATA_ONLY',sources,editions,objects,attachments};
 const plan={...payload,planSha256:contentHash(payload)};
 const receipt={planSha256:plan.planSha256,receipts:objects.slice(0,11).map(({object:o})=>({assetId:o.assetId,objectSha256:contentHash(o),planSha256:plan.planSha256,sha256:o.expectedSha256,size:100})),referenceOnly:objects.slice(11).map(({object:o})=>({assetId:o.assetId,youtubeId:o.youtubeId}))};
 const byteReceipts=receipt.receipts.map(r=>({assetId:r.assetId,sha256:r.sha256,size:r.size,verified:true,objectKey:`imports/academy/circles-existing-${plan.planSha256}/${r.sha256}.pdf`}));
 const sites=editions.map((e,i)=>({website_id:e.websiteId,offering_id:'offering-'+(i?1:0),draft_key:`websites/${e.websiteId}/versions/${e.existingDraft}.json`,published_key:`websites/${e.websiteId}/versions/${e.published}.json`,revision:1,enabled:1}));
 const scopes=sources.map(s=>({offering_id:s.offeringId,kind:s.kind,authority:'ACADEMY',generation:3,version:1,enabled:1}));
 return {plan,receipt,byteReceipts,target:{planSha256:plan.planSha256,knownWebsitesMatch:true,sourceScopesEnabled:true,existingPlannedAssets:0,existingPlannedAttachments:0,results:[{results:sites},{results:scopes}]}};
}

test('account-owner private admission is atomic, exact and unpublished; edition/authority/conflict failures preserve all rows',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("local")}}',compatibilityDate:'2026-09-28',d1Databases:{DB:'local-control-plane'}}));
 try{
  const db=await mf.getD1Database('DB');
  for(const name of ['0001_platform.sql','0002_parallel_access.sql'])for(const sql of (await readFile(new URL('../migrations/'+name,import.meta.url),'utf8')).split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
  const input=packageData(),admission=controlPlaneAdmission(input),run=async batch=>db.batch(batch.map(q=>db.prepare(q.sql).bind(...q.params)));
  for(const s of input.target.results[1].results){await db.prepare('INSERT INTO offerings(offering_id,kind,title,active,revision) VALUES(?,?,?,1,1)').bind(s.offering_id,s.kind,'Synthetic offering').run();await db.prepare("INSERT INTO source_access_scopes VALUES(?,'ACADEMY',3,1,1,1,'UTC','[]')").bind(s.offering_id).run();}
  for(const s of input.target.results[0].results)await db.prepare('INSERT INTO websites(website_id,offering_id,title,draft_key,published_key,revision,enabled) VALUES(?,?,?,?,?,?,?)').bind(s.website_id,s.offering_id,'Synthetic website',s.draft_key,s.published_key,s.revision,s.enabled).run();
  const empty=async()=>{assert.equal(await db.prepare('SELECT count(*) n FROM objects').first('n'),0);assert.equal(await db.prepare('SELECT count(*) n FROM operations').first('n'),0);};
  await db.prepare("UPDATE websites SET revision=2 WHERE website_id='site-0'").run();
  await assert.rejects(run(admission.batch),/CHECK constraint/);await empty();
  await db.prepare("UPDATE websites SET revision=1 WHERE website_id='site-0'").run();
  await db.prepare("UPDATE source_access_scopes SET authority='WEBSITE' WHERE offering_id='offering-0'").run();
  await assert.rejects(run(admission.batch),/CHECK constraint/);await empty();
  await db.prepare("UPDATE source_access_scopes SET authority='ACADEMY' WHERE offering_id='offering-0'").run();
  // A failure after earlier inserts must roll the whole transaction back.
  const fail=structuredClone(admission.batch);fail.splice(-1,0,{sql:'INSERT INTO guards VALUES(?,0)',params:['late-failure']});
  await assert.rejects(run(fail),/CHECK constraint/);await empty();
  const writes=await run(admission.batch),verified=verifyAdmission(await run(admissionVerification(admission)),admission);
  assert.deepEqual(verified,{objects:49,owners:49,attachments:49,publishedAttachments:0,websitesUnchanged:9});
  await assert.rejects(run(admission.batch),/CHECK constraint/);
  verifyAdmission(await run(admissionVerification(admission)),admission);
  assert.equal(await db.prepare('SELECT count(*) n FROM guards').first('n'),0);
  assert.equal(await db.prepare('SELECT count(*) n FROM accounts').first('n'),0);
  console.log(JSON.stringify({operatorAdmissionQueries:writes.length,rowsRead:writes.reduce((n,r)=>n+r.meta.rows_read,0),rowsWritten:writes.reduce((n,r)=>n+r.meta.rows_written,0),verified}));
 }finally{await mf.dispose();}
});

test('private admission rejects publication, edited plans and missing PDF proof',()=>{
 const input=packageData();assert.doesNotThrow(()=>controlPlaneAdmission(input));
 const missing=structuredClone(input);missing.byteReceipts.pop();assert.throws(()=>controlPlaneAdmission(missing),/PDF_BYTES_REQUIRED/);
 const changed=structuredClone(input);changed.plan.attachments[0].published=1;assert.throws(()=>controlPlaneAdmission(changed),/PLAN_CHANGED/);
 const exposed=structuredClone(input);exposed.plan.attachments[0].published=1;const {planSha256,...payload}=exposed.plan;exposed.plan.planSha256=contentHash(payload);exposed.receipt.planSha256=exposed.plan.planSha256;exposed.target.planSha256=exposed.plan.planSha256;assert.throws(()=>controlPlaneAdmission(exposed));
});
