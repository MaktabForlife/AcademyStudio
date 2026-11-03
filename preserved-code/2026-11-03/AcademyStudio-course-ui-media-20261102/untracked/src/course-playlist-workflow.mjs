import {fail,id,text,integer} from './protocol.mjs';
import {academyCommand} from './academy-client.mjs';
import {newCourse} from '../public/shared/model.mjs';
import {saveContent,websiteAccess} from './content.mjs';
import {playlistScope} from './mou-playlists.mjs';
import {cardInput,optionalTeacherIds,savedCard,cardDTO,cardPublication,finishCardPublication} from './playlist-cards.mjs';
import {attributionChange,mediaDetail} from './media-attribution.mjs';
import {streamMedia} from './media.mjs';

const revision=async(store,offer)=>(await store.first('SELECT revision FROM access_revisions WHERE offering_id=?',[offer]))?.revision||0;
async function scope(store,actor,offer,readOnly=false){const s=await playlistScope(store,actor,offer,{readOnly});if(s.kind!=='COURSE')throw fail('Open Course Media.',403);return s;}
const rowFor=(store,offer,key)=>store.first(`SELECT p.*,w.title,w.draft_key,w.published_key,w.enabled,w.revision website_revision,c.* FROM mou_playlists p JOIN websites w USING(website_id) JOIN course_playlist_workflows c USING(playlist_id) WHERE p.playlist_id=? AND p.offering_id=?`,[id(key),offer]);
const metadata=(store,key,stage)=>store.all('SELECT activity_key activityKey,offering_id offeringId,class_id classId,title,class_name className FROM course_playlist_placements WHERE playlist_id=? AND stage=? ORDER BY activity_key,class_id',[key,stage]);
const entries=(store,key,stage)=>store.all('SELECT kind,reference_id referenceId,position,snapshot_json FROM course_playlist_content WHERE playlist_id=? AND stage=? ORDER BY position',[key,stage]).then(rows=>rows.map(r=>({...r,snapshot:JSON.parse(r.snapshot_json),snapshot_json:undefined})));
async function locations(env,store,actor,offer,input,fetcher){
 await scope(store,actor,offer);if(!actor.source_ref)throw fail('Reopen your native Academy Admin session.',401);
 const result=await academyCommand(env,store,'/internal/website/course-playlist-placements',{sourceRef:actor.source_ref,offeringId:offer,purpose:'ADMIN_MEDIA',...input},fetcher);
 if(result.schema!=='COURSE_PLAYLIST_PLACEMENTS_V1'||result.offeringId!==offer||!Array.isArray(result.locations)||result.locations.length>50||!Array.isArray(result.placements)||result.placements.length>20||Math.abs(Date.now()-result.checkedAt)>60000)throw fail('Refresh the permitted playlist locations.',503);
 await scope(store,await store.actor(actor.token_hash),offer);return result;
}
function expected(offer,input,row){return {studio:true,expectedSQL:'NOT EXISTS(SELECT 1 FROM source_access_master_fences WHERE account_id=? AND offering_id=?) AND COALESCE((SELECT revision FROM access_revisions WHERE offering_id=?),0)=?'+(row?' AND EXISTS(SELECT 1 FROM mou_playlists p JOIN websites w USING(website_id) JOIN course_playlist_workflows c USING(playlist_id) WHERE p.playlist_id=? AND p.offering_id=? AND p.revision=? AND w.revision=? AND c.content_revision=?)':' AND NOT EXISTS(SELECT 1 FROM websites WHERE website_id=?)'),expectedArgs:[input.actorId,offer,offer,integer(input.revision),...(row?[row.playlist_id,offer,integer(input.playlistRevision),integer(input.websiteRevision),integer(input.contentRevision)]:[id(input.playlistId)])]};}
function placementStatements(store,key,stage,values){return [store.statement('DELETE FROM course_playlist_placements WHERE playlist_id=? AND stage=?',[key,stage]),...values.map(p=>store.statement('INSERT INTO course_playlist_placements VALUES(?,?,?,?,?,?,?)',[key,stage,p.activityKey,p.offeringId,p.classId,p.title,p.className]))];}
function contentStatements(store,key,stage,values){return [store.statement('DELETE FROM course_playlist_content WHERE playlist_id=? AND stage=?',[key,stage]),...values.map((v,i)=>store.statement('INSERT INTO course_playlist_content VALUES(?,?,?,?,?,?)',[key,stage,v.kind,v.referenceId,i+1,JSON.stringify(v.snapshot)]))];}

export async function coursePlaylistRead(env,store,actor,offer,input={},fetcher){
 await scope(store,actor,offer,true);const start=await revision(store,offer);
 if(input.action==='course-playlist-options')return locations(env,store,actor,offer,{after:input.after||'',...(input.activityKey?{activityKey:input.activityKey}:{})},fetcher);
 if(input.action==='course-playlist-detail'){
  const row=await rowFor(store,offer,input.playlistId);if(!row)throw fail('Choose a saved Course playlist.',404);
  const card=await store.first('SELECT * FROM playlist_card_designs WHERE playlist_id=?',[row.playlist_id]);
  const result={playlist:{id:row.playlist_id,name:row.title,description:row.description_draft,revision:row.revision,websiteId:row.website_id,websiteRevision:row.website_revision,contentRevision:row.content_revision,publishedContentRevision:row.content_published_revision,cardPublished:Boolean(row.enabled&&row.published_key),publishedDescription:row.description_published,card:cardDTO(card.draft_json),teacherIds:JSON.parse(card.teacher_ids_json),placements:await metadata(store,row.playlist_id,'DRAFT'),publishedPlacements:await metadata(store,row.playlist_id,'PUBLISHED'),content:await entries(store,row.playlist_id,'DRAFT'),publishedContent:await entries(store,row.playlist_id,'PUBLISHED')},revision:start};
  if(start!==await revision(store,offer))throw fail('The Course changed. Refresh it.',409,'CHANGE_CONFLICT');return result;
 }
 if(input.action==='course-playlist-recording')return mediaDetail(env,store,actor,offer,input.attachmentId);
 if(input.action==='course-playlist-candidates'){
  const after=input.after?id(input.after):'',kind=input.kind||'RECORDING';let rows;
  if(kind==='RECORDING')rows=await store.all(`SELECT a.attachment_id id,a.title,a.published,o.mime_type type,c.revision companionRevision,c.draft_key companionKey,t.revision attributionRevision FROM attachments a JOIN objects o USING(asset_id) LEFT JOIN recording_companions c USING(attachment_id) LEFT JOIN media_attributions t USING(attachment_id) WHERE a.offering_id=? AND a.attachment_id>? AND a.audience='RECORDING' AND o.mime_type IN('video/mp4','video/youtube') ORDER BY a.attachment_id LIMIT 51`,[offer,after]);
  else if(kind==='PDF')rows=await store.all("SELECT o.asset_id id,o.filename title,o.mime_type type,o.byte_size size FROM asset_owners own JOIN objects o USING(asset_id) WHERE own.offering_id=? AND own.asset_id>? AND o.mime_type='application/pdf' ORDER BY own.asset_id LIMIT 51",[offer,after]);
  else if(kind==='READING')rows=await store.all('SELECT website_id id,title,revision,published_key publishedKey,enabled FROM websites w WHERE offering_id=? AND website_id>? AND NOT EXISTS(SELECT 1 FROM mou_playlists p WHERE p.website_id=w.website_id) ORDER BY website_id LIMIT 51',[offer,after]);
  else throw fail('Choose recordings, PDFs or reading websites.');
  return {items:rows.slice(0,50),more:rows.length>50,next:rows.length>50?rows[49].id:null,revision:start};
 }
 const rows=await store.all(`SELECT p.playlist_id id,w.title name,p.revision,w.revision websiteRevision,w.enabled,w.published_key,c.content_revision contentRevision,c.content_published_revision publishedContentRevision,(SELECT count(*) FROM course_playlist_content x WHERE x.playlist_id=p.playlist_id AND x.stage='DRAFT' AND x.kind='RECORDING') recordings FROM mou_playlists p JOIN websites w USING(website_id) JOIN course_playlist_workflows c USING(playlist_id) WHERE p.offering_id=? AND p.playlist_id>? ORDER BY p.playlist_id LIMIT 51`,[offer,input.after||'']);
 const websites=await store.all('SELECT website_id id,title,enabled FROM websites w WHERE offering_id=? AND NOT EXISTS(SELECT 1 FROM mou_playlists p WHERE p.website_id=w.website_id) ORDER BY website_id LIMIT 101',[offer]);if(websites.length>100)throw fail('Choose a narrower reading website list.',409);
 const legacy=await store.all('SELECT p.playlist_id id,w.title,w.website_id websiteId FROM mou_playlists p JOIN websites w USING(website_id) WHERE p.offering_id=? AND NOT EXISTS(SELECT 1 FROM course_playlist_workflows c WHERE c.playlist_id=p.playlist_id) ORDER BY p.playlist_id LIMIT 101',[offer]);if(legacy.length>100)throw fail('Choose a narrower existing playlist list.',409);
 return {playlists:rows.slice(0,50).map(r=>({...r,cardPublished:Boolean(r.enabled&&r.published_key),published_key:undefined})),websites,legacy,revision:start,more:rows.length>50,next:rows.length>50?rows[49].id:null};
}

export async function coursePlaylistSave(env,store,actor,offer,input,fetcher){
 await scope(store,actor,offer);const old=await store.replay(actor.account_id,input.operationId,await store.requestHash(offer,input));if(old)return old;
 const key=id(input.playlistId),row=await rowFor(store,offer,key),name=text(input.name,160).trim(),description=text(input.description||'',12000);if(!name)throw fail('Enter a playlist name.');
 if(!row&&await store.first('SELECT 1 FROM websites WHERE website_id=?',[key]))throw fail('Preserve the existing website. Create a separate playlist.',409);
 if(!row){const n=await store.first('SELECT count(*) n FROM mou_playlists WHERE offering_id=?',[offer]);if(n.n>=100)throw fail('Keep up to 100 playlists in a Course.');}
 const checked=await locations(env,store,actor,offer,{selected:input.placements},fetcher);if(!checked.placements.length)throw fail('Choose where this playlist will appear.');
 const previous=await store.first('SELECT * FROM playlist_card_designs WHERE playlist_id=?',[key]),design=await savedCard(env,store,actor,offer,key,{card:cardInput(input.card),teacherIds:optionalTeacherIds(input.teacherIds||[])},previous,fetcher);
 const doc=newCourse();doc.id=key;doc.name=name;doc.tag='COURSE';doc.lessons=[];doc.home={...doc.home,headline:name,subtitle:'',description,imageId:'',imageAlt:'',caption:'',journeyTitle:'',themes:[],recordingLayout:'podcast'};doc.pages={sessions:false,materials:false,assessments:false};doc.materials={intro:'',files:[]};
 const contentKey=await saveContent(env,doc,key),statements=[];
 if(!row)statements.push(store.statement('INSERT INTO websites(website_id,offering_id,title,draft_key,enabled,revision) VALUES(?,?,?,?,0,1)',[key,offer,name,contentKey]),store.statement('INSERT INTO mou_playlists(playlist_id,offering_id,website_id,created_at) VALUES(?,?,?,?)',[key,offer,key,Date.now()]),store.statement('INSERT INTO course_playlist_workflows(playlist_id,description_draft) VALUES(?,?)',[key,description]));
 else statements.push(store.statement('UPDATE websites SET title=?,draft_key=?,revision=revision+1 WHERE website_id=?',[name,contentKey,row.website_id]),store.statement('UPDATE course_playlist_workflows SET description_draft=? WHERE playlist_id=?',[description,key]),store.statement('UPDATE mou_playlists SET revision=revision+1 WHERE playlist_id=?',[key]));
 statements.push(store.statement('UPDATE playlist_card_designs SET draft_json=?,teacher_ids_json=? WHERE playlist_id=?',[JSON.stringify(design.card),JSON.stringify(design.teacherIds),key]),...placementStatements(store,key,'DRAFT',checked.placements));
 return store.mutate(actor,offer,input,statements,{saved:true,playlistId:key},expected(offer,{...input,actorId:actor.account_id},row));
}

async function snapshot(store,offer,entry){
 const key=id(entry.referenceId);
 if(entry.kind==='RECORDING'){
  const row=await store.first(`SELECT a.attachment_id id,a.asset_id assetId,a.website_id websiteId,a.lesson_id lessonId,a.lesson_date recordedDate,a.cohort,a.title,a.published,t.revision attributionRevision,t.draft_json attributionDraft,c.revision companionRevision,c.draft_key companionKey,c.published_key companionPublishedKey,c.source_revision sourceRevision FROM attachments a JOIN objects o USING(asset_id) JOIN asset_owners own ON own.asset_id=a.asset_id AND own.offering_id=a.offering_id JOIN media_attributions t USING(attachment_id) JOIN recording_companions c USING(attachment_id) WHERE a.attachment_id=? AND a.offering_id=? AND a.audience='RECORDING' AND o.mime_type IN('video/mp4','video/youtube')`,[key,offer]);
  if(!row||!row.companionKey||!row.attributionDraft)throw fail('Choose a processed recording with a saved Teacher, summary and follow-along.',409,'RECORDING_NOT_READY');return row;
 }
 if(entry.kind==='PDF'){const row=await store.first("SELECT o.asset_id assetId,o.filename title,o.mime_type type,o.byte_size size,o.sha256 FROM asset_owners own JOIN objects o USING(asset_id) WHERE own.offering_id=? AND o.asset_id=? AND o.mime_type='application/pdf'",[offer,key]);if(!row)throw fail('Choose an existing verified Course PDF.',403);return row;}
 if(entry.kind==='READING'){const row=await store.first('SELECT w.website_id websiteId,w.title,w.published_key publishedKey,w.revision FROM websites w WHERE w.website_id=? AND w.offering_id=? AND w.enabled=1 AND w.published_key IS NOT NULL AND NOT EXISTS(SELECT 1 FROM mou_playlists p WHERE p.website_id=w.website_id)',[key,offer]);if(!row)throw fail('Choose an existing published Course reading website.',409);return row;}
 throw fail('Choose a supported content type.');
}
export async function coursePlaylistContentSave(store,actor,offer,input){
 await scope(store,actor,offer);const old=await store.replay(actor.account_id,input.operationId,await store.requestHash(offer,input));if(old)return old;
 const row=await rowFor(store,offer,input.playlistId);if(!row)throw fail('Save playlist Details first.',409);
 if(!Array.isArray(input.entries)||input.entries.length>50||new Set(input.entries.map(e=>e.kind+':'+e.referenceId)).size!==input.entries.length)throw fail('Choose up to fifty distinct items in their display order.');
 const values=[];for(const e of input.entries)values.push({kind:e.kind,referenceId:id(e.referenceId),snapshot:await snapshot(store,offer,e)});
 return store.mutate(actor,offer,input,[...contentStatements(store,row.playlist_id,'DRAFT',values),store.statement('UPDATE course_playlist_workflows SET content_revision=content_revision+1 WHERE playlist_id=?',[row.playlist_id]),store.statement('UPDATE mou_playlists SET revision=revision+1 WHERE playlist_id=?',[row.playlist_id])],{saved:true,playlistId:row.playlist_id,contentRevision:row.content_revision+1},expected(offer,{...input,actorId:actor.account_id},row));
}

export async function coursePlaylistPublish(env,store,actor,offer,input,fetcher){
 await scope(store,actor,offer);const old=await store.replay(actor.account_id,input.operationId,await store.requestHash(offer,input));if(old){await finishCardPublication(env,store,offer,old.cardPublication);return old;}
 const row=await rowFor(store,offer,input.playlistId);if(!row)throw fail('Choose a saved Course playlist.',404);
 const statements=[],guard=expected(offer,{...input,actorId:actor.account_id},row);let cardApproval=null;
 if(input.action==='course-playlist-publish-card'){
  const selected=await metadata(store,row.playlist_id,'DRAFT'),checked=await locations(env,store,actor,offer,{selected:selected.map(p=>({activityKey:p.activityKey,classId:p.classId}))},fetcher),card=await cardPublication(store,offer,row.website_id);cardApproval=card.approval;
  statements.push(...card.statements,...placementStatements(store,row.playlist_id,'PUBLISHED',checked.placements),store.statement('UPDATE course_playlist_workflows SET description_published=description_draft WHERE playlist_id=?',[row.playlist_id]),store.statement('INSERT INTO course_playlist_release_guards VALUES(?)',[row.playlist_id]),store.statement('UPDATE websites SET enabled=1,published_key=draft_key,revision=revision+1 WHERE website_id=?',[row.website_id]));
 }else if(input.action==='course-playlist-publish-content'){
  const values=await entries(store,row.playlist_id,'DRAFT');
  for(const e of values){const fresh=await snapshot(store,offer,e);if(JSON.stringify(fresh)!==JSON.stringify(e.snapshot))throw fail('Content changed since review. Refresh and save the current selection before publishing.',409,'COURSE_CONTENT_CHANGED');
   if(e.kind==='RECORDING'){
    const plan=await attributionChange(env,store,actor,offer,{action:'media-publication',operationId:crypto.randomUUID(),attachmentId:e.referenceId,revision:fresh.attributionRevision,draftContext:fresh.attributionDraft,sourceRevision:fresh.sourceRevision,companionKey:fresh.companionKey,companionRevision:fresh.companionRevision},fetcher,{collect:true});
    statements.push(...plan.statements);let i=0;const sql=plan.options.expectedSQL.replace(/\?/g,()=>`json_extract(review.value,'$[${i++}]')`);guard.expectedSQL+=' AND EXISTS(SELECT 1 FROM json_each(?) review WHERE '+sql+')';guard.expectedArgs.push(JSON.stringify([plan.options.expectedArgs]));e.snapshot={...fresh,published:1,title:JSON.parse(fresh.attributionDraft).recordingTitle??fresh.title,attributionRevision:plan.result.revision,companionRevision:fresh.companionRevision+Number(fresh.companionPublishedKey!==fresh.companionKey),companionPublishedKey:fresh.companionKey};
   }
  }
  statements.unshift(store.statement('INSERT INTO course_playlist_release_guards VALUES(?)',[row.playlist_id]));
  statements.push(store.statement('DELETE FROM mou_playlist_items WHERE playlist_id=?',[row.playlist_id]),...values.filter(e=>e.kind==='RECORDING').map(e=>store.statement('INSERT INTO mou_playlist_items VALUES(?,?)',[row.playlist_id,e.referenceId])));
  const order=values.filter(e=>e.kind==='RECORDING').map((e,i)=>({id:e.referenceId,position:i+1}));
  statements.push(store.statement("UPDATE recording_playlist_positions SET position=(SELECT json_extract(j.value,'$.position') FROM json_each(?) j WHERE json_extract(j.value,'$.id')=attachment_id) WHERE playlist_id=?",[JSON.stringify(order),row.playlist_id]),...contentStatements(store,row.playlist_id,'PUBLISHED',values),...contentStatements(store,row.playlist_id,'DRAFT',values),store.statement('UPDATE course_playlist_workflows SET content_published_revision=content_revision WHERE playlist_id=?',[row.playlist_id]));
 }else throw fail('Choose Publish card or Publish content.');
 statements.push(store.statement('UPDATE mou_playlists SET revision=revision+1 WHERE playlist_id=?',[row.playlist_id]),store.statement('DELETE FROM course_playlist_release_guards WHERE playlist_id=?',[row.playlist_id]));
 const result=await store.mutate(actor,offer,input,statements,{published:true,playlistId:row.playlist_id,part:input.action==='course-playlist-publish-card'?'CARD':'CONTENT',cardPublication:cardApproval},guard);await finishCardPublication(env,store,offer,result.cardPublication);return result;
}

export async function coursePublishedExtras(store,website){if(website.kind!=='COURSE'||!website.playlist_id)return [];return (await entries(store,website.playlist_id,'PUBLISHED')).filter(e=>e.kind!=='RECORDING').map(e=>({kind:e.kind,id:e.referenceId,title:e.snapshot.title,href:e.kind==='PDF'?'/api/course-playlists/'+encodeURIComponent(website.playlist_id)+'/files/'+encodeURIComponent(e.referenceId):'/studio/?website='+encodeURIComponent(e.referenceId)}));}
export async function publishedCourseContent(store,actor,key){const row=await store.first('SELECT p.website_id,p.offering_id,c.content_published_revision FROM mou_playlists p JOIN course_playlist_workflows c USING(playlist_id) WHERE playlist_id=?',[id(key)]);if(!row)throw fail('Choose a Course playlist.',404);await websiteAccess(store,actor,row.website_id);return {playlistId:key,revision:row.content_published_revision,items:(await entries(store,key,'PUBLISHED')).filter(e=>e.kind!=='RECORDING').map(e=>({kind:e.kind,id:e.referenceId,title:e.snapshot.title,href:e.kind==='PDF'?'/api/course-playlists/'+encodeURIComponent(key)+'/files/'+encodeURIComponent(e.referenceId):'/studio/?website='+encodeURIComponent(e.referenceId)}))};}
export async function coursePlaylistFile(env,store,actor,key,asset,request){await publishedCourseContent(store,actor,key);const row=await store.first("SELECT o.* FROM course_playlist_content c JOIN mou_playlists p USING(playlist_id) JOIN asset_owners own ON own.offering_id=p.offering_id AND own.asset_id=c.reference_id JOIN objects o ON o.asset_id=own.asset_id WHERE c.playlist_id=? AND c.stage='PUBLISHED' AND c.kind='PDF' AND c.reference_id=? AND o.mime_type='application/pdf' AND o.sha256 IS json_extract(c.snapshot_json,'$.sha256') AND o.byte_size=json_extract(c.snapshot_json,'$.size')",[id(key),id(asset)]);if(!row)throw fail('This PDF is not published in this playlist.',404);return streamMedia(env,row,request);}
