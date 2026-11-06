import {fail,json,bodyJSON} from '../protocol.mjs';
import {sourceActions,sourceCommand,videoTransportEnabled,VIDEO_ENVELOPE_BYTES,VIDEO_RESPONSE_BYTES} from './source-commands.mjs';
import {processingCommand,processingAvailable} from './commands.mjs';
const codes=new Set(['PROCESSOR_DISABLED','PROCESSOR_UNCONFIGURED','VIDEO_UPLOAD_UNCONFIGURED','VIDEO_PART_INVALID','PROCESSING_COMMAND_INVALID','PROCESSING_INPUT_TOO_LARGE','PROCESSING_SOURCE_UNAVAILABLE','PROCESSING_SOURCE_CHANGED','PROCESSING_SOURCE_REQUIRED','PROCESSING_DESTINATION_REQUIRED','PROCESSING_QUOTE_CHANGED','PROCESSING_AUTHORISATION_EXPIRED','EXPLICIT_PROCESSING_AUTHORISATION_REQUIRED','PRIVATE_CANDIDATE_UNAVAILABLE','PRIVATE_CANDIDATE_EXPIRED','EXPLICIT_CANDIDATE_REVIEW_REQUIRED','PROCESSING_CANDIDATE_STALE','REVIEWED_COMPANION_INVALID','REVIEWED_COMPANION_TOO_LARGE','CONFIRM_LESSON_REFERENCE','CONFIRM_ASSIGNED_HOMEWORK','CONFIRM_REFERENCES','CONFIRM_AUDIO_QUOTATIONS','CHANGE_CONFLICT','RETRY_CONFLICT','SIGN_IN_REQUIRED','ADMIN_STATUS_EXPIRED','ACCESS_REFRESH_REQUIRED','SOURCE_SCOPE_UNAVAILABLE','HANDOVER_REQUIRED','TRANSCRIPT_INVALID','PROCESSING_JOB_UNAVAILABLE','PROCESSING_OFFERING_MISMATCH','EXPLICIT_PROCESSING_CANCEL_REQUIRED','ACCEPTED_NATIVE_DRAFT_PRESERVED','EXPLICIT_PUBLICATION_REQUIRED','ORIGIN_REQUIRED','METHOD_NOT_ALLOWED']);
export function videoPublicError(error){
 const known=codes.has(error?.code),status=known&&[400,401,403,404,405,409,413,429,503].includes(error?.status)?error.status:503;
 const message=status===401?'Refresh your Academy sign-in before continuing.':status===403?'Current scoped Admin authority is required.':status===404?'Video processing is not enabled.':status===405?'Use POST for video processing.':status===413?'This upload exceeds the checked size limit.':status===409?'Reopen the current recording and review this pending action.':'Video processing is temporarily unavailable.';
 const result=fail(message,status,known?error.code:'PROCESSING_UNAVAILABLE');
 if(Array.isArray(error?.acknowledge))result.acknowledge=error.acknowledge.filter(x=>typeof x==='string'&&/^[-A-Za-z0-9_:]{1,180}$/.test(x)).slice(0,40);
 return result;
}
export async function videoCommand(env,store,actor,offer,command,fetcher){
 try{
  if(!videoTransportEnabled(env))throw fail('Disabled.',404,'PROCESSOR_DISABLED');
  if(sourceActions.has(command?.action)){
   const result=await sourceCommand(env,store,actor,offer,command,fetcher);
   return command.action==='video-source-capabilities'?{...result,processingAvailable:processingAvailable(env)}:result;
  }
  return await processingCommand(env,store,actor,offer,command);
 }catch(error){throw videoPublicError(error);}
}
export async function nativeVideoHTTP(request,env,store,actor,offer,fetcher){
 try{
  if(!videoTransportEnabled(env))throw fail('Disabled.',404,'PROCESSOR_DISABLED');
  if(request.method!=='POST')throw fail('Use POST.',405,'METHOD_NOT_ALLOWED');
  const result=await videoCommand(env,store,actor,offer,await bodyJSON(request.body,VIDEO_ENVELOPE_BYTES),fetcher);
  const payload=JSON.stringify(result);if(new TextEncoder().encode(payload).length>VIDEO_RESPONSE_BYTES)throw fail('Private review response is too large.',503,'PROCESSING_UNAVAILABLE');
  return json(result);
 }catch(error){const e=videoPublicError(error);return json({success:false,error:e.message,code:e.code},e.status);}
}
