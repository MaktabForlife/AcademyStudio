import {mediaAdmin} from '../media-attribution.mjs';
import {mediaGate} from '../media.mjs';
import {fail,id,sha256} from '../protocol.mjs';
// Native DB snapshot only. No R2 byte/version or ingestion-time certificate is
// claimed. The job runner must separately check actual immutable source bytes.
const snapshotSQL=`SELECT json_object(
 'attachmentId',x.attachment_id,'offeringId',x.offering_id,'websiteId',x.website_id,
 'assetId',x.asset_id,'lessonId',x.lesson_id,'lessonDate',x.lesson_date,'cohort',x.cohort,
 'title',x.title,'audience',x.audience,'published',x.published,
 'objectKey',o.object_key,'mime',o.mime_type,'filename',o.filename,'size',o.byte_size,
 'objectNativeHash',o.sha256,'youtubeId',o.youtube_id,
 'offeringKind',f.kind,'offeringActive',f.active,'offeringRevision',f.revision,
 'programmeKey',p.programme_key,
 'websiteOffering',w.offering_id,'websiteRevision',w.revision,'websiteEnabled',w.enabled,
 'websiteDraft',w.draft_key,'websitePublished',w.published_key,
 'attributionRevision',t.revision,'attributionDraft',t.draft_json,
 'companionRevision',COALESCE(c.revision,0),'companionSource',c.source_revision,
 'companionDraft',c.draft_key,'companionPublished',c.published_key,
 'scopeGeneration',s.generation,'scopeVersion',s.version,'scopeEnabled',s.enabled,
 'scopeAuthority',s.authority,'scopeClasses',s.classes_json,
 'handoverPhase',h.phase,'handoverGeneration',h.generation,'handoverSourceVersion',h.source_version,
 'personGeneration',a.generation,'personVersion',a.version,'personReady',a.ready,'personVerifiedAt',a.verified_at
 ) AS native_json
 FROM attachments x JOIN objects o USING(asset_id)
 JOIN asset_owners own ON own.asset_id=x.asset_id AND own.offering_id=x.offering_id
 JOIN offerings f ON f.offering_id=x.offering_id
 LEFT JOIN websites w ON w.website_id=x.website_id
 LEFT JOIN programme_offerings p ON p.offering_id=x.offering_id
 LEFT JOIN media_attributions t ON t.attachment_id=x.attachment_id
 LEFT JOIN recording_companions c ON c.attachment_id=x.attachment_id
 LEFT JOIN source_access_scopes s ON s.offering_id=x.offering_id
 LEFT JOIN access_handovers h ON h.offering_id=x.offering_id
 LEFT JOIN source_access_people a ON a.offering_id=x.offering_id AND a.account_id=?
 WHERE x.attachment_id=? AND x.offering_id=?`;
export async function nativeProcessingSource(env,store,actor,offer,input={}){
 if(env.VIDEO_AUTOLINK_ENABLED!=='1')throw fail('Video processing is not enabled.',404,'PROCESSOR_DISABLED');
 offer=id(offer);const attachment=id(input.attachmentId);
 await mediaAdmin(store,actor,offer);const media=await mediaGate(store,actor,attachment,{admin:true});
 if(media.offering_id!==offer||media.audience!=='RECORDING'||!['video/youtube','video/mp4'].includes(media.mime_type))throw fail('Choose this programme’s existing recording.',403,'PROCESSING_SOURCE_REQUIRED');
 const args=[actor.account_id,attachment,offer],row=await store.first(snapshotSQL,args);
 if(!row)throw fail('The saved recording owner changed.',409,'PROCESSING_SOURCE_CHANGED');
 const native=JSON.parse(row.native_json);
 if(!native.attributionRevision||!native.attributionDraft||native.websiteId&&native.websiteOffering!==offer)throw fail('Review the exact native recording destination and attribution.',409,'PROCESSING_DESTINATION_REQUIRED');
 if(await store.first('SELECT 1 FROM source_access_master_fences WHERE account_id=? AND offering_id=?',[actor.account_id,offer]))throw fail('Confirm the current native master account.',409,'ACCESS_REFRESH_REQUIRED');
 const sourceRevision=await sha256(JSON.stringify({schema:'RECORDED_MEDIA_SOURCE_V1',assetId:native.assetId,youtubeId:native.youtubeId,objectHash:native.objectNativeHash}));
 const material={...native};for(const key of ['personGeneration','personVersion','personReady','personVerifiedAt'])delete material[key];
 const value={attachmentId:attachment,offeringId:offer,assetId:native.assetId,websiteId:native.websiteId,lessonId:native.lessonId,lessonDate:native.lessonDate,cohort:native.cohort,sourceRevision,companionRevision:native.companionRevision,attributionRevision:native.attributionRevision,
  style:native.programmeKey==='mothers'?'MOU':'ACADEMIC',
  // Existing native Studio recordings are retained. Never invent an academic
  // TTL or a first-upload timestamp from MIME, URL, attachment date or clock.
  retentionPolicy:'PERMANENT_STUDIO_RETAINED',originalIngestedAt:null,
  originalIngestionProved:false,nativeDBFingerprint:await sha256(row.native_json),materialFingerprint:await sha256(JSON.stringify(material))};
 Object.defineProperty(value,'fence',{value:{expectedSQL:'('+snapshotSQL+')=? AND NOT EXISTS(SELECT 1 FROM source_access_master_fences WHERE account_id=? AND offering_id=?)',expectedArgs:[...args,row.native_json,actor.account_id,offer]},enumerable:false});
 return value;
}
