import {json,sha256} from './protocol.mjs';
import {programmeMonth} from './mou-playlists.mjs';

// These tags are validators, never bearer permissions. Callers must complete
// the unchanged current actor/content gates before considering a cached reply.
export async function accountView(actor,store){
 return {accountId:actor.account_id,displayName:actor.display_name,globalAdmin:Boolean(actor.global_admin),verifiedAt:actor.verified_at,
  cacheSession:await sha256('private-view-v1:'+actor.token_hash+':'+actor.epoch),sessionExpiresAt:actor.expires_at,
  coursePolicyEpoch:(await store.first('SELECT revision FROM course_policy_state WHERE singleton=1'))?.revision||0};
}
export async function privateViewTag(request,store,actor,offeringId,extra){
 const head=await store.first(`SELECT COALESCE(a.revision,0) access_revision,COALESCE(v.revision,0) view_revision,
  COALESCE(p.revision,0) policy_revision,(SELECT revision FROM display_meta WHERE singleton=1) name_revision,s.timezone FROM offerings o LEFT JOIN access_revisions a USING(offering_id)
  LEFT JOIN display_revisions v USING(offering_id) LEFT JOIN course_policy_revisions p USING(offering_id)
  LEFT JOIN source_access_scopes s USING(offering_id) WHERE o.offering_id=?`,[offeringId]);
 const month=head?.timezone?programmeMonth(Date.now(),head.timezone):null,url=new URL(request.url);
 return '"pv1-'+await sha256(JSON.stringify([actor.account_id,actor.epoch,actor.token_hash,actor.global_admin,actor.display_name,url.pathname,url.search,head,month,extra]))+'"';
}
export const privateUnchanged=(request,tag)=>request.headers.get('If-None-Match')===tag;
export function privateReply(value,tag){return json(value,200,{ETag:tag});}
export function privateNotModified(tag){return new Response(null,{status:304,headers:{ETag:tag,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Maktab-Server-Time':String(Date.now())}});}
export async function checkedViewReply(request,value){
 const stable={...value};delete stable.serverTime;delete stable.cached;if(value.dashboard){stable.dashboard={...value.dashboard};delete stable.dashboard.serverTime;delete stable.dashboard.cached;}
 const tag='"pv1-'+await sha256(JSON.stringify(stable))+'"';
 return privateUnchanged(request,tag)?privateNotModified(tag):privateReply(value,tag);
}
