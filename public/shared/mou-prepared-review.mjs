import {reviewNativeMouPlan} from './native-mou-import.mjs';
import {learnerCompanion} from './learner-companion.mjs';
import {checkedMediaTeacherIds,checkedMediaPlaylist} from './media-workflow.mjs';
const check=(ok,message)=>{if(!ok)throw Error(message);};
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),n=>n.toString(16).padStart(2,'0')).join('');
export async function reviewMouCatalogue(plan){
 const review=await reviewNativeMouPlan(plan);check(review.canExecute,'Use the verified prepared package with its native preflight.');
 check(plan.items.length===4,'Review the four prepared MOU lessons.');
 return Promise.all(plan.items.map(async item=>{
  const steps=plan.requests.filter(r=>r.name.startsWith(item.editorialLessonId+':'));
 const step=action=>steps.find(r=>r.body.action===action);
  const save=step('companion-save'),create=step('website-create');
  check(save&&create,'Each prepared subject needs its original reviewed private shell and companion.');
  const companion=learnerCompanion(save.body.companion);
  check(await hash(companion)===item.learnerSha256,'The prepared summary changed. Rebuild the reviewed package.');
  return {...item,companion,steps,expectedWebsiteKey:'websites/'+item.websiteId+'/versions/'+await hash(create.body.document)+'.json',companionKey:'websites/'+item.websiteId+'/recordings/'+item.assetId+'/companions/'+item.learnerSha256+'.json'};
 }));
}

// Fresh, bounded native facts are checked for this selected lesson only. Other
// subjects/drafts are never overwritten or required to remain unchanged.
export function mouLessonState(plan,item,facts){
 const scope=facts.scope;
 check(facts.offeringId===plan.preflight.offeringId&&scope?.authority==='WEBSITE'&&scope.programme_key==='mothers'&&scope.generation===plan.preflight.scope.generation&&JSON.parse(scope.classes_json).includes(item.cohort),'MOU ownership or recording cohort changed. Reopen the review.');
 const assets=facts.assets.filter(a=>a.youtube_id===item.videoId);
 check(assets.length<=1,'This source has multiple native associations. Review them before attaching.');
 const asset=assets[0];
 check(!asset||asset.asset_id===item.assetId,'Preserve the existing recording asset; its identity differs from this prepared lesson.');
 if(asset?.attachment_id)for(const [key,value]of Object.entries({attachment_id:item.attachmentId,website_id:item.websiteId,lesson_id:item.lessonId,lesson_date:item.recordedDate,cohort:item.cohort}))check(asset[key]===value,'The saved recording association changed. Review it before continuing.');
 const website=facts.websites.find(w=>w.website_id===item.websiteId),subject=facts.subjects.find(s=>s.display_key===item.subject);
 check(!subject||subject.website_id===item.websiteId&&website?.subject_enabled===1,'The subject card has another saved association. Preserve it.');
 if(website){
  check(website.offering_id===facts.offeringId&&website.draft_key===item.expectedWebsiteKey,'The subject website has saved edits. Review them separately before attaching.');
  check(website.revision===0&&!website.enabled&&!website.published_key||website.revision===1&&website.enabled===1&&website.published_key===item.expectedWebsiteKey,'The subject publication changed. Reopen its saved edition.');
 }
 check(!asset?.attachment_id||website,'The existing attachment needs its original subject website.');
 const saved=asset?.companion_draft_key;
 if(saved)check(saved===item.companionKey&&asset.source_revision===item.sourceRevision&&asset.companion_duration_seconds===item.durationSeconds&&[1,2].includes(asset.companion_revision),'The companion has saved edits or a different source. Preserve that draft.');
 check(!asset?.companion_published_key||asset.companion_published_key===item.companionKey,'The published companion changed. Preserve it.');
 const attached=Boolean(website&&subject&&asset?.attachment_id&&saved),published=Boolean(asset?.published);
 check(!published||attached&&website.enabled&&asset.companion_published_key===item.companionKey,'The existing publication needs separate reconciliation.');
 const attribution=facts.attributions?.find(a=>a.attachment_id===item.attachmentId);
 return {website,subject,asset,attribution,attached,published,label:published?'Published':attached?'Attached privately':asset?.attachment_id?'Partly attached':'Ready to attach'};
}

export async function runMouLesson({plan,itemId,phase,teacherIds,playlistId,api,current=()=>{},report=()=>{}}){
 check(['attach','publish'].includes(phase),'Choose Attach privately or Publish this lesson.');
 const reviewed=await reviewMouCatalogue(plan),item=reviewed.find(r=>r.editorialLessonId===itemId);check(item,'Choose a prepared lesson.');current();
 const fresh=await api('/api/admin/'+encodeURIComponent(plan.preflight.offeringId)+'/prepared-recordings');current();
 check(await hash(fresh.plan)===await hash(plan),'The prepared review changed. Reopen it before continuing.');
 const state=mouLessonState(plan,item,fresh.facts);if(state.published)return {published:true,unchanged:true};
 const requestedTeachers=teacherIds|| (state.attribution?JSON.parse(state.attribution.draft_json).teacherIds:[]);
 const choices=await api('/api/admin/'+encodeURIComponent(fresh.facts.offeringId)+'/media-options');current();const selected=checkedMediaTeacherIds(choices,requestedTeachers);
 const savedPlaylist=state.attribution?JSON.parse(state.attribution.draft_json).playlist?.id:null;const selectedPlaylist=playlistId||savedPlaylist;checkedMediaPlaylist(choices,selectedPlaylist);if(savedPlaylist)check(savedPlaylist===selectedPlaylist,'Preserve the saved playlist selection.');
 const step=action=>{const row=item.steps.find(r=>r.body.action===action);check(row,'The reviewed step is missing.');return row;};
 let actions;
 if(phase==='attach')actions=[...(!state.website?['website-create']:[]),...(!state.asset?['youtube']:[]),...(!state.asset?.attachment_id?['attachment']:[]),...(!state.subject?['mou-subject']:[]),...(!state.asset?.companion_draft_key?['companion-save']:[])];
 else {check(state.attached,'Attach this lesson privately and review it before publishing.');check(state.attribution,'Save a checked registered Teacher before publishing.');actions=[...(!state.website.enabled?['publish']:[]),...(!state.asset.companion_published_key?['companion-publish']:[])];}
 for(const action of actions){current();report(action==='recording-publication'?'Publishing this lesson…':phase==='attach'?'Attaching privately…':'Publishing the reviewed lesson…');const request=step(action);const body=action==='attachment'?{...request.body,action:'media-attach',teacherIds:selected,playlistId:selectedPlaylist}:request.body;await api(request.path,{body});current();}
 current();
 if(phase==='attach'){
  const updated=await api('/api/admin/'+encodeURIComponent(fresh.facts.offeringId)+'/prepared-recordings');current();const latest=mouLessonState(plan,item,updated.facts),attribution=latest.attribution;
  if(!attribution||!JSON.parse(attribution.draft_json).playlist?.id){
   const operationId='mou-teacher-'+(await hash([item.attachmentId,selected,selectedPlaylist,attribution?.revision||0])).slice(0,48);
   await api('/api/admin/'+encodeURIComponent(fresh.facts.offeringId),{body:{action:'media-attribution-save',operationId,attachmentId:item.attachmentId,revision:attribution?.revision||0,teacherIds:selected,playlistId:selectedPlaylist}});current();
  }else if(JSON.stringify([...selected].sort())!==JSON.stringify(JSON.parse(attribution.draft_json).teacherIds.slice().sort()))throw Error('Preserve the saved Teacher attribution; edit it separately.');
 }
 if(phase==='publish'){
  const saved=state.attribution;
  await api('/api/admin/'+encodeURIComponent(fresh.facts.offeringId),{body:{action:'media-publication',operationId:'mou-publish-'+(await hash([item.attachmentId,saved.revision,saved.draft_json])).slice(0,48),attachmentId:item.attachmentId,revision:saved.revision,draftContext:saved.draft_json,sourceRevision:item.sourceRevision,companionKey:item.companionKey}});current();
 }
 return {published:phase==='publish',attached:true,steps:actions.length+1};
}
