// Account-owner migration operations only; never imported by a Worker.
import {isDeepStrictEqual} from 'node:util';
import {contentHash} from './reconciled-content.mjs';
import {objectFields,attachmentFields,pick,verifyAdmission,admissionVerification} from './existing-media-control-plane.mjs';

const check=(v,m)=>{if(!v)throw Error(m);},json=JSON.stringify;
const statement=(sql,...params)=>({sql,params});
const siteFields=['website_id','offering_id','draft_key','published_key','revision','enabled'];
const scopeFields=['offering_id','authority','generation','version','enabled'];
const actorId='CLOUDFLARE_ACCOUNT_MIGRATION_OPERATOR';
function unchanged(table,fields,rows){
 const key=fields[0],different=fields.slice(1).map(k=>`t.${k} IS NOT json_extract(j.value,'$.${k}')`).join(' OR ');
 return statement(`NOT EXISTS(SELECT 1 FROM json_each(?) j LEFT JOIN ${table} t ON t.${key}=json_extract(j.value,'$.${key}') WHERE t.${key} IS NULL OR ${different})`,json(rows));
}
function admitted(admission){
 const r=admission.result,{format,operationId,actorId:actor,payloadHash,published,createdAt,...proof}=r;
 check(format==='EXISTING_MEDIA_CONTROL_PLANE_ADMISSION_V1'&&actor===actorId&&published===false&&operationId===admission.operationId&&payloadHash===admission.payloadHash&&contentHash(proof)===payloadHash,'ADMISSION_RECEIPT_CHANGED');
 check(r.objects.length===49&&r.attachments.length===49&&r.sites.length===9&&r.scopes.length===2,'EXISTING_MEDIA_SCOPE_CHANGED');
 return r;
}
export const publicationIds=admission=>({activation:'cf-existing-media-activate-'+admitted(admission).planSha256,retirement:'cf-existing-media-retire-'+admitted(admission).planSha256});
export function publicationPreflight(admission){
 const r=admitted(admission),ids=publicationIds(admission);
 return [...admissionVerification(admission),statement('SELECT s.offering_id,s.authority,s.generation,s.version,s.enabled,o.kind FROM json_each(?) j JOIN source_access_scopes s ON s.offering_id=j.value JOIN offerings o USING(offering_id)',json(r.scopes.map(s=>s.offering_id))),statement('SELECT operation_id,payload_hash,result_json FROM operations WHERE operation_id IN(?,?)',ids.activation,ids.retirement)];
}
function mutation({admission,action,operationId,result,guards,updates,now}){
 const payloadHash=contentHash(result),full={...result,payloadHash},guardId=operationId+'-guard';
 return {operationId,payloadHash,result:full,batch:[
  statement(`INSERT INTO guards(guard_id,accepted) SELECT ?,CASE WHEN ${guards.map(g=>'('+g.sql+')').join(' AND ')} THEN 1 ELSE 0 END`,guardId,...guards.flatMap(g=>g.params)),
  ...updates,
  statement('INSERT INTO operations(operation_id,actor_id,payload_hash,result_json,created_at) VALUES(?,?,?,?,?)',operationId,actorId,payloadHash,json(full),now),
  statement('INSERT INTO audit(event_id,actor_id,action,scope,occurred_at,details_json) VALUES(?,?,?,?,?,?)',operationId,actorId,action,'CIRCLES_EXISTING_DATA',now,json({admissionId:admission.operationId,planSha256:admission.result.planSha256,payloadHash,attachments:result.changedAttachmentIds.length,authority:'CLOUDFLARE_ACCOUNT_OWNER'})),
  statement('DELETE FROM guards WHERE guard_id=?',guardId)]};
}
export function controlPlaneActivation({admission,current,sourceProof,byteReceipts,editionReceipts,now=Date.now()}){
 const r=admitted(admission),ids=publicationIds(admission),sites=current[3].results.map(s=>pick(s,siteFields)),scopes=current[5].results;
 check(current[6].results.length===0,'PUBLICATION_ALREADY_RECORDED_OR_RETIRED');
 check(sites.length===9&&sites.every(s=>{const old=r.sites.find(x=>x.website_id===s.website_id);return old&&s.offering_id===old.offering_id&&s.published_key===old.published_key&&s.enabled===1;}),'PUBLISHED_WEBSITES_CHANGED');
 // Private drafts may have advanced, but are never changed or published here.
 verifyAdmission(current,{...admission,result:{...r,sites}});
 check(scopes.length===2&&scopes.every(s=>{const old=r.scopes.find(x=>x.offering_id===s.offering_id);return old&&s.authority==='ACADEMY'&&s.enabled===1&&s.generation===old.generation&&s.kind===old.kind;}),'ACADEMY_AUTHORITY_CHANGED');
 const fresh=at=>Number.isFinite(Date.parse(at))&&Date.parse(at)<=now+30_000&&Date.parse(at)>=now-900_000;
 check(sourceProof?.current===true&&sourceProof.planSha256===r.planSha256&&sourceProof.objects===49&&sourceProof.attachments===49&&fresh(sourceProof.checkedAt),'FRESH_SOURCE_ELIGIBILITY_REQUIRED');
 const pdfs=r.objects.filter(o=>o.mime_type==='application/pdf');
 check(byteReceipts?.length===11&&pdfs.every(o=>byteReceipts.some(b=>b.assetId===o.asset_id&&b.objectKey===o.object_key&&b.sha256===o.sha256&&b.size===o.byte_size&&b.verified===true&&fresh(b.checkedAt))),'FRESH_PDF_BYTES_REQUIRED');
 check(editionReceipts?.length===9&&sites.every(s=>editionReceipts.some(e=>e.websiteId===s.website_id&&e.key===s.published_key&&s.published_key.endsWith('/'+e.sha256+'.json')&&e.verified===true&&fresh(e.checkedAt))),'FRESH_PUBLISHED_BYTES_REQUIRED');
 const changed=r.attachments.map(a=>a.attachment_id),guards=[
  unchanged('websites',siteFields,sites),unchanged('objects',objectFields,r.objects),unchanged('asset_owners',['asset_id','offering_id'],r.owners),unchanged('attachments',attachmentFields,r.attachments),unchanged('source_access_scopes',scopeFields,scopes.map(s=>pick(s,scopeFields))),unchanged('offerings',['offering_id','kind'],scopes.map(s=>pick(s,['offering_id','kind']))),
  statement('EXISTS(SELECT 1 FROM operations WHERE operation_id=? AND payload_hash=?)',admission.operationId,admission.payloadHash),statement('NOT EXISTS(SELECT 1 FROM operations WHERE operation_id IN(?,?))',ids.activation,ids.retirement)];
 const result={format:'EXISTING_MEDIA_CONTROL_PLANE_ACTIVATION_V1',operationId:ids.activation,admissionId:admission.operationId,planSha256:r.planSha256,changedAttachmentIds:changed,sourceProof,sites,scopes,createdAt:now};
 return mutation({admission,action:'activate-existing-media',operationId:ids.activation,result,guards,updates:[statement('UPDATE attachments SET published=1 WHERE attachment_id IN(SELECT value FROM json_each(?))',json(changed))],now});
}
export function controlPlaneRetirement({admission,activation,currentAttachments,now=Date.now()}){
 const r=admitted(admission),ids=publicationIds(admission),{payloadHash,...proof}=activation.result;
 check(activation.operationId===ids.activation&&activation.result.admissionId===admission.operationId&&payloadHash===activation.payloadHash&&contentHash(proof)===payloadHash,'ACTIVATION_RECEIPT_CHANGED');
 const changed=activation.result.changedAttachmentIds;
 check(currentAttachments.length===changed.length&&currentAttachments.every(a=>changed.includes(a.attachment_id)&&[0,1].includes(a.published)&&r.attachments.some(o=>isDeepStrictEqual(pick(o,attachmentFields.slice(0,-1)),pick(a,attachmentFields.slice(0,-1))))),'RECOVERY_ATTACHMENT_CHANGED');
 const guards=[unchanged('attachments',attachmentFields,currentAttachments.map(a=>pick(a,attachmentFields))),statement('EXISTS(SELECT 1 FROM operations WHERE operation_id=? AND payload_hash=?)',ids.activation,activation.payloadHash),statement('NOT EXISTS(SELECT 1 FROM operations WHERE operation_id=?)',ids.retirement)];
 return mutation({admission,action:'retire-existing-media',operationId:ids.retirement,result:{format:'EXISTING_MEDIA_CONTROL_PLANE_RETIREMENT_V1',operationId:ids.retirement,admissionId:admission.operationId,changedAttachmentIds:changed,bytesRetained:true,createdAt:now},guards,updates:[statement('UPDATE attachments SET published=0 WHERE attachment_id IN(SELECT value FROM json_each(?))',json(changed))],now});
}
