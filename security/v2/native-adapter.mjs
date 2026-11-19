import {Store} from '../../src/database.mjs';
import {liveAccess,academyAuthority} from '../../src/access.mjs';
import {mediaGate} from '../../src/media.mjs';
import {websiteAccess} from '../../src/content.mjs';
import {canonical,requireThat,reject,safeInt,ascii,bytes,b64u,sha256,vectorDigest} from './codec.mjs';

const pick=(row,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(row,k)).map(k=>[k,row[k]]));
const validId=value=>requireThat(typeof value==='string'&&bytes(value).length>0&&bytes(value).length<=180&&!/[\u0000-\u0020\u007f]/.test(value),'INVALID_NATIVE_ID',400);
function references(input){
 requireThat(Array.isArray(input)&&input.length>0&&input.length<=256,'NATIVE_DEPENDENCIES_REQUIRED',503);
 const out=input.map(r=>{requireThat(r&&ascii(r.id)&&ascii(r.ownerEpoch)&&typeof r.scope==='string'&&bytes(r.scope).length>0&&bytes(r.scope).length<=512,'INVALID_NATIVE_DEPENDENCY',503);return {id:r.id,scope:r.scope,ownerEpoch:r.ownerEpoch};});
 out.sort((a,b)=>a.id===b.id?(a.scope<b.scope?-1:a.scope>b.scope?1:0):a.id<b.id?-1:1);
 requireThat(out.every((r,i)=>i===0||r.id!==out[i-1].id||r.scope!==out[i-1].scope),'DUPLICATE_NATIVE_DEPENDENCY',503);return out;
}
async function localVector(db,refs){
 const rows=(await db.prepare("SELECT json_extract(j.value,'$.id') id,json_extract(j.value,'$.scope') scope,d.owner_epoch,d.revision FROM json_each(?) j LEFT JOIN jwt_v2_dependencies d ON d.id=json_extract(j.value,'$.id') AND d.scope=json_extract(j.value,'$.scope') ORDER BY id,scope").bind(JSON.stringify(refs)).all()).results;
 requireThat(rows.length===refs.length&&rows.every(r=>ascii(r.owner_epoch)&&safeInt(r.revision,1)),'NATIVE_DEPENDENCY_UNAVAILABLE',503);
 requireThat(rows.every(r=>refs.some(ref=>ref.id===r.id&&ref.scope===r.scope&&ref.ownerEpoch===r.owner_epoch)),'NATIVE_OWNER_EPOCH_RECONCILIATION_REQUIRED',503);
 const ownerVector=[];for(const r of rows)ownerVector.push([r.id+':'+b64u(await sha256(bytes(r.scope))).slice(0,22),r.owner_epoch,r.revision]);
 return {rows,ownerVector,vectorGuards:rows.map(r=>[r.id,r.scope,r.owner_epoch,r.revision]),pv:await vectorDigest(ownerVector)};
}
const bounded=rights=>{requireThat(bytes(canonical(rights)).length<=2*1024*1024,'NATIVE_RIGHTS_TOO_LARGE',503);return rights;};
const rowsBound=rows=>{requireThat(rows.length<=6000,'NATIVE_SCOPE_TOO_LARGE',503);return rows;};

export class StudioNativeAdapter {
 constructor({env,dependencies,clock=()=>Math.floor(Date.now()/1000)}){
  requireThat(env?.DB?.withSession&&typeof clock==='function','NATIVE_STUDIO_BINDING_REQUIRED',503);
  this.env=env;this.db=env.DB.withSession('first-primary');this.dependencies=references(dependencies);this.clock=clock;
 }
 async identity(sub){
  validId(sub);const row=await this.db.prepare('SELECT account_id,active,admitted,epoch,global_admin,verified_at FROM accounts WHERE account_id=?').bind(sub).first();
  requireThat(row&&row.active===1&&row.admitted===1,'STUDIO_ACCOUNT_INACTIVE',401);
  requireThat(safeInt(row.epoch,1)&&[0,1].includes(row.global_admin),'NATIVE_STUDIO_IDENTITY_INVALID',503);
  return Object.freeze({sub:row.account_id,sourceCredentialEpoch:row.epoch,globalAdmin:row.global_admin===1,sourceContactAtMs:row.verified_at});
 }
 identityGuard(identity){
  return {sql:'SELECT 1 FROM accounts WHERE account_id=? AND active=1 AND admitted=1 AND epoch=? AND global_admin=?',
   args:[identity.sub,identity.sourceCredentialEpoch,Number(identity.globalAdmin)]};
 }
 async scopeInputs(store,actor,offer){
  validId(offer);
  // Same native scope join used by Store.scope. These are inputs, not a new permission algorithm.
  const scope=await store.first("SELECT o.*,h.offering_id completed_course,(SELECT programme_key FROM programme_offerings mp WHERE mp.offering_id=o.offering_id) programme_key,p.enrolled,p.live,p.purchased,p.cohort,s.role,(SELECT access_model FROM course_access_models m WHERE m.offering_id=o.offering_id) access_model,s.can_create_account FROM offerings o LEFT JOIN participation p ON p.offering_id=o.offering_id AND p.account_id=? LEFT JOIN completed_course_registrations h USING(offering_id) LEFT JOIN staff s ON s.offering_id=o.offering_id AND s.account_id=? WHERE o.offering_id=? AND o.active=1",[actor.account_id,actor.account_id,offer]);
  requireThat(scope,'STUDIO_OFFERING_UNAVAILABLE',404);
  let source=null;
  if(academyAuthority(this.env)){
   source=await store.first('SELECT s.*,p.generation person_generation,p.verified_at,p.ready,p.windows_json,p.has_allocation,p.course FROM source_access_scopes s LEFT JOIN source_access_people p ON p.offering_id=s.offering_id AND p.account_id=? WHERE s.offering_id=?',[actor.account_id,offer]);
   const fence=await store.first('SELECT 1 FROM source_access_master_fences WHERE account_id=? AND offering_id=?',[actor.account_id,offer]);
   requireThat(!fence,'SOURCE_MASTER_RECONCILIATION_REQUIRED',503);
   requireThat(source&&source.enabled===1,'SOURCE_SCOPE_UNAVAILABLE',403);
   if(source.authority==='WEBSITE'){
    const handover=await store.first('SELECT phase FROM access_handovers WHERE offering_id=?',[offer]);
    requireThat(handover?.phase==='COMMITTED','HANDOVER_REQUIRED',409);
   }else{
    requireThat(source.authority==='ACADEMY','SOURCE_AUTHORITY_UNKNOWN',503);
    if(!(scope.kind==='COURSE'&&scope.access_model==='FREE'))requireThat(source.ready===1&&source.person_generation===source.generation,'SOURCE_PROJECTION_NOT_READY',503);
   }
   source={...source,studio:source.authority==='WEBSITE'};
  }
  const nativeScope={...scope,live_entitled:Boolean(scope.live)};
  let live=liveAccess(source,nativeScope,this.clock()*1000);if(scope.completed_course)live=false;
  const paid=rowsBound(await store.all('SELECT month,cohort FROM paid_months WHERE account_id=? AND offering_id=? ORDER BY month,cohort LIMIT 6001',[actor.account_id,offer]));
  const websiteMonths=rowsBound(await store.all('SELECT month FROM website_months WHERE account_id=? AND offering_id=? ORDER BY month LIMIT 6001',[actor.account_id,offer]));
  const surahs=rowsBound(await store.all('SELECT g.website_id FROM surah_grants g JOIN websites w USING(website_id) WHERE g.account_id=? AND w.offering_id=? ORDER BY g.website_id LIMIT 6001',[actor.account_id,offer]));
  const retained=rowsBound(await store.all('SELECT playlist_id,kind,source_month FROM mou_playlist_retained WHERE account_id=? AND offering_id=? ORDER BY playlist_id,kind,source_month LIMIT 6001',[actor.account_id,offer]));
  return {
   ...pick(scope,['offering_id','kind','active','programme_key','enrolled','purchased','cohort','role','can_create_account','access_model']),
   liveEntitled:Boolean(scope.live),liveNow:live,completedCourse:Boolean(scope.completed_course),
   paidMonths:paid,websiteMonths,surahGrants:surahs,mouRetained:retained,
   source:source?pick(source,['authority','generation','person_generation','enabled','live_enabled','ready','classes_json','windows_json','has_allocation','course','timezone','verified_at']):null
  };
 }
 async capture({sub,sourceCredentialEpoch,sourceParentRef,offeringIds=[]}){
  validId(sub);requireThat(safeInt(sourceCredentialEpoch,1),'SOURCE_CREDENTIAL_EPOCH_REQUIRED',503);
  requireThat(Array.isArray(offeringIds)&&offeringIds.length<=200&&new Set(offeringIds).size===offeringIds.length,'INVALID_NATIVE_SCOPE',400);
  offeringIds.forEach(validId);
  const vat=this.clock();requireThat(safeInt(vat),'NATIVE_CLOCK_REQUIRED',503);
  for(let attempt=0;attempt<2;attempt++){
   const before=await localVector(this.db,this.dependencies),identity=await this.identity(sub);
   requireThat(identity.sourceCredentialEpoch===sourceCredentialEpoch,'CREDENTIAL_CHANGED',401);
   const store=new Store({...this.env,DB:this.db});
   // Source parent is provenance from the already validated local family/proof, never browser input.
   const actor={account_id:identity.sub,global_admin:Number(identity.globalAdmin),verified_at:identity.sourceContactAtMs,source_ref:sourceParentRef||null};
   const scopes=[];for(const offer of offeringIds)scopes.push(await this.scopeInputs(store,actor,offer));
   const after=await localVector(this.db,this.dependencies),current=await this.identity(identity.sub);
   if(canonical(before.rows)!==canonical(after.rows)||canonical(identity)!==canonical(current))continue;
   const checkedAt=this.clock();requireThat(safeInt(checkedAt)&&checkedAt>=vat&&checkedAt<vat+900,'NATIVE_VALIDATION_EXPIRED',503);
   return {app:'studio',sub:identity.sub,sourceCredentialEpoch,rights:bounded({globalAdmin:identity.globalAdmin,scopes}),sourceProvenance:{contactAtMs:identity.sourceContactAtMs,freshContact:false},ownerVector:after.ownerVector,vectorGuards:after.vectorGuards,pv:after.pv,vat,primaryCheckedAt:checkedAt,timedUntil:Number.MAX_SAFE_INTEGER};
  }
  reject('NATIVE_AUTHORITY_CHANGED_DURING_CAPTURE',503);
 }
 async nativeWebsiteInputs({sub,sourceParentRef,websiteId}){
  const identity=await this.identity(sub),store=new Store({...this.env,DB:this.db});
  const row=await websiteAccess(store,{account_id:identity.sub,global_admin:Number(identity.globalAdmin),verified_at:identity.sourceContactAtMs,source_ref:sourceParentRef||null},websiteId);
  return pick(row,['website_id','offering_id','kind','active','enabled','completion_date','completion_month','revision','published_key','access_model','role','is_playlist','playlist_parent']);
 }
 async nativeMediaInputs({sub,sourceParentRef,attachmentId}){
  const identity=await this.identity(sub),store=new Store({...this.env,DB:this.db});
  const row=await mediaGate(store,{account_id:identity.sub,global_admin:Number(identity.globalAdmin),verified_at:identity.sourceContactAtMs,source_ref:sourceParentRef||null},attachmentId);
  return pick(row,['attachment_id','offering_id','website_id','asset_id','lesson_id','lesson_date','cohort','audience','published','kind','active','access_model','role','playlist_only','playlist_member']);
 }
}
export const studioNativeAdapterBoundary=Object.freeze({
 coldInput:'Owning local primary facts; no Academy network call and no fabricated source-contact timestamp.',
 resourceHooks:'nativeWebsiteInputs/nativeMediaInputs reuse original business gates, including legacy source-age checks. Canonical V2 handler composition must replace that age checkpoint with the validated V2 local lease; these hooks alone do not prove seven-day renewal or full browser acceptance.',
 transactions:'identityGuard plus vectorGuards are composed in the owning V2 family transaction. No V1 session or source_ref is minted by this adapter.'
});
