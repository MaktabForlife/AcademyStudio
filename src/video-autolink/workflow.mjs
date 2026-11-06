import {WorkflowEntrypoint} from 'cloudflare:workers';
import {runProcessingJob} from './jobs.mjs';
// Unmounted class. No current Worker export/binding/config activates it.
// Durable event parameters contain only an opaque owning-job identity.
export class VideoProcessingWorkflow extends WorkflowEntrypoint {
 async run(event,step){
  const payload=event?.payload;
  if(!payload||Object.keys(payload).length!==1||typeof payload.jobId!=='string'||!/^[-A-Za-z0-9_:]{1,180}$/.test(payload.jobId))return {state:'REVIEW_REQUIRED',code:'PROCESSING_CONTEXT_CHANGED'};
  // Both platform step retries AND provider HTTP/SDK retries must be disabled.
  // The owning DB claim additionally prevents a resumed execution from spending
  // again after a successful/lost claim ACK. A step crash is not zero work.
  return step.do('manually-authorised-private-processing',{retries:{limit:0,delay:'1 second',backoff:'constant'},timeout:'60 seconds'},async()=>{
   try{return await runProcessingJob(this.env,payload.jobId);}
   catch{return {jobId:payload.jobId,state:'REVIEW_REQUIRED',code:'PROCESSING_CONTEXT_CHANGED'};}
  });
 }
}
