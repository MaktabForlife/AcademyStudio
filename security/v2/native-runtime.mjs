import {programmeRestriction} from '../../src/v111-programme-scope.mjs';
import {ensureColdSourceAuthority,sourceBusinessAuthority,studioSourceOwner,repairStudioSourceProjection,studioRepairCheckSQL} from '../../src/v111-source-authority.mjs';
import {scopedStudioBusinessAuthority} from '../../src/v111-business-authority.mjs';
import {studioAuthorityKeys} from '../../src/v111-source-authority-protocol.mjs';
import {StudioNativeAdapter} from './native-adapter.mjs';
import {requireThat,safeInt} from './codec.mjs';
import {academyAuthority} from '../../src/access.mjs';

// Actual native identity/rights only. Root owns the common C19 HTTP driver and
// primary/capture lifecycle; this factory installs no schemas or synthetic data.
export async function createNativeRuntime({env,store,clock,dependenciesFor,ensureDependencies}){
 if(env?.UAA_V2_ENABLED==='1'){const epoch=studioSourceOwner(env);studioAuthorityKeys(env,clock());const rule=store.dependencyRegistry?.get('academy:studio-source-authority');requireThat(rule?.ownerApp==='academy'&&rule.epoch===epoch&&rule.scope==='ACCOUNT'&&rule.recipients?.includes('studio'),'STUDIO_SOURCE_FOREIGN_REGISTRY_REQUIRED',503);}
 requireThat(env?.DB?.withSession&&typeof dependenciesFor==='function'&&typeof ensureDependencies==='function','STUDIO_NATIVE_RUNTIME_NOT_CONFIGURED',503);
 const adapter=sub=>new StudioNativeAdapter({env,dependencies:dependenciesFor(sub),clock});
 async function identity(sub){const value=await adapter(sub).identity(sub);return {sub:value.sub,ce:value.sourceCredentialEpoch,displayName:value.displayName,globalAdmin:value.globalAdmin};}
 function checkMapping(binding,a,value){
  requireThat(value.sourceCredentialEpoch===binding.ce,'CREDENTIAL_CHANGED',401);
  return a.identityGuard(value);
 }
 async function mappingGuard(binding){
  const a=adapter(binding.sub);
  return checkMapping(binding,a,await a.identity(binding.sub));
 }
 function mappingPreflight(binding){
  const a=adapter(binding.sub);
  return {query:a.identityQuery(binding.sub),guard:row=>checkMapping(binding,a,a.checkedIdentity(row))};
 }
 function projectionRepairQuery(binding){
  return env.UAA_V2_STUDIO_SOURCE_OWNER_EPOCH?[studioRepairCheckSQL,binding.sub]:null;
 }
 async function capture({binding,programme=null,offeringId=null,needsRepair,batchClosing=false}){
  // Common driver has ensured the complete compiled dependency manifest.
  if(env.UAA_V2_STUDIO_SOURCE_OWNER_EPOCH)await repairStudioSourceProjection({store,env,clock},binding,{needsRepair});
  const a=adapter(binding.sub);
  // Restrict capture to actual account candidates. Unavailable unrelated scopes
  // are not fabricated or allowed to turn one blocked offering into sign-in loss.
  const findOfferings=async(session,person)=>(await session.prepare(`SELECT o.offering_id FROM offerings o WHERE o.active=1 ${offeringId?'AND o.offering_id=?':''} ${programme?'AND ('+programmeRestriction(programme)+')':''} ${env.UAA_V2_STUDIO_SOURCE_OWNER_EPOCH?'AND NOT EXISTS(SELECT 1 FROM studio_source_projection_problems blocked WHERE blocked.account_id=? AND blocked.offering_id=o.offering_id) AND NOT EXISTS(SELECT 1 FROM studio_course_publication_holds hold WHERE hold.offering_id=o.offering_id AND hold.phase<>\'RELEASED\')':''} AND (
   ?=1 OR EXISTS(SELECT 1 FROM participation p WHERE p.offering_id=o.offering_id AND p.account_id=? AND (p.enrolled=1 OR p.live=1 OR p.purchased=1))
   OR EXISTS(SELECT 1 FROM staff s WHERE s.offering_id=o.offering_id AND s.account_id=?)
   OR EXISTS(SELECT 1 FROM paid_months p WHERE p.offering_id=o.offering_id AND p.account_id=?)
   OR EXISTS(SELECT 1 FROM website_months p WHERE p.offering_id=o.offering_id AND p.account_id=?)
   OR EXISTS(SELECT 1 FROM surah_grants g JOIN websites w USING(website_id) WHERE w.offering_id=o.offering_id AND g.account_id=?)
   OR EXISTS(SELECT 1 FROM mou_playlist_retained m WHERE m.offering_id=o.offering_id AND m.account_id=?)
   OR o.kind='COURSE' AND EXISTS(SELECT 1 FROM course_access_models c WHERE c.offering_id=o.offering_id AND c.access_model='FREE'))
   AND (?=0 OR EXISTS(SELECT 1 FROM source_access_scopes x WHERE x.offering_id=o.offering_id AND x.enabled=1
    AND NOT EXISTS(SELECT 1 FROM source_access_master_fences f WHERE f.offering_id=o.offering_id AND f.account_id=?)
    AND (x.authority='WEBSITE' AND EXISTS(SELECT 1 FROM access_handovers h WHERE h.offering_id=x.offering_id AND h.phase='COMMITTED')
     OR x.authority='ACADEMY' AND (o.kind='COURSE' AND EXISTS(SELECT 1 FROM course_access_models c WHERE c.offering_id=o.offering_id AND c.access_model='FREE')
      OR EXISTS(SELECT 1 FROM source_access_people p WHERE p.offering_id=x.offering_id AND p.account_id=? AND p.ready=1 AND p.generation=x.generation)))))
   ORDER BY o.offering_id LIMIT 201`).bind(...(offeringId?[offeringId]:[]),...(env.UAA_V2_STUDIO_SOURCE_OWNER_EPOCH?[binding.sub]:[]),Number(person.globalAdmin),...Array(6).fill(binding.sub),Number(academyAuthority(env)),binding.sub,binding.sub).all()).results;
  return a.capture({sub:binding.sub,sourceCredentialEpoch:binding.ce,programme,findOfferings,batchClosing});
 }
 async function draftGuard({binding,rights,resource}){
  requireThat(resource&&Object.keys(resource).sort().join(',')==='type,websiteId'&&resource.type==='studio-website'&&typeof resource.websiteId==='string'&&/^[-A-Za-z0-9_:]{1,180}$/.test(resource.websiteId),'STUDIO_DRAFT_RESOURCE_REQUIRED',403);
  const mapping=await mappingGuard(binding);requireThat(typeof rights?.globalAdmin==='boolean','STUDIO_DRAFT_AUTHORITY_REQUIRED',503);
  return {sql:`SELECT 1 FROM accounts a JOIN websites w ON w.website_id=? JOIN offerings o ON o.offering_id=w.offering_id
   WHERE a.account_id=? AND a.active=1 AND a.admitted=1 AND a.epoch=? AND a.global_admin=? AND o.active=1 ${env.UAA_V2_STUDIO_SOURCE_OWNER_EPOCH?'AND NOT EXISTS(SELECT 1 FROM studio_source_projection_problems blocked WHERE blocked.account_id=a.account_id AND blocked.offering_id=o.offering_id) AND NOT EXISTS(SELECT 1 FROM studio_course_publication_holds hold WHERE hold.offering_id=o.offering_id AND hold.phase<>\'RELEASED\')':''}
   AND (?=1 OR w.offering_id IN(SELECT value FROM json_each(?)))
   AND (a.global_admin=1 OR EXISTS(SELECT 1 FROM staff f WHERE f.account_id=a.account_id AND f.offering_id=o.offering_id AND f.role='ADMIN'))
   AND NOT EXISTS(SELECT 1 FROM source_access_master_fences f WHERE f.account_id=a.account_id AND f.offering_id=o.offering_id)
   AND (?=0 OR EXISTS(SELECT 1 FROM source_access_scopes x WHERE x.offering_id=o.offering_id AND x.enabled=1
    AND (x.authority='ACADEMY' OR x.authority='WEBSITE' AND EXISTS(SELECT 1 FROM access_handovers h WHERE h.offering_id=x.offering_id AND h.phase='COMMITTED'))
    AND EXISTS(SELECT 1 FROM source_access_people p WHERE p.offering_id=x.offering_id AND p.account_id=a.account_id AND p.ready=1 AND p.generation=x.generation)
    AND (o.kind<>'TAFSEER' OR EXISTS(SELECT 1 FROM mou_playlists p WHERE p.website_id=w.website_id AND p.offering_id=o.offering_id)
     OR EXISTS(SELECT 1 FROM programme_offerings mp JOIN programme_subjects ps USING(offering_id) WHERE mp.programme_key='mothers' AND mp.offering_id=o.offering_id AND ps.website_id=w.website_id AND ps.enabled=1)
     OR NOT EXISTS(SELECT 1 FROM programme_offerings mp WHERE mp.programme_key='mothers' AND mp.offering_id=o.offering_id) AND EXISTS(SELECT 1 FROM source_access_websites sw WHERE sw.offering_id=o.offering_id AND sw.website_id=w.website_id AND sw.enabled=1))))`,args:[resource.websiteId,binding.sub,binding.ce,Number(rights.globalAdmin),Number(rights.globalAdmin),JSON.stringify((rights.scopes||[]).filter(s=>s.role==='ADMIN').map(s=>s.offering_id)),Number(academyAuthority(env))]};
 }
 function applySecurityFactPlan({target,scopeSub}){
  if(target?.type!=='credentialEpoch')return [];
  requireThat(typeof scopeSub==='string'&&target.sub===scopeSub&&safeInt(target.newCe,1),'STUDIO_SECURITY_FACT_INVALID',503);
  // Authenticated source security facts advance only an existing native mirror.
  // No account, role, admission or acquired right is created by this operation.
  return [store.stmt('UPDATE accounts SET epoch=? WHERE account_id=? AND epoch<?',target.newCe,scopeSub,target.newCe)];
 }
 return {identity,mappingGuard,mappingPreflight,projectionRepairQuery,capture,draftGuard,businessAuthority:(rights,input)=>env.UAA_V2_STUDIO_SOURCE_OWNER_EPOCH?sourceBusinessAuthority({store,clock},rights,input):scopedStudioBusinessAuthority(rights,input),ensureColdSourceAuthority:args=>ensureColdSourceAuthority(args),applySecurityFactPlan};
}
