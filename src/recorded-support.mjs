import {bodyJSON,fail,id,sha256} from './protocol.mjs';
import {contentVersion} from './content-package.mjs';
import {referencedAssets} from '../public/shared/model.mjs';

const pair=(reading,section)=>JSON.stringify([reading,section]);
const sourceLesson=key=>typeof key==='string'?key.match(/^recording(?:-quote|-topics|-application)?:(.+)$/)?.[1]:null;
const parseObject=async(env,key)=>{const o=await env.CONTENT.get(key);if(!o||o.size>1_500_000)throw fail('The saved recording support needs review.',503);return bodyJSON(o.body,1_500_000);};

export async function recordedSupport(env,store,website,edition=contentVersion(website.published_key)){
 const cacheKey=website.website_id+':'+edition;store.recordedSupportCache??=new Map();
 if(store.recordedSupportCache.has(cacheKey))return store.recordedSupportCache.get(cacheKey);
 const row=await store.first('SELECT object_key FROM website_recording_support WHERE website_id=? AND edition=?',[website.website_id,edition]);
 const value=row?await parseObject(env,row.object_key):null;
 if(value&&(value.format!=='RECORDING_SUPPORT_V1'||value.websiteId!==website.website_id||value.edition!==edition||!Array.isArray(value.bindings)||!Array.isArray(value.sections)))throw fail('The saved recording support needs review.',503);
 store.recordedSupportCache.set(cacheKey,value);return value;
}

// Native content administration selects immutable metadata only after the same
// fresh account/scope/revision guard as the website editor. Uncommitted R2 bytes
// are unreachable; a failed/stale save cannot alter an already published view.
export async function saveRecordedSupport(env,store,actor,website,input){
 if(website.programme_key!=='mothers')throw fail('Recording-scoped support is only enabled for the reviewed MOU programme.',409);
 const edition=contentVersion(website.draft_key);if(!edition)throw fail('Save the actual website draft before linking its recording support.',409);
 if(!Array.isArray(input.bindings)||input.bindings.length>200||!Array.isArray(input.sections)||input.sections.length>1000)throw fail('Keep the recording support index bounded.');
 const document=await parseObject(env,website.draft_key),declared=new Map();
 for(const reading of document.lessons)for(const section of reading.sections)declared.set(pair(reading.id,section.id),section);
 const bindings=input.bindings.map(b=>({editorialLessonId:id(b.editorialLessonId),nativeLessonId:id(b.nativeLessonId),assetId:id(b.assetId)}));
 const byEditorial=new Map(bindings.map(b=>[b.editorialLessonId,b]));if(byEditorial.size!==bindings.length)throw fail('Choose each editorial recording once.');
 const mentioned=new Set([...declared.values()].flatMap(s=>s.blocks.map(b=>sourceLesson(b.sourceKey)).filter(Boolean)));
 if(bindings.some(b=>!mentioned.has(b.editorialLessonId)))throw fail('A recording guide is absent from this exact draft.');
 const seen=new Set(),sections=input.sections.map(s=>{
  const readingId=id(s.readingId),sectionId=id(s.sectionId),key=pair(readingId,sectionId),section=declared.get(key);
  if(!section||seen.has(key)||!Array.isArray(s.lessonIds)||!s.lessonIds.length||s.lessonIds.length>200)throw fail('Choose each real support section once with its exact recorded lessons.');seen.add(key);
  const lessonIds=s.lessonIds.map(id);if(new Set(lessonIds).size!==lessonIds.length)throw fail('Choose each support lesson once.');
  const access=s.access||'ALL';if(!['ALL','ANY'].includes(access))throw fail('Choose explicit all-parent or shared-source access.');
  if(access==='ANY'&&(!Array.isArray(section.sourcePages)||!section.sourcePages.length||section.sourcePages.some(p=>!Number.isInteger(p)||p<1)||section.blocks.some(b=>sourceLesson(b.sourceKey))))throw fail('Any-parent access is only for explicitly reviewed shared PDF source sections, without recording-specific guide blocks.');
  // A mixed-recording section is all-or-nothing. Split or explicitly index
  // smaller source sections rather than exposing another month's summary.
  for(const b of section.blocks){const editorial=sourceLesson(b.sourceKey);if(editorial&&(!byEditorial.has(editorial)||!lessonIds.includes(byEditorial.get(editorial).nativeLessonId)))throw fail('Every recording-specific block needs its exact parent lesson.');}
  return {readingId,sectionId,lessonIds,access};
 });
 const wanted=[...new Set([...bindings.map(b=>b.nativeLessonId),...sections.flatMap(s=>s.lessonIds)])];
 const lessons=wanted.length?await store.all(`SELECT x.lesson_id,x.asset_id FROM attachments x JOIN objects o USING(asset_id)
  WHERE x.offering_id=? AND x.website_id=? AND x.audience='RECORDING' AND o.mime_type IN('video/youtube','video/mp4') AND x.lesson_id IN(SELECT value FROM json_each(?)) LIMIT 401`,[website.offering_id,website.website_id,JSON.stringify(wanted)]):[];
 if(lessons.length>400||wanted.some(l=>!lessons.some(x=>x.lesson_id===l))||bindings.some(b=>!lessons.some(x=>x.lesson_id===b.nativeLessonId&&x.asset_id===b.assetId)))throw fail('Use exact recording lessons/assets already attached to this website. No timetable association is required.');
 const value={format:'RECORDING_SUPPORT_V1',websiteId:website.website_id,edition,bindings,sections},encoded=JSON.stringify(value),key='websites/'+website.website_id+'/recording-support/'+await sha256(encoded)+'.json';
 await env.CONTENT.put(key,encoded,{httpMetadata:{contentType:'application/json'}});
 const revision=website.revision+1;
 return store.mutate(actor,website.offering_id,input,[
  store.statement('INSERT INTO website_recording_support VALUES(?,?,?) ON CONFLICT(website_id,edition) DO UPDATE SET object_key=excluded.object_key',[website.website_id,edition,key]),
  store.statement('UPDATE websites SET revision=? WHERE website_id=?',[revision,website.website_id]),
  store.statement('INSERT INTO website_history VALUES(?,?,?,?,?,?)',[website.website_id,revision,'recording-support',website.draft_key,Date.now(),actor.account_id])
 ],{websiteId:website.website_id,revision,action:input.action,edition},{studio:true,expectedSQL:`EXISTS(SELECT 1 FROM websites WHERE website_id=? AND revision=? AND draft_key=?)
  AND NOT EXISTS(SELECT 1 FROM json_each(?) l WHERE NOT EXISTS(SELECT 1 FROM attachments a JOIN objects o USING(asset_id) WHERE a.offering_id=? AND a.website_id=? AND a.lesson_id=l.value AND a.audience='RECORDING' AND o.mime_type IN('video/youtube','video/mp4')))
  AND NOT EXISTS(SELECT 1 FROM json_each(?) b WHERE NOT EXISTS(SELECT 1 FROM attachments a WHERE a.offering_id=? AND a.website_id=? AND a.lesson_id=json_extract(b.value,'$.nativeLessonId') AND a.asset_id=json_extract(b.value,'$.assetId') AND a.audience='RECORDING'))`,expectedArgs:[website.website_id,input.revision,website.draft_key,JSON.stringify(wanted),website.offering_id,website.website_id,JSON.stringify(bindings),website.offering_id,website.website_id]});
}

export async function recordingScopedDocument(env,store,actor,website,document){
 if(website.programme_key!=='mothers'||actor.global_admin||website.role||website.granted)return {document,contentAccess:{mode:'FULL_TEXT'}};
 const support=await recordedSupport(env,store,website);
 // One bounded indexed month/lesson query per website response. No Source calls
 // or per-reading permission queries; recording-only lessons remain in media.
 const rows=await store.all(`SELECT x.lesson_id FROM paid_months m CROSS JOIN attachments x INDEXED BY attachments_month
  WHERE m.account_id=? AND m.offering_id=? AND x.offering_id=m.offering_id AND substr(x.lesson_date,1,7)=+m.month AND x.cohort=m.cohort AND x.website_id=? AND x.audience='RECORDING' AND x.published=1 LIMIT 401`,[actor.account_id,website.offering_id,website.website_id]);
 if(rows.length>400)throw fail('This website needs a narrower recorded-lesson view.',409,'RECORDING_SCOPE_LIMIT');
 const allowed=new Set(rows.map(r=>r.lesson_id)),sections=new Map((support?.sections||[]).map(s=>[pair(s.readingId,s.sectionId),s]));
 const filtered=structuredClone(document);filtered.lessons=filtered.lessons.flatMap(reading=>{
  const visible=reading.sections.filter(s=>{const support=sections.get(pair(reading.id,s.id)),parents=support?.lessonIds;return parents?.length&&(support.access==='ANY'?parents.some(l=>allowed.has(l)):parents.every(l=>allowed.has(l)));});
  return visible.length?[{...reading,summary:'',sections:visible}]:[];
 });
 // Unassigned global text/files are not inferred to belong to any recording.
 filtered.home={...filtered.home,headline:filtered.name,subtitle:'',description:'',caption:'',journeyTitle:'',themes:[],imageId:''};
 filtered.materials={...filtered.materials,intro:'',files:[]};delete filtered.academyMediaIds;
 return {document:filtered,contentAccess:{mode:'RECORDING_SCOPED',supportConnected:Boolean(support)}};
}

export async function recordedAssetAccess(env,store,actor,website,assetId){
 if(website.programme_key!=='mothers'||actor.global_admin||website.role||website.granted)return;
 const document=await parseObject(env,website.published_key),filtered=await recordingScopedDocument(env,store,actor,website,document);
 if(!referencedAssets(filtered.document).includes(assetId))throw fail('This file needs its own recorded-lesson text rights.',403,'MATERIAL_ACCESS_REQUIRED');
}
