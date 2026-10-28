import {fail,id,text,month,sha256,bodyJSON} from './protocol.mjs';
import {validateCourse,referencedAssets} from '../public/shared/model.mjs';
export async function objectJSON(bucket,key,limit=1_500_000){const object=await bucket.get(key);if(!object||object.size>limit)throw fail('The saved edition is unavailable.',503);return bodyJSON(object.body,limit);}
export async function saveContent(env,document,websiteId=document.id){const encoded=JSON.stringify(document);if(new TextEncoder().encode(encoded).length>1_500_000)throw fail('This website edition is too large.',413);const hash=await sha256(encoded),key='websites/'+encodeURIComponent(websiteId)+'/versions/'+hash+'.json';await env.CONTENT.put(key,encoded,{httpMetadata:{contentType:'application/json'}});return key;}
export async function websiteAccess(store,actor,websiteId,{admin=false}={}){
 const row=await store.first(`SELECT w.*,o.kind,o.active,p.purchased,s.role,
  EXISTS(SELECT 1 FROM paid_months m WHERE m.account_id=? AND m.offering_id=w.offering_id AND m.month=w.completion_month) paid,
  EXISTS(SELECT 1 FROM surah_grants g WHERE g.account_id=? AND g.website_id=w.website_id) granted
  FROM websites w JOIN offerings o USING(offering_id)
  LEFT JOIN participation p ON p.account_id=? AND p.offering_id=w.offering_id
  LEFT JOIN staff s ON s.account_id=? AND s.offering_id=w.offering_id WHERE w.website_id=?`,[actor.account_id,actor.account_id,actor.account_id,actor.account_id,id(websiteId)]);
 if(!row||!row.active)throw fail('This website is unavailable.',404);
 if(admin){await store.scope(actor,row.offering_id,{admin:true});return row;}
 const staff=actor.global_admin||row.role==='ADMIN'||row.role==='TEACHER';
 if(!staff&&!(row.kind==='COURSE'&&row.purchased||row.kind==='TAFSEER'&&(row.paid||row.granted)))throw fail('Your account does not have this material.',403,'MATERIAL_ACCESS_REQUIRED');
 if(!row.enabled||!row.published_key)throw fail('This website is not published.',404);return row;
}
export async function editWebsite(env,store,actor,websiteId,input){
 input={...input,websiteId};const website=await websiteAccess(store,actor,websiteId,{admin:true}),hash=await store.requestHash(website.offering_id,input),old=await store.replay(actor.account_id,input.operationId,hash);if(old)return old;
 if(input.revision!==website.revision)throw fail('This website changed elsewhere. Reopen the saved draft.',409);
 const revision=website.revision+1,statements=[];let historyKey=website.draft_key;
 if(input.action==='save'){
  const document=structuredClone(input.document);document.pages.assessments=false;
  let errors;try{errors=validateCourse(document,{review:false});}catch(error){throw fail(error.message);}if(errors.length)throw fail(errors.join(' '));
  const refs=referencedAssets(document);if(refs.length>100)throw fail('Keep up to 100 website assets.');
  for(const assetId of refs){const ref=await store.first('SELECT attachment_id FROM attachments WHERE asset_id=? AND website_id=? AND audience=\'WEBSITE\' LIMIT 1',[id(assetId),websiteId]);if(!ref)throw fail('A website file needs an attachment to this website.');}
  const key=await saveContent(env,document,websiteId);historyKey=key;statements.push(store.statement('UPDATE websites SET draft_key=?,revision=? WHERE website_id=?',[key,revision,websiteId]));
 }else if(input.action==='publish'){
  if(!website.draft_key)throw fail('Save a draft first.');const document=await objectJSON(env.CONTENT,website.draft_key);const errors=validateCourse(document,{review:true});if(errors.length)throw fail(errors.join(' '));
  const refs=referencedAssets(document);const linked=await store.all("SELECT asset_id FROM attachments WHERE website_id=? AND audience='WEBSITE' AND asset_id IN(SELECT value FROM json_each(?))",[websiteId,JSON.stringify(refs)]);
  if(refs.some(ref=>!linked.some(row=>row.asset_id===ref)))throw fail('A referenced website asset is no longer attached.');
  statements.push(store.statement('DELETE FROM published_assets WHERE website_id=?',[websiteId]));
  for(const assetId of refs)statements.push(store.statement('INSERT INTO published_assets VALUES(?,?)',[websiteId,assetId]));
  statements.push(store.statement("UPDATE attachments SET published=1 WHERE website_id=? AND audience='WEBSITE' AND asset_id IN(SELECT value FROM json_each(?))",[websiteId,JSON.stringify(refs)]));
  statements.push(store.statement('UPDATE websites SET published_key=draft_key,enabled=1,revision=? WHERE website_id=?',[revision,websiteId]));
 }else if(input.action==='withdraw'){historyKey=website.published_key;statements.push(store.statement('UPDATE websites SET enabled=0,revision=? WHERE website_id=?',[revision,websiteId]));}
 else if(input.action==='restore'){
  const old=await store.first('SELECT object_key FROM website_history WHERE website_id=? AND revision=?',[websiteId,input.historyRevision]);if(!old?.object_key)throw fail('Choose an existing historical edition.');await objectJSON(env.CONTENT,old.object_key);historyKey=old.object_key;statements.push(store.statement('UPDATE websites SET draft_key=?,revision=? WHERE website_id=?',[old.object_key,revision,websiteId]));
 }
 else throw fail('Choose a website action.');
 statements.push(store.statement('INSERT INTO website_history VALUES(?,?,?,?,?,?)',[websiteId,revision,input.action,historyKey,Date.now(),actor.account_id]));
 return store.mutate(actor,website.offering_id,input,statements,{websiteId,revision,action:input.action},{expectedSQL:'EXISTS(SELECT 1 FROM websites WHERE website_id=? AND revision=?)',expectedArgs:[websiteId,website.revision]});
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
