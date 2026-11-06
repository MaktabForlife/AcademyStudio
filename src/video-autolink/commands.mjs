import {fail,id} from '../protocol.mjs';
import {mediaAdmin} from '../media-attribution.mjs';
import {nativeProcessingSource} from './native-source.mjs';
import {processingQuote,authoriseProcessingJob,processingStatus} from './jobs.mjs';
import {saveProcessingSource,readProcessingCandidate,acceptProcessingCandidate} from './review.mjs';
const shapes={
 'video-processing-capabilities':['action'],
 'video-processing-source':['action','operationId','attachmentId','format','durationSeconds','transcript'],
 'video-processing-quote':['action','sourceId'],
 'video-processing-authorise':['action','operationId','sourceId','quoteHash','authorise'],
 'video-processing-status':['action','jobId'],
 'video-processing-candidate':['action','jobId'],
 'video-processing-accept':['action','operationId','jobId','candidateHash','revision','reviewed','companion','confirmLessonReference','confirmAssignedHomework','confirmReferences','confirmAudioQuotations'],
 'video-processing-cancel':['action','operationId','jobId','cancel']
};
const whole=(value,min,max)=>typeof value==='string'&&/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max;
export function processingAvailable(env){
 return env.VIDEO_AUTOLINK_ENABLED==='1'&&typeof env.OPENAI_API_KEY==='string'&&Boolean(env.OPENAI_API_KEY)&&/^[-A-Za-z0-9_.]{1,120}$/.test(env.VIDEO_AI_MODEL||'')&&/^[-A-Za-z0-9_.]{1,120}$/.test(env.VIDEO_AI_AUTHORISATION_PROFILE||'')&&whole(env.VIDEO_AI_MAX_OUTPUT_TOKENS,1,32000)&&whole(env.VIDEO_AI_MAX_REQUEST_BYTES,1000,1000000)&&whole(env.VIDEO_AI_TIMEOUT_MS,1,50000)&&whole(env.VIDEO_AI_PRIVATE_REVIEW_TTL_HOURS,1,720)&&whole(env.VIDEO_AI_WORKFLOW_RETENTION_HOURS,1,72)&&Boolean(env.VIDEO_PROCESSING_PRIVATE)&&typeof env.VIDEO_PROCESSING_WORKFLOW?.create==='function';
}
const publicCodes=new Set(['PROCESSOR_DISABLED','PROCESSOR_UNCONFIGURED','PRIVATE_REVIEW_RETENTION_UNCONFIGURED','PROCESSING_COMMAND_INVALID','PROCESSING_INPUT_TOO_LARGE','PROCESSING_SOURCE_UNAVAILABLE','PROCESSING_SOURCE_CHANGED','PROCESSING_SOURCE_REQUIRED','PROCESSING_DESTINATION_REQUIRED','PROCESSING_QUOTE_CHANGED','PROCESSING_AUTHORISATION_EXPIRED','EXPLICIT_PROCESSING_AUTHORISATION_REQUIRED','PRIVATE_CANDIDATE_UNAVAILABLE','PRIVATE_CANDIDATE_EXPIRED','EXPLICIT_CANDIDATE_REVIEW_REQUIRED','PROCESSING_CANDIDATE_STALE','REVIEWED_COMPANION_INVALID','REVIEWED_COMPANION_TOO_LARGE','CONFIRM_LESSON_REFERENCE','CONFIRM_ASSIGNED_HOMEWORK','CONFIRM_REFERENCES','CONFIRM_AUDIO_QUOTATIONS','CHANGE_CONFLICT','RETRY_CONFLICT','SIGN_IN_REQUIRED','ADMIN_STATUS_EXPIRED','ACCESS_REFRESH_REQUIRED','SOURCE_SCOPE_UNAVAILABLE','HANDOVER_REQUIRED','TRANSCRIPT_INVALID','PROCESSING_JOB_UNAVAILABLE','PROCESSING_OFFERING_MISMATCH','EXPLICIT_PROCESSING_CANCEL_REQUIRED','ACCEPTED_NATIVE_DRAFT_PRESERVED']);
function safeError(error){
 const code=publicCodes.has(error?.code)?error.code:'PROCESSING_UNAVAILABLE',status=publicCodes.has(error?.code)&&[400,401,403,404,409,413,429,503].includes(error?.status)?error.status:503;
 const message=status===401?'Refresh your Academy sign-in before continuing.':status===403?'Your account cannot process this recording.':status===413?'Choose a smaller timestamped transcript.':status===409?'Reopen the current recording and processing request.':'Video processing is temporarily unavailable.';
 return fail(message,status,code);
}
async function sameOffering(store,offer,command){
 let row;
 if(command.sourceId!==undefined)row=await store.first('SELECT offering_id FROM video_processing_sources WHERE source_id=?',[id(command.sourceId)]);
 else if(command.jobId!==undefined)row=await store.first('SELECT offering_id FROM video_processing_jobs WHERE job_id=?',[id(command.jobId)]);
 if((command.sourceId!==undefined||command.jobId!==undefined)&&row?.offering_id!==offer)throw fail('Choose this Course’s processing request.',403,'PROCESSING_OFFERING_MISMATCH');
}
async function dispatch(env,store,result){
 const job=await store.first('SELECT state,authorisation_expires_at FROM video_processing_jobs WHERE job_id=?',[result.jobId]);
 if(!job||job.state!=='QUEUED')return {...result,state:job?.state||result.state,dispatch:'NOT_NEEDED'};
 if(job.authorisation_expires_at<=Date.now())return {...result,dispatch:'EXPIRED',reviewRequired:true};
 try{
  const duration=Number(env.VIDEO_AI_WORKFLOW_RETENTION_HOURS)+' hours';
  await env.VIDEO_PROCESSING_WORKFLOW.create({id:result.jobId,params:{jobId:result.jobId},retention:{successRetention:duration,errorRetention:duration}});
  return {...result,dispatch:'QUEUED'};
 }catch{
  // A lost creation ACK is unknown. Return the existing job identity; never
  // make a new authorisation or expose SDK error text into JSON/history.
  return {...result,dispatch:'UNCONFIRMED',reviewRequired:true};
 }
}
async function cancel(env,store,actor,offer,command){
 if(command.cancel!==true)throw fail('Confirm cancellation of this processing request.',409,'EXPLICIT_PROCESSING_CANCEL_REQUIRED');
 const job=await store.first('SELECT * FROM video_processing_jobs WHERE job_id=?',[id(command.jobId)]);if(!job)throw fail('This request is unavailable.',404,'PROCESSING_JOB_UNAVAILABLE');
 if(job.state==='ACCEPTED')throw fail('Use the current native editor for accepted content.',409,'ACCEPTED_NATIVE_DRAFT_PRESERVED');
 const source=await store.first('SELECT attachment_id FROM video_processing_sources WHERE source_id=?',[job.source_id]),native=await nativeProcessingSource(env,store,actor,offer,{attachmentId:source?.attachment_id});
 const canonical={action:'video-processing-cancel',operationId:id(command.operationId),jobId:job.job_id,cancel:true};
 return store.mutate(actor,offer,canonical,[store.statement("UPDATE video_processing_jobs SET state='CANCELLED',outcome_code='PROCESSING_CANCELLED' WHERE job_id=?",[job.job_id])],{jobId:job.job_id,state:'CANCELLED'},{studio:true,...native.fence,
 expectedSQL:native.fence.expectedSQL+" AND EXISTS(SELECT 1 FROM video_processing_jobs WHERE job_id=? AND state<>'ACCEPTED')",expectedArgs:[...native.fence.expectedArgs,job.job_id]});
}
// Proposed shared handler for existing native-cookie and signed owning proxy
// entries. Neither entry currently imports/mounts it. Call only after the
// existing request signature/session/CSRF/host gates; no actor comes from JSON.
export async function processingCommand(env,store,actor,offer,command){
 try{
  if(!processingAvailable(env)){if(command?.action==='video-processing-capabilities')return {available:false};throw fail('Video processing is not enabled.',404,'PROCESSOR_DISABLED');}
  const keys=shapes[command?.action];if(!keys||!command||typeof command!=='object'||Array.isArray(command)||Object.keys(command).some(k=>!keys.includes(k)))throw fail('Choose a supported processing command.',400,'PROCESSING_COMMAND_INVALID');
  let size;try{size=new TextEncoder().encode(JSON.stringify(command)).length;}catch{throw fail('Choose a supported processing command.',400,'PROCESSING_COMMAND_INVALID');}
  if(size>200000||command.action==='video-processing-source'&&(typeof command.transcript!=='string'||new TextEncoder().encode(command.transcript).length>128000))throw fail('Keep this transcript within the checked upload limit.',413,'PROCESSING_INPUT_TOO_LARGE');
  offer=id(offer);await mediaAdmin(store,actor,offer);await sameOffering(store,offer,command);
  switch(command.action){
   case 'video-processing-capabilities':return {available:true,transcriptFormats:['VTT','SRT'],maxTranscriptBytes:128000,manualExistingRecordingOnly:true};
   case 'video-processing-source':return await saveProcessingSource(env,store,actor,offer,command);
   case 'video-processing-quote':return await processingQuote(env,store,actor,command.sourceId);
   case 'video-processing-authorise':return await dispatch(env,store,await authoriseProcessingJob(env,store,actor,command));
   case 'video-processing-status':return await processingStatus(env,store,actor,command.jobId);
   case 'video-processing-candidate':return await readProcessingCandidate(env,store,actor,command.jobId);
   case 'video-processing-accept':return await acceptProcessingCandidate(env,store,actor,command);
   case 'video-processing-cancel':return await cancel(env,store,actor,offer,command);
  }
 }catch(error){throw safeError(error);}
}
