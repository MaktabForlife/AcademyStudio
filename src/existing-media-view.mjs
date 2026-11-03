import {fail,id} from './protocol.mjs';
import {objectJSON} from './content.mjs';
import {recordingGuides} from '../public/shared/recording-companion.mjs';
import {bindRecordingGuides} from '../public/shared/media-bindings.mjs';
import {seriesRecordings} from '../public/shared/recording-website.mjs';
import {permittedGuideBindings} from './circles.mjs';

// Scoped Admin callers only. This projection never creates a playlist, moves
// a recording, or changes publication/access rights.
export async function existingMediaCounts(store,offer){
 const rows=await store.all(`SELECT a.website_id websiteId,
 count(CASE WHEN a.audience='RECORDING' AND o.mime_type IN('video/mp4','video/youtube') THEN 1 END) recordings,
 count(CASE WHEN a.audience='RECORDING' AND o.mime_type IN('video/mp4','video/youtube') AND a.published=0 THEN 1 END) privateRecordings,
 count(DISTINCT CASE WHEN o.mime_type='application/pdf' THEN a.asset_id END) pdfs,
 count(DISTINCT CASE WHEN o.mime_type='application/pdf' AND a.published=0 THEN a.asset_id END) privatePdfs
 FROM attachments a JOIN objects o USING(asset_id) WHERE a.offering_id=?
 AND (a.website_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM mou_playlist_items i WHERE i.attachment_id=a.attachment_id))
 GROUP BY a.website_id ORDER BY a.website_id LIMIT 202`,[offer]);
 if(rows.length>201)throw fail('Choose a narrower media collection.',409);
 return {websites:new Map(rows.filter(r=>r.websiteId).map(r=>[r.websiteId,r])),unassigned:rows.find(r=>r.websiteId===null)||{recordings:0,privateRecordings:0,pdfs:0,privatePdfs:0}};
}
export const emptyMediaCounts={recordings:0,privateRecordings:0,pdfs:0,privatePdfs:0};

export async function existingMediaDetail(env,store,offer,input){
 const unassigned=input.unassigned===true||input.unassigned==='1';
 if(unassigned&&input.websiteId)throw fail('Choose one media collection.');
 const website=unassigned?null:await store.first('SELECT w.*,website_id id,title name,published_key IS NOT NULL hasPublishedWebsite FROM websites w WHERE offering_id=? AND website_id=?',[offer,id(input.websiteId)]);
 if(!unassigned&&!website)throw fail('Choose an existing website in this Course.',404);
 const after=input.after?id(input.after):'';
 const rows=await store.all(`SELECT a.attachment_id attachmentId,a.asset_id assetId,a.lesson_id lessonId,a.title,a.lesson_date recordedDate,a.published,o.mime_type type,c.index_json companionIndex
 FROM attachments a JOIN objects o USING(asset_id) LEFT JOIN recording_companions c USING(attachment_id)
 WHERE a.offering_id=? AND a.attachment_id>? AND ${unassigned?'a.website_id IS NULL AND NOT EXISTS(SELECT 1 FROM mou_playlist_items i WHERE i.attachment_id=a.attachment_id)':'a.website_id=?'}
 AND (o.mime_type='application/pdf' OR a.audience='RECORDING' AND o.mime_type IN('video/mp4','video/youtube'))
 ORDER BY a.attachment_id LIMIT 51`,[offer,after,...(unassigned?[]:[website.id])]);
 let page=rows.slice(0,50).map(({companionIndex,...r})=>({...r,summary:companionIndex?JSON.parse(companionIndex).summary:null}));
 const key=website?.published_key||website?.draft_key;
 if(key&&page.some(r=>r.type!=='application/pdf')){
  const document=await objectJSON(env.CONTENT,key),media=page.filter(r=>r.type!=='application/pdf').map(r=>({...r,attachment_id:r.attachmentId,asset_id:r.assetId,lesson_id:r.lessonId,lesson_date:r.recordedDate}));
  const bindings=website.published_key?await permittedGuideBindings(env,website,media,store):[];
  const entries=seriesRecordings({media,guides:bindRecordingGuides(recordingGuides(document),media,bindings)});
  page=page.map(row=>{const entry=entries.find(e=>e.id===row.attachmentId);return entry?{...row,summary:row.summary||entry.summary,topics:entry.topics,readingIds:entry.readingIds,quote:entry.quote}:row;});
  const latest=await store.first('SELECT revision,draft_key,published_key FROM websites WHERE website_id=? AND offering_id=?',[website.id,offer]);
  if(!latest||latest.revision!==website.revision||latest.draft_key!==website.draft_key||latest.published_key!==website.published_key)throw fail('This collection changed. Reopen it.',409,'CHANGE_CONFLICT');
 }
 return {id:website?.id||'unassigned',name:website?.name||'Unassigned recordings and material',websiteId:website?.id||null,websitePublished:Boolean(website?.enabled&&website?.hasPublishedWebsite),unassigned,
 recordings:page.filter(r=>r.type!=='application/pdf'),pdfs:page.filter(r=>r.type==='application/pdf'),more:rows.length>50,next:rows.length>50?rows[49].attachmentId:null};
}
