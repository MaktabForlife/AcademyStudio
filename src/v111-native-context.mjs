import {assertPortalCapability} from './v111-portal-capability.mjs';
import {fail,boundedAge} from './protocol.mjs';
const stores=new WeakMap(),actors=new WeakMap();
import {v2Enabled,studioV2Origin,academyV2Origin} from './v111-mode.mjs';
export {v2Enabled,studioV2Origin,academyV2Origin} from './v111-mode.mjs';
export function bindV2Store(store,runtime,cap){
 if(!v2Enabled(store.env)||!runtime||typeof runtime.assertCapability!=='function'||typeof runtime.writeGuard!=='function')throw fail('Studio authentication is not configured.',503,'V2_RUNTIME_REQUIRED');
 runtime.assertCapability(cap);
 if(!cap?.binding||cap.binding.iss!==studioV2Origin||typeof cap.binding.sub!=='string'||!Number.isSafeInteger(cap.deadline)||!cap.rights||typeof cap.rights.globalAdmin!=='boolean')throw fail('Studio authority is unavailable.',503,'V2_NATIVE_CAPABILITY_INVALID');
 const previous=stores.get(store);if(previous&&previous.cap!==cap)for(const name of ['scopes','readMemo','playlistDefinitions','nativeMediaTeacherProofs'])store[name]?.clear?.();
 stores.set(store,{runtime,cap});return store;
}
export function bindV2PortalStore(store,runtime,cap,portal){
 assertPortalCapability(portal,{now:typeof runtime.clock==='function'?runtime.clock():Math.floor(Date.now()/1000)});
 if(!v2Enabled(store.env)||cap.binding!==portal.binding||cap.deadline>portal.expiresAt||cap.binding.iss!==academyV2Origin||typeof runtime.assertCapability!=='function')throw fail('The native Academy portal authority is unavailable.',503,'PORTAL_CONTEXT_INVALID');
 runtime.assertCapability(cap);stores.set(store,{runtime,cap,kind:'academy-portal'});return store;
}
function live(store,context,now=Date.now()){
 if(!context||!v2Enabled(store.env))return null;context.runtime.assertCapability(context.cap);
 if(typeof context.runtime.clock==='function')now=context.runtime.clock()*1000;
 const {binding,deadline}=context.cap;
 if(!Number.isSafeInteger(binding.vat)||!Number.isSafeInteger(binding.s_exp)||now>=Math.min(deadline,binding.vat+900,binding.s_exp)*1000)throw fail('Refresh your Studio session to continue.',401,'VALIDATION_REQUIRED');
 return context;
}
export function v2Context(store,actor=null,now=Date.now()){
 const context=actor?actors.get(actor):stores.get(store);
 if(actor&&stores.has(store)&&!context)throw fail('Reopen your Studio session.',401,'V2_ACTOR_CONTEXT_REQUIRED');
 if(context&&context.store&&context.store!==store)throw fail('Reopen this Studio action.',401,'V2_ACTOR_CONTEXT_MISMATCH');
 return live(store,context,now);
}
export const hasV2Lease=(store,actor,now=Date.now())=>Boolean(v2Context(store,actor,now));
export function capturedNativeActor(store){const context=v2Context(store),row=context?.cap.rights.nativeAuthority?.identity;if(!row)throw fail('Refresh your native Studio authority snapshot.',503,'NATIVE_AUTHORITY_SNAPSHOT_REQUIRED');return bindV2Actor(store,{...row,epoch:context.cap.binding.ce});}
export function bindV2Actor(store,row){
 const context=v2Context(store);if(!context)throw fail('Reopen Studio from Academy.',401,'SIGN_IN_REQUIRED');
 const {binding,rights}=context.cap,epoch=rights.sourceCredentialEpoch??binding.ce;
 if(!row||row.account_id!==binding.sub||!row.active||!row.admitted||row.epoch!==epoch||Boolean(row.global_admin)!==rights.globalAdmin)throw fail('Your Studio account authority changed. Refresh before continuing.',401,'VALIDATION_REQUIRED');
 // Preserve the actual native contact timestamp. V2 never creates a V1 token/source_ref/session.
 const actor={...row,expires_at:binding.s_exp*1000};delete actor.token_hash;delete actor.source_ref;
 actors.set(actor,{...context,store});return Object.freeze(actor);
}
export function nativeAuthorityFresh(store,actor,{sensitive=false,now=Date.now()}={}){
 const context=v2Context(store,actor,now);if(context&&typeof context.runtime.clock==='function')now=context.runtime.clock()*1000;
 return context?now<context.cap.binding.vat*1000+(sensitive?60_000:900_000):actor.verified_at>=now-boundedAge(store.env,sensitive);
}
export const sourceAuthorityFresh=(store,actor,verifiedAt,maxAge,now=Date.now())=>hasV2Lease(store,actor,now)||verifiedAt>=now-maxAge;
export const hasNativeParent=(store,actor)=>Boolean(actor.source_ref)||hasV2Lease(store,actor);
export function localLeaseUntil(store,actor){const context=v2Context(store,actor);return context?Math.min(context.cap.deadline,context.cap.binding.vat+900,context.cap.binding.s_exp)*1000:null;}
export function nativeSessionKey(store,actor){const context=v2Context(store,actor);return context?(context.kind==='academy-portal'?'root-portal:':'v2:')+JSON.stringify([context.cap.binding.sid,context.cap.binding.sv,context.cap.binding.ue]):actor.token_hash;}
export function nativeWriteGuard(store,actor,{sensitive=false}={}){
 const context=v2Context(store,actor);if(!context)throw fail('Reopen Studio from Academy.',401,'SIGN_IN_REQUIRED');
 if(!nativeAuthorityFresh(store,actor,{sensitive}))throw fail('Refresh current Studio authority before this action.',401,'ADMIN_STATUS_EXPIRED');
 const plan=context.runtime.writeGuard(context.cap,{sensitive});
 if(!plan||typeof plan.sql!=='string'||!Array.isArray(plan.args)||!Array.isArray(plan.before)||!Array.isArray(plan.after))throw fail('Studio write authority is unavailable.',503,'V2_WRITE_GUARD_REQUIRED');
 return plan;
}

// Private server context only. This hook records an acknowledged guarded native
// transaction; it never grants authority or changes the captured lease.
export function nativeMutationCommitted(store,actor){
 const context=v2Context(store,actor);
 context?.runtime.nativeMutationCommitted?.(context.cap);
}
