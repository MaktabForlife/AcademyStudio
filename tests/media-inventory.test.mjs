import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {fixture} from './fixture.mjs';import {accessFixture,signIn} from './access-fixture.mjs';
import {openMediaInventory} from '../../Academy-website-studio/backend/tools/website-media-inventory.mjs';
import {planMediaPage,verifyLocalMedia} from '../tools/media-import-plan.mjs';
const pdf=Buffer.from('%PDF-1.4\nSynthetic private original\n%%EOF'),checksum=createHash('sha256').update(pdf).digest('hex');

async function seedInventory(db,scope){
 const run=(sql,...v)=>db.prepare(sql).bind(...v).run(),head=await db.prepare('SELECT head_id FROM setup_head_state WHERE singleton=1').first('head_id'),batch='media-inventory-batch',next='media-inventory-head';
 const lessons=['a-published','b-hidden','c-draft','d-removed','e-unaccepted'].map(lesson_id=>({lesson_id,activity_key:scope,class_id:'historic-cohort',lesson_date:'2024-01-12',title:'Original historical lesson',start_time:'09:00',end_time:'10:00',teacher_id:null,teacher_name:'Original teacher',summary:'',state:lesson_id==='c-draft'?'DRAFT':'PUBLISHED',comments_closed:1,revision:1,source_publication_id:'original-publication',source_lessons_json:JSON.stringify([{classIds:['second-original-class']},{classIds:['ignored-later-class']}]),updated_at:'2026-10-29',session_key:JSON.stringify(['PROGRAM','2024-01-12',lesson_id]),run_id:'',teacher_ids_json:'[]',media_scope:'SESSION'}));
 const assets=[{asset_id:'original-pdf',activity_key:scope,kind:'PDF',youtube_id:null,object_key:'local/lesson-pdf-refs/11111111-1111-1111-1111-111111111111/'+checksum+'.pdf',filename:'Original.pdf',byte_size:pdf.length,created_at:'2024-01-12T10:00:00Z',display_name:'Original notes'},
  {asset_id:'original-video',activity_key:scope,kind:'YOUTUBE',youtube_id:'a1b2c3d4e5F',object_key:null,filename:'Recording',byte_size:null,created_at:'2024-01-12T10:00:00Z',display_name:'Original recording'}];
 const links=lessons.filter(l=>l.lesson_id!=='e-unaccepted').flatMap(l=>assets.map(a=>({lesson_id:l.lesson_id,asset_id:a.asset_id})));
 for(const [table,rows] of [['lesson_media_lessons',lessons],['lesson_media_assets',assets],['lesson_media_links',links]])for(const row of rows)await run(`INSERT INTO ${table}(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(()=>'?').join(',')})`,...Object.values(row));
 await run("INSERT INTO lesson_media_visibility(lesson_id,visible,updated_at) VALUES('b-hidden',0,'2026-10-29')");
 await run("DELETE FROM lesson_media_links WHERE lesson_id='d-removed'");
 await run("INSERT INTO setup_batches VALUES(?,'sep-global',?,1,?,'synthetic','{}','2026-10-29',?)",batch,JSON.stringify([scope]),head,next);
 await run("INSERT INTO setup_heads VALUES(?,?,?,'2026-10-29','sep-global')",next,head,batch);
 await run('INSERT INTO setup_head_components SELECT ?,table_name,scope_key,component_id FROM setup_head_components WHERE head_id=?',next,head);
 for(const [table,rows] of [['lesson_media_lessons',lessons.slice(0,4)],['lesson_media_assets',assets],['lesson_media_links',links]]){
  const component='inventory-'+table;
  await run('INSERT INTO setup_components VALUES(?,?,?,?,?,?,?)',component,batch,table,scope,JSON.stringify(rows),rows.length,'synthetic');
  await run('INSERT INTO setup_head_components VALUES(?,?,?,?)',next,table,scope,component);
 }
 await run('UPDATE setup_head_state SET head_id=? WHERE singleton=1',next);await run('UPDATE academy_write_state SET version=version+1 WHERE singleton=1');
 return {run,lessons,assets,next};
}

function measured(db,{onRead=async()=>{}}={}){
 const metrics={queries:0,rowsRead:0,rowsWritten:0},plans=[];
 return {metrics,plans,prepare(sql){let values=[];const wrapper={bind(...v){values=v;return wrapper;},async all(){const r=await db.prepare(sql).bind(...values).all();metrics.queries++;metrics.rowsRead+=r.meta.rows_read;metrics.rowsWritten+=r.meta.rows_written;plans.push({sql,reads:r.meta.rows_read});await onRead(sql);return r;},async first(column){const row=(await wrapper.all()).results[0];return column?row?.[column]??null:row||null;}};return wrapper;}};
}

test('accepted scoped inventory, private import plan and verified originals preserve paid media gates',async t=>{
 const f=await fixture({academy:true,authorityMode:'ACADEMY'}),directory=await mkdtemp(join(tmpdir(),'academy-media-test-'));
 try{
  const x=await accessFixture(f),{db,programA}=x;await seedInventory(db,programA);
  const counted=measured(db),inventory=await openMediaInventory(counted,{activityKey:programA,objectNamespace:'local/'}),page=await inventory.page();
  const baseline={...counted.metrics};assert(baseline.rowsRead<=100);assert.equal(baseline.rowsWritten,0);assert.equal(page.lessons.length,4);assert(!page.lessons.some(l=>l.sourceLessonId==='e-unaccepted'));
  assert.equal(page.lessons[1].state,'HIDDEN');assert.equal(page.lessons[2].state,'DRAFT');assert(page.lessons[3].assets.every(a=>!a.linked));
  assert.deepEqual(page.lessons[0].cohorts,['historic-cohort','second-original-class']);assert.equal(page.lessons[0].assets[0].resolvedObjectKey,'local/lesson-pdfs/sha256/'+checksum+'.pdf');
  const associations=page.lessons.map(l=>({sourceLessonId:l.sourceLessonId,websiteId:'site-surah'})),plan=planMediaPage(page,{associations});
  assert.equal(plan.objects.length,2);assert.equal(plan.attachments.length,4);assert.equal(plan.held.length,6);assert(plan.attachments.every(a=>a.published===0&&a.audience==='RECORDING'));
  assert.equal(plan.readyToPublish,false);assert.deepEqual(planMediaPage(page,{associations}),plan,'Exact plan retry is deterministic');
  assert.equal(planMediaPage(page).attachments.length,0,'No guessed website association');
  const original=join(directory,'Original.pdf');await writeFile(original,pdf);const object=plan.objects.find(o=>o.kind==='PDF'),verified=await verifyLocalMedia(object,original);
  assert.equal(verified.sha256,checksum);await f.media.put(verified.objectKey,pdf);
  // Synthetic admission ONLY: no production importer or publication endpoint is added.
  for(const o of plan.objects)await f.run('INSERT INTO objects VALUES(?,?,?,?,?,?,?)',o.assetId,o.kind==='PDF'?verified.objectKey:null,o.kind==='PDF'?'application/pdf':'video/youtube',o.filename,o.byteSize||0,o.kind==='PDF'?verified.sha256:null,o.youtubeId);
  for(const a of plan.attachments)await f.run('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,1)',a.attachment_id,a.offering_id,a.website_id,a.asset_id,a.lesson_id,a.lesson_date,a.cohort,a.title,a.audience);
  const learner=await signIn(f),grant=await signIn(f,'studentB'),attachment=plan.attachments.find(a=>a.asset_id===object.assetId&&a.cohort==='historic-cohort');
  f.source.resetMetrics();const opened=await f.request('/api/media/'+attachment.attachment_id,{cookie:learner});assert.equal(opened.status,200);assert.deepEqual(Buffer.from(opened.body),pdf);
  const range=await f.request('/api/media/'+attachment.attachment_id,{cookie:learner,headers:{Range:'bytes=5-13'}});assert.equal(range.status,206);assert.deepEqual(Buffer.from(range.body),pdf.subarray(5,14));assert(opened.reads<=12);assert(range.reads<=12);
  assert.equal((await f.request('/api/media/'+attachment.attachment_id,{cookie:grant})).status,403,'Website-only grant does not grant original recordings/PDFs');
  const wrongClass=plan.attachments.find(a=>a.asset_id===object.assetId&&a.cohort==='second-original-class');assert.equal((await f.request('/api/media/'+wrongClass.attachment_id,{cookie:learner})).status,403);
  assert.equal(f.source.metrics.queries,0,'Routine PDF/range/denial never calls Academy');
  const first=await inventory.page({limit:1}),second=await inventory.page({after:first.checkpoint.afterLessonId,limit:1});assert.equal(second.lessons[0].sourceLessonId,'b-hidden');
  const resumed=await openMediaInventory(db,{activityKey:programA,checkpoint:first.checkpoint});assert.equal((await resumed.page({limit:1})).lessons[0].sourceLessonId,'b-hidden');
  const unrelated=JSON.stringify(Array.from({length:4000},(_,i)=>'unrelated-component-'+i));
  await x.run("INSERT INTO setup_components SELECT value,'media-inventory-batch','lesson_media_lessons','PROGRAM:UNRELATED','[]',0,'synthetic' FROM json_each(?)",unrelated);
  await x.run("INSERT INTO setup_head_components SELECT 'media-inventory-head','lesson_media_lessons',value,value FROM json_each(?)",unrelated);
  await x.run(`INSERT INTO lesson_media_lessons(lesson_id,activity_key,class_id,lesson_date,title,start_time,end_time,teacher_name,state,updated_at)
   SELECT value,?,'historic-cohort','2024-01-12','Unaccepted unrelated media','09:00','10:00','','DRAFT','2026-10-29' FROM json_each(?)`,programA,unrelated);
  const after=measured(db),grown=await openMediaInventory(after,{activityKey:programA,objectNamespace:'local/'});await grown.page();
  assert(after.metrics.rowsRead<=baseline.rowsRead+2,JSON.stringify({baseline,grown:after.metrics,queries:after.plans}));assert.equal(after.metrics.rowsWritten,0);
  let raced=false;const racing=measured(db,{async onRead(sql){if(!raced&&sql.startsWith('SELECT lesson_id,asset_id')){raced=true;await x.run('UPDATE academy_write_state SET version=version+1 WHERE singleton=1');}}});
  const duringRead=await openMediaInventory(racing,{activityKey:programA});await assert.rejects(duringRead.page(),/MEDIA_SOURCE_CHANGED/,'A concurrent source edit discards the whole page');assert(raced);
  await assert.rejects(inventory.page(),/MEDIA_SOURCE_CHANGED/);
  await assert.rejects(openMediaInventory(db,{activityKey:programA,checkpoint:first.checkpoint}),/MEDIA_CHECKPOINT_CHANGED/);
  t.diagnostic(JSON.stringify({sourceInventory:baseline,after4000UnrelatedComponents:after.metrics,targetPdfRows:opened.reads,targetRangeRows:range.reads,routineAcademyRows:f.source.metrics.rowsRead}));
 }finally{await f.close();await rm(directory,{recursive:true,force:true});}
});

test('planner refuses ambiguous rights, malformed files and changed checksums without publishing',async()=>{
 const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const source={activityKey:'COURSE:EXAMPLE',offeringId:'course',kind:'COURSE'},asset={sourceAssetId:'asset',kind:'PDF',name:'Notes',filename:'Notes.pdf',byteSize:pdf.length,sourceObjectKey:'private/original',resolvedObjectKey:'private/original',expectedSha256:checksum,youtubeId:null,linked:true,sourceExpired:false},lesson={sourceLessonId:'course-collection',scope:'COURSE',date:'',title:'Course PDFs',state:'PUBLISHED',cohorts:[],assets:[asset],sessionKey:null,runId:'',publicationId:null,revision:1},page={format:'ACADEMY_MEDIA_INVENTORY_V1',inventoryId:hash(source),source,lessons:[lesson]},options={associations:[{sourceLessonId:lesson.sourceLessonId,websiteId:'site-course'}]};
 const directory=await mkdtemp(join(tmpdir(),'academy-media-validation-'));try{
  const plan=planMediaPage(page,options);assert.equal(plan.attachments[0].cohort,'');assert.equal(plan.attachments[0].lesson_date,'');assert.equal(plan.attachments[0].published,0);
  const clone=()=>structuredClone(page);let bad=clone();bad.source.kind='TAFSEER';bad.inventoryId=hash(bad.source);assert.throws(()=>planMediaPage(bad,options),/MEDIA_COURSE_COLLECTION_INVALID/);
  bad=clone();bad.lessons[0].scope='SESSION';bad.lessons[0].date='2024-01-12';bad.lessons[0].cohorts=[];bad.source.kind='TAFSEER';bad.inventoryId=hash(bad.source);assert(planMediaPage(bad,options).held[0].reasons.includes('HISTORICAL_CLASS_REQUIRED'));
  bad=clone();bad.source.offeringId='another-course';assert.throws(()=>planMediaPage(bad,options),/MEDIA_INVENTORY_DIGEST_CHANGED/);
  bad=clone();bad.lessons[0].assets[0].sourceExpired=true;assert(planMediaPage(bad,options).held[0].reasons.includes('SOURCE_RECORDING_EXPIRED'));
  bad=clone();bad.lessons[0].assets.push({...asset,name:'Conflicting duplicate'});assert.throws(()=>planMediaPage(bad,options),/MEDIA_ASSET_DUPLICATE/);
  assert.throws(()=>planMediaPage(page,{associations:[...options.associations,...options.associations]}),/MEDIA_MAPPING_DUPLICATE/);
  const file=join(directory,'changed.pdf');await writeFile(file,Buffer.from(pdf.toString().replace('original','modified')));
  await assert.rejects(verifyLocalMedia(plan.objects[0],file),/MEDIA_BYTES_CHECKSUM_CHANGED/);
  await writeFile(file,Buffer.alloc(pdf.length));await assert.rejects(verifyLocalMedia(plan.objects[0],file),/MEDIA_BYTES_TYPE_CHANGED/);
  await writeFile(file,pdf.subarray(0,10));await assert.rejects(verifyLocalMedia(plan.objects[0],file),/MEDIA_BYTES_SIZE_CHANGED/);
  await writeFile(file,Buffer.concat([pdf,pdf]));await assert.rejects(verifyLocalMedia(plan.objects[0],file),/MEDIA_BYTES_TOO_LARGE/);
  const mp4=Buffer.concat([Buffer.from([0,0,0,20]),Buffer.from('ftypisom'),Buffer.alloc(512*1024)]),video={...plan.objects[0],kind:'MP4',byteSize:mp4.length,expectedSha256:null};
  await writeFile(file,mp4);const verified=await verifyLocalMedia(video,file);assert.equal(verified.mimeType,'video/mp4');assert.equal(verified.size,mp4.length);
  const another={...plan.objects[0],assetId:'different-attachment'};await writeFile(file,pdf);assert.equal((await verifyLocalMedia(another,file)).objectKey,(await verifyLocalMedia(plan.objects[0],file)).objectKey,'Identical bytes share a storage key while attachment identities stay independent');
 }finally{await rm(directory,{recursive:true,force:true});}
});
