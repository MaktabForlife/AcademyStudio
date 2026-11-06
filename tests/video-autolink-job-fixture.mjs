import {readFileSync} from 'node:fs';
import {fixture} from './fixture.mjs';import {Store} from '../src/database.mjs';import {sha256} from '../src/protocol.mjs';
import {nativeProcessingSource} from '../src/video-autolink/native-source.mjs';
import {processingQuote,authoriseProcessingJob} from '../src/video-autolink/jobs.mjs';
const raw='WEBVTT\n\n00:00.000 --> 00:02.000\nSynthetic evidence: read the assigned page.\n\n00:02.000 --> 00:04.000\nA source-grounded second point.';
const generated=()=>({summary:'- A synthetic point.',lessonReference:'PRIVATE uncertain book',application:'',taskAssigned:false,topics:[{time:'00:00',title:'Synthetic topic',sourceCueIndex:0}],topicNotes:[],referenceCandidates:[],quotationCandidates:[],assignmentEvidence:[],reviewNotes:['PRIVATE review marker']});
const response=()=>Response.json({id:'resp_synthetic',status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(generated())}]}],usage:{input_tokens:100,output_tokens:50,total_tokens:150}},{headers:{'x-request-id':'req_synthetic'}});
async function setup(){
 const f=await fixture();
 await f.run("INSERT INTO objects VALUES('processing-asset',NULL,'video/youtube','Synthetic recording',0,NULL,'abcdefghijk')");
 await f.run("INSERT INTO asset_owners VALUES('processing-asset','course')");
 await f.run("INSERT INTO attachments VALUES('processing-attachment','course','site-course','processing-asset','processing-lesson','2026-11-06','','Synthetic recording','RECORDING',0)");
 await f.run("INSERT INTO media_attributions VALUES('processing-attachment',1,?,NULL)",JSON.stringify({teacherIds:['teacher'],recordingTitle:'Synthetic recording'}));
 let statement='';for(const part of readFileSync(new URL('./fixtures/video-autolink-proposed.sql',import.meta.url),'utf8').replace(/--[^\n]*/g,'').split(';')){statement+=part+';';if(/CREATE TRIGGER/i.test(statement)&&!/\sEND;\s*$/.test(statement))continue;if(statement.trim()!==';')await f.db.prepare(statement).run();statement='';}
 const login=await f.login('admin'),hash=await sha256(login.cookie.split('=')[1]);await f.run('UPDATE sessions SET source_ref=? WHERE token_hash=?','synthetic-native-source-session',hash);
 await f.run("INSERT INTO source_access_scopes(offering_id,generation,version,enabled,live_enabled,timezone,classes_json,authority) VALUES('course',1,1,1,0,'UTC','[]','WEBSITE')");
 await f.run("INSERT INTO access_handovers(offering_id,transfer_id,phase,generation,source_version,revision,cursor,checked,created_at) VALUES('course','synthetic-transfer','COMMITTED',1,1,0,'',0,?)",Date.now());
 await f.run("INSERT INTO source_access_people VALUES('admin','course',1,1,?,1,'[]',0,1)",Date.now());
 const env={...f.env,AUTHORITY_MODE:'ACADEMY',DB:f.db,CONTENT:f.content,MEDIA:f.media,VIDEO_AUTOLINK_ENABLED:'1',OPENAI_API_KEY:'synthetic-key-NOT-REAL',VIDEO_AI_MODEL:'synthetic-reviewed-model',VIDEO_AI_AUTHORISATION_PROFILE:'synthetic-reviewed-profile',VIDEO_AI_MAX_OUTPUT_TOKENS:'2000',VIDEO_AI_MAX_REQUEST_BYTES:'64000',VIDEO_AI_TIMEOUT_MS:'5000',VIDEO_PROCESSING_PRIVATE:f.content,VIDEO_AI_PRIVATE_REVIEW_TTL_HOURS:'1',VIDEO_AI_CLEANUP_ENABLED:'1'};
 const store=()=>new Store(env),actor=await store().actor(hash),native=await nativeProcessingSource(env,store(),actor,'course',{attachmentId:'processing-attachment'}),transcriptHash=await sha256(raw),transcriptKey='video-processing-private/sources/synthetic-source/transcript-'+transcriptHash+'.vtt',privateExpiresAt=Date.now()+3600000;
 await f.content.put(transcriptKey,raw);await f.run("INSERT INTO video_processing_sources VALUES('synthetic-source','course','processing-attachment','processing-asset',?,?,?,?,4,'PERMANENT_STUDIO_RETAINED',NULL,?,?)",native.sourceRevision,transcriptKey,transcriptHash,'VTT',privateExpiresAt,Date.now());
 const q=await processingQuote(env,store(),actor,'synthetic-source');
 const authorise=async()=>{const operationId=crypto.randomUUID(),input={operationId,sourceId:'synthetic-source',quoteHash:q.quoteHash,authorise:true};const result=await authoriseProcessingJob(env,store(),actor,input);return {jobId:result.jobId,input,result};};
 return {...f,env,store,actor,q,authorise,transcriptKey};
}

export {setup,raw,response};
