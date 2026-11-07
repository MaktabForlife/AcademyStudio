import {publicationIndex} from '../public/shared/learner-companion.mjs';
import {companionChanges} from './recording-companions.mjs';
import {fail,id,text,integer,date,sha256,bodyJSON} from './protocol.mjs';
import {academyCommand} from './academy-client.mjs';
import {academyAuthority} from './access.mjs';
import {mediaGate} from './media.mjs';
import {checkedPlaylist,assignPlaylist} from './mou-playlists.mjs';

export async function mediaAdmin(store,actor,offer,{readOnly=false}={}){
 const scope=await store.scope(actor,offer,{admin:true,readOnly});
 if(!['COURSE','TAFSEER'].includes(scope.kind)||academyAuthority(store.env)&&!scope.studioAuthority)throw fail('This programme requires current Studio ownership.',403);
 return scope;
}
function recordingTitle(value){const title=text(value).trim();if(!title)throw fail('Enter a recording title.');return title;}
export function teacherIds(value){
 if(!Array.isArray(value)||value.length<1||value.length>10)throw fail('Choose one to ten registered Teachers.');
 const ids=value.map(id);if(new Set(ids.map(v=>v.toLowerCase())).size!==ids.length)throw fail('Choose each Teacher once.');return ids;
}
export async function mediaTeachers(env,store,actor,offer,selected,fetcher,{readOnly=false}={}){
 await mediaAdmin(store,actor,offer,{readOnly});if(!actor.source_ref)throw fail('Refresh the native Academy session before choosing a Teacher.',401);
 const ids=selected===undefined?undefined:teacherIds(selected);
 store.nativeMediaTeacherProofs??=new Map();const proofKey=JSON.stringify([actor.token_hash,actor.source_ref,offer]);
 let result=store.nativeMediaTeacherProofs.get(proofKey);if(!result){result=await academyCommand(env,store,'/internal/website/media-teachers',{sourceRef:actor.source_ref,offeringId:offer,purpose:'ADMIN_MEDIA',...(ids?{teacherIds:ids}:{})},fetcher);store.nativeMediaTeacherProofs.set(proofKey,result);}
 if(result.schema!=='NATIVE_MEDIA_TEACHERS_V1'||result.offeringId!==offer||!Array.isArray(result.teachers)||result.teachers.length>200||!Number.isSafeInteger(result.checkedAt)||Math.abs(Date.now()-result.checkedAt)>60000)throw fail('Native Teacher choices need to be refreshed.',503);
 if(result.classes!==undefined&&(!Array.isArray(result.classes)||result.classes.length>200))throw fail('Native class choices need review.',503);
 const teachers=result.teachers.map(t=>({id:id(t.id),name:text(t.name,240)}));if(new Set(teachers.map(t=>t.id.toLowerCase())).size!==teachers.length)throw fail('Native Teacher choices need review.',503);
 const picked=ids?.map(v=>teachers.find(t=>t.id.toLowerCase()===v.toLowerCase()));if(picked?.some(t=>!t))throw fail('Choose a current registered Teacher.',409);
 // Recheck after the awaited native command. The transaction also fences local
 // account/session/epoch/role/ownership changes before any write.
 await mediaAdmin(store,await store.actor(actor.token_hash),offer,{readOnly});
 return {schema:result.schema,offeringId:offer,teacherRequired:true,classes:Array.isArray(result.classes)?result.classes.map(c=>({id:id(c.id),name:text(c.name,240)})):[],teachers,selectedTeacherIds:picked?.map(t=>t.id)||[],checkedAt:result.checkedAt};
}
async function contextFor(store,scope,row,teachers,classes=[]){
 const website=row.website_id?await store.first('SELECT website_id,title FROM websites WHERE website_id=? AND offering_id=?',[row.website_id,row.offering_id]):null;
 let subject=null,playlist=null;
 if(row.playlist_id){const selected=await checkedPlaylist(store,row.offering_id,row.playlist_id);if(scope.programme_key!=='mothers'&&!row.published&&row.website_id!==selected.website_id)throw fail('Use the selected playlist’s native website.',409);playlist={id:selected.playlist_id,websiteId:selected.website_id,name:selected.title};row.playlist_revision=selected.revision;}
 if(scope.kind!=='COURSE'){
  if(!website)throw fail('Choose the native Surah or MOU subject for this recording.');
  if(scope.programme_key==='mothers'){
   if(!playlist) {if(!row.published)throw fail('Choose a MOU playlist for this recording.',409,'PLAYLIST_REQUIRED');const binding=await store.first('SELECT display_key FROM programme_subjects WHERE offering_id=? AND website_id=? AND enabled=1',[row.offering_id,row.website_id]);if(!binding)throw fail('Preserve the registered legacy MOU subject.');subject={key:binding.display_key,websiteId:website.website_id,name:website.title};}
  }else if(!playlist)subject={key:website.website_id,websiteId:website.website_id,name:website.title};
  date(row.lesson_date);const source=await store.first('SELECT classes_json FROM source_access_scopes WHERE offering_id=?',[row.offering_id]);if(!source||!JSON.parse(source.classes_json).includes(row.cohort))throw fail('Preserve the exact native recording class/cohort.',409);
 }
 return {schema:'RECORDED_MEDIA_CONTEXT_V2',mediaIdentity:{assetId:row.asset_id,websiteId:row.website_id,lessonId:row.lesson_id,recordedDate:row.lesson_date,cohort:row.cohort},offeringId:row.offering_id,kind:scope.kind,programmeKey:scope.programme_key||null,classIds:scope.kind==='COURSE'?[]:[row.cohort],classNames:scope.kind==='COURSE'?[]:classes.filter(c=>c.id===row.cohort).map(c=>c.name),subject,...(playlist?{playlist}:{}),teacherIds:teachers.map(t=>t.id),teacherName:teachers.map(t=>t.name).join(', '),attributionSource:'NATIVE_TEACHER_ACCOUNT'};
}
export async function attributionFacts(store,ids){
 if(!ids.length)return [];
 return store.all('SELECT attachment_id,revision,draft_json,published_json FROM media_attributions WHERE attachment_id IN(SELECT value FROM json_each(?))',[JSON.stringify(ids)]);
}
export async function addPublishedAttribution(store,media){
 const rows=await attributionFacts(store,media.map(r=>r.attachment_id));
 return media.map(row=>{const saved=rows.find(r=>r.attachment_id===row.attachment_id),context=saved?.published_json?JSON.parse(saved.published_json):null,identity=context?.mediaIdentity;return identity&&identity.assetId===row.asset_id&&identity.websiteId===row.website_id&&identity.lessonId===row.lesson_id&&identity.recordedDate===row.lesson_date&&identity.cohort===row.cohort?{...row,recordedContext:context,...(context.playlist?{playlistId:context.playlist.id,playlist:{id:context.playlist.id,name:context.playlist.name}}:{})}:row;});
}
function parentGuard(scope,row,{requireMembership=false}={}){
 const sql="EXISTS(SELECT 1 FROM offerings WHERE offering_id=? AND kind=?) AND EXISTS(SELECT 1 FROM asset_owners WHERE asset_id=? AND offering_id=?)";
 const args=[row.offering_id,scope.kind,row.asset_id,row.offering_id];
 let extra='';
 if(scope.kind!=='COURSE'){extra=" AND EXISTS(SELECT 1 FROM source_access_scopes s,json_each(s.classes_json) c WHERE s.offering_id=? AND s.enabled=1 AND c.value=?) AND EXISTS(SELECT 1 FROM websites WHERE website_id=? AND offering_id=?)";
 args.push(row.offering_id,row.cohort,row.website_id,row.offering_id);}
 if(row.playlist_id){extra+=" AND EXISTS(SELECT 1 FROM mou_playlists p JOIN websites w USING(website_id) WHERE p.offering_id=? AND p.playlist_id=? AND p.revision=?)";args.push(row.offering_id,row.playlist_id,row.playlist_revision);if(requireMembership){extra+=' AND EXISTS(SELECT 1 FROM mou_playlist_items WHERE playlist_id=? AND attachment_id=?)';args.push(row.playlist_id,row.attachment_id);}}else if(scope.programme_key==='mothers'){extra+=" AND EXISTS(SELECT 1 FROM programme_subjects WHERE offering_id=? AND website_id=? AND enabled=1)";args.push(row.offering_id,row.website_id);}
 return {sql:sql+extra,args};
}
export async function attributionChange(env,store,actor,offer,input,fetcher,{collect=false}={}){
 const scope=await mediaAdmin(store,actor,offer),attachment=id(input.attachmentId),row=await mediaGate(store,actor,attachment,{admin:true});
 if(row.offering_id!==offer||row.audience!=='RECORDING')throw fail('Choose this programme’s recording.',403);
 const saved=await store.first('SELECT * FROM media_attributions WHERE attachment_id=?',[attachment]);
 {const previous=saved?JSON.parse(saved.draft_json).playlist?.id:null;if(previous&&input.playlistId&&previous!==input.playlistId)throw fail('Preserve the saved playlist selection. Add other memberships through playlist management.',409);row.playlist_id=previous||input.playlistId||null;if(row.playlist_id)row.playlist_revision=(await checkedPlaylist(store,offer,row.playlist_id)).revision;}
 const parent=parentGuard(scope,row,{requireMembership:input.action==='media-publication'&&!collect});
 if(input.action==='media-attribution-save'){
  const selected=teacherIds(input.teacherIds);
  const checked=await mediaTeachers(env,store,actor,offer,selected,fetcher);
  const context=await contextFor(store,scope,row,checked.teachers.filter(t=>checked.selectedTeacherIds.includes(t.id)),checked.classes);
  // Teacher corrections preserve a title awaiting the same explicit Publish.
  if(saved&&Object.hasOwn(JSON.parse(saved.draft_json),'recordingTitle'))context.recordingTitle=recordingTitle(JSON.parse(saved.draft_json).recordingTitle);
  const encoded=JSON.stringify(context);
  const replay=await store.replay(actor.account_id,input.operationId,await store.requestHash(offer,input));if(replay)return replay;
  if(integer(input.revision)!==(saved?.revision||0))throw fail('Teacher attribution changed. Reopen the saved recording.',409);
  const assignment=context.playlist?assignPlaylist(store,{playlist_id:context.playlist.id},row,{exclusive:!row.published,protectPrivateParent:!row.published,supportIds:(await store.all('SELECT support_attachment_id FROM media_supporting_files WHERE recording_attachment_id=?',[attachment])).map(r=>r.support_attachment_id)}):[];
  return store.mutate(actor,offer,input,[...assignment,store.statement('INSERT INTO media_attributions VALUES(?,1,?,NULL) ON CONFLICT(attachment_id) DO UPDATE SET revision=media_attributions.revision+1,draft_json=excluded.draft_json',[attachment,encoded])],{attachmentId:attachment,revision:(saved?.revision||0)+1,recordedContext:context},{studio:true,expectedSQL:parent.sql+' AND COALESCE((SELECT revision FROM media_attributions WHERE attachment_id=?),0)=? AND EXISTS(SELECT 1 FROM attachments WHERE attachment_id=? AND offering_id=? AND asset_id=? AND website_id IS ? AND lesson_id=? AND lesson_date=? AND cohort=?)',expectedArgs:[...parent.args,attachment,input.revision,attachment,offer,row.asset_id,row.website_id,row.lesson_id,row.lesson_date,row.cohort]});
 }
 if(input.action!=='media-publication')throw fail('Choose a media attribution action.');
 if(!saved)throw fail('Choose and save a registered Teacher before publication.',409);
 const context=JSON.parse(saved.draft_json),checked=await mediaTeachers(env,store,actor,offer,context.teacherIds,fetcher);
 const fresh=await contextFor(store,scope,row,checked.teachers.filter(t=>checked.selectedTeacherIds.includes(t.id)),checked.classes);
 if(JSON.stringify(context.mediaIdentity)!==JSON.stringify(fresh.mediaIdentity)||JSON.stringify(context.classIds)!==JSON.stringify(fresh.classIds)||context.subject?.key!==fresh.subject?.key||context.playlist?.id!==fresh.playlist?.id)throw fail('The saved media parent changed. Review its attribution again.',409);
 const replay=await store.replay(actor.account_id,input.operationId,await store.requestHash(offer,input));if(replay)return replay;
 if(input.revision!==saved.revision||input.draftContext!==saved.draft_json)throw fail('Review the exact saved Teacher attribution before publishing.',409);
 let expected='1',args=[],companionStatements=[];
 if(input.sourceRevision||input.companionKey||context.playlist&&!row.published){
  const companion=await store.first('SELECT revision,source_revision,draft_key,published_key,duration_seconds FROM recording_companions WHERE attachment_id=?',[attachment]);
  if(!companion||input.sourceRevision&&input.sourceRevision!==companion.source_revision||input.companionKey&&input.companionKey!==companion.draft_key)throw fail('Review the exact saved companion before this recording.',409);
  if(input.companionRevision!==undefined){
   if(input.companionRevision!==companion.revision)throw fail('The saved companion changed. Review it again.',409);
   if(companion.draft_key!==companion.published_key){const object=await env.CONTENT.get(companion.draft_key);if(!object||object.size>300000)throw fail('The saved companion is unavailable.',503);const value=await bodyJSON(object.body,300000);if(value.schema!=='LEARNER_COMPANION_V1')throw fail('Review the saved companion format.',409);companionStatements.push(store.statement('UPDATE recording_companions SET published_key=draft_key,index_json=?,revision=revision+1 WHERE attachment_id=?',[JSON.stringify({...publicationIndex(value),durationSeconds:companion.duration_seconds}),attachment]));}
  }else if(!companion.published_key||companion.draft_key!==companion.published_key)throw fail('Publish the exact reviewed companion before this recording.',409);
  expected='EXISTS(SELECT 1 FROM recording_companions WHERE attachment_id=? AND revision=? AND source_revision=? AND draft_key=? AND published_key IS ?)';args=[attachment,companion.revision,companion.source_revision,companion.draft_key,companion.published_key];
 }
 const title=Object.hasOwn(context,'recordingTitle')?recordingTitle(context.recordingTitle):null;
 const plan={statements:[...companionStatements,store.statement('UPDATE media_attributions SET published_json=draft_json,revision=revision+1 WHERE attachment_id=?',[attachment]),store.statement('UPDATE attachments SET published=1'+(title===null?'':',title=?')+' WHERE attachment_id=?',[...(title===null?[]:[title]),attachment]),store.statement('UPDATE attachments SET published=1 WHERE attachment_id IN(SELECT support_attachment_id FROM media_supporting_files WHERE recording_attachment_id=?)',[attachment])],result:{attachmentId:attachment,published:true,revision:saved.revision+1},options:{studio:true,expectedSQL:`EXISTS(SELECT 1 FROM media_attributions WHERE attachment_id=? AND revision=? AND draft_json=?) AND EXISTS(SELECT 1 FROM attachments a LEFT JOIN websites w USING(website_id) WHERE a.attachment_id=? AND a.offering_id=? AND a.asset_id=? AND a.website_id IS ? AND a.lesson_id=? AND a.lesson_date=? AND a.cohort=? AND (${context.playlist?'1':'a.website_id IS NULL OR w.enabled=1 AND w.published_key IS NOT NULL'})) AND ${expected} AND ${parent.sql} AND NOT EXISTS(SELECT 1 FROM media_supporting_files l JOIN attachments x ON x.attachment_id=l.support_attachment_id WHERE l.recording_attachment_id=? AND (x.offering_id<>? OR x.website_id IS NOT ? OR x.lesson_id<>? OR x.lesson_date<>? OR x.cohort<>? OR x.audience<>'RECORDING'))`,expectedArgs:[attachment,input.revision,saved.draft_json,attachment,offer,row.asset_id,row.website_id,row.lesson_id,row.lesson_date,row.cohort,...args,...parent.args,attachment,offer,row.website_id,row.lesson_id,row.lesson_date,row.cohort]}};
 if(collect)return plan;return store.mutate(actor,offer,input,plan.statements,plan.result,plan.options);
}

export async function mediaOptions(env,store,actor,offer,fetcher){
 const scope=await mediaAdmin(store,actor,offer,{readOnly:true}),choices=await mediaTeachers(env,store,actor,offer,undefined,fetcher,{readOnly:true});
 const subjects=scope.kind==='COURSE'||scope.programme_key==='mothers'?[]:await store.all('SELECT website_id id,title name FROM websites WHERE offering_id=? ORDER BY website_id LIMIT 101',[offer]);
 const playlists=await store.all('SELECT p.playlist_id id,w.title name,w.completion_date closeDate,w.enabled,p.website_id websiteId,p.revision FROM mou_playlists p JOIN websites w USING(website_id) WHERE p.offering_id=? ORDER BY p.playlist_id LIMIT 101',[offer]);if(playlists.length>100)throw fail('Choose a smaller playlist catalogue.',409);
 if(subjects.length>100)throw fail('Choose a smaller native subject catalogue.',409);
 const source=scope.kind==='COURSE'?null:await store.first('SELECT classes_json FROM source_access_scopes WHERE offering_id=?',[offer]);
 const ids=source?JSON.parse(source.classes_json):[];
 return {...choices,kind:scope.kind,programmeKey:scope.programme_key||null,accessModel:scope.kind==='COURSE'?'COURSE':'MONTHLY',subjects,playlists,classIds:ids,classes:choices.classes.filter(c=>ids.includes(c.id))};
}
export async function attachMedia(env,store,actor,offer,input,fetcher,planner,{privateCourseSource=false}={}){
 const selected=teacherIds(input.teacherIds);
 const scope=await mediaAdmin(store,actor,offer),checked=await mediaTeachers(env,store,actor,offer,selected,fetcher);
 const replay=await store.replay(actor.account_id,input.operationId,await store.requestHash(offer,input));if(replay)return replay;
 const attachment=id(input.attachmentId),playlist=input.playlistId?await checkedPlaylist(store,offer,input.playlistId):null;
 const website=input.websiteId?id(input.websiteId):playlist?.website_id||(scope.kind==='COURSE'?null:id(input.websiteId));
 // New monthly Surahs and Course playlist media use their exact native wrapper.
 // MOU keeps the reviewed cross-parent support/legacy binding path.
 if(playlist&&scope.programme_key!=='mothers'&&website!==playlist.website_id)throw fail('Use the selected playlist’s native website.',409);
 const row={asset_id:id(input.assetId),lesson_id:input.lessonId?id(input.lessonId):attachment,offering_id:offer,website_id:website,lesson_date:scope.kind==='COURSE'?(input.lessonDate?date(input.lessonDate):''):date(input.lessonDate),cohort:scope.kind==='COURSE'?'':text(input.cohort,180),...(playlist?{playlist_id:playlist.playlist_id}:scope.programme_key==='mothers'?{playlist_id:id(input.playlistId)}:{})};
 if(privateCourseSource&&(scope.kind!=='COURSE'||!playlist||!await store.first('SELECT 1 FROM course_playlist_workflows WHERE playlist_id=?',[playlist.playlist_id])||(input.supportingFiles||[]).length))throw fail('Choose the exact native Course playlist for this private source.',409,'PLAYLIST_REQUIRED');
 const context=await contextFor(store,scope,row,checked.teachers.filter(t=>checked.selectedTeacherIds.includes(t.id)),checked.classes);
 const native={...input,action:'attachment',websiteId:website,lessonId:row.lesson_id,lessonDate:row.lesson_date,cohort:row.cohort,audience:'RECORDING',published:false,createOnly:true};
 const source=await store.first('SELECT mime_type FROM objects WHERE asset_id=?',[row.asset_id]);if(!source||!['video/mp4','video/youtube'].includes(source.mime_type))throw fail('Choose one recording source, and keep PDFs/images as supporting files.');
 const parent=parentGuard(scope,row);
 const statements=await planner(env,store,actor,offer,native,{collect:true,scope,playlistChecked:Boolean(playlist)||scope.programme_key==='mothers'});
 const attachmentIds=[attachment,...(Array.isArray(input.supportingFiles)?input.supportingFiles.map(f=>id(f.attachmentId)):[])];if(new Set(attachmentIds).size!==attachmentIds.length)throw fail('Choose distinct recording and supporting-file identities.');
 if(input.supportingFiles!==undefined){
  if(!Array.isArray(input.supportingFiles)||input.supportingFiles.length>10||new Set(input.supportingFiles.map(v=>v.assetId)).size!==input.supportingFiles.length)throw fail('Choose up to ten distinct supporting files.');
  for(const file of input.supportingFiles){const asset=await store.first('SELECT o.mime_type,o.filename FROM objects o JOIN asset_owners a USING(asset_id) WHERE o.asset_id=? AND a.offering_id=?',[id(file.assetId),offer]);if(!asset||!['application/pdf','image/png','image/jpeg','image/webp'].includes(asset.mime_type))throw fail('Choose a private PDF or image owned by this programme.');
   const support=id(file.attachmentId);statements.push(...await planner(env,store,actor,offer,{action:'attachment',createOnly:true,assetId:file.assetId,attachmentId:support,websiteId:website,lessonId:row.lesson_id,lessonDate:row.lesson_date,cohort:row.cohort,title:asset.filename,audience:'RECORDING',published:false},{collect:true,scope,playlistChecked:Boolean(playlist)||scope.programme_key==='mothers'}));statements.push(store.statement('INSERT INTO media_supporting_files VALUES(?,?)',[attachment,support]));
  }
 }
 if(context.playlist)statements.push(...assignPlaylist(store,{playlist_id:context.playlist.id},{...row,attachment_id:attachment},{exclusive:true,supportIds:attachmentIds.slice(1),protectPrivateParent:true,deferMembership:privateCourseSource}));
 statements.push(store.statement('INSERT INTO media_attributions VALUES(?,1,?,NULL)',[attachment,JSON.stringify(context)]));
 return store.mutate(actor,offer,input,statements,{attachmentId:attachment,revision:1,recordedContext:context,attached:true,published:false},{studio:true,expectedSQL:parent.sql+(privateCourseSource?' AND EXISTS(SELECT 1 FROM course_playlist_workflows WHERE playlist_id=?)':'')+' AND NOT EXISTS(SELECT 1 FROM attachments WHERE attachment_id IN(SELECT value FROM json_each(?))) AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM asset_owners WHERE asset_id=j.value AND offering_id=?))',expectedArgs:[...parent.args,...(privateCourseSource?[playlist.playlist_id]:[]),JSON.stringify(attachmentIds),JSON.stringify((input.supportingFiles||[]).map(f=>f.assetId)),offer]});
}

export async function mediaCompanionSave(env,store,actor,offer,input,fetcher){
 const hasTitle=Object.hasOwn(input,'title'),title=hasTitle?recordingTitle(input.title):null,titleRevision=hasTitle?integer(input.attributionRevision):null;
 await mediaAdmin(store,actor,offer);const row=await mediaGate(store,actor,id(input.attachmentId),{admin:true});if(row.offering_id!==offer||!row.website_id&&row.kind!=='COURSE'||row.audience!=='RECORDING'||!['video/mp4','video/youtube'].includes(row.mime_type))throw fail('Choose this programme’s recording.',403);
 const attribution=(await attributionFacts(store,[row.attachment_id]))[0];if(!attribution)throw fail('Save a checked registered Teacher first.',409);await mediaTeachers(env,store,actor,offer,JSON.parse(attribution.draft_json).teacherIds,fetcher);
 // Titles share the existing private attribution draft, never the learner
 // attachment row. Commit the title and companion draft under both revisions.
 let titleDraft;
 if(hasTitle){
  const revision=titleRevision,context=JSON.parse(attribution.draft_json),changed=title!==(context.recordingTitle??row.title);
  titleDraft={statements:changed?[store.statement('UPDATE media_attributions SET draft_json=?,revision=revision+1 WHERE attachment_id=?',[JSON.stringify({...context,recordingTitle:title}),row.attachment_id])]:[],
   result:{attributionRevision:revision+Number(changed)},
   expectedSQL:'EXISTS(SELECT 1 FROM media_attributions WHERE attachment_id=? AND revision=? AND draft_json=?) AND EXISTS(SELECT 1 FROM attachments WHERE attachment_id=? AND title=? AND lesson_id=? AND lesson_date=? AND cohort=?)',
   expectedArgs:[row.attachment_id,revision,attribution.draft_json,row.attachment_id,row.title,row.lesson_id,row.lesson_date,row.cohort]};
 }
 if(input.action==='media-text-save'&&!Object.hasOwn(input,'companion')){
  if(!titleDraft)throw fail('Enter a recording title.');
  // A title-only correction needs no R2 read/write or fabricated companion.
  return store.mutate(actor,offer,input,titleDraft.statements,{attachmentId:row.attachment_id,saved:true,...titleDraft.result},{studio:true,expectedSQL:titleDraft.expectedSQL+' AND COALESCE((SELECT revision FROM recording_companions WHERE attachment_id=?),0)=?',expectedArgs:[...titleDraft.expectedArgs,row.attachment_id,integer(input.revision)]});
 }
 const source=await store.first('SELECT sha256,youtube_id FROM objects WHERE asset_id=?',[row.asset_id]),sourceRevision=await sha256(JSON.stringify({schema:'RECORDED_MEDIA_SOURCE_V1',assetId:row.asset_id,youtubeId:source.youtube_id,objectHash:source.sha256}));
 return companionChanges(env,store,actor,offer,{...input,action:'companion-save',sourceRevision},titleDraft);
}
export async function mediaDetail(env,store,actor,offer,attachment){
 await mediaAdmin(store,actor,offer,{readOnly:true});const row=await mediaGate(store,actor,id(attachment),{admin:true,readOnly:true});if(row.offering_id!==offer)throw fail('Choose this programme’s recording.',403);
 const attribution=(await attributionFacts(store,[attachment]))[0],saved=await store.first('SELECT * FROM recording_companions WHERE attachment_id=?',[attachment]);let companion=null;
 if(saved){const object=await env.CONTENT.get(saved.draft_key);if(!object||object.size>300000)throw fail('The saved companion is unavailable.',503);companion=await bodyJSON(object.body,300000);}
 const supportingFiles=await store.all('SELECT a.attachment_id attachmentId,a.title,o.mime_type type FROM media_supporting_files l JOIN attachments a ON a.attachment_id=l.support_attachment_id JOIN objects o USING(asset_id) WHERE l.recording_attachment_id=? ORDER BY a.attachment_id LIMIT 11',[attachment]);if(supportingFiles.length>10)throw fail('Review the supporting-file associations.',409);
 return {source:{kind:row.youtube_id?'YOUTUBE':'MP4',url:row.youtube_id?'https://www.youtube.com/watch?v='+row.youtube_id:'/api/media/'+encodeURIComponent(attachment)+'?draft=1'},supportingFiles,websiteId:row.website_id,lessonId:row.lesson_id,assetId:row.asset_id,attachmentId:attachment,title:attribution?JSON.parse(attribution.draft_json).recordingTitle??row.title:row.title,publishedTitle:row.title,recordedDate:row.lesson_date,published:Boolean(row.published),recordedContext:attribution?JSON.parse(attribution.draft_json):null,attributionRevision:attribution?.revision||0,draftContext:attribution?.draft_json||null,companion,companionRevision:saved?.revision||0,companionDraftKey:saved?.draft_key||null,companionPublishedKey:saved?.published_key||null,sourceRevision:saved?.source_revision||null,durationSeconds:saved?.duration_seconds||null};
}
export async function addSupportingFiles(store,media){
 const ids=media.filter(r=>['video/mp4','video/youtube'].includes(r.type)).map(r=>r.attachment_id);if(!ids.length)return media;
 const rows=await store.all("SELECT l.recording_attachment_id,x.attachment_id,x.title,o.mime_type type FROM media_supporting_files l JOIN attachments a ON a.attachment_id=l.recording_attachment_id JOIN attachments x ON x.attachment_id=l.support_attachment_id JOIN objects o ON o.asset_id=x.asset_id WHERE l.recording_attachment_id IN(SELECT value FROM json_each(?)) AND x.published=1 AND x.offering_id=a.offering_id AND x.website_id IS a.website_id AND x.lesson_id=a.lesson_id AND x.lesson_date=a.lesson_date AND x.cohort=a.cohort AND x.audience='RECORDING' ORDER BY l.recording_attachment_id,x.attachment_id LIMIT 501",[JSON.stringify(ids)]);if(rows.length>500)throw fail('The supporting-file catalogue needs review.',409);
 return media.map(row=>({...row,supportingFiles:rows.filter(s=>s.recording_attachment_id===row.attachment_id).map(s=>({attachmentId:s.attachment_id,title:s.title,type:s.type}))}));
}
