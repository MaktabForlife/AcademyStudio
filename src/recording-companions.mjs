import {fail,id,sha256,bodyJSON} from './protocol.mjs';
import {mediaGate} from './media.mjs';
import {learnerCompanion,publicationIndex} from '../public/shared/learner-companion.mjs';

export async function companionChanges(env,store,actor,offer,input){
 const attachment=id(input.attachmentId),row=await mediaGate(store,actor,attachment,{admin:true});
 if(row.offering_id!==offer||!row.website_id&&row.kind!=='COURSE'||row.audience!=='RECORDING'||!['video/youtube','video/mp4'].includes(row.mime_type))throw fail('Choose the exact recording in this programme.',409);
 const saved=await store.first('SELECT * FROM recording_companions WHERE attachment_id=?',[attachment]);
 const previous=await store.replay(actor.account_id,input.operationId,await store.requestHash(offer,input));if(previous){if(input.action==='companion-save')await env.CONTENT.put(previous.draftKey,JSON.stringify(learnerCompanion(input.companion)),{httpMetadata:{contentType:'application/json'}});return previous;}
 if(input.revision!==(saved?.revision??0))throw fail('This companion changed. Reopen its saved draft.',409);
 let key=saved?.draft_key,index=saved?.index_json,staged;
 if(input.action==='companion-save'){
  if(!/^[a-f0-9]{64}$/.test(input.sourceRevision||''))throw fail('Choose the reviewed source revision.');
  if(!Number.isInteger(input.durationSeconds)||input.durationSeconds<1||input.durationSeconds>86400)throw fail('Confirm the recording duration.');
  const value=learnerCompanion(input.companion);if(value.topics.some(t=>t.start>=input.durationSeconds))throw fail('Keep topic timestamps within the actual recording.');const encoded=JSON.stringify(value);if(new TextEncoder().encode(encoded).byteLength>300000)throw fail('Keep this companion bounded.',413);
  key=(row.website_id?'websites/'+row.website_id:'offerings/'+offer)+'/recordings/'+row.asset_id+'/companions/'+await sha256(encoded)+'.json';staged=encoded;
 }else if(input.action==='companion-publish'){
  if(!saved||input.sourceRevision!==saved.source_revision||input.draftKey!==saved.draft_key)throw fail('Review the exact saved source and draft before publishing.',409);
  const object=await env.CONTENT.get(key);if(!object||object.size>300000)throw fail('Saved companion unavailable.',503);
  const value=await bodyJSON(object.body,300000);if(value.schema!=='LEARNER_COMPANION_V1')throw fail('Review the publication format.',409);index=JSON.stringify({...publicationIndex(value),durationSeconds:saved.duration_seconds});
 }else throw fail('Choose a companion action.');
 const next=(saved?.revision??0)+1;
 const statements=input.action==='companion-save'?[store.statement('INSERT INTO recording_companions VALUES(?,?,1,?,NULL,NULL,?) ON CONFLICT(attachment_id) DO UPDATE SET source_revision=excluded.source_revision,revision=recording_companions.revision+1,draft_key=excluded.draft_key,duration_seconds=excluded.duration_seconds',[attachment,input.sourceRevision,key,input.durationSeconds])]:[store.statement('UPDATE recording_companions SET published_key=draft_key,index_json=?,revision=revision+1 WHERE attachment_id=?',[index,attachment])];
 const result=await store.mutate(actor,offer,input,statements,{attachmentId:attachment,revision:next,draftKey:key,published:input.action==='companion-publish'},{studio:true,expectedSQL:"COALESCE((SELECT revision FROM recording_companions WHERE attachment_id=?),0)=? AND EXISTS(SELECT 1 FROM attachments WHERE attachment_id=? AND offering_id=? AND asset_id=? AND website_id IS ?)",expectedArgs:[attachment,input.revision,attachment,offer,row.asset_id,row.website_id]});
 if(staged)await env.CONTENT.put(key,staged,{httpMetadata:{contentType:'application/json'}});return result;
}
export async function permittedCompanionIndexes(store,media){
 const ids=media.filter(r=>['video/mp4','video/youtube'].includes(r.type)).map(r=>r.attachment_id);if(!ids.length)return [];
 const rows=await store.all('SELECT attachment_id,index_json FROM recording_companions WHERE attachment_id IN(SELECT value FROM json_each(?)) AND published_key IS NOT NULL',[JSON.stringify(ids)]);
 return rows.map(r=>({attachmentId:r.attachment_id,...JSON.parse(r.index_json)}));
}
export async function readCompanion(env,store,actor,attachmentId){
 await mediaGate(store,actor,attachmentId); // Same parent access, publication, epoch and session gates as playback.
 const row=await store.first('SELECT published_key FROM recording_companions WHERE attachment_id=?',[attachmentId]);if(!row?.published_key)throw fail('No companion has been published for this recording.',404);
 const object=await env.CONTENT.get(row.published_key);if(!object||object.size>300000)throw fail('Companion unavailable.',503);
 const value=await bodyJSON(object.body,300000);if(value.schema!=='LEARNER_COMPANION_V1')throw fail('Companion needs review.',503);return value;
}

// A selected-source preflight avoids the broad Admin participant/month dashboard.
export async function recordingAttachmentPreflight(store,offer,videoIds){
 if(!Array.isArray(videoIds)||!videoIds.length||videoIds.length>8||videoIds.some(v=>!/^[A-Za-z0-9_-]{11}$/.test(v)))throw fail('Choose up to eight exact recording sources.');
 const assets=await store.all(`SELECT o.asset_id,o.youtube_id,x.attachment_id,x.website_id,x.lesson_id,x.lesson_date,x.cohort,x.published,c.revision companion_revision,c.duration_seconds companion_duration_seconds,c.source_revision,c.draft_key companion_draft_key,c.published_key companion_published_key FROM objects o INDEXED BY objects_youtube JOIN asset_owners own ON own.asset_id=o.asset_id AND own.offering_id=? LEFT JOIN attachments x ON x.asset_id=o.asset_id AND x.offering_id=own.offering_id LEFT JOIN recording_companions c ON c.attachment_id=x.attachment_id WHERE o.youtube_id IN(SELECT value FROM json_each(?)) AND o.youtube_id IS NOT NULL LIMIT 65`,[offer,JSON.stringify(videoIds)]);
 if(assets.length>64)throw fail('Review duplicate native source associations before attaching.',409);
 const subjects=await store.all('SELECT p.display_key,w.website_id,w.draft_key,w.published_key,w.revision,w.enabled FROM programme_subjects p JOIN websites w USING(website_id) WHERE p.offering_id=? ORDER BY p.display_key LIMIT 11',[offer]);
 const scope=await store.first('SELECT s.classes_json,s.authority,s.generation,(SELECT programme_key FROM programme_offerings p WHERE p.offering_id=s.offering_id) programme_key FROM source_access_scopes s WHERE s.offering_id=?',[offer]);
 return {schema:'RECORDING_ATTACHMENT_PREFLIGHT_V1',offeringId:offer,assets,subjects,scope};
}
export async function publishRecordingAttachment(store,actor,offer,input){
 const row=await mediaGate(store,actor,id(input.attachmentId),{admin:true});if(row.offering_id!==offer)throw fail('Choose this programme’s recording.',403);
 const replay=await store.replay(actor.account_id,input.operationId,await store.requestHash(offer,input));if(replay)return replay;
 if(row.programme_key==='mothers'||await store.first('SELECT 1 FROM mou_playlist_items WHERE attachment_id=? LIMIT 1',[row.attachment_id]))throw fail('Review the recorded Teacher and explicit playlist in the checked media form before publishing.',409,'PLAYLIST_REQUIRED');
 for(const [field,key] of [['asset_id','assetId'],['website_id','websiteId'],['lesson_id','lessonId'],['lesson_date','lessonDate'],['cohort','cohort']])if(row[field]!==input[key])throw fail('The recording association changed; preserve the current saved entry.',409);
 if(row.audience!=='RECORDING'||row.published)throw fail('Review the current recording publication.',409);
 const companion=await store.first('SELECT published_key,source_revision FROM recording_companions WHERE attachment_id=?',[row.attachment_id]);
 if(!companion?.published_key||companion.source_revision!==input.sourceRevision||companion.published_key!==input.companionKey)throw fail('Publish the reviewed exact companion before this recording.',409);
 return store.mutate(actor,offer,input,[store.statement('UPDATE attachments SET published=1 WHERE attachment_id=?',[row.attachment_id])],{attachmentId:row.attachment_id,published:true},{studio:true,expectedSQL:`EXISTS(SELECT 1 FROM attachments a JOIN websites w ON w.website_id=a.website_id JOIN recording_companions c USING(attachment_id) WHERE a.attachment_id=? AND a.offering_id=? AND a.asset_id=? AND a.website_id=? AND a.lesson_id=? AND a.lesson_date=? AND a.cohort=? AND a.audience='RECORDING' AND a.published=0 AND w.enabled=1 AND w.published_key IS NOT NULL AND c.source_revision=? AND c.published_key=?)`,expectedArgs:[row.attachment_id,offer,input.assetId,input.websiteId,input.lessonId,input.lessonDate,input.cohort,input.sourceRevision,input.companionKey]});
}
