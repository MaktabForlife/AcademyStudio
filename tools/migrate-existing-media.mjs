// Existing-data migration only. No HTTP route, scheduled job or hosted launcher.
// The local restriction stays until a separately reviewed live migration release.
import {realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {Store} from '../src/database.mjs';
import {id} from '../src/protocol.mjs';
import {contentVersion} from '../src/content-package.mjs';
import {contentHash} from './reconciled-content.mjs';
import {planMediaPage,verifyLocalMedia} from './media-import-plan.mjs';

const check=(condition,message)=>{if(!condition)throw Error(message);};
const json=value=>JSON.stringify(value);
const fields=['attachment_id','offering_id','website_id','asset_id','lesson_id','lesson_date','cohort','title','audience','published'];
const objectFields=['asset_id','object_key','mime_type','filename','byte_size','sha256','youtube_id'];
const siteFields=['website_id','offering_id','draft_key','published_key','revision','enabled'];
const pick=(row,columns)=>Object.fromEntries(columns.map(k=>[k,row[k]]));
const ordered=(values,key)=>[...values].sort((a,b)=>a[key]<b[key]?-1:a[key]>b[key]?1:0);
const operation=(prefix,admissionId)=>prefix+'-'+contentHash(admissionId);
const sameRows=(actual,expected,key)=>isDeepStrictEqual(ordered(actual,key),ordered(expected,key));

// Assert that every observed row is still present/absent with the same values.
// json_each drives exact primary-key probes; unrelated table growth is irrelevant.
function snapshotGuard(table,columns,rows){
 const key=columns[0],different=columns.slice(1).map(k=>`t.${k} IS NOT json_extract(s.value,'$.${k}')`).join(' OR ');
 return {sql:`NOT EXISTS(SELECT 1 FROM json_each(?) s LEFT JOIN ${table} t ON t.${key}=json_extract(s.value,'$.${key}') WHERE (json_extract(s.value,'$.absent')=1 AND t.${key} IS NOT NULL) OR (coalesce(json_extract(s.value,'$.absent'),0)=0 AND (t.${key} IS NULL${different?' OR '+different:''})))`,args:[json(rows)]};
}

export function existingMediaMigration({env,actor,plan,receipt,stagedDirectory,openInventory}){
 check(env?.ENVIRONMENT==='local'&&env.AUTHORITY_MODE==='ACADEMY','LOCAL_EXISTING_DATA_MIGRATION_REQUIRED');
 plan=structuredClone(plan);receipt=structuredClone(receipt);
 check(typeof openInventory==='function'&&actor?.token_hash,'MIGRATION_OPERATOR_AND_SOURCE_REQUIRED');
 const {planSha256,...payload}=plan;
 check(plan.format==='CIRCLES_MEDIA_TRANSFER_PLAN_V1'&&plan.localOnly&&contentHash(payload)===planSha256,'MEDIA_TRANSFER_PLAN_CHANGED');
 check(receipt.format==='CIRCLES_MEDIA_STAGE_RECEIPT_V1'&&receipt.localOnly&&receipt.planSha256===planSha256,'MEDIA_STAGE_RECEIPT_CHANGED');
 check(plan.attachments.length<=250&&plan.objects.length<=250&&Buffer.byteLength(json(plan))<=500_000,'EXISTING_MEDIA_MIGRATION_LIMIT');
 const store=new Store(env),retirementId=admissionId=>operation('media-retire',admissionId),activationId=admissionId=>operation('media-activate',admissionId);
 const input=(action,operationId,offeringId,extra={})=>({action,operationId:id(operationId),offeringId,planSha256,...extra});
 const replay=async(offeringId,change)=>store.replay(actor.account_id,change.operationId,await store.requestHash(offeringId,change));
 const admitted=async admissionId=>{
  const row=await store.first('SELECT result_json FROM operations WHERE operation_id=?',[id(admissionId)]),result=row&&JSON.parse(row.result_json);
  check(result?.format==='EXISTING_MEDIA_ADMISSION_V1'&&result.planSha256===planSha256,'MEDIA_ADMISSION_REQUIRED');return result;
 };
 const scopeData=offeringId=>{
  id(offeringId);const source=plan.sources.find(s=>s.offeringId===offeringId),attachments=plan.attachments.filter(a=>a.offering_id===offeringId),assetIds=new Set(attachments.map(a=>a.asset_id));
  check(source&&attachments.length&&attachments.every(a=>a.audience==='RECORDING'&&a.published===0),'EXISTING_MEDIA_SCOPE_REQUIRED');
  const objects=plan.objects.filter(o=>assetIds.has(o.object.assetId));check(objects.length===assetIds.size&&objects.every(o=>['PDF','YOUTUBE'].includes(o.object.kind)),'EXISTING_MEDIA_OBJECT_REQUIRED');
  return {source,attachments,objects,websiteIds:[...new Set(attachments.map(a=>a.website_id).filter(Boolean))]};
 };
 const verifySource=async data=>{
  const inventory=await openInventory(data.source);
  check(inventory&&isDeepStrictEqual(inventory.source,data.source)&&inventory.inventoryId===contentHash(data.source),'MEDIA_SOURCE_SNAPSHOT_CHANGED');
  const associations=[...new Map(data.attachments.map(a=>{const asset=data.objects.find(o=>o.object.assetId===a.asset_id).object;return [json([a.lesson_id,asset.sourceAssetId]),{sourceLessonId:a.lesson_id,sourceAssetId:asset.sourceAssetId,...(a.website_id?{websiteId:a.website_id}:{offeringOnly:true})}];})).values()];
  const objects=new Map(),attachments=[];let after='',more=true,pages=0;
  while(more){
   check(++pages<=40,'MEDIA_INVENTORY_LIMIT');const page=await inventory.page({after,limit:25});
   check(isDeepStrictEqual(page.source,data.source)&&page.inventoryId===inventory.inventoryId,'MEDIA_SOURCE_SNAPSHOT_CHANGED');
   const selected=associations.filter(a=>page.lessons.some(l=>l.sourceLessonId===a.sourceLessonId));
   const current=planMediaPage(page,{associations:selected});for(const o of current.objects)objects.set(o.assetId,o);attachments.push(...current.attachments);
   more=page.more;const next=page.checkpoint?.afterLessonId;check(!more||typeof next==='string'&&next>after,'MEDIA_PAGE_CHECKPOINT_INVALID');after=next;
  }
  check(sameRows([...objects.values()],data.objects.map(o=>o.object),'assetId')&&sameRows(attachments,data.attachments,'attachment_id'),'MEDIA_SOURCE_ELIGIBILITY_CHANGED');
 };
 const verifyObject=async(row,bytes)=>{
  check(bytes&&bytes.size===row.byte_size,'MEDIA_TARGET_BYTES_MISSING');const hash=createHash('sha256');let size=0;
  for await(const chunk of bytes.body){size+=chunk.byteLength;check(size<=row.byte_size,'MEDIA_TARGET_BYTES_CHANGED');hash.update(chunk);}
  check(size===row.byte_size&&hash.digest('hex')===row.sha256,'MEDIA_TARGET_BYTES_CHANGED');
 };
 const copyObjects=async data=>{
  const root=await realpath(stagedDirectory),rows=[];
  for(const {object:o}of data.objects){
   if(o.kind==='YOUTUBE'){check(receipt.referenceOnly.some(r=>r.assetId===o.assetId&&r.youtubeId===o.youtubeId),'MEDIA_REFERENCE_RECEIPT_CHANGED');rows.push({asset_id:o.assetId,object_key:null,mime_type:'video/youtube',filename:o.filename,byte_size:0,sha256:null,youtube_id:o.youtubeId});continue;}
   const r=receipt.receipts.find(r=>r.assetId===o.assetId);check(r&&r.planSha256===planSha256&&r.objectSha256===contentHash(o)&&/^objects\/[a-f0-9]{64}\.pdf$/.test(r.stagedFile),'MEDIA_BYTES_RECEIPT_CHANGED');
   const file=await realpath(join(root,r.stagedFile));check(file.startsWith(root+'/'),'MEDIA_STAGE_PATH_INVALID');const verified=await verifyLocalMedia(o,file);
   check(verified.sha256===r.sha256&&verified.size===r.size&&verified.objectKey===r.objectKey,'MEDIA_BYTES_RECEIPT_CHANGED');
   const row={asset_id:o.assetId,object_key:r.objectKey,mime_type:'application/pdf',filename:o.filename,byte_size:r.size,sha256:r.sha256,youtube_id:null};
   let existing=await env.MEDIA.get(row.object_key);
   if(!existing){const chunks=[];let size=0;for await(const chunk of createReadStream(file,{highWaterMark:256*1024})){size+=chunk.length;check(size<=r.size&&size<=16*1024*1024,'MEDIA_STAGED_BYTES_CHANGED');chunks.push(chunk);}const bytes=Buffer.concat(chunks);check(bytes.length===r.size&&contentHash(bytes)===r.sha256,'MEDIA_STAGED_BYTES_CHANGED');await env.MEDIA.put(row.object_key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/pdf'},sha256:r.sha256});existing=await env.MEDIA.get(row.object_key);}
   await verifyObject(row,existing);rows.push(row);
  }
  return rows;
 };
 const targetSnapshot=async(data,objectRows)=>{
  const sites=await store.all(`SELECT w.* FROM json_each(?) j JOIN websites w ON w.website_id=j.value`,[json(data.websiteIds)]);
  check(sites.length===data.websiteIds.length&&sites.every(w=>w.offering_id===data.source.offeringId),'EXISTING_TARGET_WEBSITE_REQUIRED');
  for(const w of sites){
   const edition=plan.editions.find(e=>e.websiteId===w.website_id);check(edition&&contentVersion(w.published_key)===edition.published,'TARGET_PUBLISHED_EDITION_CHANGED');
   const object=await env.CONTENT.get(w.published_key);check(object&&object.size<=2_000_000&&contentHash(Buffer.from(await object.arrayBuffer()))===edition.published,'TARGET_PUBLISHED_BYTES_CHANGED');
  }
  const ids=json(objectRows.map(o=>o.asset_id)),existingObjects=await store.all('SELECT o.* FROM json_each(?) j JOIN objects o ON o.asset_id=j.value',[ids]);
  const owners=await store.all('SELECT x.asset_id FROM json_each(?) j JOIN asset_owners x ON x.asset_id=j.value AND x.offering_id=?',[ids,data.source.offeringId]);
  for(const o of existingObjects)check(objectRows.some(w=>isDeepStrictEqual(w,o))&&owners.some(x=>x.asset_id===o.asset_id),'TARGET_MEDIA_OWNERSHIP_OR_OBJECT_CONFLICT');
  const existingAttachments=await store.all('SELECT x.* FROM json_each(?) j JOIN attachments x ON x.attachment_id=j.value',[json(data.attachments.map(a=>a.attachment_id))]);
  for(const a of existingAttachments)check(data.attachments.some(w=>isDeepStrictEqual(pick(w,fields.slice(0,-1)),pick(a,fields.slice(0,-1)))),'TARGET_ATTACHMENT_CONFLICT');
  const scope=await store.first('SELECT s.*,o.kind FROM source_access_scopes s JOIN offerings o USING(offering_id) WHERE s.offering_id=?',[data.source.offeringId]);
  check(scope?.authority==='ACADEMY'&&scope.enabled===1&&scope.kind===data.source.kind,'ACADEMY_SOURCE_SCOPE_REQUIRED');
  return {sites:sites.map(w=>pick(w,siteFields)),objects:objectRows.map(o=>existingObjects.find(x=>x.asset_id===o.asset_id)||{asset_id:o.asset_id,absent:1}),
   owners:owners.map(o=>o.asset_id),attachments:data.attachments.map(a=>existingAttachments.find(x=>x.attachment_id===a.attachment_id)||{attachment_id:a.attachment_id,absent:1}),scope:{offering_id:scope.offering_id,generation:scope.generation,version:scope.version,kind:scope.kind}};
 };
 const guarded=snapshot=>{
  const parts=[snapshotGuard('websites',siteFields,snapshot.sites),snapshotGuard('objects',objectFields,snapshot.objects),snapshotGuard('attachments',fields,snapshot.attachments)];
  const owners=`NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM asset_owners x WHERE x.asset_id=j.value AND x.offering_id=?))`;
  const source=`EXISTS(SELECT 1 FROM source_access_scopes s JOIN offerings o USING(offering_id) WHERE s.offering_id=? AND s.generation=? AND s.version=? AND s.enabled=1 AND s.authority='ACADEMY' AND o.kind=?)`;
  return {global:true,expectedSQL:[...parts.map(p=>p.sql),owners,source].join(' AND '),expectedArgs:[...parts.flatMap(p=>p.args),json(snapshot.owners),snapshot.scope.offering_id,snapshot.scope.offering_id,snapshot.scope.generation,snapshot.scope.version,snapshot.scope.kind]};
 };
 return {store,
  async admit({offeringId,operationId}){
   const change=input('migrate-existing-media',operationId,offeringId),old=await replay(offeringId,change);if(old)return old;
   await store.scope(actor,offeringId,{admin:true});const data=scopeData(offeringId),objectRows=await copyObjects(data),snapshot=await targetSnapshot(data,objectRows);
   await verifySource(data);const statements=[];
   for(const row of objectRows)if(snapshot.objects.find(o=>o.asset_id===row.asset_id).absent){statements.push(store.statement('INSERT INTO objects VALUES(?,?,?,?,?,?,?)',objectFields.map(k=>row[k])),store.statement('INSERT INTO asset_owners VALUES(?,?)',[row.asset_id,offeringId]));}
   for(const row of data.attachments)if(snapshot.attachments.find(a=>a.attachment_id===row.attachment_id).absent)statements.push(store.statement('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?)',fields.map(k=>row[k])));
   const result={format:'EXISTING_MEDIA_ADMISSION_V1',admissionId:operationId,planSha256,offeringId,source:data.source,snapshot,objectRows,
    attachments:data.attachments.map(a=>pick(a,fields)),createdAttachmentIds:snapshot.attachments.filter(a=>a.absent).map(a=>a.attachment_id),
    mappings:data.objects.map(({object:o})=>({sourceAssetId:o.sourceAssetId,targetAssetId:o.assetId})),published:false};
   return store.mutate(actor,offeringId,change,statements,result,guarded(snapshot));
  },
  async activate({admissionId}){
   const admission=await admitted(admissionId),offeringId=admission.offeringId,change=input('activate-existing-media',activationId(admissionId),offeringId,{admissionId});
   const old=await replay(offeringId,change);if(old)return old;
   check(!await store.first('SELECT operation_id FROM operations WHERE operation_id=?',[retirementId(admissionId)]),'MEDIA_MIGRATION_RETIRED');
   await store.scope(actor,offeringId,{admin:true});const data=scopeData(offeringId),snapshot=await targetSnapshot(data,admission.objectRows);
   check(snapshot.attachments.every(a=>!a.absent)&&snapshot.objects.every(o=>!o.absent),'MEDIA_ADMISSION_INCOMPLETE');
   await copyObjects(data);await verifySource(data);
   const guard=guarded(snapshot);guard.expectedSQL+=' AND NOT EXISTS(SELECT 1 FROM operations WHERE operation_id=?)';guard.expectedArgs.push(retirementId(admissionId));
   const changed=snapshot.attachments.filter(a=>!a.published).map(a=>a.attachment_id),statements=changed.map(key=>store.statement('UPDATE attachments SET published=1 WHERE attachment_id=?',[key]));
   return store.mutate(actor,offeringId,change,statements,{format:'EXISTING_MEDIA_ACTIVATION_V1',admissionId,changedAttachmentIds:changed},guard);
  },
  async retire({admissionId,mode='ROLLBACK'}){
   check(['ROLLBACK','WITHDRAW'].includes(mode),'MEDIA_RETIREMENT_MODE_INVALID');const admission=await admitted(admissionId),change=input('retire-existing-media',retirementId(admissionId),admission.offeringId,{admissionId,mode});
   const old=await replay(null,change);if(old)return old;
   const activated=await store.first('SELECT result_json FROM operations WHERE operation_id=?',[activationId(admissionId)]),activation=activated&&JSON.parse(activated.result_json);
   const ids=mode==='WITHDRAW'?admission.attachments.map(a=>a.attachment_id):[...new Set([...admission.createdAttachmentIds,...(activation?.changedAttachmentIds||[])])];
   const current=await store.all('SELECT a.* FROM json_each(?) j JOIN attachments a ON a.attachment_id=j.value',[json(ids)]);
   check(current.length===ids.length&&current.every(a=>admission.attachments.some(w=>isDeepStrictEqual(pick(a,fields.slice(0,-1)),pick(w,fields.slice(0,-1))))),'MEDIA_RECOVERY_RECORD_CHANGED');
   const guard=snapshotGuard('attachments',fields,current);guard.sql+=' AND NOT EXISTS(SELECT 1 FROM operations WHERE operation_id=?)';guard.args.push(retirementId(admissionId));
   guard.sql+=` AND ${activated?'EXISTS':'NOT EXISTS'}(SELECT 1 FROM operations WHERE operation_id=?)`;guard.args.push(activationId(admissionId));
   return store.mutate(actor,null,change,current.filter(a=>a.published).map(a=>store.statement('UPDATE attachments SET published=0 WHERE attachment_id=?',[a.attachment_id])),
    {format:'EXISTING_MEDIA_RETIREMENT_V1',admissionId,mode,unpublishedAttachmentIds:ids,bytesRetained:true},{global:true,expectedSQL:guard.sql,expectedArgs:guard.args});
  }
 };
}
