// Operator-only transaction builder. No credentials, HTTP routes or Worker imports.
// Execution requires separate approval and an authenticated account-owner adapter.
import {isDeepStrictEqual} from 'node:util';
import {contentHash} from './reconciled-content.mjs';

const check=(v,message)=>{if(!v)throw Error(message);};
export const objectFields=['asset_id','object_key','mime_type','filename','byte_size','sha256','youtube_id'];
export const attachmentFields=['attachment_id','offering_id','website_id','asset_id','lesson_id','lesson_date','cohort','title','audience','published'];
const siteFields=['website_id','offering_id','draft_key','published_key','revision','enabled'];
export const pick=(row,fields)=>Object.fromEntries(fields.map(k=>[k,row[k]]));
const statement=(sql,...params)=>({sql,params});
const json=JSON.stringify;
function unchanged(table,fields,rows){
 const key=fields[0],different=fields.slice(1).map(k=>`t.${k} IS NOT json_extract(j.value,'$.${k}')`).join(' OR ');
 return statement(`NOT EXISTS(SELECT 1 FROM json_each(?) j LEFT JOIN ${table} t ON t.${key}=json_extract(j.value,'$.${key}') WHERE t.${key} IS NULL OR ${different})`,json(rows));
}

export function controlPlaneAdmission({plan,receipt,target,byteReceipts,now=Date.now()}){
 const {planSha256,...payload}=plan;
 check(plan.format==='CIRCLES_MEDIA_TRANSFER_PLAN_V1'&&plan.migrationPhase==='EXISTING_DATA_ONLY'&&contentHash(payload)===planSha256,'PLAN_CHANGED');
 check(receipt.planSha256===planSha256&&target.planSha256===planSha256&&target.knownWebsitesMatch&&target.sourceScopesEnabled,'PREFLIGHT_REQUIRED');
 check(plan.sources.length===2&&plan.editions.length===9&&plan.objects.length===49&&plan.attachments.length===49,'APPROVED_SCOPE_CHANGED');
 check(target.existingPlannedAssets===0&&target.existingPlannedAttachments===0,'TARGET_MEDIA_ALREADY_EXISTS');
 check(new Set(plan.objects.map(x=>x.object.assetId)).size===49&&new Set(plan.attachments.map(x=>x.attachment_id)).size===49,'DUPLICATE_MEDIA');
 const sites=target.results[0].results.map(x=>pick(x,siteFields)),scopes=target.results[1].results;
 check(sites.length===9&&scopes.length===2,'TARGET_SCOPE_CHANGED');
 for(const e of plan.editions){const s=sites.find(s=>s.website_id===e.websiteId);check(s&&s.enabled===1&&s.published_key===`websites/${e.websiteId}/versions/${e.published}.json`&&s.draft_key===`websites/${e.websiteId}/versions/${e.existingDraft}.json`,'TARGET_EDITION_CHANGED');}
 for(const s of plan.sources){const t=scopes.find(x=>x.offering_id===s.offeringId);check(t&&t.authority==='ACADEMY'&&t.enabled===1&&t.generation===s.generation&&t.kind===s.kind,'TARGET_AUTHORITY_CHANGED');}
 const objects=plan.objects.map(({object:o})=>{
  if(o.kind==='YOUTUBE'){
   check(receipt.referenceOnly.some(r=>r.assetId===o.assetId&&r.youtubeId===o.youtubeId)&&/^[A-Za-z0-9_-]{11}$/.test(o.youtubeId),'REFERENCE_CHANGED');
   return {asset_id:o.assetId,object_key:null,mime_type:'video/youtube',filename:o.filename,byte_size:0,sha256:null,youtube_id:o.youtubeId};
  }
  const r=receipt.receipts.find(r=>r.assetId===o.assetId),b=byteReceipts.find(b=>b.assetId===o.assetId);
  check(o.kind==='PDF'&&r&&b&&r.objectSha256===contentHash(o)&&r.planSha256===planSha256&&b.sha256===r.sha256&&b.size===r.size&&b.verified===true,'PDF_BYTES_REQUIRED');
  check(b.objectKey===`imports/academy/circles-existing-${planSha256}/${r.sha256}.pdf`,'MIGRATION_NAMESPACE_REQUIRED');
  return {asset_id:o.assetId,object_key:b.objectKey,mime_type:'application/pdf',filename:o.filename,byte_size:r.size,sha256:r.sha256,youtube_id:null};
 });
 check(byteReceipts.length===11&&objects.filter(o=>o.mime_type==='video/youtube').length===38,'APPROVED_MEDIA_COUNTS_CHANGED');
 const attachments=plan.attachments.map(a=>pick(a,attachmentFields));
 for(const a of attachments){check(a.audience==='RECORDING'&&a.published===0&&objects.some(o=>o.asset_id===a.asset_id)&&scopes.some(s=>s.offering_id===a.offering_id)&&(!a.website_id||sites.some(s=>s.website_id===a.website_id&&s.offering_id===a.offering_id)),'PRIVATE_ATTACHMENT_REQUIRED');}
 const owners=[...new Map(attachments.map(a=>[json([a.asset_id,a.offering_id]),{asset_id:a.asset_id,offering_id:a.offering_id}])).values()];
 check(owners.length===49&&attachments.filter(a=>!a.website_id).length===6,'APPROVED_OWNERSHIP_CHANGED');
 const operationId='cf-existing-media-'+planSha256,actorId='CLOUDFLARE_ACCOUNT_MIGRATION_OPERATOR';
 const proof={planSha256,objects,owners,attachments,sites,scopes},payloadHash=contentHash(proof);
 const result={format:'EXISTING_MEDIA_CONTROL_PLANE_ADMISSION_V1',operationId,actorId,payloadHash,...proof,published:false,createdAt:now};
 const guardId=operationId+'-guard',guards=[unchanged('websites',siteFields,sites),
  unchanged('source_access_scopes',['offering_id','authority','generation','version','enabled'],scopes.map(s=>pick(s,['offering_id','authority','generation','version','enabled']))),
  unchanged('offerings',['offering_id','kind'],scopes.map(s=>pick(s,['offering_id','kind']))),
  statement('NOT EXISTS(SELECT 1 FROM json_each(?) j JOIN objects o ON o.asset_id=j.value)',json(objects.map(o=>o.asset_id))),
  statement('NOT EXISTS(SELECT 1 FROM json_each(?) j JOIN attachments a ON a.attachment_id=j.value)',json(attachments.map(a=>a.attachment_id))),
  statement('NOT EXISTS(SELECT 1 FROM operations WHERE operation_id=?)',operationId)];
 const bulk=(table,fields,rows)=>statement(`INSERT INTO ${table} (${fields.join(',')}) SELECT ${fields.map(k=>`json_extract(j.value,'$.${k}')`).join(',')} FROM json_each(?) j`,json(rows));
 const batch=[statement(`INSERT INTO guards(guard_id,accepted) SELECT ?,CASE WHEN ${guards.map(g=>'('+g.sql+')').join(' AND ')} THEN 1 ELSE 0 END`,guardId,...guards.flatMap(g=>g.params)),
  bulk('objects',objectFields,objects),bulk('asset_owners',['asset_id','offering_id'],owners),bulk('attachments',attachmentFields,attachments),
  statement('INSERT INTO operations(operation_id,actor_id,payload_hash,result_json,created_at) VALUES(?,?,?,?,?)',operationId,actorId,payloadHash,json(result),now),
  statement('INSERT INTO audit(event_id,actor_id,action,scope,occurred_at,details_json) VALUES(?,?,?,?,?,?)',operationId,actorId,'import-existing-private-media','CIRCLES_EXISTING_DATA',now,json({planSha256,payloadHash,objects:49,pdfs:11,references:38,attachments:49,published:false,authority:'CLOUDFLARE_ACCOUNT_OWNER'})),
  statement('DELETE FROM guards WHERE guard_id=?',guardId)];
 return {operationId,payloadHash,result,batch};
}

export function verifyAdmission(rows,admission){
 const sort=(a,key)=>[...a].sort((x,y)=>json(key.map(k=>x[k])).localeCompare(json(key.map(k=>y[k]))));
 const same=(a,b,key)=>isDeepStrictEqual(sort(a,key),sort(b,key));
 check(same(rows[0].results.map(o=>pick(o,objectFields)),admission.result.objects,['asset_id']),'IMPORTED_OBJECTS_CHANGED');
 check(same(rows[1].results,admission.result.owners,['asset_id','offering_id']),'IMPORTED_OWNERSHIP_CHANGED');
 check(same(rows[2].results.map(a=>pick(a,attachmentFields)),admission.result.attachments,['attachment_id']),'IMPORTED_ATTACHMENTS_CHANGED');
 check(same(rows[3].results.map(s=>pick(s,siteFields)),admission.result.sites,['website_id']),'WEBSITE_EDITIONS_CHANGED');
 check(rows[4].results.length===1&&rows[4].results[0].payload_hash===admission.payloadHash,'IMPORT_RECEIPT_MISSING');
 return {objects:rows[0].results.length,owners:rows[1].results.length,attachments:rows[2].results.length,publishedAttachments:rows[2].results.filter(a=>a.published).length,websitesUnchanged:9};
}

export function admissionVerification(admission){
 const assets=json(admission.result.objects.map(o=>o.asset_id)),atts=json(admission.result.attachments.map(a=>a.attachment_id)),sites=json(admission.result.sites.map(s=>s.website_id));
 return [statement('SELECT o.* FROM json_each(?) j JOIN objects o ON o.asset_id=j.value',assets),
  statement('SELECT o.asset_id,o.offering_id FROM json_each(?) j JOIN asset_owners o ON o.asset_id=j.value',assets),
  statement('SELECT a.* FROM json_each(?) j JOIN attachments a ON a.attachment_id=j.value',atts),
  statement('SELECT w.* FROM json_each(?) j JOIN websites w ON w.website_id=j.value',sites),
  statement('SELECT payload_hash FROM operations WHERE operation_id=?',admission.operationId)];
}
