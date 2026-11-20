import {assertCommittedControl} from '../security/v2/control-publication.mjs';
import {canonical,requireThat,safeInt} from '../security/v2/codec.mjs';
const fences=new WeakMap();
const snapshotSQL=`SELECT e.owner_epoch,e.highest_seen,e.coherent_through,p.minutes,t.cr,t.projection_json,t.projection_digest,t.commit_ref,r.receipt_ref FROM jwt_v2_policy_heads h JOIN jwt_v2_policy_epochs e ON e.owner_epoch=h.owner_epoch JOIN jwt_v2_policy_history p ON p.owner_epoch=e.owner_epoch AND p.revision=e.coherent_through JOIN jwt_v2_control_targets t ON t.app=h.app AND t.env=h.env AND t.suffix='control/app' JOIN jwt_v2_control_registry_heads r ON r.app=h.app AND r.env=h.env WHERE h.app=? AND h.env=?`;
async function snapshot(runtime){
 requireThat(runtime.app==='studio','PORTAL_POLICY_OWNER_REQUIRED',503);
 const row=await runtime.store.first(snapshotSQL,runtime.app,runtime.config.env);
 requireThat(row&&safeInt(row.highest_seen,1)&&row.coherent_through===row.highest_seen,'PORTAL_POLICY_NOT_COHERENT',503);
 return row;
}
// This is an additional private transaction fence, never a substitute Root actor
// or a Studio family. The validated app projection must be this exact owning
// primary commit, and its policy/registry must remain unchanged through commit.
export async function validatedPortalFence(runtime,{expiresAt}){
 requireThat(safeInt(expiresAt)&&runtime.clock()<expiresAt,'PORTAL_LEASE_EXPIRED',401);
 const before=await snapshot(runtime),app=await runtime.appControl();
 requireThat(app.denied!==true&&app.authorityReady!==false,'PORTAL_APP_NOT_READY',503);
 await assertCommittedControl(runtime.store,'control/app',app);
 const after=await snapshot(runtime);requireThat(canonical(before)===canonical(after),'PORTAL_POLICY_CHANGED',409);
 const fence=Object.freeze({});fences.set(fence,{runtime,row:Object.freeze(after),expiresAt});return fence;
}
export function portalFenceCondition(runtime,fence){
 const value=fences.get(fence);requireThat(value&&value.runtime===runtime,'PORTAL_POLICY_FENCE_REQUIRED',503);const r=value.row;
 return {sql:`SELECT 1 FROM jwt_v2_policy_heads h JOIN jwt_v2_policy_epochs e ON e.owner_epoch=h.owner_epoch JOIN jwt_v2_policy_history p ON p.owner_epoch=e.owner_epoch AND p.revision=e.coherent_through JOIN jwt_v2_control_targets t ON t.app=h.app AND t.env=h.env AND t.suffix='control/app' JOIN jwt_v2_control_registry_heads registry ON registry.app=h.app AND registry.env=h.env WHERE h.app=? AND h.env=? AND e.owner_epoch=? AND e.highest_seen=? AND e.coherent_through=? AND e.coherent_through=e.highest_seen AND p.minutes=? AND t.cr=? AND t.projection_json=? AND t.projection_digest=? AND t.commit_ref=? AND registry.receipt_ref=? AND EXISTS(SELECT 1 FROM jwt_v2_objects WHERE object_key=? AND state='ACTIVE') AND ?>unixepoch()`,args:[runtime.app,runtime.config.env,r.owner_epoch,r.highest_seen,r.coherent_through,r.minutes,r.cr,r.projection_json,r.projection_digest,r.commit_ref,r.receipt_ref,runtime.cache.key('control/app'),value.expiresAt]};
}
export async function assertPortalFence(runtime,fence){const g=portalFenceCondition(runtime,fence);requireThat(await runtime.store.first(g.sql,...g.args),'PORTAL_POLICY_CHANGED',409);}
export async function portalGuardedBatch(runtime,fence,statements){
 if(fence===null)return runtime.store.batch(statements);
 const g=portalFenceCondition(runtime,fence),pair=runtime.store.guard(g.sql,g.args);return runtime.store.batch([pair[0],...statements,pair[1]]);
}
