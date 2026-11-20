// A private, signed business-scope upper bound. Never accept this from browser JSON.
const commands=Object.freeze(['/internal/website/dashboard','/internal/website/lesson-join','/internal/website/media-teachers','/internal/website/course-playlist-placements','/internal/website/identity']);
export const studioBusinessCommands=commands;
const bad=()=>{throw Object.assign(Error('Invalid Studio business authority.'),{status:401,code:'V2_NATIVE_AUTHORITY_INVALID'});};
const exact=(value,keys)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==keys.slice().sort().join(','))bad();};
const text=(value,max=180,nullable=false)=>{if(nullable&&value==null)return null;if(typeof value!=='string'||!value.length||value.length>max||/[\u0000-\u001f\u007f]/.test(value))bad();return value;};
const cohort=value=>value===''?'':text(value,180,true);
const flag=value=>{if(typeof value!=='boolean')bad();return value;};
const bit=value=>{if(value!==0&&value!==1)bad();return value;};
const number=value=>{if(!Number.isSafeInteger(value)||value<0)bad();return value;};
const rows=(value,keys,project)=>{if(!Array.isArray(value)||value.length>6000)bad();return value.map(row=>{exact(row,keys);return project(row);});};
const json=value=>{text(value,262144);let parsed;try{parsed=JSON.parse(value);}catch{bad();}if(!parsed||typeof parsed!=='object')bad();return value;};
const sourceKeys=['authority','generation','person_generation','enabled','live_enabled','ready','classes_json','windows_json','has_allocation','course','timezone'];
const nullableNumber=value=>value==null?null:number(value);
function source(value){if(value==null)return null;const out={authority:text(value.authority,16),generation:number(value.generation),person_generation:nullableNumber(value.person_generation),enabled:bit(value.enabled),live_enabled:bit(value.live_enabled),ready:value.ready==null?null:bit(value.ready),classes_json:json(value.classes_json),windows_json:value.windows_json==null?null:json(value.windows_json),has_allocation:value.has_allocation==null?null:bit(value.has_allocation),course:value.course==null?null:bit(value.course),timezone:text(value.timezone,100)};if(!['ACADEMY','WEBSITE'].includes(out.authority))bad();return out;}
const scopeKeys=['offering_id','kind','programme_key','active','role','can_create_account','enrolled','purchased','cohort','liveEntitled','completedCourse','access_model','paidMonths','websiteMonths','surahGrants','mouRetained','source'];
function scope(value){
 const out={offering_id:text(value.offering_id),kind:text(value.kind,30),programme_key:text(value.programme_key,100,true),active:bit(value.active),role:text(value.role,40,true),can_create_account:value.can_create_account==null?null:bit(value.can_create_account),enrolled:value.enrolled==null?null:bit(value.enrolled),purchased:value.purchased==null?null:bit(value.purchased),cohort:cohort(value.cohort),liveEntitled:flag(value.liveEntitled),completedCourse:flag(value.completedCourse),access_model:text(value.access_model,30,true),
 paidMonths:rows(value.paidMonths,['month','cohort'],r=>({month:text(r.month,30),cohort:cohort(r.cohort)})),websiteMonths:rows(value.websiteMonths,['month'],r=>({month:text(r.month,30)})),surahGrants:rows(value.surahGrants,['website_id'],r=>({website_id:text(r.website_id)})),mouRetained:rows(value.mouRetained,['playlist_id','kind','source_month'],r=>({playlist_id:text(r.playlist_id),kind:text(r.kind,30),source_month:text(r.source_month,30)})),source:source(value.source)};
 return out;
}
export function projectStudioBusinessAuthority(rights){
 if(!rights||!Array.isArray(rights.scopes)||rights.scopes.length>200)bad();const out={schema:1,globalAdmin:flag(rights.globalAdmin),scopes:rights.scopes.map(scope)};
 if(new Set(out.scopes.map(s=>s.offering_id)).size!==out.scopes.length||new TextEncoder().encode(JSON.stringify(out)).length>2*1024*1024)bad();return out;
}
export function validateStudioBusinessAuthority(value){
 if(value?.schema===2){exact(value,['schema','head','receipt']);exact(value.head,['sub','ce','ownerEpoch','revision','payloadDigest']);exact(value.receipt,['tx','jti','sub','ce','ae','psid','bsid','bv','s_iat','s_exp','grantDigest']);for(const k of ['sub','ownerEpoch','payloadDigest'])text(value.head[k]);for(const k of ['ce','revision'])number(value.head[k]);for(const k of ['tx','jti','sub','psid','bsid','grantDigest'])text(value.receipt[k]);for(const k of ['ce','ae','bv','s_iat','s_exp'])number(value.receipt[k]);return value;}

 exact(value,['schema','globalAdmin','scopes']);if(value.schema!==1)bad();for(const row of value.scopes||[]){exact(row,scopeKeys);if(row.source!==null)exact(row.source,sourceKeys);}
 return projectStudioBusinessAuthority(value);
}

export function scopedStudioBusinessAuthority(rights,{command,input}){
 if(!commands.includes(command)||!input||typeof input!=='object')bad();
 if(rights.globalAdmin===true)return projectStudioBusinessAuthority({globalAdmin:true,scopes:[]});
 let scopes=rights.scopes;
 if(['/internal/website/identity','/internal/website/media-teachers'].includes(command)){
  const offer=text(input.offeringId);scopes=scopes.filter(s=>s.offering_id===offer);if(scopes.length!==1)bad();
 }
 // Placement can return several individually permitted native destinations.
 // Dashboard/Join references are resolved by the owning native mapper. The
 // complete captured upper bound is mandatory until a paged UI contract exists.
 const result=projectStudioBusinessAuthority({...rights,scopes});
 if(new TextEncoder().encode(JSON.stringify(result)).length>49152)throw Object.assign(Error('Choose a smaller native business scope.'),{status:503,code:'NATIVE_RPC_SCOPE_PARTITION_REQUIRED'});
 return result;
}
