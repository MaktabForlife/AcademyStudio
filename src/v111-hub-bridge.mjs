import {validatedPortalFence,portalFenceCondition,assertPortalFence} from './v111-portal-fence.mjs';
import {verifyPortalRequest,portalReply,portalFetch} from '../security/v2/portal-business.mjs';
import {markPortalCapability,assertPortalCapability} from './v111-portal-capability.mjs';
import {stageSourceAuthorityManifest,stageSourceAuthorityPage,installStudioSourceAuthority,readStudioSourceAuthority,blockedStudioScopes} from './v111-source-authority.mjs';
import {StudioNativeAdapter} from '../security/v2/native-adapter.mjs';
import {canonical,strictJSON,requireThat} from '../security/v2/codec.mjs';
import {Store} from './database.mjs';
import {bindV2PortalStore} from './v111-native-context.mjs';
import {executeHubSummary,executeHubJoin} from './hub-bridge.mjs';
import {executeStudioAccess,readAccessAction} from './studio-access.mjs';
import {publicCatalogue} from './circles.mjs';
const same=(a,b)=>canonical(a)===canonical(b);
function guardFor(runtime,portal,capture,policyFence,{nativeVector=true}={}){
 const b=portal.binding,h=portal.head,vectorSQL=nativeVector?"NOT EXISTS(SELECT 1 FROM json_each(?) j LEFT JOIN jwt_v2_dependencies d ON d.id=json_extract(j.value,'$[0]') AND d.scope=json_extract(j.value,'$[1]') WHERE d.id IS NULL OR d.owner_epoch<>json_extract(j.value,'$[2]') OR d.revision<>json_extract(j.value,'$[3]'))":"1",sql="SELECT 1 FROM accounts a JOIN studio_source_authority source ON source.account_id=a.account_id WHERE a.account_id=? AND a.active=1 AND a.admitted=1 AND a.epoch=? AND a.global_admin=? AND source.ce=a.epoch AND source.source_owner_epoch=? AND source.source_revision=? AND source.payload_digest=? AND ?>unixepoch() AND EXISTS(SELECT 1 FROM jwt_v2_objects WHERE object_key=? AND state='ACTIVE') AND ("+vectorSQL+") AND NOT EXISTS(SELECT 1 FROM jwt_v2_restrictions r WHERE "+
 "(json_extract(r.target_json,'$.type')='credentialEpoch' AND json_extract(r.target_json,'$.sub')=? AND ?>0 AND ?<json_extract(r.target_json,'$.newCe')) OR "+
 "(json_extract(r.target_json,'$.type')='accountCutoff' AND json_extract(r.target_json,'$.sub')=? AND (?<json_extract(r.target_json,'$.maxCe') OR ?=json_extract(r.target_json,'$.maxCe') AND ?<=json_extract(r.target_json,'$.maxAe'))) OR "+
 "(json_extract(r.target_json,'$.type')='parent' AND json_extract(r.target_json,'$.sub')=? AND json_extract(r.target_json,'$.psid')=? AND json_extract(r.target_json,'$.bsid')=? AND json_extract(r.target_json,'$.bv')=? AND json_extract(r.target_json,'$.ce')=? AND json_extract(r.target_json,'$.ae')=?) OR "+
 "(json_extract(r.target_json,'$.type')='browser' AND json_extract(r.target_json,'$.bsid')=? AND ?<=json_extract(r.target_json,'$.maxBv')) OR "+
 "(json_extract(r.target_json,'$.type')='dependency' AND json_extract(r.target_json,'$.id')='academy:studio-source-authority' AND r.scope_sub=? COLLATE BINARY AND (json_extract(r.target_json,'$.ownerEpoch')<>? OR json_extract(r.target_json,'$.revision')>? OR json_extract(r.target_json,'$.effect')='DENY')))";
 const policy=portalFenceCondition(runtime,policyFence);return {sql:sql+' AND EXISTS('+policy.sql+')',args:[b.sub,b.ce,Number(capture.rights.globalAdmin),h.ownerEpoch,h.revision,h.payloadDigest,Math.min(portal.expiresAt,portal.deadline,capture.timedUntil),runtime.cache.key('control/app'),...(nativeVector?[canonical(capture.vectorGuards)]:[]),b.sub,b.ce,b.ce,b.sub,b.ce,b.ce,b.ae,b.sub,b.psid,b.bsid,b.bv,b.ce,b.ae,b.bsid,b.bv,b.sub,h.ownerEpoch,h.revision,...policy.args]};
}
async function contextFor(runtime,portal,offeringIds,policyFence){
 const b=portal.binding,source=await readStudioSourceAuthority({db:runtime.store.db,env:runtime.env,binding:b,now:runtime.clock()});
 requireThat(same(source.head,portal.head)&&source.websiteAdmission,'PORTAL_SOURCE_HEAD_CHANGED',409);
 const adapter=new StudioNativeAdapter({env:runtime.env,dependencies:runtime.settings.dependenciesFor(b.sub),clock:runtime.clock});
 const capture=await adapter.capture({sub:b.sub,sourceCredentialEpoch:b.ce,sourceParentRef:null,offeringIds});
 const cap=Object.freeze({binding:portal.binding,rights:capture.rights,deadline:Math.min(portal.expiresAt,portal.deadline,capture.timedUntil)}),condition=guardFor(runtime,portal,capture,policyFence);
 let committed=false;
 const checked={
  clock:runtime.clock,
  nativeMutationCommitted(value){this.assertCapability(value);committed=true;},
  assertCapability(value){assertPortalCapability(portal,{now:runtime.clock()});requireThat(value===cap&&runtime.clock()<cap.deadline,'PORTAL_LEASE_EXPIRED',401);},
  writeGuard(value,{sensitive=false}={}){
   this.assertCapability(value);requireThat(['admin','admin-cover'].includes(portal.operation),'PORTAL_READ_ONLY',403);
   requireThat(!sensitive||runtime.clock()<b.vat+60,'ADMIN_STATUS_EXPIRED',401);
   const pair=runtime.store.guard(condition.sql,condition.args);return {...condition,before:[pair[0]],after:[pair[1]]};
  },
  domainCommand:async(value,{command,input,operationId=crypto.randomUUID(),resource=null})=>{
   checked.assertCapability(value);requireThat(['admin','admin-read','admin-cover'].includes(portal.operation),'PORTAL_SOURCE_COMMAND_FORBIDDEN',403);
   return portalFetch(runtime,portal,'source-return',{command,input,operationId,resource});
  }
 };
 // The full captured vector fences the actual native transaction. Its own
 // successful write may legitimately advance that vector. A commit ACK then
 // checks the same Root principal, Source head, lifecycle, cutoffs and fixed
 // expiry, without requiring the committed business data to be unchanged.
 const acknowledgement=guardFor(runtime,portal,capture,policyFence,{nativeVector:false});
 const recheck=async({acknowledge=false}={})=>{checked.assertCapability(cap);const selected=acknowledge&&committed?acknowledgement:condition;requireThat(await runtime.store.first(selected.sql,...selected.args),'PORTAL_AUTHORITY_CHANGED',409);};
 await recheck();const store=bindV2PortalStore(new Store(runtime.env),checked,cap,portal),actor=await store.actor();return {store,actor,recheck};
}
export async function receiveStudioPortal(request,runtime,{fetcher=globalThis.fetch}={}){
 const peer=await verifyPortalRequest(request,runtime);
 try{
  const body=peer.body,portal=markPortalCapability(body,{now:runtime.clock(),peer}),input=body.input,policyFence=await validatedPortalFence(runtime,{expiresAt:portal.expiresAt});
  requireThat(input&&typeof input==='object'&&!Array.isArray(input),'PORTAL_INPUT_INVALID',400);
  if(body.operation==='stage-manifest'){
   assertPortalCapability(portal,{manifest:input.manifest,now:runtime.clock()});
   requireThat(input.manifest.bound===null,'PORTAL_PROFILE_BOUND_GRANT_FORBIDDEN',403);await stageSourceAuthorityManifest(runtime,input.manifest,input.manifestDigest,{portalFence:policyFence});
   await assertPortalFence(runtime,policyFence);assertPortalCapability(portal,{now:runtime.clock()});return portalReply(runtime,peer,{status:'STAGED'});
  }
  if(body.operation==='stage-page'){
   const manifest=await stageSourceAuthorityPage(runtime,input,{portalFence:policyFence});assertPortalCapability(portal,{manifest,now:runtime.clock()});
   const count=await runtime.store.first('SELECT count(*) n FROM studio_source_authority_pages WHERE export_id=?',manifest.exportId);
   const value=count.n===manifest.pageCount?await installStudioSourceAuthority(runtime,manifest.exportId,{portal,portalFence:policyFence}):{status:'STAGED'};
   await assertPortalFence(runtime,policyFence);assertPortalCapability(portal,{now:runtime.clock()});return portalReply(runtime,peer,{status:value.status});
  }
  let ids;
  if(body.operation==='summary'){
   requireThat(['bootstrap','navigation','access'].includes(input.action)&&Object.keys(input).every(k=>['action','websiteIds'].includes(k)),'PORTAL_INPUT_INVALID',400);
   const catalogue=await publicCatalogue(runtime.env),websites=catalogue.items.filter(i=>!i.pending&&i.websiteId);
   requireThat(websites.length<=50,'HUB_CATALOGUE_LIMIT',503);
   const requested=input.action==='access'?input.websiteIds||[]:websites.map(i=>i.websiteId);
   requireThat(Array.isArray(requested)&&requested.length<=50&&new Set(requested).size===requested.length,'PORTAL_INPUT_INVALID',400);
   ids=(await runtime.store.all('SELECT DISTINCT offering_id FROM websites WHERE website_id IN(SELECT value FROM json_each(?))',canonical(requested))).map(r=>r.offering_id);
  }else{
   requireThat(['join','admin','admin-read','admin-cover'].includes(body.operation)&&typeof input.offeringId==='string','PORTAL_INPUT_INVALID',400);ids=[input.offeringId];
   if(body.operation==='join')requireThat(Object.keys(input).every(k=>['action','offeringId','sessionId'].includes(k))&&typeof input.sessionId==='string','PORTAL_INPUT_INVALID',400);
   else requireThat(Object.keys(input).every(k=>['offeringId','command'].includes(k))&&input.command&&typeof input.command.action==='string'&&(body.operation==='admin-read'?readAccessAction(input.command.action):true),'PORTAL_INPUT_INVALID',400);
  }
  const blocked=new Set((await blockedStudioScopes(runtime,portal.binding.sub)).map(r=>r.offering_id));
  if(body.operation==='summary')ids=ids.filter(id=>!blocked.has(id));else requireThat(!ids.some(id=>blocked.has(id)),'PORTAL_SCOPE_BLOCKED',403);
  const {store,actor,recheck}=await contextFor(runtime,portal,ids,policyFence);let value;
  if(body.operation==='summary')value=await executeHubSummary(runtime.env,store,actor,input,recheck);
  else if(body.operation==='join')value=await executeHubJoin(runtime.env,store,actor,{...input,lessonSessionId:input.sessionId},recheck);
  else value=await executeStudioAccess(runtime.env,store,actor,structuredClone(input),fetcher,{coverOnly:body.operation==='admin-cover'});
  await recheck({acknowledge:true});return portalReply(runtime,peer,value);
 }catch(error){return portalReply(runtime,peer,{success:false,code:typeof error.code==='string'?error.code:'PORTAL_NATIVE_ACTION_UNAVAILABLE',error:'The native Academy connection could not complete this action.'},error.status||503);}
}
