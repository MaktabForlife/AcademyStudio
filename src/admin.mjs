import {companionChanges,publishRecordingAttachment} from './recording-companions.mjs';
import {bindMouSubject} from './mou-classroom.mjs';
import {changeCoursePolicy} from './course-policy.mjs';
import {academyAuthority,rejectAuthorityWrite} from './access.mjs';
import {fail,id,text,integer,flag,month,date,sha256,bytes,httpsURL} from './protocol.mjs';
import {fileKind,newCourse} from '../public/shared/model.mjs';
import {saveContent} from './content.mjs';
import {validatePackage} from './content-package.mjs';
export async function change(env,store,actor,offeringId,input,guardOptions={}){
 if(input.action==='recording-publication')return publishRecordingAttachment(store,actor,offeringId,input);
 if(['companion-save','companion-publish'].includes(input.action))return companionChanges(env,store,actor,offeringId,input);
 if(input.action==='mou-subject')return bindMouSubject(store,actor,offeringId,input,guardOptions);
 if(input.action==='course-policy')return changeCoursePolicy(store,actor,offeringId,input,guardOptions);
 if(!guardOptions.collect&&['content-batch','access-batch','participant','paid-months','website-months','staff','surah-grant','completion-month','completion-date','enrolment-decision','website-create','attachment'].includes(input.action))await rejectAuthorityWrite(store,offeringId);
 if(!guardOptions.collect&&(input.createOnly||input.action==='content-batch'&&input.changes?.some(c=>c.createOnly))){const replay=await store.replay(actor.account_id,input.operationId,await store.requestHash(offeringId,input));if(replay){await store.scope(actor,offeringId,{admin:true});return replay;}}
 const scope=guardOptions.collect?guardOptions.scope||null:await store.scope(actor,offeringId,{admin:true});const statements=[];const s=(sql,args=[])=>statements.push(store.statement(sql,args));
 if(input.action==='content-batch'){
  if(!Array.isArray(input.changes)||!input.changes.length||input.changes.length>25)throw fail('Save up to 25 reviewed media references together.');
  const seen=new Set();for(const item of input.changes){if(!['youtube','attachment'].includes(item.action))throw fail('A media batch cannot change learning access.');const key=item.action+':'+id(item.action==='youtube'?item.assetId:item.attachmentId);if(seen.has(key))throw fail('Choose each media reference once.');seen.add(key);}
  const attachments=input.changes.filter(item=>item.action==='attachment');let batchFacts=null;
  if(attachments.length){
   const assetIds=[...new Set(attachments.map(item=>id(item.assetId)))],websiteIds=[...new Set(attachments.filter(item=>item.websiteId).map(item=>id(item.websiteId)))],attachmentIds=attachments.map(item=>id(item.attachmentId));
   const [assets,websites,previous]=await store.batch([
    store.statement('SELECT o.asset_id,o.mime_type FROM json_each(?) j JOIN objects o ON o.asset_id=j.value JOIN asset_owners x ON x.asset_id=o.asset_id AND x.offering_id=?',[JSON.stringify(assetIds),offeringId]),
    store.statement('SELECT w.website_id,EXISTS(SELECT 1 FROM mou_playlists p WHERE p.website_id=w.website_id AND p.offering_id=w.offering_id) playlist FROM json_each(?) j JOIN websites w ON w.website_id=j.value AND w.offering_id=?',[JSON.stringify(websiteIds),offeringId]),
    store.statement('SELECT a.attachment_id,a.offering_id FROM json_each(?) j JOIN attachments a ON a.attachment_id=j.value',[JSON.stringify(attachmentIds)])
   ]);
   batchFacts={assets:new Map(assets.results.map(row=>[row.asset_id,row])),websites:new Set(websites.results.map(row=>row.website_id)),playlistWebsites:new Set(websites.results.filter(row=>row.playlist).map(row=>row.website_id)),previous:new Map(previous.results.map(row=>[row.attachment_id,row]))};
  }
  for(const item of input.changes)statements.push(...await change(env,store,actor,offeringId,item,{collect:true,scope,batchFacts}));
 }else if(input.action==='access-batch'){
  if(!Array.isArray(input.changes)||!input.changes.length||input.changes.length>40)throw fail('Save up to 40 access changes together.');
  const people=input.changes.filter(item=>item.action==='participant'),ids=people.map(item=>id(item.accountId));if(new Set(ids).size!==ids.length)throw fail('Choose each participant once per Save.');
  if(people.length){const rows=await store.all("SELECT a.account_id,p.purchased FROM json_each(?) j JOIN accounts a ON a.account_id=j.value LEFT JOIN participation p ON p.account_id=a.account_id AND p.offering_id=?",[JSON.stringify(ids),offeringId]),previous=new Map(rows.map(r=>[r.account_id,r.purchased]));
   if(rows.length!==people.length)throw fail('Create or explicitly link the Academy account first.',409,'IDENTITY_REQUIRED');
   const values=people.map(item=>{const enrolled=flag(item.enrolled),live=flag(item.live);if(previous.get(item.accountId)&&item.purchased===false&&!item.reason?.trim())throw fail('Give a reason for revoking a whole-Course purchase.');return {account:id(item.accountId),enrolled,live:enrolled&&live,purchased:flag(item.purchased),cohort:text(item.cohort||'',180)};});
   s("INSERT INTO participation SELECT json_extract(value,'$.account'),?,json_extract(value,'$.enrolled'),json_extract(value,'$.live'),json_extract(value,'$.purchased'),json_extract(value,'$.cohort') FROM json_each(?) WHERE 1 ON CONFLICT(account_id,offering_id) DO UPDATE SET enrolled=excluded.enrolled,live=excluded.live,purchased=excluded.purchased,cohort=excluded.cohort",[offeringId,JSON.stringify(values)]);
  }
  for(const item of input.changes){if(item.action==='participant')continue;if(!['paid-months','website-months','surah-grant','staff'].includes(item.action))throw fail('Choose a supported access change.');statements.push(...await change(env,store,actor,offeringId,item,{collect:true}));}
  if(statements.length>90)throw fail('Save a smaller access batch.');
 }else if(input.action==='participant'){
  const accountId=id(input.accountId),enrolled=flag(input.enrolled),live=flag(input.live);if(!await store.first('SELECT account_id FROM accounts WHERE account_id=?',[accountId]))throw fail('Create or explicitly link the Academy account first.',409,'IDENTITY_REQUIRED');
  const previous=await store.first('SELECT purchased FROM participation WHERE account_id=? AND offering_id=?',[accountId,offeringId]);if(previous?.purchased&&input.purchased===false&&!input.reason?.trim())throw fail('Give a reason for revoking a whole-Course purchase.');
  s(`INSERT INTO participation VALUES(?,?,?,?,?,?) ON CONFLICT(account_id,offering_id) DO UPDATE SET enrolled=excluded.enrolled,live=excluded.live,purchased=excluded.purchased,cohort=excluded.cohort`,[accountId,offeringId,enrolled,enrolled&&live,flag(input.purchased),text(input.cohort||'',180)]);
 }else if(input.action==='paid-months'){
  const offering=await store.first('SELECT kind FROM offerings WHERE offering_id=?',[offeringId]);if(offering.kind!=='TAFSEER'||!Array.isArray(input.changes)||input.changes.length>240)throw fail('Choose up to 240 Tafseer month changes.');
  const cells=[],seen=new Set();for(const cell of input.changes){const row={accountId:id(cell.accountId),month:month(cell.month),cohort:text(cell.cohort||'',180),paid:flag(cell.paid),reason:text(cell.reason||input.reason||'',500)},key=JSON.stringify([row.accountId,row.month,row.cohort]);if(seen.has(key))throw fail('Choose each account/month/cohort only once.');seen.add(key);if(!row.paid&&!row.reason.trim())throw fail('Give a reason for removing acquired rights.');cells.push(row);}
  const rows=JSON.stringify(cells);
  s("INSERT INTO paid_months SELECT json_extract(value,'$.accountId'),?,json_extract(value,'$.month'),json_extract(value,'$.cohort'),json_extract(value,'$.reason') FROM json_each(?) WHERE json_extract(value,'$.paid')=1 ON CONFLICT DO NOTHING",[offeringId,rows]);
  s("DELETE FROM paid_months WHERE offering_id=? AND (account_id,month,cohort) IN(SELECT json_extract(value,'$.accountId'),json_extract(value,'$.month'),json_extract(value,'$.cohort') FROM json_each(?) WHERE json_extract(value,'$.paid')=0)",[offeringId,rows]);
  s("INSERT INTO website_months SELECT json_extract(value,'$.accountId'),?,json_extract(value,'$.month') FROM json_each(?) WHERE json_extract(value,'$.paid')=1 ON CONFLICT DO NOTHING",[offeringId,rows]);
  s("DELETE FROM website_months WHERE offering_id=? AND (account_id,month) IN(SELECT json_extract(value,'$.accountId'),json_extract(value,'$.month') FROM json_each(?) WHERE json_extract(value,'$.paid')=0) AND NOT EXISTS(SELECT 1 FROM paid_months p WHERE p.account_id=website_months.account_id AND p.offering_id=website_months.offering_id AND p.month=website_months.month)",[offeringId,rows]);
 }else if(input.action==='website-months'){
  const offering=await store.first('SELECT kind FROM offerings WHERE offering_id=?',[offeringId]);if(offering.kind!=='TAFSEER'||!Array.isArray(input.changes)||input.changes.length>240)throw fail('Choose up to 240 website-month changes.');
  const cells=input.changes.map(c=>{const paid=flag(c.paid),reason=text(c.reason||input.reason||'',500);if(!paid&&!reason.trim())throw fail('Give a reason for removing acquired website rights.');return {accountId:id(c.accountId),month:month(c.month),paid,reason};}),rows=JSON.stringify(cells);if(new Set(cells.map(c=>JSON.stringify([c.accountId,c.month]))).size!==cells.length)throw fail('Choose each account and website month once.');
  s("INSERT INTO website_months SELECT json_extract(value,'$.accountId'),?,json_extract(value,'$.month') FROM json_each(?) WHERE json_extract(value,'$.paid')=1 ON CONFLICT DO NOTHING",[offeringId,rows]);
  s("DELETE FROM website_months WHERE offering_id=? AND (account_id,month) IN(SELECT json_extract(value,'$.accountId'),json_extract(value,'$.month') FROM json_each(?) WHERE json_extract(value,'$.paid')=0) AND NOT EXISTS(SELECT 1 FROM paid_months p WHERE p.account_id=website_months.account_id AND p.offering_id=website_months.offering_id AND p.month=website_months.month)",[offeringId,rows]);
 }else if(input.action==='staff'){
  if(academyAuthority(env))throw fail('Manage scoped staff roles in Academy User profiles.',409,'ACADEMY_STAFF_AUTHORITY');
  if(!actor.global_admin)throw fail('Only Global Admin changes staff authority.',403);const accountId=id(input.accountId);if(input.role===null)s('DELETE FROM staff WHERE account_id=? AND offering_id=?',[accountId,offeringId]);else {if(!['ADMIN','TEACHER'].includes(input.role))throw fail('Choose a staff role.');s('INSERT INTO staff VALUES(?,?,?,?) ON CONFLICT(account_id,offering_id) DO UPDATE SET role=excluded.role,can_create_account=excluded.can_create_account',[accountId,offeringId,input.role,flag(input.canCreateAccount||false)]);}
 }else if(input.action==='surah-grant'){
  const website=await store.first('SELECT website_id FROM websites WHERE website_id=? AND offering_id=?',[id(input.websiteId),offeringId]);if(!website)throw fail('Choose a website in this offering.');if(!input.reason?.trim())throw fail('Give a reason for the grant change.');
  if(input.enabled===true)s('INSERT INTO surah_grants VALUES(?,?,?) ON CONFLICT(account_id,website_id) DO UPDATE SET reason=excluded.reason',[id(input.accountId),website.website_id,text(input.reason,500)]);else if(input.enabled===false)s('DELETE FROM surah_grants WHERE account_id=? AND website_id=?',[id(input.accountId),website.website_id]);else throw fail('Choose whether to enable the grant.');
 }else if(input.action==='website-create'){
  const websiteId=id(input.websiteId),document=input.document||newCourse(),completionDate=input.completionDate?date(input.completionDate):null;
  const errors=validatePackage(document);if(errors.length)throw fail(errors.join(' '));const key=await saveContent(env,document,websiteId);
  s('INSERT INTO websites VALUES(?,?,?,?,?,NULL,0,0,?)',[websiteId,offeringId,text(input.title),completionDate?completionDate.slice(0,7):input.completionMonth?month(input.completionMonth):null,key,completionDate]);
 }else if(input.action==='completion-month'){
  const previous=await store.first('SELECT completion_date FROM websites WHERE website_id=? AND offering_id=?',[id(input.websiteId),offeringId]);if(previous?.completion_date)throw fail('Preserve the full completion date using the completion-date action.');
  s('UPDATE websites SET completion_month=?,revision=revision+1 WHERE website_id=? AND offering_id=?',[month(input.month),id(input.websiteId),offeringId]);
 }else if(input.action==='completion-date'){
  const completionDate=date(input.completionDate);s('UPDATE websites SET completion_date=?,completion_month=?,revision=revision+1 WHERE website_id=? AND offering_id=?',[completionDate,completionDate.slice(0,7),id(input.websiteId),offeringId]);
 }else if(input.action==='card'){
  s(`INSERT INTO cards VALUES(?,?,?,?,?,0) ON CONFLICT(offering_id) DO UPDATE SET title=excluded.title,description=excluded.description,display_label=excluded.display_label,visible=excluded.visible,revision=cards.revision+1`,[offeringId,text(input.title),text(input.description||'',2000),text(input.displayLabel||''),flag(input.visible)]);
 }else if(input.action==='attachment'){
  if(scope?.programme_key==='mothers'&&input.audience==='RECORDING'&&!guardOptions.playlistChecked)throw fail('Use the checked media form and choose a MOU playlist.',409,'PLAYLIST_REQUIRED');
  if(input.websiteId&&!guardOptions.playlistChecked&&(guardOptions.batchFacts?guardOptions.batchFacts.playlistWebsites.has(id(input.websiteId)):await store.first('SELECT 1 FROM mou_playlists WHERE website_id=? AND offering_id=?',[id(input.websiteId),offeringId])))throw fail('Use the checked media form and choose this playlist.',409,'PLAYLIST_REQUIRED');
  const assetId=id(input.assetId),asset=guardOptions.batchFacts?guardOptions.batchFacts.assets.get(assetId):await store.first('SELECT o.mime_type FROM objects o JOIN asset_owners x USING(asset_id) WHERE o.asset_id=? AND x.offering_id=?',[assetId,offeringId]);if(!asset)throw fail('Choose a file owned by this offering.',403);
  const websiteId=input.websiteId?id(input.websiteId):null;if(websiteId&&!(guardOptions.batchFacts?guardOptions.batchFacts.websites.has(websiteId):await store.first('SELECT website_id FROM websites WHERE website_id=? AND offering_id=?',[websiteId,offeringId])))throw fail('Choose a website in this offering.');
  if(!['WEBSITE','RECORDING'].includes(input.audience)||input.audience==='WEBSITE'&&(!websiteId||!['application/pdf','image/png','image/jpeg','image/webp'].includes(asset.mime_type)))throw fail('Website-only rights cannot grant recordings.');
  const previous=guardOptions.batchFacts?guardOptions.batchFacts.previous.get(id(input.attachmentId)):await store.first('SELECT offering_id FROM attachments WHERE attachment_id=?',[id(input.attachmentId)]);if(previous&&previous.offering_id!==offeringId)throw fail('This attachment belongs elsewhere.',403);
  if(input.createOnly&&previous)throw fail('Preserve the existing native recording association.',409);
  // Historical Course recordings need no invented date or live session. Monthly
  // programmes still require their exact recording date for retained rights.
  const lessonDate=(scope?.kind==='COURSE'||input.audience==='WEBSITE')&&(input.lessonDate==null||input.lessonDate==='')?'':date(input.lessonDate);
  s(`INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(attachment_id) DO UPDATE SET website_id=excluded.website_id,asset_id=excluded.asset_id,lesson_id=excluded.lesson_id,lesson_date=excluded.lesson_date,cohort=excluded.cohort,title=excluded.title,audience=excluded.audience,published=excluded.published`,[input.attachmentId,offeringId,websiteId,assetId,id(input.lessonId),lessonDate,text(input.cohort||'',180),text(input.title),input.audience,flag(input.published)]);
 }else if(input.action==='youtube'){
  if(!/^[A-Za-z0-9_-]{11}$/.test(input.videoId||''))throw fail('Choose a valid YouTube recording.');const assetId=id(input.assetId);
  s('INSERT INTO objects VALUES(?,NULL,?,?,0,NULL,?)',[assetId,'video/youtube',text(input.title),input.videoId]);s('INSERT INTO asset_owners VALUES(?,?)',[assetId,offeringId]);
 }else if(input.action==='enrolment-decision'){
  if(!['APPROVED','REJECTED'].includes(input.state))throw fail('Choose an enrolment decision.');const request=await store.first('SELECT * FROM enrolment_requests WHERE request_id=? AND offering_id=?',[id(input.requestId),offeringId]);if(!request)throw fail('Request not found.',404);
  const target=id(input.accountId||request.requester_id);s('UPDATE enrolment_requests SET state=?,linked_account_id=? WHERE request_id=?',[input.state,target,request.request_id]);
  // Approval is participation only. Self-reported payment never creates a purchase.
  if(input.state==='APPROVED')s('INSERT INTO participation VALUES(?,?,1,0,0,\'\') ON CONFLICT(account_id,offering_id) DO UPDATE SET enrolled=1',[target,offeringId]);
 }else throw fail('Unknown administration action.');
 if(guardOptions.collect)return statements;
 const createOnly=input.action==='attachment'&&input.createOnly?[id(input.attachmentId)]:input.action==='content-batch'?input.changes.filter(c=>c.action==='attachment'&&c.createOnly).map(c=>id(c.attachmentId)):[];if(createOnly.length)guardOptions={...guardOptions,expectedSQL:`(${guardOptions.expectedSQL||'1'}) AND NOT EXISTS(SELECT 1 FROM attachments WHERE attachment_id IN(SELECT value FROM json_each(?)))`,expectedArgs:[...(guardOptions.expectedArgs||[]),JSON.stringify(createOnly)]};
 return store.mutate(actor,offeringId,input,statements,{saved:true},{...guardOptions,global:input.action==='staff'||input.action==='access-batch'&&input.changes.some(c=>c.action==='staff'),studio:['content-batch','access-batch','participant','paid-months','website-months','staff','surah-grant','completion-month','completion-date','enrolment-decision','website-create','attachment'].includes(input.action)});
}
export async function upload(env,store,actor,offeringId,request){
 await store.scope(actor,offeringId,{admin:true});const url=new URL(request.url),assetId=id(url.searchParams.get('assetId')),operationId=id(url.searchParams.get('operationId')),filename=text(url.searchParams.get('filename')||'File');
 const data=await bytes(request.body,16*1024*1024),kind=fileKind(data);if(!kind||!data.length||kind.startsWith('image/')&&data.length>5*1024*1024)throw fail('Choose a PDF up to 16 MB or an image up to 5 MB.');
 const hash=await sha256(data),key='shared/sha256/'+hash,input={operationId,action:'upload',assetId,filename,hash};const old=await store.replay(actor.account_id,operationId,await store.requestHash(offeringId,input));if(old)return old;
 await env.MEDIA.put(key,data,{httpMetadata:{contentType:kind}});
 return store.mutate(actor,offeringId,input,[store.statement('INSERT INTO objects VALUES(?,?,?,?,?,?,NULL)',[assetId,key,kind,filename,data.length,hash]),store.statement('INSERT INTO asset_owners VALUES(?,?)',[assetId,offeringId])],{assetId,type:kind,size:data.length});
}
export async function recording(env,store,actor,offeringId,input,request){
 await store.scope(actor,offeringId,{admin:true});const assetId=id(input.assetId);
 if(input.action==='start'){
  const old=await store.first('SELECT * FROM uploads WHERE asset_id=?',[assetId]);if(old){if(old.offering_id!==offeringId)throw fail('Recording belongs elsewhere.',403);return {assetId,uploadId:old.upload_id};}
  const key='retained/'+encodeURIComponent(offeringId)+'/'+assetId,multipart=await env.MEDIA.createMultipartUpload(key,{httpMetadata:{contentType:'video/mp4'}});
  await store.mutate(actor,offeringId,input,[store.statement('INSERT INTO uploads VALUES(?,?,?,?,?,?,\'OPEN\')',[assetId,offeringId,key,multipart.uploadId,text(input.filename),Date.now()])],{assetId,uploadId:multipart.uploadId});return {assetId,uploadId:multipart.uploadId};
 }
 const row=await store.first('SELECT * FROM uploads WHERE asset_id=? AND offering_id=?',[assetId,offeringId]);if(!row)throw fail('Recording upload not found.',404);const multipart=env.MEDIA.resumeMultipartUpload(row.object_key,row.upload_id);
 if(input.action==='part'){
  if(row.state!=='OPEN')throw fail('This upload is complete.',409);const partNumber=integer(input.partNumber,1,10000),data=await bytes(request.body,10*1024*1024);
  if(partNumber===1&&String.fromCharCode(...data.slice(4,8))!=='ftyp')throw fail('Choose an MP4 recording.');const part=await multipart.uploadPart(partNumber,data);return {partNumber:part.partNumber,etag:part.etag};
 }
 if(input.action==='complete'){
  if(!Array.isArray(input.parts)||!input.parts.length||input.parts.length>10000)throw fail('Supply the uploaded recording parts.');
  const parts=input.parts.map((p,index)=>{if(p.partNumber!==index+1)throw fail('Supply all recording parts in order, starting with part one.');return {partNumber:integer(p.partNumber,1,10000),etag:text(p.etag,1024)};});
  let object=await env.MEDIA.head(row.object_key);if(!object)object=await multipart.complete(parts);
  const result=await store.mutate(actor,offeringId,input,[store.statement('INSERT INTO objects VALUES(?,?,?,?,?,?,NULL)',[assetId,row.object_key,'video/mp4',row.filename,object.size,'multipart:'+object.etag]),store.statement('INSERT INTO asset_owners VALUES(?,?)',[assetId,offeringId]),store.statement("UPDATE uploads SET state='COMPLETE' WHERE asset_id=?",[assetId])],{assetId,size:object.size,retained:true});return result;
 }throw fail('Unknown recording upload action.');
}
export async function announcements(store,actor,input){if(!actor.global_admin)throw fail('Only Global Admin edits public announcements.',403);return store.mutate(actor,null,input,[store.statement('INSERT INTO announcements VALUES(?,?,?) ON CONFLICT(announcement_id) DO UPDATE SET text=excluded.text,visible=excluded.visible',[id(input.id),text(input.text,4000),flag(input.visible)])],{saved:true},{global:true});}
