import {fail,id,integer,sha256} from './protocol.mjs';
import {playlistScope,checkedPlaylist,assignPlaylist} from './mou-playlists.mjs';
import {objectJSON,saveContent} from './content.mjs';
import {recordingGuides} from '../public/shared/recording-companion.mjs';
import {permittedGuideBindings} from './circles.mjs';

const revision=async(store,offer)=>(await store.first('SELECT revision FROM access_revisions WHERE offering_id=?',[offer]))?.revision||0;
const sourceFields=['attachment_id','asset_id','website_id','lesson_id','lesson_date','cohort','title','audience','published'];
const objectFields=['mime_type','object_key','filename','byte_size','sha256','youtube_id'];

// The source website is explicit. Unassigned material, title/date guesses and
// teacher inference never participate in this compatibility path.
async function facts(env,store,actor,offer,input){
 const scope=await playlistScope(store,actor,offer,{readOnly:true}),start=await revision(store,offer);
 const source=await store.first('SELECT * FROM websites WHERE website_id=? AND offering_id=?',[id(input.websiteId),offer]);
 if(!source||await store.first('SELECT 1 FROM mou_playlists WHERE website_id=?',[source.website_id]))throw fail('Choose an existing source website, not another native playlist.',409);
 const key=source.enabled&&source.published_key?source.published_key:source.draft_key;
 if(!key)throw fail('The source has no saved reading website.',409);
 const rows=await store.all(`SELECT a.*,o.mime_type,o.object_key,o.filename,o.byte_size,o.sha256,o.youtube_id,c.index_json,
 EXISTS(SELECT 1 FROM asset_owners own WHERE own.asset_id=a.asset_id AND own.offering_id=a.offering_id) has_owner
 FROM attachments a JOIN objects o USING(asset_id) LEFT JOIN recording_companions c USING(attachment_id)
 WHERE a.offering_id=? AND a.website_id=? AND (o.mime_type='application/pdf' OR a.audience='RECORDING' AND o.mime_type IN('video/mp4','video/youtube'))
 ORDER BY a.attachment_id LIMIT 61`,[offer,source.website_id]);
 const videos=rows.filter(r=>r.audience==='RECORDING'&&r.mime_type!=='application/pdf'),files=rows.filter(r=>r.mime_type==='application/pdf');
 if(rows.length>60||videos.length>50||files.length>10)throw fail('Review at most fifty recordings and ten PDFs together.',409);
 if(!rows.length)throw fail('This source has no recordings or PDFs to attach.',409);
 const document=await objectJSON(env.CONTENT,key),unresolved=[],ordered=[];
 const bindings=await permittedGuideBindings(env,{...source,programme_key:scope.programme_key,published_key:key},videos.map(r=>({...r,type:r.mime_type})),store);
 for(const guide of recordingGuides(document)){
  const matching=videos.filter(r=>r.lesson_id===guide.lessonId||bindings.some(b=>b.editorialLessonId===guide.lessonId&&b.nativeLessonId===r.lesson_id&&b.assetId===r.asset_id));
  if(matching.length>1){unresolved.push({readingId:guide.readingId,reason:'More than one exact recording matches this reading'});continue;}
  if(!matching.length)continue;
  const r=matching[0];let item=ordered.find(v=>v.attachmentId===r.attachment_id);
  if(!item){const index=r.index_json?JSON.parse(r.index_json):null;item={attachmentId:r.attachment_id,assetId:r.asset_id,title:r.title,recordedDate:r.lesson_date,published:Boolean(r.published),summary:index?.summary||guide.summary||'',topics:index?.topics||guide.topics||[],readingIds:[],...(guide.quote?{quote:guide.quote}:{})};ordered.push(item);}
  if(guide.readingId&&!item.readingIds.includes(guide.readingId))item.readingIds.push(guide.readingId);
 }
 for(const r of videos)if(!ordered.some(v=>v.attachmentId===r.attachment_id)){const index=r.index_json?JSON.parse(r.index_json):null;ordered.push({attachmentId:r.attachment_id,assetId:r.asset_id,title:r.title,recordedDate:r.lesson_date,published:Boolean(r.published),summary:index?.summary||'',topics:index?.topics||[],readingIds:[]});}
 const pdfs=[];
 for(const r of files){
  if(!r.object_key||!r.sha256||!Number.isSafeInteger(r.byte_size)||r.byte_size<=0)unresolved.push({attachmentId:r.attachment_id,reason:'The original PDF metadata is incomplete'});
  else {const saved=await env.MEDIA.head(r.object_key);if(!saved||saved.size!==r.byte_size)unresolved.push({attachmentId:r.attachment_id,reason:'The original PDF is unavailable or its size changed'});}
  if(!pdfs.some(p=>p.assetId===r.asset_id))pdfs.push({attachmentId:r.attachment_id,assetId:r.asset_id,title:r.title,size:r.byte_size,sha256:r.sha256,published:Boolean(r.published)});
 }
 for(const r of rows)if(!r.has_owner)unresolved.push({attachmentId:r.attachment_id,reason:'The file has no verified owner in this offering'});
 const sourceReview={websiteId:source.website_id,revision:source.revision,draftKey:source.draft_key,publishedKey:source.published_key,enabled:source.enabled};
 const sourceRows=rows.map(r=>Object.fromEntries([...sourceFields,...objectFields,'index_json'].map(k=>[k,r[k]??null])));
 const review={schema:'EXISTING_PLAYLIST_REFERENCES_V1',websiteId:source.website_id,title:source.title,kind:scope.kind,sourceReview,recordings:ordered,pdfs,unresolved,canAttach:!unresolved.length,href:'/studio/?website='+encodeURIComponent(source.website_id)};
 review.reviewHash=await sha256(JSON.stringify({sourceReview,sourceRows,recordings:ordered,pdfs}));
 const latest=await store.first('SELECT revision,draft_key,published_key,enabled FROM websites WHERE website_id=?',[source.website_id]);
 if(!latest||latest.revision!==source.revision||latest.draft_key!==source.draft_key||latest.published_key!==source.published_key||latest.enabled!==source.enabled||start!==await revision(store,offer))throw fail('The source collection changed. Review it again.',409,'CHANGE_CONFLICT');
 return {review,sourceRows,scope};
}
export async function reviewPlaylistReferences(env,store,actor,offer,input){return (await facts(env,store,actor,offer,input)).review;}

// All references are saved in one guarded transaction. Source attachments,
// objects, accounts, subscriptions, grants and publication flags are untouched.
export async function savePlaylistReferences(env,store,actor,offer,input){
 await playlistScope(store,actor,offer);
 const replay=await store.replay(actor.account_id,input.operationId,await store.requestHash(offer,input));if(replay)return replay;
 const target=await checkedPlaylist(store,offer,input.playlistId);
 if(target.enabled||target.published_key)throw fail('Choose a new private target playlist. Publishing remains a separate action.',409);
 const {review,sourceRows,scope}=await facts(env,store,actor,offer,input);
 if(!review.canAttach||input.reviewHash!==review.reviewHash)throw fail('The source or PDF changed. Review the exact collection again.',409,'COLLECTION_REVIEW_CHANGED');
 const course=scope.kind==='COURSE',workflow=await store.first('SELECT * FROM course_playlist_workflows WHERE playlist_id=?',[target.playlist_id]);
 if(course&&!workflow||!course&&workflow)throw fail('Use this offering’s native playlist workflow.',409);
 const statements=[],raw=JSON.stringify(sourceRows),src=review.sourceReview;
 if(course){
  const old=await store.all("SELECT kind,reference_id,snapshot_json FROM course_playlist_content WHERE playlist_id=? AND stage='DRAFT' ORDER BY position LIMIT 51",[target.playlist_id]);
  const values=[...review.recordings.map(r=>({kind:'RECORDING',id:r.attachmentId,snapshot:{...r,id:r.attachmentId,existingCollection:src}})),...review.pdfs.map(r=>({kind:'PDF',id:r.assetId,snapshot:{assetId:r.assetId,title:r.title,type:'application/pdf',size:r.size,sha256:r.sha256,existingCollection:src}}))];
  if(values.length>50)throw fail('Keep up to fifty items in a Course playlist draft.',409);
  if(old.length&&JSON.stringify(old.map(r=>[r.kind,r.reference_id,r.snapshot_json]))!==JSON.stringify(values.map(v=>[v.kind,v.id,JSON.stringify(v.snapshot)])))throw fail('Choose an empty private playlist so existing draft material is preserved.',409);
  if(!old.length){for(const [i,v] of values.entries())statements.push(store.statement("INSERT INTO course_playlist_content VALUES(?,'DRAFT',?,?,?,?)",[target.playlist_id,v.kind,v.id,i+1,JSON.stringify(v.snapshot)]));statements.push(store.statement('UPDATE course_playlist_workflows SET content_revision=content_revision+1 WHERE playlist_id=?',[target.playlist_id]));}
 }else{
  for(const r of review.recordings)statements.push(...assignPlaylist(store,target,{attachment_id:r.attachmentId}));
  const document=await objectJSON(env.CONTENT,target.draft_key);
  const old=await store.all("SELECT asset_id FROM attachments WHERE website_id=? AND audience='WEBSITE'",[target.website_id]);
  for(const pdf of review.pdfs){
   if(!old.some(r=>r.asset_id===pdf.assetId))statements.push(store.statement("INSERT INTO attachments VALUES(?,?,?,?,?,'','',?,'WEBSITE',0)",[crypto.randomUUID(),offer,target.website_id,pdf.assetId,'',pdf.title]));
   if(!document.materials.files.some(f=>f.assetId===pdf.assetId))document.materials.files.push({id:'shared-'+pdf.assetId,assetId:pdf.assetId,title:pdf.title,description:'Existing protected PDF · shared file'});
  }
  if(review.pdfs.length){const key=await saveContent(env,document,target.website_id);statements.push(store.statement('UPDATE websites SET draft_key=?,revision=revision+1 WHERE website_id=?',[key,target.website_id]));}
 }
 statements.push(store.statement('UPDATE mou_playlists SET revision=revision+1 WHERE playlist_id=?',[target.playlist_id]));
 const columns=[...sourceFields.map(k=>'a.'+k),...objectFields.map(k=>'o.'+k),'c.index_json'];
 // Row-value IS preserves null-safe equality without a deep AND expression.
 const matches='('+columns.join(',')+') IS ('+[...sourceFields,...objectFields,'index_json'].map(k=>`json_extract(j.value,'$.${k}')`).join(',')+')';
 const expectedSQL=`NOT EXISTS(SELECT 1 FROM source_access_master_fences WHERE account_id=? AND offering_id=?) AND COALESCE((SELECT revision FROM access_revisions WHERE offering_id=?),0)=?
 AND EXISTS(SELECT 1 FROM mou_playlists p JOIN websites w USING(website_id) WHERE p.playlist_id=? AND p.offering_id=? AND p.revision=? AND w.revision=? AND w.enabled=0 AND w.published_key IS NULL)
 AND EXISTS(SELECT 1 FROM websites WHERE website_id=? AND offering_id=? AND revision=? AND draft_key IS ? AND published_key IS ? AND enabled=?)
 AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM attachments a JOIN objects o USING(asset_id) LEFT JOIN recording_companions c USING(attachment_id) JOIN asset_owners own ON own.asset_id=a.asset_id AND own.offering_id=a.offering_id WHERE a.attachment_id=json_extract(j.value,'$.attachment_id') AND a.offering_id=? AND ${matches}))
 AND (SELECT count(*) FROM attachments a JOIN objects o USING(asset_id) WHERE a.offering_id=? AND a.website_id=? AND (o.mime_type='application/pdf' OR a.audience='RECORDING' AND o.mime_type IN('video/mp4','video/youtube')))=?`;
 const result={saved:true,private:true,playlistId:target.playlist_id,recordings:review.recordings.length,pdfs:review.pdfs.length,sourceWebsiteId:src.websiteId,requiresRecordingReview:course};
 return store.mutate(actor,offer,input,statements,result,{studio:true,expectedSQL,expectedArgs:[actor.account_id,offer,offer,integer(input.revision),target.playlist_id,offer,integer(input.playlistRevision),integer(input.websiteRevision),src.websiteId,offer,src.revision,src.draftKey,src.publishedKey,src.enabled,raw,offer,offer,src.websiteId,sourceRows.length]});
}
