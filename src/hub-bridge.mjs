import {signedInput} from './integration.mjs';
import {boundedAge,fail,id} from './protocol.mjs';
import {markHubActor} from './hub-actor.mjs';
import {publicCatalogue,catalogueAccess} from './circles.mjs';
import {circlesNavigation} from './navigation.mjs';
import {offeringJoin} from './offering-join.mjs';
const allowedSummary=new Set(['issuedAt','accountId','epoch','globalAdmin','sessionId','action','websiteIds']);
const allowedJoin=new Set(['issuedAt','accountId','epoch','globalAdmin','sessionId','offeringId','lessonSessionId']);
async function actorProof(request,env,store,{join=false}={}){
 const input=await signedInput(request,env,{limit:16_384}),now=Date.now(),keys=join?allowedJoin:allowedSummary;
 if(!input||Array.isArray(input)||Object.keys(input).some(k=>!keys.has(k))||!Number.isSafeInteger(input.issuedAt)||Math.abs(now-input.issuedAt)>60_000||!Number.isSafeInteger(input.epoch)||input.epoch<0||typeof input.globalAdmin!=='boolean')throw fail('Invalid or expired native Academy proof.',401,'HUB_PROOF_REQUIRED');
 id(input.accountId);id(input.sessionId);
 if(join){id(input.offeringId);id(input.lessonSessionId);}
 else if(!['bootstrap','navigation','access'].includes(input.action)||input.websiteIds!==undefined&&(!Array.isArray(input.websiteIds)||input.websiteIds.length>50||new Set(input.websiteIds).size!==input.websiteIds.length)||input.action!=='access'&&input.websiteIds!==undefined)throw fail('Choose a bounded hub summary.',400);
 if(!join&&input.websiteIds)input.websiteIds.forEach(id);
 // Source signs only after authenticating this exact current native session.
 // It is not a Studio source_ref, credential, browser token or grant.
 const load=()=>store.first('SELECT * FROM accounts WHERE account_id=?',[input.accountId]);
 const check=row=>{
  if(!row||!row.active||!row.admitted)throw fail('Your Academy account is unavailable.',401,'SIGN_IN_REQUIRED');
  if(row.epoch!==input.epoch||Boolean(row.global_admin)!==input.globalAdmin)throw fail('Your Academy account changed. Refresh before continuing.',409,'ACCESS_REFRESH_REQUIRED');
  if(row.verified_at<now-boundedAge(env))throw fail('Your Academy account status needs to be refreshed.',401,'STATUS_EXPIRED');
  return row;
 };
 const actor=markHubActor(check(await load()));
 return {input,actor,async recheck(){check(await load());}};
}
export async function hubSummary(request,env,store){
 const {input,actor,recheck}=await actorProof(request,env,store),catalogue=await publicCatalogue(env);
 const published=catalogue.items.filter(i=>!i.pending&&i.websiteId),ids=[...new Set(published.map(i=>i.websiteId))];
 if(ids.length>50)throw fail('The published hub catalogue needs review.',503,'HUB_CATALOGUE_LIMIT');
 const selected=input.action==='access'?(input.websiteIds||[]):ids;
 if(selected.some(websiteId=>!ids.includes(websiteId)))throw fail('Choose published hub websites.',400);
 const rights=await catalogueAccess(store,actor,selected,{navigationOnly:input.action!=='access'});
 const navigation=input.action==='access'?null:await circlesNavigation(env,store,actor,{catalogue,rights});
 const permitted=rights.websites.filter(r=>r.canOpen).map(r=>r.websiteId);
 const websites=permitted.length?await store.all('SELECT w.website_id websiteId,w.offering_id offeringId,o.kind FROM json_each(?) r JOIN websites w ON w.website_id=r.value JOIN offerings o USING(offering_id) WHERE w.enabled=1 AND w.published_key IS NOT NULL AND o.active=1',[JSON.stringify(permitted)]):[];
 await recheck();
 return {navigation,rights,websites,coursePolicyEpoch:rights.coursePolicyEpoch,checkedAt:Date.now()};
}
export async function hubJoin(request,env,store){
 const {input,actor,recheck}=await actorProof(request,env,store,{join:true}),scope=await store.scope(actor,input.offeringId);
 const result=await offeringJoin(store,actor,input.offeringId,scope,{sessionId:input.lessonSessionId});
 await recheck();return result;
}
