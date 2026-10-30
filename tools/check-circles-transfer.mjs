import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve,join} from 'node:path';
import {fixture} from '../tests/fixture.mjs';
import {validatePackage} from '../public/shared/content-schema.mjs';
import {contentHash,seedReconciledFixture,readReconciledEdition} from './reconciled-content.mjs';
import {bindRecordingGuides} from '../public/shared/media-bindings.mjs';
import {recordingGuides} from '../public/shared/recording-companion.mjs';
if(!process.argv[2]||!process.argv[3])throw Error('Specify project root and a private evidence directory.');
const root=resolve(process.argv[2]),out=resolve(process.argv[3]),bundle=join(root,'outputs/academy-content-copy-20261030/circles-bundle'),manifest=JSON.parse(await readFile(join(bundle,'manifest.json'),'utf8'));
await mkdir(out,{recursive:true,mode:0o700});const f=await fixture(),checks=[];const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
try{
 const initialPeers=(await f.db.prepare('SELECT * FROM websites ORDER BY website_id').all()).results;
 const seeded=await seedReconciledFixture(f,bundle,{validateDocument:validatePackage});assert.equal(seeded.entitlementsImported,0);assert.equal(seeded.realUsersImported,0);
 const admin=(await f.login('admin')).cookie,former=(await f.login('former')).cookie,grant=(await f.login('grant-only')).cookie;
 const read=async ref=>JSON.parse(await readFile(join(bundle,ref.file),'utf8'));
 let ranges=0,videos=0,maxMediaReads=0,maxEditReads=0,boundGuides=0;
 for(const site of manifest.sites){
  const path='/api/websites/'+site.websiteId,expected=await read(site.editions.reviewDraft),original=await read(site.editions.published);
  assert.deepEqual(ok(await f.request(path+'/edit',{cookie:admin})).document,expected);assert.deepEqual(ok(await f.request(path,{cookie:admin})).document,original);
  const feed=ok(await f.request('/api/offerings/'+site.offeringId+'/media?website='+site.websiteId,{cookie:admin}));
  const guides=bindRecordingGuides(recordingGuides(expected),feed.media,site.mediaBindings);for(const binding of site.mediaBindings){assert(guides.some(g=>g.lessonId===binding.nativeLessonId));boundGuides++;}
  for(const row of feed.media){const result=await f.request('/api/media/'+row.attachment_id,{cookie:admin,...(row.type==='application/pdf'?{headers:{Range:'bytes=0-4'}}:{})});
   maxMediaReads=Math.max(maxMediaReads,result.reads);if(row.type==='application/pdf'){assert.equal(result.status,206);assert.equal(Buffer.from(result.body).toString(),'%PDF-');ranges++;}else{assert.equal(result.status,200);assert(site.recordings.some(r=>r.native?.youtubeId===result.body.videoId));videos++;}}
  const peers=(await f.db.prepare('SELECT website_id,revision,draft_key,published_key FROM websites WHERE website_id<>? ORDER BY website_id').bind(site.websiteId).all()).results;
  const changed=structuredClone(expected);changed.home.caption+=' · Private fixture verification';const body={action:'save',operationId:crypto.randomUUID(),revision:2,document:changed};
  const saved=await f.request(path+'/edit',{cookie:admin,method:'POST',body});ok(saved);maxEditReads=Math.max(maxEditReads,saved.reads);assert.deepEqual(ok(await f.request(path,{cookie:admin})).document,original);
  assert.equal(ok(await f.request(path+'/edit',{cookie:admin,method:'POST',body})).replayed,true);
  const released=ok(await f.request(path+'/edit',{cookie:admin,method:'POST',body:{action:'publish',operationId:crypto.randomUUID(),revision:saved.body.revision}}));assert.deepEqual(ok(await f.request(path,{cookie:admin})).document,changed);
  ok(await f.request(path+'/edit',{cookie:admin,method:'POST',body:{action:'restore',operationId:crypto.randomUUID(),revision:released.revision,historyRevision:1}}));assert.deepEqual(ok(await f.request(path+'/edit',{cookie:admin})).document,await read(site.editions.existingDraft));assert.deepEqual(ok(await f.request(path,{cookie:admin})).document,changed);
  assert.deepEqual((await f.db.prepare('SELECT website_id,revision,draft_key,published_key FROM websites WHERE website_id<>? ORDER BY website_id').bind(site.websiteId).all()).results,peers);
  checks.push({key:site.key,readings:site.lessons,privateDraftExact:true,originalPublicationPreserved:true,saveStayedPrivate:true,exactRetry:true,fixturePublishOnly:true,originalDraftRecoverable:true,peerWebsitesUnchanged:true});
 }
 const protectedPdf=manifest.sites.find(s=>s.key==='yaseen'),native=protectedPdf.materials[0].native[0],assetId='academy-asset-'+contentHash([protectedPdf.offeringId,native.sourceAssetId]),attachment=(await f.db.prepare('SELECT attachment_id FROM attachments WHERE website_id=? AND asset_id=? AND cohort=?').bind(protectedPdf.websiteId,assetId,native.cohorts[0]).first()).attachment_id;
 await f.run('INSERT INTO paid_months VALUES(?,?,?,?,?)','former',protectedPdf.offeringId,native.date.slice(0,7),native.cohorts[0],'Synthetic original purchase');
 assert.equal((await f.request('/api/media/'+attachment,{cookie:former,headers:{Range:'bytes=0-4'}})).status,206);
 await f.run('INSERT INTO surah_grants VALUES(?,?,?)','grant-only',protectedPdf.websiteId,'Synthetic website-only grant');assert.equal((await f.request('/api/websites/'+protectedPdf.websiteId,{cookie:grant})).status,200);assert.equal((await f.request('/api/media/'+attachment,{cookie:grant})).status,403);
 await f.run('DELETE FROM paid_months WHERE account_id=? AND offering_id=?','former',protectedPdf.offeringId);assert.equal((await f.request('/api/media/'+attachment,{cookie:former})).status,403);
 const course=manifest.sites.find(s=>s.kind==='COURSE'),coursePdf=(await f.db.prepare("SELECT a.attachment_id FROM attachments a JOIN objects o USING(asset_id) WHERE a.offering_id=? AND a.audience='RECORDING' AND o.mime_type='application/pdf' LIMIT 1").bind(course.offeringId).first()).attachment_id;
 await f.run('INSERT INTO participation VALUES(?,?,0,0,1,?)','former',course.offeringId,'');assert.equal((await f.request('/api/media/'+coursePdf,{cookie:former,headers:{Range:'bytes=0-4'}})).status,206);
 await assert.rejects(readReconciledEdition(bundle,course.websiteId,{edition:'reviewDraft',authorize:async()=>false}),/BUNDLE_CONTENT_FORBIDDEN/);assert.deepEqual(await readReconciledEdition(bundle,course.websiteId,{edition:'reviewDraft',authorize:async request=>request.admin}),await read(course.editions.reviewDraft));
 await assert.rejects(seedReconciledFixture(f,bundle,{validateDocument:validatePackage}),/EXISTING_WEBSITE_WOULD_BE_OVERWRITTEN/);
 assert.deepEqual((await f.db.prepare("SELECT * FROM websites WHERE website_id IN ('site-course','site-surah') ORDER BY website_id").all()).results,initialPeers);
 const report={date:'2026-10-30',nativeRuntime:true,localOnly:true,...seeded,checks,verifiedPdfRanges:ranges,resolvedNativeVideoReferences:videos,resolvedGuideBindings:boundGuides,maxMediaRowsRead:maxMediaReads,maxPrivateSaveRowsRead:maxEditReads,originalMonthClassRights:true,websiteOnlyGrantDeniedMedia:true,withdrawalImmediate:true,retainedWholeCoursePurchase:true,unmappedNotGranted:true,hostedCalls:0,academyQueriesDuringRehearsal:0,browserVisualVerified:false,browserPlaybackVerified:false,audioVerified:false};
 await writeFile(join(out,'circles-native-rehearsal.json'),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify({websites:checks.length,readings:checks.reduce((n,c)=>n+c.readings,0),pdfRanges:ranges,videoReferences:videos,maxMediaRowsRead:maxMediaReads,maxPrivateSaveRowsRead:maxEditReads,checks:'passed',hostedCalls:0}));
}finally{await f.close();}
