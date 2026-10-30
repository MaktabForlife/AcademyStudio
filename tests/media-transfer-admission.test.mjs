import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fixture} from './fixture.mjs';
import {accessFixture,signIn} from './access-fixture.mjs';
import {sampleMediaTransfer} from './media-transfer-fixture.mjs';
import {buildCirclesMediaPlan} from '../tools/prepare-circles-media.mjs';
import {stageMediaTransfer} from '../tools/stage-media-transfer.mjs';
import {Store} from '../src/database.mjs';
import {sha256} from '../src/protocol.mjs';

// An admission contract rehearsal in disposable native D1/R2 only. This is not
// an operational importer, HTTP route or Academy-authority write exception.
test('staged originals rehearse guarded admission, separate publication and reversible withdrawal under Academy authority',async t=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY'}),directory=await mkdtemp(join(tmpdir(),'circles-native-transfer-'));
 try{
  const x=await accessFixture(f),data=sampleMediaTransfer();data.pages[0].source.activityKey=x.programA;
  data.pages[0].lessons[0].cohorts[0]='historic-cohort';
  const {contentHash}=await import('../tools/reconciled-content.mjs');data.pages[0].inventoryId=contentHash(data.pages[0].source);data.pages[0].checkpoint.inventoryId=data.pages[0].inventoryId;
  const plan=buildCirclesMediaPlan(data.bundle,data.copy,data.pages,{bundleSha256:'f'.repeat(64)}),source=join(directory,'source'),staged=join(directory,'staged');
  await mkdir(join(source,'objects'),{recursive:true,mode:0o700});for(const [i,file]of data.files.entries())await writeFile(join(source,file.file),data.originals[i],{mode:0o600});
  const receipt=await stageMediaTransfer(plan,{sourceRoot:source,destination:staged});
  for(const item of receipt.receipts)await f.media.put(item.objectKey,await readFile(join(staged,item.stagedFile)));
  const admin=await signIn(f,'global'),learner=await signIn(f),grant=await signIn(f,'studentB'),store=new Store({...f.env,DB:f.db}),actor=await store.actor(await sha256(admin.slice(admin.indexOf('=')+1)));
  const website=await f.db.prepare("SELECT * FROM websites WHERE website_id='site-surah'").first(),scope=await f.db.prepare("SELECT * FROM source_access_scopes WHERE offering_id='tafseer'").first();
  const rightsBefore=(await f.db.prepare('SELECT * FROM paid_months ORDER BY account_id,offering_id,month,cohort').all()).results;
  const statements=[];
  for(const {object}of plan.objects){
   const file=receipt.receipts.find(r=>r.assetId===object.assetId);
   statements.push(store.statement('INSERT INTO objects VALUES(?,?,?,?,?,?,?)',[object.assetId,file?.objectKey||null,file?.mimeType||'video/youtube',object.filename,file?.size||0,file?.sha256||null,object.youtubeId]));
   statements.push(store.statement('INSERT INTO asset_owners VALUES(?,?)',[object.assetId,'tafseer']));
  }
  for(const a of plan.attachments)statements.push(store.statement('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?)',[a.attachment_id,a.offering_id,a.website_id,a.asset_id,a.lesson_id,a.lesson_date,a.cohort,a.title,a.audience,a.published]));
  const expectedSQL=`EXISTS(SELECT 1 FROM websites WHERE website_id=? AND offering_id=? AND revision=? AND draft_key=? AND published_key=?) AND EXISTS(SELECT 1 FROM source_access_scopes WHERE offering_id=? AND generation=? AND version=? AND enabled=1 AND authority='ACADEMY')`;
  const options={expectedSQL,expectedArgs:['site-surah','tafseer',website.revision,website.draft_key,website.published_key,'tafseer',scope.generation,scope.version]};
  const input={operationId:crypto.randomUUID(),action:'local-media-admission-rehearsal',planSha256:plan.planSha256};
  const admit=()=>store.mutate(actor,'tafseer',input,statements,{admitted:true,published:false},options);
  await f.run('UPDATE accounts SET global_admin=0 WHERE account_id=?',actor.account_id);
  await assert.rejects(admit(),/permissions or this record changed/);assert.equal(await f.db.prepare('SELECT count(*) n FROM objects').first('n'),0,'Authority loss rolls back every metadata row');
  await f.run('UPDATE accounts SET global_admin=1 WHERE account_id=?',actor.account_id);
  await f.run("UPDATE websites SET revision=revision+1 WHERE website_id='site-surah'");
  await assert.rejects(admit(),/permissions or this record changed/);assert.equal(await f.db.prepare('SELECT count(*) n FROM attachments').first('n'),0,'A changed target edition rolls back the admission');
  await f.run("UPDATE websites SET revision=revision-1 WHERE website_id='site-surah'");
  f.source.resetMetrics();store.metrics={queries:0,rowsRead:0,rowsWritten:0};
  assert.equal((await admit()).published,false);const admissionMetrics={...store.metrics};assert.equal((await admit()).replayed,true);
  const item=plan.attachments.find(a=>a.cohort==='historic-cohort'&&plan.objects.find(o=>o.object.assetId===a.asset_id).object.kind==='PDF');
  assert.equal((await f.request('/api/media/'+item.attachment_id,{cookie:learner})).status,404,'Admission alone does not publish');
  const publish=plan.attachments.map(a=>store.statement('UPDATE attachments SET published=1 WHERE attachment_id=? AND published=0',[a.attachment_id]));
  await store.mutate(actor,'tafseer',{operationId:crypto.randomUUID(),action:'local-media-publication-rehearsal',planSha256:plan.planSha256},publish,{published:true},options);
  const range=await f.request('/api/media/'+item.attachment_id,{cookie:learner,headers:{Range:'bytes=0-4'}});assert.equal(range.status,206);assert.equal(Buffer.from(range.body).toString(),'%PDF-');
  assert.equal((await f.request('/api/media/'+item.attachment_id,{cookie:grant})).status,403,'Website-only grant still cannot open the original PDF');
  const wrongClass=plan.attachments.find(a=>a.asset_id===item.asset_id&&a.cohort==='second-class');assert.equal((await f.request('/api/media/'+wrongClass.attachment_id,{cookie:learner})).status,403);
  await store.mutate(actor,'tafseer',{operationId:crypto.randomUUID(),action:'local-media-withdrawal-rehearsal',planSha256:plan.planSha256},plan.attachments.map(a=>store.statement('UPDATE attachments SET published=0 WHERE attachment_id=?',[a.attachment_id])),{withdrawn:true},options);
  assert.equal((await f.request('/api/media/'+item.attachment_id,{cookie:learner})).status,404,'Withdrawn originals stop immediately');
  assert(await f.media.head(receipt.receipts[0].objectKey),'Withdrawal keeps the verified original for recovery');
  assert.deepEqual(await f.db.prepare("SELECT * FROM websites WHERE website_id='site-surah'").first(),website,'The website editions remain unchanged');
  assert.deepEqual((await f.db.prepare('SELECT * FROM paid_months ORDER BY account_id,offering_id,month,cohort').all()).results,rightsBefore,'Migration does not add or remove purchased rights');
  assert.equal(f.source.metrics.queries,0,'Admission and routine media do not poll Academy');assert(range.reads<=12);assert(admissionMetrics.rowsRead<=100);
  t.diagnostic(JSON.stringify({admission:admissionMetrics,targetPdfRangeRows:range.reads,routineAcademyRows:f.source.metrics.rowsRead,atomicAuthorityAndEditionGuards:true,rightsUnchanged:true,originalBytesRetained:true}));
 }finally{await f.close();await rm(directory,{recursive:true,force:true});}
});
