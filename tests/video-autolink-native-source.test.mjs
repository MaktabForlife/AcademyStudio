import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {Store} from '../src/database.mjs';
import {sha256} from '../src/protocol.mjs';
import {nativeProcessingSource} from '../src/video-autolink/native-source.mjs';
async function setup(){
 const f=await fixture();
 await f.run("INSERT INTO objects VALUES('processing-asset',NULL,'video/youtube','Synthetic recording',0,NULL,'abcdefghijk')");
 await f.run("INSERT INTO asset_owners VALUES('processing-asset','course')");
 await f.run("INSERT INTO attachments VALUES('processing-attachment','course','site-course','processing-asset','processing-lesson','2026-11-06','','Synthetic recording','RECORDING',0)");
 await f.run("INSERT INTO media_attributions VALUES('processing-attachment',1,?,NULL)",JSON.stringify({teacherIds:['teacher'],recordingTitle:'Synthetic recording'}));
 const login=await f.login('admin'),hash=await sha256(login.cookie.split('=')[1]),env={...f.env,DB:f.db,VIDEO_AUTOLINK_ENABLED:'1'};
 const store=()=>new Store(env),actor=await store().actor(hash);return {...f,env,store,actor};
}
test('default-disabled source boundary performs no DB or storage work',async()=>{
 let reads=0;await assert.rejects(nativeProcessingSource({},new Proxy({},{get(){reads++;throw Error('No query');}}),{},'course',{attachmentId:'x'}),e=>e.code==='PROCESSOR_DISABLED');assert.equal(reads,0);
});
test('actual native admin/media guards resolve exact permanent destination without inventing upload provenance',async()=>{
 const f=await setup();try{
  const source=await nativeProcessingSource(f.env,f.store(),f.actor,'course',{attachmentId:'processing-attachment',policy:'TEMPORARY_ACADEMIC',originalIngestedAt:Date.now(),style:'MOU'});
  assert.equal(source.attachmentId,'processing-attachment');assert.equal(source.websiteId,'site-course');assert.equal(source.style,'ACADEMIC');assert.equal(source.retentionPolicy,'PERMANENT_STUDIO_RETAINED');assert.equal(source.originalIngestedAt,null);assert.equal(source.originalIngestionProved,false);assert(!JSON.stringify(source).includes('SELECT'));assert(!JSON.stringify(source).includes('objectKey'));
  const other=await f.login('learner'),actor=await f.store().actor(await sha256(other.cookie.split('=')[1]));await assert.rejects(nativeProcessingSource(f.env,f.store(),actor,'course',{attachmentId:'processing-attachment'}));
  await assert.rejects(nativeProcessingSource(f.env,f.store(),f.actor,'tafseer',{attachmentId:'processing-attachment'}));
 }finally{await f.close();}
});
test('prepared native DB source tuple fences changed asset/association/attribution/Admin draft before a mutation',async t=>{
 for(const [name,sql,args]of [
  ['source identity',"UPDATE objects SET youtube_id='lmnopqrstuv' WHERE asset_id='processing-asset'",[]],
  ['exact destination',"UPDATE attachments SET lesson_id='other-lesson' WHERE attachment_id='processing-attachment'",[]],
  ['teacher draft',"UPDATE media_attributions SET revision=2,draft_json='{}' WHERE attachment_id='processing-attachment'",[]],
  ['saved Admin companion',"INSERT INTO recording_companions VALUES('processing-attachment',?,1,'synthetic-private-draft',NULL,NULL,60)",['a'.repeat(64)]],
  ['master fence',"INSERT INTO source_access_master_fences VALUES('admin','course',1,1,1,1)",[]],
  ['native credential epoch',"UPDATE accounts SET epoch=epoch+1 WHERE account_id='admin'",[]]
 ]){
  await t.test(name,async()=>{const f=await setup();try{
   const store=f.store(),source=await nativeProcessingSource(f.env,store,f.actor,'course',{attachmentId:'processing-attachment'});await f.run(sql,...args);
   await assert.rejects(store.mutate(f.actor,'course',{action:'synthetic-processing-fence',operationId:crypto.randomUUID()},[store.statement("UPDATE attachments SET title='Incorrect overwrite' WHERE attachment_id='processing-attachment'")],{saved:true},{studio:true,...source.fence}));
   assert.equal((await f.db.prepare("SELECT title FROM attachments WHERE attachment_id='processing-attachment'").first()).title,'Synthetic recording');
   assert.equal((await f.db.prepare("SELECT count(*) n FROM operations WHERE result_json=?").bind(JSON.stringify({saved:true})).first()).n,0);
  }finally{await f.close();}});
 }
});
test('unchanged tuple uses real owning mutation/audit and scoped source still cannot authorise publication or R2 bytes',async()=>{
 const f=await setup();try{
  const store=f.store(),source=await nativeProcessingSource(f.env,store,f.actor,'course',{attachmentId:'processing-attachment'}),operationId=crypto.randomUUID();
  const result=await store.mutate(f.actor,'course',{action:'synthetic-processing-fence',operationId},[],{checked:true},{studio:true,...source.fence});assert.deepEqual(result,{checked:true});
  assert.equal((await f.db.prepare("SELECT count(*) n FROM operations WHERE operation_id=?").bind(operationId).first()).n,1);
  assert.equal((await f.db.prepare("SELECT published FROM attachments WHERE attachment_id='processing-attachment'").first()).published,0);
  assert.equal(source.r2Version,undefined);assert.equal(source.audioVerified,undefined);
 }finally{await f.close();}
});
