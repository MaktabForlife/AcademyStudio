import {carryGuideBindings} from './circles.mjs';
import {saveRecordedSupport,carryRecordedSupport} from './recorded-support.mjs';
import {cardPublication,finishCardPublication} from './playlist-cards.mjs';
import {sourceWebsiteGate} from './access.mjs';
import {fail,id,text,month,sha256,bodyJSON} from './protocol.mjs';
import {validatePackage} from './content-package.mjs';
import {assertWebsiteAssets} from './website-assets.mjs';
import {playlistTextAccess,playlistParentTextAccess} from './mou-playlists.mjs';
export async function objectJSON(bucket,key,limit=1_500_000){const object=await bucket.get(key);if(!object||object.size>limit)throw fail('The saved edition is unavailable.',503);return bodyJSON(object.body,limit);}
export async function saveContent(env,document,websiteId=document.id){const encoded=JSON.stringify(document);if(new TextEncoder().encode(encoded).length>1_500_000)throw fail('This website edition is too large.',413);const hash=await sha256(encoded),key='websites/'+encodeURIComponent(websiteId)+'/versions/'+hash+'.json';await env.CONTENT.put(key,encoded,{httpMetadata:{contentType:'application/json'}});return key;}
export async function websiteAccess(store,actor,websiteId,{admin=false,readOnly=!admin}={}){
 const row=await store.first(`SELECT w.*,(SELECT published_title FROM playlist_card_designs c JOIN mou_playlists p USING(playlist_id) WHERE p.website_id=w.website_id) published_title,o.kind,o.active,(SELECT playlist_id FROM mou_playlists mp WHERE mp.website_id=w.website_id) playlist_id,p.purchased,s.role,h.offering_id completed_course,(SELECT programme_key FROM programme_offerings mp WHERE mp.offering_id=o.offering_id) programme_key,(SELECT access_model FROM course_access_models m WHERE m.offering_id=o.offering_id) access_model,
  EXISTS(SELECT 1 FROM paid_months m WHERE m.account_id=? AND m.offering_id=w.offering_id UNION ALL SELECT 1 FROM website_months m WHERE m.account_id=? AND m.offering_id=w.offering_id) retained_text,
  EXISTS(SELECT 1 FROM paid_months m WHERE m.account_id=? AND m.offering_id=w.offering_id AND m.month=w.completion_month UNION ALL SELECT 1 FROM website_months m WHERE m.account_id=? AND m.offering_id=w.offering_id AND m.month=w.completion_month) paid,
  EXISTS(SELECT 1 FROM surah_grants g WHERE g.account_id=? AND g.website_id=w.website_id) granted
  FROM websites w JOIN offerings o USING(offering_id)
  LEFT JOIN completed_course_registrations h USING(offering_id)
  LEFT JOIN participation p ON p.account_id=? AND p.offering_id=w.offering_id
  LEFT JOIN staff s ON s.account_id=? AND s.offering_id=w.offering_id WHERE w.website_id=?`,[actor.account_id,actor.account_id,actor.account_id,actor.account_id,actor.account_id,actor.account_id,actor.account_id,id(websiteId)]);
 if(!row||!row.active)throw fail('This website is unavailable.',404);await sourceWebsiteGate(store,actor,row,{readOnly});
 if(admin){await store.scope(actor,row.offering_id,{admin:true,readOnly});return row;}
 const staff=actor.global_admin||row.role==='ADMIN'||row.role==='TEACHER';
 const playlist=row.playlist_id;
 const privatePlaylistParent=row.programme_key==='mothers'&&!playlist?await store.first('SELECT 1 FROM mou_playlist_only_websites WHERE website_id=?',[websiteId]):null;
 const monthlyText=row.kind==='COURSE'?false:playlist?row.granted||await playlistTextAccess(store,actor,websiteId,row.offering_id):privatePlaylistParent?await playlistParentTextAccess(store,actor,websiteId,row.offering_id):row.paid||row.granted||row.programme_key==='mothers'&&row.retained_text;
 if(!staff&&!(row.kind==='COURSE'&&(row.purchased||row.access_model==='FREE')||row.kind==='TAFSEER'&&monthlyText))throw fail('Your account does not have this material.',403,'MATERIAL_ACCESS_REQUIRED');
 if(!row.enabled||!row.published_key)throw fail('This website is not published.',404);return {...row,title:row.published_title??row.title,is_playlist:Boolean(playlist),playlist_parent:Boolean(privatePlaylistParent)};
}
export async function editWebsite(env,store,actor,websiteId,input){
 input={...input,websiteId};const website=await websiteAccess(store,actor,websiteId,{admin:true}),hash=await store.requestHash(website.offering_id,input),old=await store.replay(actor.account_id,input.operationId,hash);if(old){await finishCardPublication(env,store,website.offering_id,old.cardPublication);return old;}
 if(input.revision!==website.revision)throw fail('This website changed elsewhere. Reopen the saved draft.',409);
 if(input.action==='recording-support')return saveRecordedSupport(env,store,actor,website,input);
 const revision=website.revision+1,statements=[];let recordingOnly=false,cardApproval=null;let historyKey=website.draft_key;
 if(input.action==='save'){
  const document=structuredClone(input.document);if(website.playlist_id){document.name=text(document.name,160).trim();if(!document.name)throw fail('Enter a playlist name.');statements.push(store.statement('UPDATE websites SET title=? WHERE website_id=?',[document.name,websiteId]));}const errors=validatePackage(document);if(errors.length)throw fail(errors.join(' '));
  await assertWebsiteAssets(store,websiteId,document);
  const key=await saveContent(env,document,websiteId);await carryGuideBindings(env,website,document,key);statements.push(...await carryRecordedSupport(env,store,website,document,key));historyKey=key;statements.push(store.statement('UPDATE websites SET draft_key=?,revision=? WHERE website_id=?',[key,revision,websiteId]));
 }else if(input.action==='publish'){
  const card=await cardPublication(store,website.offering_id,websiteId);statements.push(...card.statements);cardApproval=card.approval;
  if(!website.draft_key)throw fail('Save a draft first.');const document=await objectJSON(env.CONTENT,website.draft_key);let errors=validatePackage(document,{review:true});if(document.lessons.length===0&&await store.first("SELECT 1 FROM attachments a JOIN objects o USING(asset_id) WHERE a.website_id=? AND a.offering_id=? AND a.audience='RECORDING' AND o.mime_type IN('video/youtube','video/mp4') LIMIT 1",[websiteId,website.offering_id])){recordingOnly=true;errors=errors.filter(e=>e!=='Add at least one web lesson.');}if(errors.length)throw fail(errors.join(' '));
  const refs=await assertWebsiteAssets(store,websiteId,document);
  statements.push(store.statement('DELETE FROM published_assets WHERE website_id=?',[websiteId]));
  for(const assetId of refs)statements.push(store.statement('INSERT INTO published_assets VALUES(?,?)',[websiteId,assetId]));
  // One delivery attachment per asset is sufficient. Keep duplicate drafts
  // private, prefer an already-published attachment, and never rewrite history.
  statements.push(store.statement(`UPDATE attachments SET published=1 WHERE published=0 AND attachment_id IN(
   SELECT (SELECT a.attachment_id FROM attachments a WHERE a.website_id=? AND a.asset_id=r.value AND a.audience='WEBSITE'
    ORDER BY a.published DESC,a.attachment_id LIMIT 1) FROM json_each(?) r)`,[websiteId,JSON.stringify(refs)]));
  statements.push(store.statement('UPDATE websites SET published_key=draft_key,enabled=1,revision=? WHERE website_id=?',[revision,websiteId]));
 }else if(input.action==='withdraw'){historyKey=website.published_key;statements.push(store.statement('UPDATE websites SET enabled=0,revision=? WHERE website_id=?',[revision,websiteId]));}
 else if(input.action==='restore'){
  const old=await store.first('SELECT object_key FROM website_history WHERE website_id=? AND revision=?',[websiteId,input.historyRevision]);if(!old?.object_key)throw fail('Choose an existing historical edition.');await objectJSON(env.CONTENT,old.object_key);historyKey=old.object_key;statements.push(store.statement('UPDATE websites SET draft_key=?,revision=? WHERE website_id=?',[old.object_key,revision,websiteId]));
 }
 else throw fail('Choose a website action.');
 statements.push(store.statement('INSERT INTO website_history VALUES(?,?,?,?,?,?)',[websiteId,revision,input.action,historyKey,Date.now(),actor.account_id]));
 if(website.playlist_id)statements.push(store.statement('UPDATE mou_playlists SET revision=revision+1 WHERE playlist_id=?',[website.playlist_id]));
 const result=await store.mutate(actor,website.offering_id,input,statements,{websiteId,revision,action:input.action,cardPublication:cardApproval},{studio:Boolean(website.playlist_id),expectedSQL:'NOT EXISTS(SELECT 1 FROM source_access_master_fences WHERE account_id=? AND offering_id=?) AND EXISTS(SELECT 1 FROM websites WHERE website_id=? AND revision=?)'+(recordingOnly?" AND EXISTS(SELECT 1 FROM attachments a JOIN objects o USING(asset_id) WHERE a.website_id=? AND a.offering_id=? AND a.audience='RECORDING' AND o.mime_type IN('video/youtube','video/mp4'))":''),expectedArgs:[actor.account_id,website.offering_id,websiteId,website.revision,...(recordingOnly?[websiteId,website.offering_id]:[])]});
 await finishCardPublication(env,store,website.offering_id,result.cardPublication);return result;
}
export async function flushPublic(env,store){
 const head=await store.first("SELECT * FROM publication_heads WHERE scope='homepage'");if(!head)return {published:false};const edition=await objectJSON(env.CONTENT,head.object_key);
 for(let attempt=0;attempt<4;attempt++){
  const current=await env.CONTENT.get('public/home.json'),existing=current?await bodyJSON(current.body):null;
  if(existing&&existing.revision>=head.revision)return {published:true,revision:existing.revision};
  const result=await env.CONTENT.put('public/home.json',JSON.stringify({revision:head.revision,...edition}),{onlyIf:current?{etagMatches:current.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
  if(result)return {published:true,revision:head.revision};
 }throw fail('The public edition is waiting for a retry.',503,'PUBLICATION_PENDING');
}
export async function publishHome(env,store,actor,input){
 if(!actor.global_admin)throw fail('Only Global Admin can publish the homepage.',403);
 const old=await store.replay(actor.account_id,input.operationId,await store.requestHash(null,input));if(old){await flushPublic(env,store);return old;}
 const head=await store.first("SELECT revision FROM publication_heads WHERE scope='homepage'"),revision=(head?.revision||0)+1;
 const cards=await store.all(`SELECT c.offering_id,c.title,c.description,c.display_label,o.kind FROM cards c JOIN offerings o USING(offering_id) WHERE c.visible=1 AND o.active=1 ORDER BY c.offering_id LIMIT 200`);
 const announcements=await store.all('SELECT announcement_id,text FROM announcements WHERE visible=1 ORDER BY announcement_id LIMIT 30');
 const sessions=await store.all('SELECT session_id,offering_id,title,starts_at,ends_at,cancelled FROM timetable WHERE starts_at>=? AND starts_at<? AND cancelled=0 ORDER BY starts_at LIMIT 300',[Date.now()-86400_000,Date.now()+31*86400_000]);
 const edition={title:'Umm Abbad Academy',cards,announcements,sessions},key='public/versions/'+await sha256(JSON.stringify(edition))+'.json';await env.CONTENT.put(key,JSON.stringify(edition),{httpMetadata:{contentType:'application/json'}});
 const result=await store.mutate(actor,null,input,[store.statement("INSERT INTO publication_heads VALUES('homepage',?,?) ON CONFLICT(scope) DO UPDATE SET revision=excluded.revision,object_key=excluded.object_key",[revision,key])],{revision,published:true},{global:true,expectedSQL:"COALESCE((SELECT revision FROM publication_heads WHERE scope='homepage'),0)=?",expectedArgs:[revision-1]});
 await flushPublic(env,store);return result;
}
