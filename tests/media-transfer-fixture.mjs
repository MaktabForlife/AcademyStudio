import {contentHash} from '../tools/reconciled-content.mjs';

export function sampleMediaTransfer(){
 const source={activityKey:'PROGRAM:original',offeringId:'tafseer',kind:'TAFSEER',headId:'accepted-head',generation:3,writeVersion:7,components:[]};
 const originals=[Buffer.from('%PDF-1.4\nSynthetic first private original\n%%EOF'),Buffer.from('%PDF-1.4\nSynthetic second private original\n%%EOF')];
 const pdfs=originals.map((bytes,i)=>({sourceAssetId:'pdf-'+i,kind:'PDF',name:'Original notes '+i,filename:'Notes.pdf',byteSize:bytes.length,youtubeId:null,sourceObjectKey:'private/'+i+'.pdf',resolvedObjectKey:'private/'+i+'.pdf',expectedSha256:contentHash(bytes),linked:true,createdAt:null,sourceExpiresAt:null,sourceExpired:false}));
 const video=(id,youtubeId)=>({sourceAssetId:id,kind:'YOUTUBE',name:'Original recording',filename:'Video',byteSize:null,youtubeId,sourceObjectKey:null,resolvedObjectKey:null,expectedSha256:null,linked:true,createdAt:null,sourceExpiresAt:null,sourceExpired:false});
 const lesson={sourceLessonId:'original-lesson',scope:'SESSION',date:'2024-01-12',title:'Original lesson',state:'PUBLISHED',cohorts:['original-class','second-class'],assets:[...pdfs,video('video','abcdefghijk'),video('unassigned-video','zyxwvutsrqp')],sessionKey:'original-session',runId:'',publicationId:'original-publication',revision:2};
 const page={format:'ACADEMY_MEDIA_INVENTORY_V1',inventoryId:contentHash(source),source,lessons:[lesson],more:false,checkpoint:{inventoryId:contentHash(source),afterLessonId:lesson.sourceLessonId}};
 const references=lesson.assets.map(asset=>({offeringId:source.offeringId,sourceLessonId:lesson.sourceLessonId,state:lesson.state,date:lesson.date,cohorts:lesson.cohorts,...asset}));
 const files=originals.map(bytes=>({file:'objects/'+contentHash(bytes)+'.pdf',sha256:contentHash(bytes),bytes:bytes.length}));
 const copy={format:'ACADEMY_PRIVATE_COPY_REVIEW_V1',sourceUnchanged:true,sourceDeleted:false,targetPublished:false,targetAccessChanged:false,pages:1,snapshots:[{source,totalLessons:1}],references,
  objects:pdfs.map((p,i)=>({sourceAssetId:p.sourceAssetId,sourceObjectKey:p.resolvedObjectKey,sha256:files[i].sha256,bytes:files[i].bytes}))};
 const bundle={format:'CIRCLES_RECONCILED_CONTENT_V1',private:true,sourceDeleted:false,permissionsImported:false,hostedWrites:0,
  objects:files.map(f=>({...f,mimeType:'application/pdf'})),pending:[{key:'unmapped-course',status:'IDENTITY_AND_ACCESS_MAPPING_PENDING'}],
  sites:[{websiteId:'site-surah',offeringId:'tafseer',editions:{published:{sha256:'a'.repeat(64)},existingDraft:{sha256:'b'.repeat(64)},reviewDraft:{sha256:'c'.repeat(64)}},
   recordings:[{status:'MATCHED',editorialLessonId:'editorial-video',videoId:'abcdefghijk',native:references[2]},{status:'NATIVE_MAPPING_PENDING',editorialLessonId:'unresolved'}],
   materials:files.map((file,i)=>({status:'MATCHED',sha256:file.sha256,localObject:file,native:[references[i]]}))}]};
 return {bundle,copy,pages:[page],originals,files};
}
