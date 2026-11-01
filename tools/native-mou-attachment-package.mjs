// Pure native request planner. It cannot fetch, log in, process, publish or deploy.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareAttachments} from './prepare-recording-attachments.mjs';
import {createHash} from 'node:crypto';
import {newCourse} from '../public/shared/model.mjs';
import {mouSubjects} from '../public/shared/mou-subjects.mjs';
import {learnerCompanion} from '../public/shared/learner-companion.mjs';
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const operationId=v=>{const h=hash(v);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
export function subjectDocument(websiteId,title,date){const d=newCourse();return {...d,id:websiteId,name:title,tag:'MOTHERS OF THE UMMAH',home:{...d.home,headline:title,subtitle:'',description:'',imageId:'',imageAlt:title,caption:'',journeyTitle:'',themes:[],recordingLayout:'podcast'},lessons:[],pages:{sessions:false,materials:false,assessments:false},menu:{home:'Recordings',lessons:'Read',sessions:'Sessions',materials:'Files',assessments:'Assessments'},materials:{intro:'',files:[]},updatedAt:date+'T00:00:00.000Z'};}
export function nativeDraftInput(lesson){const c=learnerCompanion(lesson.draft);return {summary:c.summary,lessonReference:c.lessonReference,application:c.application,assignmentLabel:c.assignmentLabel,topics:c.topics.map(({time,title})=>({time,title})),topicNotes:c.topicNotes,references:c.references.map(r=>({...r,verification:'matched',enabled:true})),quote:{text:'',verified:false}};}
export function buildNativeMouPackage({preflight,manifest,lessons,cohort='CLS-39751608-d213-4c66-a4d5-dccfbbeb1c57',localOnly=false}){
 if(preflight.schema!=='RECORDING_ATTACHMENT_PREFLIGHT_V1'||preflight.scope?.authority!=='WEBSITE'||preflight.scope?.programme_key!=='mothers'||!JSON.parse(preflight.scope.classes_json).includes(cohort))throw Error('Confirm the unchanged native MOU ownership and exact recording cohort first.');
 if(!localOnly&&manifest.items.some(i=>i.owner==='STUDIO'&&i.nativeOfferingId!==preflight.offeringId))throw Error('Use the confirmed native MOU offering only.');
 const offer=preflight.offeringId,requests=[],items=[];
 for(const item of manifest.items.filter(i=>i.owner==='STUDIO')){
  const lesson=lessons.find(l=>l.id===item.editorialLessonId),subject=mouSubjects.find(s=>s.key===item.subjectDisplayKey),existingSubject=preflight.subjects.find(s=>s.display_key===subject.key);
  if(existingSubject&&(!existingSubject.enabled||!existingSubject.published_key))throw Error('Review the existing unpublished subject draft without replacing it: '+subject.key);
  const websiteId=existingSubject?.website_id||item.proposedWebsiteId,videoId=new URL(item.sourceURL).searchParams.get('v'),matches=preflight.assets.filter(a=>a.youtube_id===videoId),assets=[...new Set(matches.map(a=>a.asset_id))];if(assets.length>1)throw Error('Resolve duplicate native source assets: '+videoId);
  if(matches.some(a=>a.attachment_id))throw Error('An existing native association needs reconciliation; preserve it: '+videoId);
  const assetId=assets[0]||item.proposedAssetId,attachmentId=item.proposedAttachmentId,lessonId=item.proposedLessonId,companion=learnerCompanion(lesson.draft),draft=nativeDraftInput(lesson),companionKey=`websites/${websiteId}/recordings/${assetId}/companions/${hash(companion)}.json`;
  if(JSON.stringify(learnerCompanion(draft))!==JSON.stringify(companion))throw Error('The guarded input changed the approved learner content.');
  const step=(name,path,body)=>requests.push({name:item.editorialLessonId+':'+name,method:'POST',path,body:{operationId:operationId([item.sourceRevision,name,offer,websiteId,assetId,attachmentId]),...body}}),admin='/api/admin/'+offer;
  if(!existingSubject)step('create-subject',admin,{action:'website-create',websiteId,title:subject.title,document:subjectDocument(websiteId,subject.title,item.recordedDate)});
  if(!assets.length)step('register-source',admin,{action:'youtube',assetId,videoId,title:lesson.title});
  step('stage-recording',admin,{action:'attachment',createOnly:true,attachmentId,assetId,websiteId,lessonId,lessonDate:item.recordedDate,cohort,title:lesson.title,audience:'RECORDING',published:false});
  if(!existingSubject)step('publish-subject-shell','/api/websites/'+websiteId+'/edit',{action:'publish',revision:0});
  step('save-companion',admin,{action:'companion-save',attachmentId,revision:0,sourceRevision:item.sourceRevision,durationSeconds:item.durationSeconds,companion:draft});
  step('publish-companion',admin,{action:'companion-publish',attachmentId,revision:1,sourceRevision:item.sourceRevision,draftKey:companionKey});
  step('publish-recording',admin,{action:'recording-publication',attachmentId,assetId,websiteId,lessonId,lessonDate:item.recordedDate,cohort,sourceRevision:item.sourceRevision,companionKey});
  if(!existingSubject)step('connect-subject-card',admin,{action:'mou-subject',createOnly:true,websiteId,displayKey:subject.key,enabled:true});
  items.push({videoId,title:lesson.title,recordedDate:item.recordedDate,durationSeconds:item.durationSeconds,editorialLessonId:item.editorialLessonId,subject:subject.key,websiteId,assetId,attachmentId,lessonId,cohort,sourceRevision:item.sourceRevision,learnerSha256:hash(companion)});
 }
 return {schema:'NATIVE_MOU_GUARDED_REQUESTS_V1',execution:'CURRENT_AUTHORISED_NATIVE_ADMIN_ONLY_AFTER_COMBINED_V109_2_INTEGRATION',preflightSha256:hash(preflight),preflight,items,requests,academic:manifest.items.filter(i=>i.owner==='ACADEMY').map(({editorialLessonId,nativeActivityKey,mappingStatus})=>({editorialLessonId,nativeActivityKey,mappingStatus})),hostedExecuted:false,processingOrReprocessing:false};
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 if(process.argv.length!==5)throw Error('Use: node tools/native-mou-attachment-package.mjs PROJECT_ROOT FRESH_NATIVE_PREFLIGHT_JSON OUTPUT_JSON');
 const {manifest,lessons}=await prepareAttachments(resolve(process.argv[2]),resolve('local-content/recording-attachments'));
 const preflight=JSON.parse(await readFile(resolve(process.argv[3]),'utf8')),plan=buildNativeMouPackage({preflight,manifest,lessons});await writeFile(resolve(process.argv[4]),JSON.stringify(plan,null,2));console.log(JSON.stringify({requests:plan.requests.length,hostedExecuted:false,output:resolve(process.argv[4])}));
}
