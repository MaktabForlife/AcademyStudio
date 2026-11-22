import {readStudioSourceAuthority} from '../../src/v111-source-authority.mjs';
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
const vectorSQL="SELECT json_extract(j.value,'$.id') id,json_extract(j.value,'$.scope') scope,d.owner_epoch,d.revision FROM json_each(?) j LEFT JOIN jwt_v2_dependencies d ON d.id=json_extract(j.value,'$.id') AND d.scope=json_extract(j.value,'$.scope') ORDER BY id,scope";
async function localVector(rows,refs){
 requireThat(rows.length===refs.length&&rows.every(r=>ascii(r.owner_epoch)&&safeInt(r.revision,1)),'NATIVE_DEPENDENCY_UNAVAILABLE',503);
 requireThat(rows.every(r=>refs.some(ref=>ref.id===r.id&&ref.scope===r.scope&&ref.ownerEpoch===r.owner_epoch)),'NATIVE_OWNER_EPOCH_RECONCILIATION_REQUIRED',503);
 const ownerVector=[];for(const r of rows)ownerVector.push([r.id+':'+b64u(await sha256(bytes(r.scope))).slice(0,22),r.owner_epoch,r.revision]);
 return {rows,ownerVector,vectorGuards:rows.map(r=>[r.id,r.scope,r.owner_epoch,r.revision]),pv:await vectorDigest(ownerVector)};
}
const bounded=rights=>{requireThat(bytes(canonical(rights)).length<=2*1024*1024,'NATIVE_RIGHTS_TOO_LARGE',503);return rights;};
const rowsBound=rows=>{requireThat(rows.length<=6000,'NATIVE_SCOPE_TOO_LARGE',503);return rows;};


const authorityTables={
 participation:'account_id',staff:'account_id',paid_months:'account_id',website_months:'account_id',surah_grants:'account_id',mou_playlist_retained:'account_id',source_access_people:'account_id',source_access_master_fences:'account_id',circles_navigation:'account_id',
 source_access_scopes:'offering_id',source_access_websites:'offering_id',access_handovers:'offering_id',programme_offerings:'offering_id',programme_subjects:'offering_id',course_access_models:'offering_id',completed_course_registrations:'offering_id'
};
const authorityColumns={
 studio_course_publication_holds:['offering_id','transfer_id','registration_id','source_owner_epoch','phase'],
 studio_source_projection_problems:['account_id','offering_id','code','source_owner_epoch','source_revision'],
 participation:['account_id','offering_id','enrolled','live','purchased','cohort'],staff:['account_id','offering_id','role','can_create_account'],paid_months:['account_id','offering_id','month','cohort'],website_months:['account_id','offering_id','month'],surah_grants:['account_id','website_id'],mou_playlist_retained:['playlist_id','offering_id','account_id','source_month','kind'],
 source_access_people:['account_id','offering_id','generation','version','verified_at','ready','windows_json','has_allocation','course'],source_access_master_fences:['account_id','offering_id','epoch','active','admitted','global_admin'],circles_navigation:['account_id','epoch','verified_at','programmes_json'],source_access_scopes:['offering_id','authority','enabled','generation','version','live_enabled','timezone','classes_json'],source_access_websites:['website_id','offering_id','enabled'],access_handovers:['offering_id','transfer_id','phase','generation','source_version','revision','cursor','checked','created_at'],programme_offerings:['programme_key','offering_id','access_model'],programme_subjects:['offering_id','display_key','website_id','enabled'],course_access_models:['offering_id','access_model'],completed_course_registrations:['offering_id','registration_id','website_id','package_sha256']
};
async function authoritySnapshot(store,identity,offeringIds){
 const installed={...authorityTables,...(store.env.UAA_V2_STUDIO_SOURCE_OWNER_EPOCH?{studio_source_projection_problems:'account_id',studio_course_publication_holds:'hold'}:{})};
 const entries=Object.entries(installed),ids=JSON.stringify(offeringIds);
 const [account,...schemas]=await store.batch([
  store.statement('SELECT account_id,active,admitted,global_admin FROM accounts WHERE account_id=?',[identity.sub]),
  ...entries.map(([table])=>store.statement('PRAGMA table_info("'+table+'")'))
 ]);
 const columns=entries.map(([table],index)=>{
  const actual=new Set(schemas[index].results.map(column=>column.name));
  const selected=authorityColumns[table].filter(column=>actual.has(column));
  requireThat(selected.length&&selected.every(column=>/^[a-z_][a-z0-9_]*$/i.test(column)),'NATIVE_AUTHORITY_SCHEMA_REQUIRED',503);
  return selected;
 });
 const values=await store.batch(entries.map(([table,scope],index)=>store.statement(
  'SELECT '+columns[index].map(column=>'"'+column+'"').join(',')+' FROM "'+table+'" WHERE '+
   (scope==='hold'?"phase<>'RELEASED'":scope==='account_id'?'account_id=?':'offering_id IN(SELECT value FROM json_each(?))')+' LIMIT 6001',
  scope==='hold'?[]:[scope==='account_id'?identity.sub:ids]
 )));
 const tables=Object.fromEntries(entries.map(([table],index)=>[table,{columns:columns[index],rows:rowsBound(values[index].results)}]));
 return {schema:1,identity:account.results[0]||null,tables};
}

function scopeQueries(store,account,offer,sourceBound,academyBound){
 return [
  store.statement("SELECT o.*,h.offering_id completed_course,(SELECT programme_key FROM programme_offerings mp WHERE mp.offering_id=o.offering_id) programme_key,p.enrolled,p.live,p.purchased,p.cohort,s.role,(SELECT access_model FROM course_access_models m WHERE m.offering_id=o.offering_id) access_model,s.can_create_account FROM offerings o LEFT JOIN participation p ON p.offering_id=o.offering_id AND p.account_id=? LEFT JOIN completed_course_registrations h USING(offering_id) LEFT JOIN staff s ON s.offering_id=o.offering_id AND s.account_id=? WHERE o.offering_id=? AND o.active=1",[account,account,offer]),
  store.statement('SELECT month,cohort FROM paid_months WHERE account_id=? AND offering_id=? ORDER BY month,cohort LIMIT 6001',[account,offer]),
  store.statement('SELECT month FROM website_months WHERE account_id=? AND offering_id=? ORDER BY month LIMIT 6001',[account,offer]),
  store.statement('SELECT g.website_id FROM surah_grants g JOIN websites w USING(website_id) WHERE g.account_id=? AND w.offering_id=? ORDER BY g.website_id LIMIT 6001',[account,offer]),
  store.statement('SELECT playlist_id,kind,source_month FROM mou_playlist_retained WHERE account_id=? AND offering_id=? ORDER BY playlist_id,source_month LIMIT 6001',[account,offer]),
  ...(sourceBound?[
   store.statement("SELECT 1 FROM studio_course_publication_holds WHERE offering_id=? AND phase<>'RELEASED'",[offer]),
   store.statement('SELECT 1 FROM studio_source_projection_problems WHERE account_id=? AND offering_id=?',[account,offer])
  ]:[]),
  ...(academyBound?[
   store.statement('SELECT s.*,p.generation person_generation,p.verified_at,p.ready,p.windows_json,p.has_allocation,p.course FROM source_access_scopes s LEFT JOIN source_access_people p ON p.offering_id=s.offering_id AND p.account_id=? WHERE s.offering_id=?',[account,offer]),
   store.statement('SELECT 1 FROM source_access_master_fences WHERE account_id=? AND offering_id=?',[account,offer]),
   store.statement('SELECT phase FROM access_handovers WHERE offering_id=?',[offer])
  ]:[])
 ];
}

function checkedScope(results,sourceBound,academyBound,now){
 const [[scope],paid,websiteMonths,surahGrants,mouRetained,...checks]=results.map(result=>result.results);
 if(sourceBound){
  requireThat(!checks[0].length,'COURSE_PUBLICATION_PENDING',503);
  requireThat(!checks[1].length,'SOURCE_SCOPE_PROJECTION_BLOCKED',403);
 }
 requireThat(scope,'STUDIO_OFFERING_UNAVAILABLE',404);
 let source=null;
 if(academyBound){
  const [[entry],fences,[handover]]=sourceBound?checks.slice(2):checks;
  requireThat(!fences.length,'SOURCE_MASTER_RECONCILIATION_REQUIRED',503);
  requireThat(entry&&entry.enabled===1,'SOURCE_SCOPE_UNAVAILABLE',403);
  if(entry.authority==='WEBSITE'){
   requireThat(handover?.phase==='COMMITTED','HANDOVER_REQUIRED',409);
  }else{
   requireThat(entry.authority==='ACADEMY','SOURCE_AUTHORITY_UNKNOWN',503);
   if(!(scope.kind==='COURSE'&&scope.access_model==='FREE'))requireThat(entry.ready===1&&entry.person_generation===entry.generation,'SOURCE_PROJECTION_NOT_READY',503);
  }
  source={...entry,studio:entry.authority==='WEBSITE'};
 }
 const nativeScope={...scope,live_entitled:Boolean(scope.live)};
 const live=liveAccess(source,nativeScope,now);
 return {
  ...pick(scope,['offering_id','kind','active','programme_key','enrolled','purchased','cohort','role','can_create_account','access_model']),
  liveEntitled:Boolean(scope.live),liveNow:!scope.completed_course&&live,completedCourse:Boolean(scope.completed_course),
  paidMonths:rowsBound(paid),websiteMonths:rowsBound(websiteMonths),surahGrants:rowsBound(surahGrants),mouRetained:rowsBound(mouRetained),
  source:source?pick(source,['authority','generation','person_generation','enabled','live_enabled','ready','classes_json','windows_json','has_allocation','course','timezone','verified_at']):null
 };
}

const identitySQL='SELECT account_id,display_name,active,admitted,epoch,global_admin,verified_at FROM accounts WHERE account_id=?';

export class StudioNativeAdapter {
 constructor({env,dependencies,clock=()=>Math.floor(Date.now()/1000)}){
  requireThat(env?.DB?.withSession&&typeof clock==='function','NATIVE_STUDIO_BINDING_REQUIRED',503);
  this.env=env;this.db=env.DB.withSession('first-primary');this.dependencies=references(dependencies);this.clock=clock;
 }
 async identity(sub){
  validId(sub);
  return this.checkedIdentity(await this.db.prepare(identitySQL).bind(sub).first());
 }
 checkedIdentity(row){
  requireThat(row&&row.active===1&&row.admitted===1,'STUDIO_ACCOUNT_INACTIVE',401);
  requireThat(safeInt(row.epoch,1)&&[0,1].includes(row.global_admin),'NATIVE_STUDIO_IDENTITY_INVALID',503);
  return Object.freeze({sub:row.account_id,displayName:row.display_name,sourceCredentialEpoch:row.epoch,globalAdmin:row.global_admin===1,sourceContactAtMs:row.verified_at});
 }
 async captureInputs(sub){
  const session=this.env.DB.withSession('first-primary');
  const results=await session.batch([
   session.prepare(vectorSQL).bind(JSON.stringify(this.dependencies)),
   session.prepare(identitySQL).bind(sub)
  ]);
  requireThat(results.length===2&&results.every(result=>result.success===true&&Array.isArray(result.results)),
   'NATIVE_IDENTITY_BATCH_UNAVAILABLE',503);
  const [vector,identity]=results;
  return {vector:await localVector(vector.results,this.dependencies),identity:this.checkedIdentity(identity.results[0])};
 }
 identityGuard(identity){
  return {sql:'SELECT 1 FROM accounts WHERE account_id=? AND active=1 AND admitted=1 AND epoch=? AND global_admin=?',
   args:[identity.sub,identity.sourceCredentialEpoch,Number(identity.globalAdmin)]};
 }
 async captureScopes(store,account,offeringIds){
  const sourceBound=Boolean(this.env.UAA_V2_STUDIO_SOURCE_OWNER_EPOCH),academyBound=academyAuthority(this.env),scopes=[];
  // Each D1 batch uses one request from the invocation budget. Keep each batch
  // small while handling the full offering list without one request per scope.
  const batchSize=32;
  for(let index=0;index<offeringIds.length;index+=batchSize){
   const queries=offeringIds.slice(index,index+batchSize).map(offer=>scopeQueries(store,account,offer,sourceBound,academyBound));
   const results=await store.batch(queries);
   let offset=0;
   for(const query of queries){
    const end=offset+query.length;
    scopes.push(checkedScope(results.slice(offset,end),sourceBound,academyBound,this.clock()*1000));
    offset=end;
   }
  }
  return scopes;
 }
 async capture({sub,sourceCredentialEpoch,offeringIds=[]}){
  validId(sub);requireThat(safeInt(sourceCredentialEpoch,1),'SOURCE_CREDENTIAL_EPOCH_REQUIRED',503);
  requireThat(Array.isArray(offeringIds)&&offeringIds.length<=200&&new Set(offeringIds).size===offeringIds.length,'INVALID_NATIVE_SCOPE',400);
  offeringIds.forEach(validId);
  const vat=this.clock();requireThat(safeInt(vat),'NATIVE_CLOCK_REQUIRED',503);
  for(let attempt=0;attempt<2;attempt++){
   const {vector:before,identity}=await this.captureInputs(sub);
   requireThat(identity.sourceCredentialEpoch===sourceCredentialEpoch,'CREDENTIAL_CHANGED',401);
   const store=new Store(this.env,this.db);
   const scopes=await this.captureScopes(store,identity.sub,offeringIds);
   const nativeAuthority=await authoritySnapshot(store,identity,offeringIds);const source=this.env.UAA_V2_STUDIO_SOURCE_OWNER_EPOCH?await readStudioSourceAuthority({db:this.db,env:this.env,binding:{sub,ce:sourceCredentialEpoch},now:vat}):null;
   const {vector:after,identity:current}=await this.captureInputs(identity.sub);
   if(canonical(before.rows)!==canonical(after.rows)||canonical(identity)!==canonical(current))continue;
   const checkedAt=this.clock();requireThat(safeInt(checkedAt)&&checkedAt>=vat&&checkedAt<vat+900,'NATIVE_VALIDATION_EXPIRED',503);
   return {app:'studio',sub:identity.sub,sourceCredentialEpoch,rights:bounded({globalAdmin:identity.globalAdmin,scopes,nativeAuthority,...(source?{academy:source.rights,sourceAuthority:source.head}:{})}),sourceProvenance:{contactAtMs:identity.sourceContactAtMs,freshContact:false},ownerVector:after.ownerVector,vectorGuards:after.vectorGuards,pv:after.pv,vat,primaryCheckedAt:checkedAt,timedUntil:source?source.timedUntil:Number.MAX_SAFE_INTEGER};
  }
  reject('NATIVE_AUTHORITY_CHANGED_DURING_CAPTURE',503);
 }
 async nativeWebsiteInputs({sub,sourceParentRef,websiteId}){
  const identity=await this.identity(sub),store=new Store(this.env,this.db);
  const row=await websiteAccess(store,{account_id:identity.sub,global_admin:Number(identity.globalAdmin),verified_at:identity.sourceContactAtMs,source_ref:sourceParentRef||null},websiteId);
  return pick(row,['website_id','offering_id','kind','active','enabled','completion_date','completion_month','revision','published_key','access_model','role','is_playlist','playlist_parent']);
 }
 async nativeMediaInputs({sub,sourceParentRef,attachmentId}){
  const identity=await this.identity(sub),store=new Store(this.env,this.db);
  const row=await mediaGate(store,{account_id:identity.sub,global_admin:Number(identity.globalAdmin),verified_at:identity.sourceContactAtMs,source_ref:sourceParentRef||null},attachmentId);
  return pick(row,['attachment_id','offering_id','website_id','asset_id','lesson_id','lesson_date','cohort','audience','published','kind','active','access_model','role','playlist_only','playlist_member']);
 }
}
export const studioNativeAdapterBoundary=Object.freeze({
 coldInput:'Owning local primary facts; no Academy network call and no fabricated source-contact timestamp.',
 resourceHooks:'nativeWebsiteInputs/nativeMediaInputs reuse original business gates, including legacy source-age checks. Canonical V2 handler composition must replace that age checkpoint with the validated V2 local lease; these hooks alone do not prove seven-day renewal or full browser acceptance.',
 transactions:'identityGuard plus vectorGuards are composed in the owning V2 family transaction. No V1 session or source_ref is minted by this adapter.'
});
