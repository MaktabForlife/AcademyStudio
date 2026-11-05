// Independent account-bound Studio issuance proof; no live route imports this.
// Uses only reads of native business tables. JWT metadata here is synthetic;
// production binding/mutation integration remains gated by the live DB hold.
import {AuthContractError} from './claims.mjs';
import {createNativeCookieEngine,projectStudioRights} from './native-rights.mjs';
import {createPrototypeStore} from './store.mjs';
const fail=code=>{throw new AuthContractError(code);};
const contextSQL='SELECT f.*,v.permission_version current_permission_version,a.account_id native_account_id,a.global_admin,a.epoch native_epoch FROM jwt_v110_families f JOIN jwt_v110_accounts v USING(account_id) JOIN accounts a USING(account_id) JOIN jwt_v110_browser_heads b USING(browser_id) WHERE f.family_id=? AND f.refresh_fp=? AND f.refresh_generation=? AND f.revoked=0 AND v.active=1 AND a.active=1 AND a.admitted=1 AND v.credential_epoch=f.credential_epoch AND a.epoch=f.credential_epoch AND b.generation=f.browser_generation AND f.original_expires_at_s>? AND ?-f.last_fg_refresh_s<5400 AND NOT EXISTS(SELECT 1 FROM jwt_v110_parent_tombstones t WHERE t.parent_session_id=f.parent_session_id)';
const join=' WHERE f.family_id=? AND f.refresh_fp=? AND f.refresh_generation=? AND n.account_id=f.account_id';
const tables=[
 ['participation','n.offering_id,n.enrolled,n.live,n.purchased,n.cohort'],
 ['staff','n.offering_id,n.role,n.can_create_account'],
 ['paid_months','n.offering_id,n.month,n.cohort'],
 ['website_months','n.offering_id,n.month'],
 ['surah_grants','n.website_id']
];
const familyTuple=['family_id','account_id','parent_session_id','browser_id','browser_generation','credential_epoch','unlock_generation','original_signed_in_at_s','original_expires_at_s','refresh_generation'];
function parameters(family,fp,now){return [family.family_id,fp,family.refresh_generation,now,now];}
function internalResult(publicFields,cookies=[],claims){
 const result={...publicFields};
 // Defence in depth: HTTP adapters must still allowlist their JSON body.
 // Accidental JSON.stringify(result) must not disclose Set-Cookie or claims.
 Object.defineProperty(result,'setCookies',{value:Object.freeze(cookies),enumerable:false});
 if(claims)Object.defineProperty(result,'claims',{value:claims,enumerable:false});
 return Object.freeze(result);
}
function currentClaims(row){
 return {sub:row.account_id,sid:row.family_id,psid:row.parent_session_id,bsid:row.browser_id,bv:row.browser_generation,ce:row.credential_epoch,pv:row.current_permission_version,ue:row.unlock_generation,s_iat:row.original_signed_in_at_s,s_exp:row.original_expires_at_s};
}
function checkedRows(rows,account){
 return rows.map(row=>{
  if(row.account_id!==account)fail('NATIVE_SUBJECT_MISMATCH');
  const {account_id,...authority}=row;return authority;
 });
}
async function snapshot(db,family,fp,now){
 const binding=[family.family_id,fp,family.refresh_generation];
 // All source rows and the current account/version are read in ONE local
 // transaction. Every native row carries its account binding for rechecking.
 const statements=[
  db.prepare(contextSQL).bind(...parameters(family,fp,now)),
  ...tables.map(([table,columns])=>db.prepare('SELECT n.account_id,'+columns+' FROM jwt_v110_families f CROSS JOIN '+table+' n'+join).bind(...binding)),
  // Existing account-first month indexes and the native retained-revocation
  // index avoid a global retained-playlist scan. Only effective retained
  // entitlement rows are included; orphan metadata grants no access.
  db.prepare("SELECT DISTINCT n.account_id,n.playlist_id,n.offering_id,n.source_month,n.kind FROM jwt_v110_families f CROSS JOIN paid_months m CROSS JOIN mou_playlist_retained n INDEXED BY mou_retained_revocation WHERE f.family_id=? AND f.refresh_fp=? AND f.refresh_generation=? AND m.account_id=f.account_id AND n.account_id=m.account_id AND n.offering_id=m.offering_id AND n.source_month=m.month AND n.kind='PAID' UNION SELECT n.account_id,n.playlist_id,n.offering_id,n.source_month,n.kind FROM jwt_v110_families f CROSS JOIN website_months m CROSS JOIN mou_playlist_retained n INDEXED BY mou_retained_revocation WHERE f.family_id=? AND f.refresh_fp=? AND f.refresh_generation=? AND m.account_id=f.account_id AND n.account_id=m.account_id AND n.offering_id=m.offering_id AND n.source_month=m.month AND n.kind='WEBSITE'").bind(...binding,...binding)
 ];
 const rs=await db.batch(statements),row=rs[0].results[0];
 if(!row||row.native_account_id!==row.account_id||familyTuple.some(key=>row[key]!==family[key]))fail('SESSION_ENDED');
 const input={global_admin:row.global_admin};
 const names=[...tables.map(x=>x[0]),'mou_playlist_retained'];
 for(let i=0;i<names.length;i++)input[names[i]]=checkedRows(rs[i+1].results,row.account_id);
 return {row,rights:projectStudioRights(input),metrics:{statements:rs.length,rowsRead:rs.reduce((n,r)=>n+(r.meta?.rows_read||0),0),rowsWritten:rs.reduce((n,r)=>n+(r.meta?.rows_written||0),0)}};
}
export async function createAccountBoundStudioRefresh({binding,clock=()=>Math.floor(Date.now()/1000),...config}){
 if(config.app!=='studio'||!binding?.withSession||typeof clock!=='function')fail('INVALID_CONFIG');
 const engine=await createNativeCookieEngine(config);
 return Object.freeze({
  async refreshAndIssue(raw,options={}){
   if(!options||Object.keys(options).some(k=>k!=='foreground')||(options.foreground!==undefined&&typeof options.foreground!=='boolean'))fail('INVALID_REFRESH_MODE');
   const rotation={statements:0,rowsRead:0,rowsWritten:0},nativeSnapshot={...rotation};
   const metrics={rotation,nativeSnapshot};let selectedFamily;

   for(let attempt=0;attempt<2;attempt++){
    const now=clock();if(!Number.isSafeInteger(now)||now<0)fail('INVALID_TIME');
    const store=createPrototypeStore(binding,{app:'studio',commitClock:clock,
     async prepareRotation({family,oldFingerprint,now:preparedAt}){
      if(selectedFamily&&familyTuple.some(key=>family[key]!==selectedFamily[key]))fail('SESSION_ENDED');
      selectedFamily??={...family};
      const current=await snapshot(binding.withSession('first-primary'),family,oldFingerprint,preparedAt);
      for(const key of Object.keys(nativeSnapshot))nativeSnapshot[key]+=current.metrics[key];
      // Every fallible read, strict projection, encoding, signing and initial
      // capacity check completes while the browser's old refresh is current.
      const issued=await engine.issue(currentClaims(current.row),current.rights,preparedAt);
      return {permissionVersion:current.row.current_permission_version,nativeEpoch:current.row.native_epoch,nativeGlobalAdmin:current.row.global_admin,expiresAt:issued.claims.exp,
       ready(next,committedAt){
        return internalResult({kind:'rotated',metrics,nativeAccountBound:true},[engine.accessCookie(issued.token,issued.claims.exp,committedAt),engine.refreshCookie(next,current.row.original_expires_at_s,committedAt)],issued.claims);
       }
      };
     }
    });
    const committed=await store.refresh(raw,{now,foreground:options.foreground===true});
    for(const key of Object.keys(rotation))rotation[key]+=store.metrics[key];
    if(committed.kind==='rotated'){
     // No native read/sign/cookie construction remains after the primary CAS.
     return committed.preparedResponse;
    }
    if(committed.kind!=='retry_preparation')return internalResult({kind:committed.kind,metrics,nativeAccountBound:true});
   }
   // Bounded PV churn has committed no successor and emits no cookies. The
   // original raw secret remains current unless a concurrent request won.
   return internalResult({kind:'retry_required',metrics,nativeAccountBound:true});
  }
 });
}
