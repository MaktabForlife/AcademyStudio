import {mouSubjects} from './mou-subjects.mjs';
import {esc} from './model.mjs';
import {learnerCompanion} from './learner-companion.mjs';
export const mouOffering='PRG-656bcece-4310-49c7-87d7-ee06756f66c1';
const subjects=new Set(['kitabul-adhkar','shamail-of-nabi','ihya-ulumid-deen','madaarijus-saalikeen']);
const id=v=>typeof v==='string'&&/^[-A-Za-z0-9_:]{1,180}$/.test(v);
const hash=async v=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(v))))].map(n=>n.toString(16).padStart(2,'0')).join('');
const check=(value,message)=>{if(!value)throw Error(message);};
const only=(value,names)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>names.includes(k));
const fields={
 'website-create':['operationId','action','websiteId','title','document'],
 youtube:['operationId','action','assetId','videoId','title'],
 attachment:['operationId','action','createOnly','attachmentId','assetId','websiteId','lessonId','lessonDate','cohort','title','audience','published'],
 publish:['operationId','action','revision'],
 'companion-save':['operationId','action','attachmentId','revision','sourceRevision','durationSeconds','companion'],
 'companion-publish':['operationId','action','attachmentId','revision','sourceRevision','draftKey'],
 'recording-publication':['operationId','action','attachmentId','assetId','websiteId','lessonId','lessonDate','cohort','sourceRevision','companionKey'],
 'mou-subject':['operationId','action','createOnly','websiteId','displayKey','enabled']
};
export function mouPreflightPath(plan){const p=new URLSearchParams();for(const item of plan.items)p.append('source',item.videoId);return '/api/admin/'+mouOffering+'/recording-attachments?'+p;}
export async function reviewNativeMouPlan(plan){
 check(plan?.schema==='NATIVE_MOU_GUARDED_REQUESTS_V1'&&Array.isArray(plan.items)&&plan.items.length===4&&Array.isArray(plan.requests)&&plan.requests.length>=16&&plan.requests.length<=32,'Choose the guarded four-MOU attachment package.');
 check(plan.preflight?.schema==='RECORDING_ATTACHMENT_PREFLIGHT_V1'&&plan.preflight.offeringId===mouOffering&&await hash(plan.preflight)===plan.preflightSha256,'This package needs its exact native preflight evidence.');
 check(plan.preflight.scope?.programme_key==='mothers'&&plan.preflight.scope.authority==='WEBSITE','Confirm native MOU ownership.');
 const seenSubjects=new Set(),seenOperations=new Set(),reviews=[];
 for(const item of plan.items){
  check(subjects.has(item.subject)&&!seenSubjects.has(item.subject)&&[item.websiteId,item.assetId,item.attachmentId,item.lessonId].every(id)&&/^[A-Za-z0-9_-]{11}$/.test(item.videoId||'')&&/^[a-f0-9]{64}$/.test(item.sourceRevision||''),'Review the four exact subject/source identities.');seenSubjects.add(item.subject);
  check(JSON.parse(plan.preflight.scope.classes_json).includes(item.cohort),'The recording cohort is outside the native MOU scope.');
  const steps=plan.requests.filter(r=>r.name.startsWith(item.editorialLessonId+':')),actions=steps.map(s=>s.body?.action);
  for(const required of ['attachment','companion-save','companion-publish','recording-publication'])check(actions.filter(a=>a===required).length===1,'Review one recording and companion per subject.');
  check(new Set(actions).size===actions.length&&steps.length>=4&&steps.length<=8,'A package step is duplicated.');
  const order=['website-create','youtube','attachment','publish','companion-save','companion-publish','recording-publication','mou-subject'];check(actions.every((a,i)=>i===0||order.indexOf(a)>order.indexOf(actions[i-1])),'Keep native attachment steps in their reviewed order.');
  const saving=steps.find(s=>s.body.action==='companion-save').body,c=saving.companion;
  check(only(c,['schema','summary','summaryFormat','lessonReference','application','assignmentLabel','topics','topicNotes','references','quotations','quote']),'Private review content does not belong in an import package.');
  check((c.references||[]).every(r=>only(r,['arabic','meaning','time','verification','status','enabled']))&&(c.topicNotes||[]).every(n=>only(n,['time','title','chapter','reflection','practice']))&&(c.topics||[]).every(t=>only(t,['time','title','start'])),'Private reference/topic evidence must remain outside this package.');
  const publication=learnerCompanion(c);check(publication.quotations.length===0&&await hash(publication)===item.learnerSha256,'This batch must retain the exact reviewed learner content and omit unverified quotations.');
  const key=`websites/${item.websiteId}/recordings/${item.assetId}/companions/${item.learnerSha256}.json`;
  for(const step of steps){const b=step.body;
   check(step.method==='POST'&&only(b,fields[b.action]||[])&&typeof b.operationId==='string'&&/^[-A-Za-z0-9_:]{1,180}$/.test(b.operationId)&&!seenOperations.has(b.operationId),'Choose distinct exact native retry identifiers.');seenOperations.add(b.operationId);
   check(step.path===(b.action==='publish'?'/api/websites/'+item.websiteId+'/edit':'/api/admin/'+mouOffering),'The package contains a foreign destination.');
   for(const k of ['websiteId','assetId','attachmentId','lessonId','sourceRevision','cohort'])if(b[k]!==undefined)check(b[k]===item[k],'A native recording association changed.');
   if(b.action==='youtube')check(b.videoId===item.videoId&&b.title===item.title,'The original source changed.');
   if(b.action==='attachment')check(b.createOnly===true&&b.audience==='RECORDING'&&b.published===false&&b.lessonDate===item.recordedDate&&b.title===item.title,'Stage each exact recording privately without overwriting another entry.');
   if(b.action==='companion-save')check(b.revision===0&&b.durationSeconds===item.durationSeconds,'Review the companion revision and duration.');
   if(b.action==='companion-publish')check(b.revision===1&&b.draftKey===key,'Publish only the reviewed exact companion.');
   if(b.action==='recording-publication')check(b.companionKey===key&&b.lessonDate===item.recordedDate,'The recording publication does not match its reviewed companion.');
   if(b.action==='mou-subject')check(b.createOnly===true&&b.displayKey===item.subject&&b.enabled===true,'Preserve existing subject bindings.');
   if(b.action==='website-create')check(b.document?.id===item.websiteId&&b.document.lessons?.length===0&&b.document.home?.description===''&&b.document.home?.themes?.length===0&&b.document.materials?.files?.length===0,'New subject shells cannot carry unrelated or private teaching content.');
   if(b.action==='publish')check(b.revision===0,'Preserve existing website drafts.');
  }
  const original=plan.preflight.subjects.find(s=>s.display_key===item.subject);if(original)check(original.website_id===item.websiteId&&original.enabled&&original.published_key&&!actions.some(a=>['website-create','publish','mou-subject'].includes(a)),'Preserve the current published subject and its saved draft.');
  else check(['website-create','publish','mou-subject'].every(a=>actions.includes(a)),'Connect only a completed new subject shell.');
  reviews.push({title:item.title||item.subject,date:item.recordedDate,duration:item.durationSeconds,subject:item.subject,subjectTitle:mouSubjects.find(s=>s.key===item.subject)?.title||item.subject,summary:publication.summary,references:publication.references.length,quotations:publication.quotations.length});
 }
 check(seenOperations.size===plan.requests.length,'The package contains an unrelated operation.');
 return {reviews,steps:plan.requests.length,canExecute:plan.requiresFreshPreflight!==true&&plan.execution==='CURRENT_AUTHORISED_NATIVE_ADMIN_ONLY_AFTER_COMBINED_V109_2_INTEGRATION'};
}
export function nativeMouReviewHTML(review){return '<h2>Four reviewed MOU lessons</h2><p>'+review.steps+' native steps · access remains on the existing month/cohort gates · no processing or reprocessing</p>'+review.reviews.map(r=>'<article><h3>'+esc(r.title)+'</h3><p>'+esc(r.subjectTitle)+' · '+esc(r.date)+' · '+Math.round(r.duration/60)+' min</p><p>'+esc(r.summary)+'</p><p>'+r.references+' permitted reference cards · '+r.quotations+' quotations</p></article>').join('');}
export async function assertMouPreflight(plan,fresh){
 check(fresh.schema==='RECORDING_ATTACHMENT_PREFLIGHT_V1'&&fresh.offeringId===mouOffering&&JSON.stringify(fresh.scope)===JSON.stringify(plan.preflight.scope),'Native MOU ownership/cohort changed. Export a fresh preflight and reconcile it.');
 for(const old of plan.preflight.subjects){const now=fresh.subjects.find(s=>s.display_key===old.display_key);check(now&&JSON.stringify(now)===JSON.stringify(old),'An existing subject draft/publication changed. Preserve the saved Admin edits.');}
 for(const current of fresh.subjects){if(plan.preflight.subjects.some(s=>s.display_key===current.display_key))continue;const item=plan.items.find(i=>i.subject===current.display_key),created=plan.requests.find(r=>r.body.action==='website-create'&&r.body.websiteId===item?.websiteId);check(item&&created&&current.website_id===item.websiteId&&current.revision===1&&current.enabled,'A new subject changed outside this exact import.');const expected='websites/'+item.websiteId+'/versions/'+await hash(created.body.document)+'.json';check(current.draft_key===expected&&current.published_key===expected,'Preserve the current subject draft and publication.');}
 for(const a of fresh.assets){const item=plan.items.find(i=>i.videoId===a.youtube_id);check(item&&a.asset_id===item.assetId,'A source asset changed or has duplicate native identities.');if(a.attachment_id)check(a.attachment_id===item.attachmentId&&a.website_id===item.websiteId&&a.lesson_id===item.lessonId&&a.lesson_date===item.recordedDate&&a.cohort===item.cohort,'Preserve the existing native recording association.');const key=`websites/${item.websiteId}/recordings/${item.assetId}/companions/${item.learnerSha256}.json`;if(a.companion_draft_key)check(a.companion_draft_key===key&&a.source_revision===item.sourceRevision,'Preserve the saved companion edit.');if(a.companion_published_key)check(a.companion_published_key===key,'Preserve the current companion publication.');}
}
// Historical packages remain readable for identity/receipt reconciliation. New
// MOU publication is always the explicit per-lesson Teacher/playlist workflow.
export async function executeNativeMouPlan(plan,{current=()=>{}}){
 await reviewNativeMouPlan(plan);current();
 throw Error('Use the per-lesson MOU review: choose a playlist and Teacher, attach privately, then publish one lesson at a time.');
}
