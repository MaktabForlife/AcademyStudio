import {academyAuthority} from './access.mjs';
import {bodyJSON,boundedAge,fail,id} from './protocol.mjs';
import {contentVersion} from './content-package.mjs';
import {recordedSupport} from './recorded-support.mjs';

// Only deliberately published, whitelisted card metadata crosses this boundary.
// Private migration manifests and author exports are never public catalogue input.
export async function publicCatalogue(env){
 const object=await env.CONTENT.get('public/circles/catalogue.json');
 if(!object)return {items:[]};
 if(object.size>128_000)throw fail('The learning catalogue is unavailable.',503);
 const data=await bodyJSON(object.body,128_000);
 if(data.format!=='CIRCLES_PUBLIC_CATALOGUE_V1'||!Array.isArray(data.items)||data.items.length>200)throw fail('The learning catalogue needs review.',503);
 const seen=new Set(),items=data.items.map(item=>{
  const key=id(item.key),kind=item.kind,title=key==='foundations'?'Qur’anic Studies':String(item.title||'').slice(0,200);
  if(seen.has(key)||!['TAFSEER','COURSE'].includes(kind)||!title)throw fail('The learning catalogue needs review.',503);
  seen.add(key);
  const pending=item.pending===true,websiteId=!pending&&item.websiteId?id(item.websiteId):null;
  const colour=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value:null;
  let publicTextUrl=null;
  if(item.publicTextPath){
   const url=new URL(item.publicTextPath,env.ACADEMY_ORIGIN);
   if(key!=='foundations'||url.origin!==new URL(env.ACADEMY_ORIGIN).origin||!url.pathname.startsWith('/academy/')||url.username||url.password)throw fail('The public reading link needs review.',503);
   publicTextUrl=url.href;
  }
  return {key,kind,title,websiteId,pending,publicTextUrl,readerLayout:item.readerLayout==='podcast-inline'?'podcast-inline':null,
   cover:/^[a-f0-9]{64}$/.test(item.coverSha256||'')?'/api/public/circles/covers/'+item.coverSha256:null,
   accent:colour(item.accent)||'#805764',soft:colour(item.soft)||'#eee2df'};
 });
 return {items};
}

export async function websitePresentation(env,website){
 // A missing/unavailable presentation snapshot cannot become a content gate.
 let items=[];try{items=(await publicCatalogue(env)).items;}catch{}
 const matches=items.filter(i=>i.websiteId===website.website_id&&i.kind===website.kind&&!i.pending);
 return {kind:website.kind,...(matches.length===1?{key:matches[0].key,title:matches[0].title,...(matches[0].readerLayout?{readerLayout:matches[0].readerLayout}:{})}:{})};
}

// One bounded, account-scoped lookup. Staff authority permits opening a website
// but never supplies evidence of a purchase, paid month or individual grant.
export async function catalogueAccess(store,actor,websiteIds,{navigationOnly=false}={}){
 if(!Array.isArray(websiteIds)||websiteIds.length>50)throw fail('Choose at most 50 learning websites.');
 const ids=[...new Set(websiteIds.map(id))];if(!ids.length)return {websites:[]};
 const rows=await store.all(`SELECT w.website_id,w.enabled,w.published_key,o.kind,o.active,
  p.purchased,sf.role,sc.authority,sc.enabled source_enabled,sc.generation,
  ap.ready,ap.generation person_generation,ap.verified_at,sw.enabled mapped,
  EXISTS(SELECT 1 FROM paid_months pm WHERE pm.account_id=? AND pm.offering_id=w.offering_id AND pm.month=w.completion_month
   UNION ALL SELECT 1 FROM website_months wm WHERE wm.account_id=? AND wm.offering_id=w.offering_id AND wm.month=w.completion_month) paid,
  EXISTS(SELECT 1 FROM surah_grants sg WHERE sg.account_id=? AND sg.website_id=w.website_id) granted
  FROM json_each(?) r JOIN websites w ON w.website_id=r.value JOIN offerings o USING(offering_id)
  LEFT JOIN participation p ON p.offering_id=w.offering_id AND p.account_id=?
  LEFT JOIN staff sf ON sf.offering_id=w.offering_id AND sf.account_id=?
  LEFT JOIN source_access_scopes sc ON sc.offering_id=w.offering_id
  LEFT JOIN source_access_people ap ON ap.offering_id=w.offering_id AND ap.account_id=?
  LEFT JOIN source_access_websites sw ON sw.website_id=w.website_id AND sw.offering_id=w.offering_id`,
 [actor.account_id,actor.account_id,actor.account_id,JSON.stringify(ids),actor.account_id,actor.account_id,actor.account_id]);
 const found=new Map(rows.map(r=>[r.website_id,r])),now=Date.now();
 return {websites:ids.map(websiteId=>{
  const row=found.get(websiteId),base={websiteId,canOpen:false,subscriptionStatus:'required',accessBasis:null,needsRefresh:false};
  if(!row?.active||!row.enabled||!row.published_key)return base;
  const staff=Boolean(actor.global_admin||row.role),parallel=academyAuthority(store.env)&&row.authority!=='WEBSITE';
  if(parallel){
   if(!actor.source_ref||!row.source_enabled||row.kind==='TAFSEER'&&!row.mapped)return base;
   if(!row.ready||row.generation!==row.person_generation||row.verified_at<now-boundedAge(store.env,staff&&!navigationOnly))return {...base,needsRefresh:true};
  }
  const accessBasis=row.kind==='COURSE'&&row.purchased?'purchase':row.kind==='TAFSEER'&&row.paid?'paid-month':row.kind==='TAFSEER'&&row.granted?'website-grant':null;
  return {...base,canOpen:staff||Boolean(accessBasis),subscriptionStatus:accessBasis?'subscribed':'required',accessBasis};
 })};
}

export function guideBindingsKey(websiteId,edition){return `websites/${id(websiteId)}/recording-bindings/${edition}.json`;}
async function readBindings(env,websiteId,edition){
 if(!/^[a-f0-9]{64}$/.test(edition||''))return null;
 const object=await env.CONTENT.get(guideBindingsKey(websiteId,edition));if(!object)return null;
 if(object.size>64_000)throw fail('The recording guide links need review.',503);
 const data=await bodyJSON(object.body,64_000);
 if(data.format!=='CIRCLES_RECORDING_BINDINGS_V1'||data.websiteId!==websiteId||data.edition!==edition||!Array.isArray(data.bindings)||data.bindings.length>200)throw fail('The recording guide links need review.',503);
 return data.bindings.map(b=>({editorialLessonId:id(b.editorialLessonId),nativeLessonId:id(b.nativeLessonId),assetId:id(b.assetId)}));
}
export async function carryGuideBindings(env,website,document,key){
 const edition=contentVersion(key),draft=contentVersion(website.draft_key),published=contentVersion(website.published_key);
 if(edition===draft)return;
 const bindings=await readBindings(env,website.website_id,draft)??await readBindings(env,website.website_id,published);if(!bindings)return;
 const declared=new Set(document.lessons.flatMap(l=>l.sections.flatMap(s=>s.blocks.filter(b=>b.type==='note'&&b.aside&&b.sourceKey?.startsWith('recording:')).map(b=>b.sourceKey.slice(10)))));
 const value={format:'CIRCLES_RECORDING_BINDINGS_V1',websiteId:website.website_id,edition,bindings:bindings.filter(b=>declared.has(b.editorialLessonId))};
 const saved=await env.CONTENT.put(guideBindingsKey(website.website_id,edition),JSON.stringify(value),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
 if(!saved){const existing=await readBindings(env,website.website_id,edition);if(JSON.stringify(existing)!==JSON.stringify(value.bindings))throw fail('This edition has different recording links. Review the existing mapping.',409,'RECORDING_MAPPING_CONFLICT');}
}
export async function permittedGuideBindings(env,website,media,store){
 const edition=contentVersion(website.published_key);
 if(!/^[a-f0-9]{64}$/.test(edition||'')||!media.length)return [];
 const support=store&&website.programme_key==='mothers'?await recordedSupport(env,store,website,edition):null,bindings=support?.bindings??await readBindings(env,website.website_id,edition);if(!bindings)return [];
 const counts=new Map();for(const b of bindings)counts.set(b.editorialLessonId,(counts.get(b.editorialLessonId)||0)+1);
 return bindings.filter(b=>counts.get(b.editorialLessonId)===1&&media.some(r=>r.attachment_id&&['video/youtube','video/mp4'].includes(r.type)&&r.asset_id===b.assetId&&r.lesson_id===b.nativeLessonId));
}
