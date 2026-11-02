import {fail,id} from './protocol.mjs';
import {objectJSON} from './content.mjs';
import {recordingGuides} from '../public/shared/recording-companion.mjs';
import {permittedGuideBindings} from './circles.mjs';

// Review existing operational material only. No file upload, material import,
// entitlement mutation or publication occurs here.
export async function existingCollection(env,store,actor,offer,websiteId){
 const scope=await store.scope(actor,offer,{admin:true,readOnly:true});
 if(scope.programme_key!=='mothers')throw fail('Choose the MOU media workspace.',403);
 const website=await store.first('SELECT w.* FROM programme_subjects s JOIN websites w USING(website_id) WHERE s.offering_id=? AND s.website_id=? AND s.enabled=1',[offer,id(websiteId)]);
 if(!website||!website.published_key||!website.enabled)throw fail('Choose an existing published MOU subject.',409);
 const rows=await store.all("SELECT a.attachment_id,a.asset_id,a.website_id,a.lesson_id,a.lesson_date,a.title,a.published,o.mime_type type,c.index_json FROM attachments a JOIN objects o USING(asset_id) LEFT JOIN recording_companions c USING(attachment_id) WHERE a.offering_id=? AND a.website_id=? AND a.audience='RECORDING' AND o.mime_type IN('video/mp4','video/youtube') ORDER BY a.attachment_id LIMIT 51",[offer,website.website_id]);
 if(!rows.length||rows.length>50)throw fail('Review a collection with one to fifty existing recordings.',409);
 const document=await objectJSON(env.CONTENT,website.published_key);website.programme_key='mothers';const guides=recordingGuides(document),bindings=await permittedGuideBindings(env,website,rows,store),ordered=[],unresolved=[];
 for(const guide of guides){
  const matching=rows.filter(row=>row.lesson_id===guide.lessonId||bindings.some(binding=>binding.editorialLessonId===guide.lessonId&&binding.nativeLessonId===row.lesson_id&&binding.assetId===row.asset_id));
  if(matching.length!==1){unresolved.push({editorialLessonId:guide.lessonId,attachmentIds:matching.map(row=>row.attachment_id)});continue;}
  const row=matching[0],old=ordered.find(item=>item.attachmentId===row.attachment_id);
  if(old){if(guide.readingId&&!old.readingIds.includes(guide.readingId))old.readingIds.push(guide.readingId);continue;}
  const index=row.index_json?JSON.parse(row.index_json):null;
  ordered.push({attachmentId:row.attachment_id,assetId:row.asset_id,title:row.title,recordedDate:row.lesson_date,published:Boolean(row.published),summary:index?.summary||guide.summary||'',topics:index?.topics||guide.topics||[],...(guide.quote?{quote:guide.quote}:{}),readingIds:guide.readingId?[guide.readingId]:[]});
 }
 for(const row of rows)if(!ordered.some(item=>item.attachmentId===row.attachment_id))unresolved.push({attachmentId:row.attachment_id,lessonId:row.lesson_id,reason:'No exact saved reading/recording binding'});
 const pdfs=await store.all("SELECT a.attachment_id attachmentId,a.asset_id assetId,a.title,o.byte_size size,o.object_key objectKey FROM attachments a JOIN objects o USING(asset_id) JOIN published_assets p ON p.website_id=a.website_id AND p.asset_id=a.asset_id WHERE a.offering_id=? AND a.website_id=? AND a.audience='WEBSITE' AND a.published=1 AND o.mime_type='application/pdf' ORDER BY a.attachment_id LIMIT 11",[offer,website.website_id]);
 if(pdfs.length>10)throw fail('Review a collection with up to ten shared PDFs.',409);
 for(const pdf of pdfs){if(!await env.MEDIA.head(pdf.objectKey))unresolved.push({assetId:pdf.assetId,reason:'Original protected PDF is unavailable'});delete pdf.objectKey;}
 const after=await store.first('SELECT revision,published_key,enabled FROM websites WHERE website_id=?',[website.website_id]);
 if(after.revision!==website.revision||after.published_key!==website.published_key||!after.enabled)throw fail('This source collection changed. Review it again.',409,'CHANGE_CONFLICT');
 return {schema:'EXISTING_MOU_COLLECTION_V1',websiteId:website.website_id,title:website.title,sourceReview:{websiteId:website.website_id,revision:website.revision,publishedKey:website.published_key},recordings:ordered,pdfs,unresolved,canAttach:unresolved.length===0&&ordered.length===rows.length,pdfAccess:'EXISTING_MOU_WEBSITE',href:'/studio/?website='+encodeURIComponent(website.website_id)};
}

// One private website attachment reuses the existing PDF asset and object. The
// playlist's explicit publication publishes this website resource, never a recording.
export async function referenceCollectionPDF(env,store,actor,offer,input){
 const {playlistScope,checkedPlaylist}=await import('./mou-playlists.mjs');
 const {saveContent}=await import('./content.mjs');
 const scope=await playlistScope(store,actor,offer);if(scope.programme_key!=='mothers')throw fail('Choose the MOU media workspace.',403);
 const replay=await store.replay(actor.account_id,input.operationId,await store.requestHash(offer,input));if(replay)return replay;
 const playlist=await checkedPlaylist(store,offer,input.playlistId),source=input.sourceReview;
 if(!source||typeof source.publishedKey!=='string'||source.publishedKey.length>512||!Number.isSafeInteger(source.revision)||playlist.enabled)throw fail('Review the original PDF and a private target playlist.',409);
 const pdf=await store.first("SELECT a.*,o.object_key,o.mime_type FROM attachments a JOIN objects o USING(asset_id) JOIN published_assets p ON p.website_id=a.website_id AND p.asset_id=a.asset_id WHERE a.attachment_id=? AND a.offering_id=? AND a.website_id=? AND a.audience='WEBSITE' AND a.published=1 AND o.mime_type='application/pdf'",[id(input.sourceAttachmentId),offer,id(source.websiteId)]);
 if(!pdf||!await env.MEDIA.head(pdf.object_key))throw fail('The original protected PDF is unavailable.',409);
 const document=await objectJSON(env.CONTENT,playlist.draft_key);
 const existing=await store.first("SELECT attachment_id FROM attachments WHERE website_id=? AND asset_id=? AND audience='WEBSITE' ORDER BY attachment_id LIMIT 1",[playlist.website_id,pdf.asset_id]);
 if(!document.materials.files.some(file=>file.assetId===pdf.asset_id))document.materials.files.push({id:'shared-'+pdf.asset_id,assetId:pdf.asset_id,title:pdf.title,description:'Original shared notes · existing protected file'});
 const key=await saveContent(env,document,playlist.website_id),attachmentId=existing?.attachment_id||id(input.attachmentId);
 const statements=[...(!existing?[store.statement("INSERT INTO attachments VALUES(?,?,?,?,?,'','',?,'WEBSITE',0)",[attachmentId,offer,playlist.website_id,pdf.asset_id,'',pdf.title])]:[]),store.statement('UPDATE websites SET draft_key=?,revision=revision+1 WHERE website_id=?',[key,playlist.website_id]),store.statement('UPDATE mou_playlists SET revision=revision+1 WHERE playlist_id=?',[playlist.playlist_id])];
 return store.mutate(actor,offer,input,statements,{saved:true,attachmentId,assetId:pdf.asset_id,private:true},{studio:true,expectedSQL:"COALESCE((SELECT revision FROM access_revisions WHERE offering_id=?),0)=? AND EXISTS(SELECT 1 FROM mou_playlists p JOIN websites w USING(website_id) WHERE p.playlist_id=? AND p.offering_id=? AND p.revision=? AND w.revision=? AND w.enabled=0) AND EXISTS(SELECT 1 FROM websites w JOIN programme_subjects s USING(website_id) WHERE w.website_id=? AND w.offering_id=? AND w.revision=? AND w.published_key=? AND w.enabled=1 AND s.enabled=1) AND EXISTS(SELECT 1 FROM attachments WHERE attachment_id=? AND asset_id=? AND website_id=? AND published=1)",expectedArgs:[offer,input.revision,playlist.playlist_id,offer,input.playlistRevision,input.websiteRevision,source.websiteId,offer,source.revision,source.publishedKey,pdf.attachment_id,pdf.asset_id,source.websiteId]});
}
