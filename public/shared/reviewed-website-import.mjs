import {validatePackage} from './content-schema.mjs';
const id=value=>{if(typeof value!=='string'||!/^[-A-Za-z0-9_:]{1,180}$/.test(value))throw Error('Review the exact website and media identities.');return value;};
const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value))].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function reviewImport(plan){
 const allowed=new Set(['format','offeringId','websiteId','document','documentSha256','assets','recordings','recordingSupport','programmeSubject']);
 if(!plan||Object.keys(plan).some(key=>!allowed.has(key))||plan.format!=='STUDIO_REVIEWED_WEBSITE_IMPORT_V1'||!Array.isArray(plan.assets)||plan.assets.length>100||!Array.isArray(plan.recordings)||plan.recordings.length>80)throw Error('Choose a bounded reviewed website package.');
 id(plan.offeringId);id(plan.websiteId);const errors=validatePackage(plan.document,{review:true});if(errors.length)throw Error(errors.join(' '));
 if(plan.programmeSubject!==undefined&&plan.programmeSubject!=='surah-al-baqarah')throw Error('Review the exact programme subject.');
 if(await hash(JSON.stringify(plan.document))!==plan.documentSha256)throw Error('The reviewed website document changed.');
 const assets=new Set(),lessons=new Set(),attachments=new Set();
 for(const asset of plan.assets){id(asset.assetId);if(assets.has(asset.assetId)||!/^[a-f0-9]{64}$/.test(asset.sha256||'')||!['application/pdf','image/png','image/jpeg','image/webp'].includes(asset.mimeType)||typeof asset.base64!=='string'||asset.base64.length>24*1024*1024||!Number.isSafeInteger(asset.bytes)||asset.bytes<1||asset.bytes>16*1024*1024)throw Error('Review the distinct website files.');assets.add(asset.assetId);}
 for(const recording of plan.recordings){id(recording.assetId);id(recording.lessonId);id(recording.attachmentId);if(assets.has(recording.assetId)||lessons.has(recording.lessonId)||attachments.has(recording.attachmentId)||!/^[A-Za-z0-9_-]{11}$/.test(recording.videoId||'')||typeof recording.title!=='string'||!recording.title.trim()||recording.title.length>240)throw Error('Review the distinct recorded lessons.');assets.add(recording.assetId);lessons.add(recording.lessonId);attachments.add(recording.attachmentId);}
 return {title:plan.document.name,recordings:plan.recordings.length,readings:plan.document.lessons.length,files:plan.assets.length,bytes:plan.assets.reduce((n,a)=>n+a.bytes,0),importId:await hash(JSON.stringify(plan))};
}

// Uses the normal protected endpoints. The selected account and its current
// scope are checked on every save; the file cannot supply a role or grant.
export async function importReviewedWebsite(plan,{api,current=()=>{},report=()=>{}}){
 const review=await reviewImport(plan),prefix='import:'+review.importId,base='/api/admin/'+id(plan.offeringId),website='/api/websites/'+id(plan.websiteId)+'/edit';
 const call=async(path,options)=>{current();const result=await api(path,options);current();return result;};
 const scope=await call(base);if(scope.canManageContent!==true)throw Error('Complete the reviewed offering handover before importing content.');
 report('Creating the private website draft…');
 await call(base,{body:{operationId:prefix+':create',action:'website-create',websiteId:plan.websiteId,title:plan.document.name,document:plan.document}});
 if(plan.programmeSubject)await call(base,{body:{operationId:prefix+':subject',action:'mou-subject',displayKey:plan.programmeSubject,websiteId:plan.websiteId,enabled:true}});
 const saved=await call(website);if(saved.offeringId!==plan.offeringId||saved.draftVersion!==plan.documentSha256)throw Error('This website has a different saved edition. Review it before importing.');
 for(const [index,asset] of plan.assets.entries()){
  current();const binary=atob(asset.base64),bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));if(bytes.length!==asset.bytes||await hash(bytes)!==asset.sha256)throw Error('A prepared website file changed.');current();
  report('Uploading website file '+(index+1)+' of '+plan.assets.length+'…');
  await call(base+'/files?'+new URLSearchParams({assetId:asset.assetId,operationId:prefix+':file:'+asset.assetId,filename:asset.filename||asset.assetId}),{method:'PUT',body:new Blob([bytes],{type:asset.mimeType})});
 }
 const batch=async(kind,changes)=>{for(let offset=0;offset<changes.length;offset+=25){report('Saving '+kind+' '+(offset+1)+'–'+Math.min(offset+25,changes.length)+'…');await call(base,{body:{operationId:prefix+':'+kind+':'+offset,action:'content-batch',changes:changes.slice(offset,offset+25)}});}};
 await batch('recordings',plan.recordings.map(recording=>({action:'youtube',assetId:recording.assetId,videoId:recording.videoId,title:recording.title})));
 const attachments=[...plan.assets.map(asset=>({action:'attachment',attachmentId:'website-file:'+plan.websiteId+':'+asset.assetId,assetId:asset.assetId,websiteId:plan.websiteId,lessonId:'website-support:'+plan.websiteId,lessonDate:null,cohort:'',title:asset.filename||asset.assetId,audience:'WEBSITE',published:false})),...plan.recordings.map(recording=>({action:'attachment',attachmentId:recording.attachmentId,assetId:recording.assetId,websiteId:plan.websiteId,lessonId:recording.lessonId,lessonDate:recording.lessonDate??null,cohort:recording.cohort||'',title:recording.title,audience:'RECORDING',published:false}))];
 await batch('attachments',attachments);
 let revision=0;
 if(plan.recordingSupport){report('Connecting the approved supporting readings…');const result=await call(website,{body:{operationId:prefix+':support',action:'recording-support',revision:0,bindings:plan.recordingSupport.bindings,sections:plan.recordingSupport.sections}});revision=result.revision;}
 report('Publishing the reviewed website…');
 await call(website,{body:{operationId:prefix+':publish',action:'publish',revision}});
 await batch('published-recordings',attachments.filter(row=>row.audience==='RECORDING').map(row=>({...row,published:true})));
 report('Published '+review.title+'.');return {...review,websiteId:plan.websiteId,published:true};
}
