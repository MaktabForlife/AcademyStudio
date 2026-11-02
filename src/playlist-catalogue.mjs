import {academyAuthority} from './access.mjs';
import {programmeMonth,playlistEntitlementSQL} from './mou-playlists.mjs';
import {cardDTO} from './playlist-cards.mjs';
import {boundedAge} from './protocol.mjs';

// Decorate only the already-selected website page. One indexed metadata query
// and one bounded monthly-rights batch; never a request/query for each card.
export async function publishedPlaylistDescriptors(store,actor,websites){
 const ids=websites.map(w=>w.website_id);if(!ids.length)return [];
 const rows=await store.all(`SELECT p.playlist_id,p.published_count,w.website_id,w.offering_id,COALESCE(pc.published_title,w.title) title,pc.published_json,w.completion_date,w.completion_month,
 o.title offering_title,o.kind,mp.programme_key,cm.access_model,cr.revision policy_revision,pa.purchased,sf.role,sc.authority,sc.enabled source_enabled,sc.timezone,sc.generation,ap.ready,ap.generation person_generation,ap.verified_at,h.phase,
 EXISTS(SELECT 1 FROM surah_grants g WHERE g.account_id=? AND g.website_id=w.website_id) granted,
 EXISTS(SELECT 1 FROM source_access_master_fences f WHERE f.account_id=? AND f.offering_id=w.offering_id) fenced
 FROM json_each(?) j JOIN websites w ON w.website_id=j.value JOIN mou_playlists p USING(website_id) LEFT JOIN playlist_card_designs pc USING(playlist_id) JOIN offerings o ON o.offering_id=w.offering_id
 LEFT JOIN programme_offerings mp ON mp.offering_id=w.offering_id LEFT JOIN course_access_models cm ON cm.offering_id=w.offering_id
 LEFT JOIN course_policy_revisions cr ON cr.offering_id=w.offering_id
 LEFT JOIN participation pa ON pa.offering_id=w.offering_id AND pa.account_id=? LEFT JOIN staff sf ON sf.offering_id=w.offering_id AND sf.account_id=?
 LEFT JOIN source_access_scopes sc ON sc.offering_id=w.offering_id LEFT JOIN source_access_people ap ON ap.offering_id=w.offering_id AND ap.account_id=?
 LEFT JOIN access_handovers h ON h.offering_id=w.offering_id
 WHERE o.active=1 AND w.enabled=1 AND w.published_key IS NOT NULL`,[actor.account_id,actor.account_id,JSON.stringify(ids),actor.account_id,actor.account_id,actor.account_id]);
 const monthly=rows.filter(r=>r.kind==='TAFSEER'&&!(actor.global_admin||r.role)).map(r=>({id:r.playlist_id,month:r.timezone?programmeMonth(Date.now(),r.timezone):null}));
 const rights=monthly.length?await store.all(`SELECT p.playlist_id,
 ${playlistEntitlementSQL({paidOnly:true,month:"COALESCE(w.completion_month,json_extract(j.value,'$.month'))"})} can_listen,
 ${playlistEntitlementSQL({month:"COALESCE(w.completion_month,json_extract(j.value,'$.month'))"})} can_read
 FROM json_each(?) j JOIN mou_playlists p ON p.playlist_id=json_extract(j.value,'$.id') JOIN websites w USING(website_id)`,[actor.account_id,actor.account_id,actor.account_id,actor.account_id,actor.account_id,JSON.stringify(monthly)]):[];
 const found=new Map(rights.map(r=>[r.playlist_id,r])),now=Date.now(),parallel=academyAuthority(store.env);
 return rows.flatMap(row=>{
  const staff=Boolean(actor.global_admin||row.role),source= !parallel||Boolean(actor.source_ref&&!row.fenced&&row.source_enabled&&(row.authority==='WEBSITE'?row.phase==='COMMITTED':row.ready&&row.generation===row.person_generation&&row.verified_at>=now-boundedAge(store.env)));
  const paid=found.get(row.playlist_id),course=row.kind==='COURSE'&&Boolean(row.purchased||row.access_model==='FREE');
  const canListen=source&&Boolean(staff||course||row.kind==='TAFSEER'&&paid?.can_listen),canRead=source&&Boolean(staff||course||row.kind==='TAFSEER'&&(paid?.can_read||row.granted));
  if(!canRead&&!canListen)return [];
  return [{id:row.playlist_id,websiteId:row.website_id,offeringId:row.offering_id,offeringTitle:row.offering_title,kind:row.kind,...(row.kind==='COURSE'?{coursePolicy:{offeringId:row.offering_id,model:row.access_model||'PAID',revision:row.policy_revision||0}}:{}),programmeKey:row.programme_key||null,accessModel:row.kind==='COURSE'?'COURSE':'MONTHLY',title:row.title,card:cardDTO(row.published_json,{published:true,origin:store.env.WEBSITE_ORIGIN}),canEdit:Boolean(source&&(actor.global_admin||row.role==='ADMIN')),...(source&&(actor.global_admin||row.role==='ADMIN')?{editorHref:'/builder/?website='+encodeURIComponent(row.website_id)}:{}),state:row.completion_date?'CLOSED':'OPEN',closeDate:row.completion_date,recordings:row.published_count,canListen,canRead,published:true,href:'/studio/?website='+encodeURIComponent(row.website_id)}];
 });
}
