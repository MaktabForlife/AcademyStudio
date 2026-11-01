import {fail,id,text,integer,date} from './protocol.mjs';
import {rejectAuthorityWrite} from './access.mjs';
import {newCourse} from '../public/shared/model.mjs';
import {saveContent} from './content.mjs';


// Recomputed from the server clock for every request, independently of the
// twelve-hour account proof. The programme's native timezone owns month rollover.
export function programmeMonth(now,timezone){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));
 return parts.year+'-'+parts.month;
}
export function checkedPlaylistCloseDate(value,definition,now=Date.now()){
 if(!value)return null;const closeDate=date(value);
 if(definition.accessModel==='MONTHLY'){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:definition.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));
  if(closeDate>parts.year+'-'+parts.month+'-'+parts.day)throw fail('Close dates cannot be in the future. Leave the playlist open while recordings are being added.');
 }
 return closeDate;
}
export async function playlistDefinition(store,offer){
 store.playlistDefinitions??=new Map();if(store.playlistDefinitions.has(offer))return store.playlistDefinitions.get(offer);
 const row=await store.first("SELECT o.kind,p.programme_key,s.timezone FROM offerings o LEFT JOIN programme_offerings p USING(offering_id) LEFT JOIN source_access_scopes s USING(offering_id) WHERE o.offering_id=?",[offer]);
 if(!row||!['COURSE','TAFSEER'].includes(row.kind))throw fail('Choose a Studio Course, Tafseer or MOU programme.',403);
 if(row.kind==='TAFSEER'&&!row.timezone)throw fail('Refresh the native programme timezone.',409);
 const definition={...row,accessModel:row.kind==='COURSE'?'COURSE':'MONTHLY',label:row.kind==='COURSE'?'Course playlists':row.programme_key==='mothers'?'MOU playlists':'Surah playlists',currentMonth:row.timezone?programmeMonth(Date.now(),row.timezone):null};
 store.playlistDefinitions.set(offer,definition);return definition;
}
async function effectiveMonth(store,offer){
 const definition=await playlistDefinition(store,offer);
 if(definition.accessModel!=='MONTHLY')throw fail('Courses retain whole-course access.',409);
 return `COALESCE(w.completion_month,'${definition.currentMonth}')`;
}

const currentRevision=async(store,offer)=>(await store.first('SELECT revision FROM access_revisions WHERE offering_id=?',[offer]))?.revision||0;
export async function playlistScope(store,actor,offer,{readOnly=false}={}){
 const scope=await store.scope(actor,offer,{admin:true,readOnly});
 if(!['COURSE','TAFSEER'].includes(scope.kind))throw fail('Choose a Studio Course, Tafseer or MOU programme.',403);
 await rejectAuthorityWrite(store,offer);return scope;
}
const playlistRow=(store,offer,key)=>store.first(`SELECT p.*,w.title,w.completion_date,w.completion_month,w.revision website_revision,w.enabled,w.published_key FROM mou_playlists p JOIN websites w USING(website_id) WHERE p.playlist_id=? AND p.offering_id=?`,[id(key),offer]);
export async function playlistTable(store,actor,offer,input={}){
 await playlistScope(store,actor,offer,{readOnly:true});const revision=await currentRevision(store,offer);
 const rows=await store.all(`SELECT p.playlist_id id,p.revision,w.title name,w.completion_date closeDate,w.completion_month closeMonth,w.revision websiteRevision,w.enabled,
 p.website_id websiteId,p.recording_count recordings
 FROM mou_playlists p JOIN websites w USING(website_id) WHERE p.offering_id=? ORDER BY p.playlist_id LIMIT 101`,[offer]);
 if(rows.length>100)throw fail('This programme needs a narrower playlist selector.',409);
 let memberOf;
 if(input.attachmentId){const attachment=id(input.attachmentId);if(!await store.first('SELECT 1 FROM attachments WHERE attachment_id=? AND offering_id=?',[attachment,offer]))throw fail('Choose a recording in this programme.',403);memberOf=(await store.all('SELECT playlist_id FROM mou_playlist_items WHERE attachment_id=? ORDER BY playlist_id LIMIT 101',[attachment])).map(r=>r.playlist_id);if(memberOf.length>100)throw fail('Review this recording’s playlist memberships.',409);}
 if(revision!==await currentRevision(store,offer))throw fail('The playlist register changed. Refresh it.',409,'CHANGE_CONFLICT');
 let items;
 if(input.playlistId){const selected=rows.find(r=>r.id===id(input.playlistId));if(!selected)throw fail('Choose a saved playlist.',404);items=await store.all('SELECT i.attachment_id attachmentId,a.title,a.published,r.position FROM recording_playlist_positions r JOIN mou_playlist_items i USING(playlist_id,attachment_id) JOIN attachments a USING(attachment_id) WHERE r.playlist_id=? ORDER BY r.position,r.attachment_id LIMIT 401',[selected.id]);if(items.length>400)throw fail('Choose a narrower recording order.',409);}
 const legacy=await store.all('SELECT w.website_id id,w.website_id websiteId,w.title name,w.completion_date closeDate,w.completion_month closeMonth,w.revision websiteRevision,w.enabled FROM websites w WHERE w.offering_id=? AND NOT EXISTS(SELECT 1 FROM mou_playlists p WHERE p.website_id=w.website_id) ORDER BY w.website_id LIMIT 201',[offer]);if(legacy.length>200)throw fail('Choose a narrower historical website selector.',409);
 if(revision!==await currentRevision(store,offer))throw fail('The playlist register changed. Refresh it.',409,'CHANGE_CONFLICT');
 const definition=await playlistDefinition(store,offer);
 return {schema:'MOU_PLAYLISTS_V1',revision,accessModel:definition.accessModel,label:definition.label,timezone:definition.timezone,currentMonth:definition.currentMonth,playlists:[...rows.map(row=>({...row,accessModel:definition.accessModel,state:row.closeDate?'CLOSED':'OPEN'})),...legacy.map(row=>({...row,accessModel:definition.accessModel,legacy:true,readOnly:true,state:'LEGACY'}))],legacy:legacy.map(row=>({...row,legacy:true,readOnly:true,state:'LEGACY'})),...(items?{items}:{}),...(memberOf?{memberOf}:{})};
}
async function priorHolders(store,offer,month){
 if(!month)return [];
 // Limit raw paid rows too: many cohorts cannot turn DISTINCT into an unbounded scan.
 const paid=await store.all('SELECT account_id FROM paid_months INDEXED BY mou_paid_month_holders WHERE offering_id=? AND month=? ORDER BY account_id,cohort LIMIT 1001',[offer,month]);
 const website=await store.all('SELECT account_id FROM website_months INDEXED BY mou_website_month_holders WHERE offering_id=? AND month=? ORDER BY account_id LIMIT 251',[offer,month]);
 const accounts=new Set([...paid,...website].map(r=>r.account_id));
 if(paid.length>1000||website.length>250||accounts.size>250)throw fail('This date correction affects too many paid class records or students. Keep the saved date until a grouped correction is reviewed.',409,'PLAYLIST_CORRECTION_LIMIT');
 return [...new Set(paid.map(r=>r.account_id))].map(accountId=>({accountId,kind:'PAID'})).concat(website.map(r=>({accountId:r.account_id,kind:'WEBSITE'})));
}
export async function playlistCorrection(store,actor,offer,input){
 await playlistScope(store,actor,offer);const definition=await playlistDefinition(store,offer),row=await playlistRow(store,offer,input.playlistId);if(!row)throw fail('Choose a saved playlist.',404);
 const revision=await currentRevision(store,offer),holders=definition.accessModel==='MONTHLY'?await priorHolders(store,offer,row.completion_month):[];
 if(revision!==await currentRevision(store,offer))throw fail('The monthly register changed. Review the correction again.',409);
 return {revision,playlistRevision:row.revision,websiteRevision:row.website_revision,sourceMonth:row.completion_month,paidHolders:holders.filter(r=>r.kind==='PAID').length,websiteHolders:holders.filter(r=>r.kind==='WEBSITE').length};
}
export async function playlistPublication(store,actor,offer,input){
 await playlistScope(store,actor,offer);const replay=await store.replay(actor.account_id,input.operationId,await store.requestHash(offer,input));if(replay)return replay;const playlist=await playlistRow(store,offer,input.playlistId);if(!playlist)throw fail('Choose a saved playlist.',404);
 if(typeof input.published!=='boolean')throw fail('Choose Publish or Withdraw.');
 if(input.published&&!await store.first('SELECT 1 FROM mou_playlist_items i JOIN attachments a USING(attachment_id) WHERE i.playlist_id=? AND a.published=1 LIMIT 1',[playlist.playlist_id]))throw fail('Publish at least one reviewed recording first.',409);
 return store.mutate(actor,offer,input,[store.statement('UPDATE websites SET enabled=?,published_key=CASE WHEN ?=1 THEN draft_key ELSE published_key END,revision=revision+1 WHERE website_id=?',[Number(input.published),Number(input.published),playlist.website_id]),store.statement('UPDATE mou_playlists SET revision=revision+1 WHERE playlist_id=?',[playlist.playlist_id])],{saved:true,published:input.published},{studio:true,expectedSQL:'COALESCE((SELECT revision FROM access_revisions WHERE offering_id=?),0)=? AND EXISTS(SELECT 1 FROM mou_playlists p JOIN websites w USING(website_id) WHERE p.playlist_id=? AND p.revision=? AND w.revision=?)',expectedArgs:[offer,integer(input.revision),playlist.playlist_id,integer(input.playlistRevision),integer(input.websiteRevision)]});
}
export async function playlistAddRecording(store,actor,offer,input){
 await playlistScope(store,actor,offer);const replay=await store.replay(actor.account_id,input.operationId,await store.requestHash(offer,input));if(replay)return replay;const playlist=await checkedPlaylist(store,offer,input.playlistId),attachment=id(input.attachmentId);
 const row=await store.first("SELECT attachment_id,website_id,published FROM attachments a JOIN objects o USING(asset_id) WHERE a.attachment_id=? AND a.offering_id=? AND a.audience='RECORDING' AND o.mime_type IN('video/mp4','video/youtube')",[attachment,offer]);if(!row)throw fail('Choose a saved recording in this programme.',403);
 // Adding an existing recording is a reference. Its legacy access, source and
 // publication state stay unchanged; new private media uses the checked form.
 return store.mutate(actor,offer,input,assignPlaylist(store,playlist,row),{saved:true},{studio:true,expectedSQL:"COALESCE((SELECT revision FROM access_revisions WHERE offering_id=?),0)=? AND EXISTS(SELECT 1 FROM mou_playlists p JOIN websites w USING(website_id) WHERE p.playlist_id=? AND p.revision=? AND (?=0 OR w.enabled=0)) AND EXISTS(SELECT 1 FROM attachments a JOIN objects o USING(asset_id) WHERE a.attachment_id=? AND a.offering_id=? AND a.website_id IS ? AND a.published=? AND a.audience='RECORDING' AND o.mime_type IN('video/mp4','video/youtube'))",expectedArgs:[offer,integer(input.revision),playlist.playlist_id,integer(input.playlistRevision),Number(input.requirePrivate===true),attachment,offer,row.website_id,row.published]});
}
export async function savePlaylist(env,store,actor,offer,input){
 await playlistScope(store,actor,offer);const definition=await playlistDefinition(store,offer);
 const canonical={action:'mou-playlist-save',operationId:id(input.operationId),playlistId:id(input.playlistId),name:text(input.name,160).trim(),closeDate:input.closeDate?date(input.closeDate):null,revision:integer(input.revision),playlistRevision:integer(input.playlistRevision),websiteRevision:integer(input.websiteRevision),reviewCorrection:input.reviewCorrection===true};
 if(Object.hasOwn(input,'accessDate'))throw fail('Use the explicitly chosen close date. Open playlists follow the current paid month.');
 const replay=await store.replay(actor.account_id,canonical.operationId,await store.requestHash(offer,canonical));if(replay)return replay;
 checkedPlaylistCloseDate(canonical.closeDate,definition);
 if(!canonical.name)throw fail('Enter a playlist name.');
 if(input.accessModel&&input.accessModel!==definition.accessModel)throw fail('Preserve this programme’s native access model.',409);
 const row=await playlistRow(store,offer,canonical.playlistId),statements=[];
 if(!row){
  if(canonical.playlistRevision||canonical.websiteRevision)throw fail('The playlist changed. Refresh before saving.',409);
  const count=await store.first('SELECT count(*) n FROM mou_playlists WHERE offering_id=?',[offer]);if(count.n>=100)throw fail('Keep up to 100 playlists in this programme.');
  if(await store.first('SELECT 1 FROM websites WHERE website_id=?',[canonical.playlistId]))throw fail('Choose a new private playlist identity.',409);
  const document=newCourse();document.id=canonical.playlistId;document.name=canonical.name;document.tag=definition.kind==='COURSE'?'COURSE':definition.programme_key==='mothers'?'MOTHERS OF THE UMMAH':'TAFSEER AND TADABBUR';document.lessons=[];
  document.home={...document.home,headline:canonical.name,subtitle:'',description:'',imageId:'',imageAlt:'',caption:'',journeyTitle:'',themes:[],recordingLayout:'podcast'};
  document.pages={sessions:false,materials:false,assessments:false};document.materials={intro:'',files:[]};
  const key=await saveContent(env,document,canonical.playlistId);
  statements.push(store.statement('INSERT INTO websites(website_id,offering_id,title,completion_date,completion_month,draft_key,published_key,enabled,revision) VALUES(?,?,?,?,?,?,NULL,0,0)',[canonical.playlistId,offer,canonical.name,canonical.closeDate,canonical.closeDate?.slice(0,7)||null,key]),store.statement('INSERT INTO mou_playlists(playlist_id,offering_id,website_id,revision,created_at) VALUES(?,?,?,1,?)',[canonical.playlistId,offer,canonical.playlistId,Date.now()]));
 }else{
  if(row.revision!==canonical.playlistRevision||row.website_revision!==canonical.websiteRevision)throw fail('The playlist changed. Refresh before saving.',409,'CHANGE_CONFLICT');
  const correcting=row.completion_month!==(canonical.closeDate?.slice(0,7)||null);
  if(definition.accessModel==='MONTHLY'&&correcting&&row.completion_month){
   const holders=await priorHolders(store,offer,row.completion_month);
   if(holders.length&&!canonical.reviewCorrection)throw fail('Review how the date correction preserves existing access before saving.',409,'PLAYLIST_CORRECTION_REVIEW');
   if(holders.length)statements.push(store.statement("INSERT INTO mou_playlist_retained SELECT ?,?,json_extract(value,'$.accountId'),?,json_extract(value,'$.kind') FROM json_each(?) WHERE 1 ON CONFLICT DO NOTHING",[row.playlist_id,offer,row.completion_month,JSON.stringify(holders)]));
  }
  statements.push(store.statement('INSERT INTO mou_playlist_date_writes VALUES(?)',[row.playlist_id]),store.statement('UPDATE websites SET title=?,completion_date=?,completion_month=?,revision=revision+1 WHERE website_id=?',[canonical.name,canonical.closeDate,canonical.closeDate?.slice(0,7)||null,row.website_id]),store.statement('UPDATE mou_playlists SET revision=revision+1 WHERE playlist_id=?',[row.playlist_id]),store.statement('DELETE FROM mou_playlist_date_writes WHERE playlist_id=?',[row.playlist_id]));
 }
 const expectedSQL='COALESCE((SELECT revision FROM access_revisions WHERE offering_id=?),0)=?'+(row?' AND EXISTS(SELECT 1 FROM mou_playlists p JOIN websites w USING(website_id) WHERE p.playlist_id=? AND p.revision=? AND w.revision=?)':' AND NOT EXISTS(SELECT 1 FROM mou_playlists WHERE playlist_id=?)');
 return store.mutate(actor,offer,canonical,statements,{saved:true,playlistId:canonical.playlistId},{studio:true,expectedSQL,expectedArgs:[offer,canonical.revision,...(row?[row.playlist_id,canonical.playlistRevision,canonical.websiteRevision]:[canonical.playlistId])]});
}

// The caller must still enforce current account, offering, publication and live
// gates. Text-only months never confer the recording entitlement.
export function playlistEntitlementSQL({paidOnly=false,playlist='p',month}={}){
 if(!month)throw Error('A server-derived playlist month is required.');
 return `(EXISTS(SELECT 1 FROM paid_months m WHERE m.account_id=? AND m.offering_id=${playlist}.offering_id AND m.month=${month})
 ${paidOnly?'':`OR EXISTS(SELECT 1 FROM website_months m WHERE m.account_id=? AND m.offering_id=${playlist}.offering_id AND m.month=${month})`}
 OR EXISTS(SELECT 1 FROM mou_playlist_retained r WHERE r.playlist_id=${playlist}.playlist_id AND r.account_id=? AND (r.kind='PAID' AND EXISTS(SELECT 1 FROM paid_months m WHERE m.account_id=r.account_id AND m.offering_id=r.offering_id AND m.month=r.source_month)${paidOnly?'':" OR r.kind='WEBSITE' AND EXISTS(SELECT 1 FROM website_months m WHERE m.account_id=r.account_id AND m.offering_id=r.offering_id AND m.month=r.source_month)"})))`;
}
export async function playlistMediaAccess(store,actor,row){
 if((await playlistDefinition(store,row.offering_id)).accessModel==='COURSE')return Boolean(await store.first(`SELECT 1 FROM mou_playlist_items i JOIN mou_playlists p USING(playlist_id) JOIN websites w ON w.website_id=p.website_id WHERE (i.attachment_id=? OR i.attachment_id=(SELECT recording_attachment_id FROM media_supporting_files WHERE support_attachment_id=?)) AND p.offering_id=? AND w.enabled=1 AND w.published_key IS NOT NULL AND (EXISTS(SELECT 1 FROM participation r WHERE r.account_id=? AND r.offering_id=p.offering_id AND r.purchased=1) OR EXISTS(SELECT 1 FROM course_access_models c WHERE c.offering_id=p.offering_id AND c.access_model='FREE')) LIMIT 1`,[row.attachment_id,row.attachment_id,row.offering_id,actor.account_id]));
 const month=await effectiveMonth(store,row.offering_id);
 const found=await store.first(`SELECT 1 FROM mou_playlist_items i JOIN mou_playlists p USING(playlist_id) JOIN websites w ON w.website_id=p.website_id
 WHERE (i.attachment_id=? OR i.attachment_id=(SELECT recording_attachment_id FROM media_supporting_files WHERE support_attachment_id=?))
 AND p.offering_id=? AND w.enabled=1 AND w.published_key IS NOT NULL AND ${playlistEntitlementSQL({paidOnly:true,month})} LIMIT 1`,[row.attachment_id,row.attachment_id,row.offering_id,actor.account_id,actor.account_id]);return Boolean(found);
}
export async function playlistTextAccess(store,actor,websiteId,offer){
 const month=await effectiveMonth(store,offer);
 return Boolean(await store.first(`SELECT 1 FROM mou_playlists p JOIN websites w ON w.website_id=p.website_id WHERE p.website_id=? AND ${playlistEntitlementSQL({month})}`,[websiteId,actor.account_id,actor.account_id,actor.account_id]));
}
export async function playlistParentTextAccess(store,actor,websiteId,offer){
 const month=await effectiveMonth(store,offer);
 return Boolean(await store.first(`SELECT 1 FROM attachments a JOIN mou_playlist_items i USING(attachment_id) JOIN mou_playlists p USING(playlist_id) JOIN websites w ON w.website_id=p.website_id WHERE a.website_id=? AND w.enabled=1 AND w.published_key IS NOT NULL AND ${playlistEntitlementSQL({month})} LIMIT 1`,[websiteId,actor.account_id,actor.account_id,actor.account_id]));
}
export async function checkedPlaylist(store,offer,playlistId){
 const row=await playlistRow(store,offer,id(playlistId));if(!row)throw fail('Choose a registered playlist.',409,'PLAYLIST_REQUIRED');return row;
}
export async function playlistRecordingAccess(store,actor,playlistId,offer){
 if((await playlistDefinition(store,offer)).accessModel==='COURSE')return Boolean(await store.first("SELECT 1 FROM mou_playlists p JOIN websites w USING(website_id) WHERE p.playlist_id=? AND p.offering_id=? AND w.enabled=1 AND w.published_key IS NOT NULL AND (EXISTS(SELECT 1 FROM participation r WHERE r.account_id=? AND r.offering_id=p.offering_id AND r.purchased=1) OR EXISTS(SELECT 1 FROM course_access_models c WHERE c.offering_id=p.offering_id AND c.access_model='FREE'))",[playlistId,offer,actor.account_id]));
 const month=await effectiveMonth(store,offer);
 return Boolean(await store.first(`SELECT 1 FROM mou_playlists p JOIN websites w USING(website_id) WHERE p.playlist_id=? AND w.enabled=1 AND w.published_key IS NOT NULL AND ${playlistEntitlementSQL({paidOnly:true,month})}`,[playlistId,actor.account_id,actor.account_id]));
}
export async function learnerPlaylists(store,actor,offer,{staff=false}={}){
 const definition=await playlistDefinition(store,offer),course=definition.accessModel==='COURSE',month=course?null:await effectiveMonth(store,offer);
 const paid=course?"EXISTS(SELECT 1 FROM participation r WHERE r.account_id=? AND r.offering_id=p.offering_id AND r.purchased=1) OR EXISTS(SELECT 1 FROM course_access_models c WHERE c.offering_id=p.offering_id AND c.access_model='FREE')":playlistEntitlementSQL({paidOnly:true,month});
 const read=course?paid:`(${playlistEntitlementSQL({month})} OR EXISTS(SELECT 1 FROM surah_grants g WHERE g.account_id=? AND g.website_id=p.website_id))`;
 const rows=await store.all(`SELECT p.playlist_id,p.published_count,w.website_id,w.title,w.completion_date,(${paid}) recordings_access,(${read}) text_access FROM mou_playlists p JOIN websites w USING(website_id) WHERE p.offering_id=? AND w.enabled=1 AND w.published_key IS NOT NULL ORDER BY p.playlist_id LIMIT 101`,[...Array(course?2:6).fill(actor.account_id),offer]);
 if(rows.length>100)throw fail('Review the playlist catalogue.',409);
 return rows.filter(r=>staff||r.recordings_access||r.text_access).map(r=>({id:r.playlist_id,websiteId:r.website_id,title:r.title,closeDate:r.completion_date,state:r.completion_date?'CLOSED':'OPEN',recordings:r.published_count,canListen:Boolean(staff||r.recordings_access),canRead:Boolean(staff||r.text_access),href:'/studio/?website='+encodeURIComponent(r.website_id)}));
}

export async function playlistReadingLessons(store,actor,website){
 const month=await effectiveMonth(store,website.offering_id);
 // Seek this exact native parent first, including when other entitled playlists
 // in the SAME programme have thousands of members on different websites.
 const rows=await store.all(`SELECT a.lesson_id FROM mou_playlist_item_parents ip
 CROSS JOIN mou_playlists p ON p.playlist_id=ip.playlist_id
 CROSS JOIN websites w ON w.website_id=p.website_id
 CROSS JOIN mou_playlist_items i ON i.playlist_id=ip.playlist_id AND i.attachment_id=ip.attachment_id
 CROSS JOIN attachments a ON a.attachment_id=ip.attachment_id
 WHERE ip.website_id=? AND p.offering_id=? AND w.enabled=1 AND w.published_key IS NOT NULL AND ${playlistEntitlementSQL({month})}
 AND a.website_id=ip.website_id AND a.offering_id=p.offering_id AND a.audience='RECORDING' AND a.published=1 LIMIT 401`,[website.website_id,website.offering_id,actor.account_id,actor.account_id,actor.account_id]);
 if(rows.length>400)throw fail('This website needs a narrower playlist support view.',409,'RECORDING_SCOPE_LIMIT');
 return [...new Set(rows.map(r=>r.lesson_id))];
}
export function assignPlaylist(store,playlist,row,{exclusive=false,supportIds=[],protectPrivateParent=false}={}){
 const statements=[store.statement('INSERT INTO mou_playlist_items VALUES(?,?) ON CONFLICT DO NOTHING',[playlist.playlist_id,row.attachment_id])];
 if(exclusive)for(const attachment of [row.attachment_id,...supportIds])statements.push(store.statement('INSERT INTO mou_playlist_only_media VALUES(?) ON CONFLICT DO NOTHING',[attachment]));
 if(protectPrivateParent)statements.push(store.statement('INSERT INTO mou_playlist_only_websites SELECT w.website_id FROM websites w WHERE w.website_id=? AND (w.enabled=0 OR w.published_key IS NULL) AND NOT EXISTS(SELECT 1 FROM attachments a WHERE a.website_id=w.website_id AND a.published=1) ON CONFLICT DO NOTHING',[row.website_id]));
 return statements;
}

// Seek only this account's monthly offerings; timezone is a signed native fact.
// No global account, website or media scan and no per-card authority round-trip.
export async function playlistWebsiteCandidates(store,actor,after=''){
 const scopes=await store.all(`SELECT s.offering_id,s.timezone FROM source_access_scopes s JOIN offerings o USING(offering_id)
 WHERE s.offering_id IN(SELECT offering_id FROM paid_months WHERE account_id=? UNION SELECT offering_id FROM website_months WHERE account_id=?)
 AND o.kind='TAFSEER' AND EXISTS(SELECT 1 FROM mou_playlists p WHERE p.offering_id=s.offering_id) LIMIT 33`,[actor.account_id,actor.account_id]);
 if(scopes.length>32)throw fail('Choose a narrower programme catalogue.',409);
 if(!scopes.length)return [];
 const months=scopes.map(s=>({offeringId:s.offering_id,month:programmeMonth(Date.now(),s.timezone)}));
 const rows=await store.all(`SELECT w.website_id FROM json_each(?) j CROSS JOIN mou_playlists p ON p.offering_id=json_extract(j.value,'$.offeringId') CROSS JOIN websites w ON w.website_id=p.website_id
 WHERE w.website_id>? AND w.enabled=1 AND w.published_key IS NOT NULL AND ${playlistEntitlementSQL({month:"COALESCE(w.completion_month,json_extract(j.value,'$.month'))"})} ORDER BY w.website_id LIMIT 51`,[JSON.stringify(months),after,actor.account_id,actor.account_id,actor.account_id]);
 return rows.map(r=>r.website_id);
}
export async function cataloguePlaylistRights(store,actor,rows){
 const selected=rows.filter(r=>r.playlist_id&&r.kind==='TAFSEER').map(r=>({id:r.playlist_id,month:programmeMonth(Date.now(),r.timezone)}));
 if(!selected.length)return new Map();
 const rights=await store.all(`SELECT p.website_id,${playlistEntitlementSQL({month:"COALESCE(w.completion_month,json_extract(j.value,'$.month'))"})} allowed FROM json_each(?) j JOIN mou_playlists p ON p.playlist_id=json_extract(j.value,'$.id') JOIN websites w USING(website_id)`,[actor.account_id,actor.account_id,actor.account_id,JSON.stringify(selected)]);
 return new Map(rights.map(r=>[r.website_id,Boolean(r.allowed)]));
}

export async function savePlaylistOrder(store,actor,offer,input){
 await playlistScope(store,actor,offer);const replay=await store.replay(actor.account_id,input.operationId,await store.requestHash(offer,input));if(replay)return replay;
 const playlist=await checkedPlaylist(store,offer,input.playlistId);
 if(!Array.isArray(input.entries)||!input.entries.length||input.entries.length>400)throw fail('Order one to 400 saved recordings.');
 const entries=input.entries.map(e=>({attachmentId:id(e.attachmentId),position:integer(e.position,1)}));
 if(new Set(entries.map(e=>e.attachmentId)).size!==entries.length||new Set(entries.map(e=>e.position)).size!==entries.length||entries.some(e=>e.position>entries.length)||playlist.recording_count!==entries.length)throw fail('Order every playlist recording once.');
 const encoded=JSON.stringify(entries);
 return store.mutate(actor,offer,input,[store.statement("UPDATE recording_playlist_positions AS r SET position=json_extract(j.value,'$.position') FROM json_each(?) j WHERE r.playlist_id=? AND r.attachment_id=json_extract(j.value,'$.attachmentId')",[encoded,playlist.playlist_id])],{saved:true,playlistId:playlist.playlist_id},{studio:true,expectedSQL:"COALESCE((SELECT revision FROM access_revisions WHERE offering_id=?),0)=? AND EXISTS(SELECT 1 FROM mou_playlists p WHERE p.playlist_id=? AND p.offering_id=? AND p.revision=? AND p.recording_count=?) AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM mou_playlist_items i WHERE i.playlist_id=? AND i.attachment_id=json_extract(j.value,'$.attachmentId')))",expectedArgs:[offer,integer(input.revision),playlist.playlist_id,offer,integer(input.playlistRevision),entries.length,encoded,playlist.playlist_id]});
}
