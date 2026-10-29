import {rejectAuthorityWrite} from './access.mjs';
import {fail,id,text,integer,flag,month,date,sha256,bytes,httpsURL} from './protocol.mjs';
import {fileKind,newCourse} from '../public/shared/model.mjs';
import {saveContent} from './content.mjs';
import {validatePackage} from './content-package.mjs';
export async function change(env,store,actor,offeringId,input){
 if(['participant','paid-months','staff','surah-grant','completion-month','completion-date','enrolment-decision','website-create','attachment'].includes(input.action))await rejectAuthorityWrite(store,offeringId);
 await store.scope(actor,offeringId,{admin:true});const statements=[];const s=(sql,args=[])=>statements.push(store.statement(sql,args));
 if(input.action==='participant'){
  const accountId=id(input.accountId);if(!await store.first('SELECT account_id FROM accounts WHERE account_id=?',[accountId]))throw fail('Create or explicitly link the Academy account first.',409,'IDENTITY_REQUIRED');
  const previous=await store.first('SELECT purchased FROM participation WHERE account_id=? AND offering_id=?',[accountId,offeringId]);if(previous?.purchased&&input.purchased===false&&!input.reason?.trim())throw fail('Give a reason for revoking a whole-Course purchase.');
  s(`INSERT INTO participation VALUES(?,?,?,?,?,?) ON CONFLICT(account_id,offering_id) DO UPDATE SET enrolled=excluded.enrolled,live=excluded.live,purchased=excluded.purchased,cohort=excluded.cohort`,[accountId,offeringId,flag(input.enrolled),flag(input.live),flag(input.purchased),text(input.cohort||'',180)]);
 }else if(input.action==='paid-months'){
  const offering=await store.first('SELECT kind FROM offerings WHERE offering_id=?',[offeringId]);if(offering.kind!=='TAFSEER'||!Array.isArray(input.changes)||input.changes.length>240)throw fail('Choose up to 240 Tafseer month changes.');
  for(const cell of input.changes){const args=[id(cell.accountId),offeringId,month(cell.month),text(cell.cohort||'',180)];if(cell.paid===true)s('INSERT INTO paid_months VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING',[...args,text(cell.reason||'',500)]);else if(cell.paid===false){if(!cell.reason?.trim())throw fail('Give a reason for removing acquired rights.');s('DELETE FROM paid_months WHERE account_id=? AND offering_id=? AND month=? AND cohort=?',args);}else throw fail('Choose paid or unpaid.');if(cell.paid)s('INSERT INTO website_months VALUES(?,?,?) ON CONFLICT DO NOTHING',args.slice(0,3));else s('DELETE FROM website_months WHERE account_id=? AND offering_id=? AND month=? AND NOT EXISTS(SELECT 1 FROM paid_months m WHERE m.account_id=? AND m.offering_id=? AND m.month=?)',[...args.slice(0,3),...args.slice(0,3)]);}
 }else if(input.action==='staff'){
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
  const assetId=id(input.assetId),asset=await store.first('SELECT o.mime_type FROM objects o JOIN asset_owners x USING(asset_id) WHERE o.asset_id=? AND x.offering_id=?',[assetId,offeringId]);if(!asset)throw fail('Choose a file owned by this offering.',403);
  const websiteId=input.websiteId?id(input.websiteId):null;if(websiteId&&!await store.first('SELECT website_id FROM websites WHERE website_id=? AND offering_id=?',[websiteId,offeringId]))throw fail('Choose a website in this offering.');
  if(!['WEBSITE','RECORDING'].includes(input.audience)||input.audience==='WEBSITE'&&(!websiteId||!['application/pdf','image/png','image/jpeg','image/webp'].includes(asset.mime_type)))throw fail('Website-only rights cannot grant recordings.');
  const previous=await store.first('SELECT offering_id FROM attachments WHERE attachment_id=?',[id(input.attachmentId)]);if(previous&&previous.offering_id!==offeringId)throw fail('This attachment belongs elsewhere.',403);
  s(`INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(attachment_id) DO UPDATE SET website_id=excluded.website_id,asset_id=excluded.asset_id,lesson_id=excluded.lesson_id,lesson_date=excluded.lesson_date,cohort=excluded.cohort,title=excluded.title,audience=excluded.audience,published=excluded.published`,[input.attachmentId,offeringId,websiteId,assetId,id(input.lessonId),date(input.lessonDate),text(input.cohort||'',180),text(input.title),input.audience,flag(input.published)]);
 }else if(input.action==='youtube'){
  if(!/^[A-Za-z0-9_-]{11}$/.test(input.videoId||''))throw fail('Choose a valid YouTube recording.');const assetId=id(input.assetId);
  s('INSERT INTO objects VALUES(?,NULL,?,?,0,NULL,?)',[assetId,'video/youtube',text(input.title),input.videoId]);s('INSERT INTO asset_owners VALUES(?,?)',[assetId,offeringId]);
 }else if(input.action==='enrolment-decision'){
  if(!['APPROVED','REJECTED'].includes(input.state))throw fail('Choose an enrolment decision.');const request=await store.first('SELECT * FROM enrolment_requests WHERE request_id=? AND offering_id=?',[id(input.requestId),offeringId]);if(!request)throw fail('Request not found.',404);
  const target=id(input.accountId||request.requester_id);s('UPDATE enrolment_requests SET state=?,linked_account_id=? WHERE request_id=?',[input.state,target,request.request_id]);
  // Approval is participation only. Self-reported payment never creates a purchase.
  if(input.state==='APPROVED')s('INSERT INTO participation VALUES(?,?,1,0,0,\'\') ON CONFLICT(account_id,offering_id) DO UPDATE SET enrolled=1',[target,offeringId]);
 }else throw fail('Unknown administration action.');
 return store.mutate(actor,offeringId,input,statements,{saved:true},{global:input.action==='staff'});
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
