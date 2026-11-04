// One reviewed user action; bounded existing guarded reference writes underneath.
export function collectionPlan(review,playlistId){
 if(review?.schema==='EXISTING_PLAYLIST_REFERENCES_V1'){
  if(!review.canAttach||review.unresolved?.length||(!review.recordings?.length&&!review.pdfs?.length)||review.recordings.length>50||review.pdfs.length>10||new Set(review.recordings.map(row=>row.attachmentId)).size!==review.recordings.length)throw Error('Resolve every source recording and PDF before attaching this playlist.');
  return {review:structuredClone(review),playlistId,items:review.recordings.map(row=>({id:row.attachmentId})),pdfs:review.pdfs.map(row=>({id:row.attachmentId,assetId:row.assetId})),batchOperation:crypto.randomUUID(),batchPending:null,complete:false};
 }
 if(review?.schema!=='EXISTING_MOU_COLLECTION_V1'||!review.canAttach||review.unresolved?.length||!review.recordings?.length||review.recordings.length>50||review.pdfs.length>10||new Set(review.recordings.map(row=>row.attachmentId)).size!==review.recordings.length)throw Error('Resolve every source recording and PDF before attaching this playlist.');
 return {review:structuredClone(review),playlistId,items:review.recordings.map(row=>({id:row.attachmentId,operationId:crypto.randomUUID(),pending:null,complete:false})),pdfs:review.pdfs.map(row=>({id:row.attachmentId,assetId:row.assetId,attachmentId:crypto.randomUUID(),operationId:crypto.randomUUID(),pending:null,complete:false})),complete:false};
}
export function attachCollection(options){const {plan}=options;if(plan.running)return plan.running;plan.running=runCollection(options).finally(()=>{plan.running=null;});return plan.running;}
async function runCollection({plan,api,path,current=()=>{},progress=()=>{}}){
 current();
 if(plan.batchOperation){
  if(!plan.batchPending){const table=await api(path+'/playlists?playlist='+encodeURIComponent(plan.playlistId));current();const target=table.playlists.find(row=>row.id===plan.playlistId&&!row.legacy);if(!target||target.enabled)throw Error('Choose a private target playlist.');plan.batchPending={action:'existing-playlist-save',operationId:plan.batchOperation,playlistId:plan.playlistId,websiteId:plan.review.websiteId,reviewHash:plan.review.reviewHash,revision:table.revision,playlistRevision:target.revision,websiteRevision:target.websiteRevision};}
  await api(path,{body:plan.batchPending});current();
  const checked=await api(path+'/playlists?playlist='+encodeURIComponent(plan.playlistId));current();
  if(!checked.playlists.some(row=>row.id===plan.playlistId&&!row.enabled)||!plan.items.every(item=>checked.items?.some(row=>row.attachmentId===item.id))||!plan.pdfs.every(item=>checked.pdfs?.some(row=>row.assetId===item.assetId)))throw Error('The private playlist references need verification. Retry this same save.');
  plan.complete=true;progress(plan.items.length,plan.items.length);return {recordings:plan.items.length,pdfs:plan.pdfs.length,private:true};
 }
 // Each group is at most eight references. A failed/uncertain item stops the
 // run; retry keeps its exact command/operation before proceeding.
 for(let offset=0;offset<plan.items.length;offset+=8){
  let snapshot=null;
  for(const item of plan.items.slice(offset,offset+8)){
   current();if(item.complete)continue;
   if(!item.pending){const table=snapshot||await api(path+'/playlists?playlist='+encodeURIComponent(plan.playlistId));snapshot=table;current();const target=table.playlists.find(row=>row.id===plan.playlistId&&!row.legacy);if(!target||target.enabled)throw Error('Keep the target playlist private. Publication is a separate reviewed action.');
    if(table.items.some(row=>row.attachmentId===item.id)){item.complete=true;progress(plan.items.filter(row=>row.complete).length,plan.items.length);continue;}
    item.pending={action:'mou-playlist-add',operationId:item.operationId,playlistId:plan.playlistId,attachmentId:item.id,requirePrivate:true,revision:table.revision,playlistRevision:target.revision,sourceReview:plan.review.sourceReview};
   }
   try{const saved=await api(path,{body:item.pending});current();if(snapshot&&Number.isSafeInteger(saved.nextRevision)&&Number.isSafeInteger(saved.nextPlaylistRevision)){snapshot.revision=saved.nextRevision;snapshot.playlists.find(row=>row.id===plan.playlistId).revision=saved.nextPlaylistRevision;}else snapshot=null;item.pending=null;item.complete=true;progress(plan.items.filter(row=>row.complete).length,plan.items.length);}catch(error){if(error.status&&error.status<500){item.pending=null;item.operationId=crypto.randomUUID();}throw error;}
  }
 }
 for(const item of plan.pdfs){
  current();if(item.complete)continue;
  if(!item.pending){const table=await api(path+'/playlists?playlist='+encodeURIComponent(plan.playlistId));current();const target=table.playlists.find(row=>row.id===plan.playlistId);if(!target||target.enabled)throw Error('Keep this playlist private until its reference review is complete.');const saved=table.pdfs?.find(row=>row.assetId===item.assetId);if(saved){item.complete=true;continue;}item.pending={action:'mou-playlist-pdf-reference',operationId:item.operationId,playlistId:plan.playlistId,sourceAttachmentId:item.id,attachmentId:item.attachmentId,sourceReview:plan.review.sourceReview,revision:table.revision,playlistRevision:target.revision,websiteRevision:target.websiteRevision};}
  try{await api(path,{body:item.pending});current();item.complete=true;item.pending=null;}catch(error){if(error.status&&error.status<500){item.pending=null;item.operationId=crypto.randomUUID();}throw error;}
 }
 const checked=await api(path+'/existing-collection?website='+encodeURIComponent(plan.review.websiteId));current();
 if(JSON.stringify(checked.sourceReview)!==JSON.stringify(plan.review.sourceReview)||!checked.canAttach||JSON.stringify(checked.pdfs)!==JSON.stringify(plan.review.pdfs))throw Error('The original collection or PDF changed. Reopen its review; completed private references remain saved.');
 const table=await api(path+'/playlists?playlist='+encodeURIComponent(plan.playlistId));current();
 if(!plan.pdfs.every(item=>table.pdfs?.some(row=>row.assetId===item.assetId)))throw Error('The shared PDF reference is missing. Resume the review before publication.');
 if(!plan.items.every(item=>table.items.some(row=>row.attachmentId===item.id)))throw Error('Some recording references are missing. Retry this review before publication.');
 plan.complete=true;return {recordings:plan.items.length,pdfs:checked.pdfs.length,private:true};
}
