import {learnerCompanion,seconds} from '../../public/shared/learner-companion.mjs';
const invalid=()=>{throw new Error('GENERATION_OUTPUT_INVALID');};
function exact(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(k=>!keys.includes(k)))invalid();}
function text(value,max){if(typeof value!=='string'||value.length>max||/[\uD800-\uDFFF]/u.test(value)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)||/<\/?[A-Za-z][^>]*>/.test(value))invalid();return value;}
function array(value,max){if(!Array.isArray(value)||value.length>max)invalid();return value;}
function cue(index,transcript,optional=false){if(optional&&index===null)return null;if(!Number.isInteger(index)||index<0||index>=transcript.cues.length)invalid();return transcript.cues[index];}
function at(value,duration){if(typeof value!=='string'||!/^\d{1,3}:[0-5]\d(?::[0-5]\d)?$/.test(value)||seconds(value)>=duration)invalid();return value;}
function anchored(row,transcript){const c=cue(row.sourceCueIndex,transcript);at(row.time,transcript.durationSeconds);if(seconds(row.time)!==Math.floor(c.startMs/1000))invalid();}
export function privateGeneratedCandidate(value,{style,transcript}){
 if(!['ACADEMIC','MOU'].includes(style)||!transcript?.cues?.length)invalid();
 exact(value,['summary','lessonReference','application','taskAssigned','topics','topicNotes','referenceCandidates','quotationCandidates','assignmentEvidence','reviewNotes']);
 text(value.summary,20000);text(value.lessonReference,2000);text(value.application,20000);if(typeof value.taskAssigned!=='boolean')invalid();
 let last=-1;
 for(const row of array(value.topics,100)){exact(row,['time','title','sourceCueIndex']);text(row.title,500);anchored(row,transcript);if(seconds(row.time)<last)invalid();last=seconds(row.time);}
 last=-1;
 for(const row of array(value.topicNotes,100)){exact(row,['time','title','chapter','reflection','practice','sourceCueIndex']);text(row.title,500);text(row.chapter,2000);text(row.reflection,20000);text(row.practice,20000);anchored(row,transcript);if(seconds(row.time)<last)invalid();last=seconds(row.time);}
 if(style==='ACADEMIC'&&value.topicNotes.length)invalid();
 const assignments=array(value.assignmentEvidence,20).map(row=>{exact(row,['sourceCueIndex','evidence']);text(row.evidence,2000);const c=cue(row.sourceCueIndex,transcript);if(!row.evidence||!c.text.includes(row.evidence))invalid();return {...row,transcriptMatched:true};});
 if(value.taskAssigned&&assignments.length===0||style==='ACADEMIC'&&!value.taskAssigned&&value.application)invalid();
 const references=array(value.referenceCandidates,100).map(row=>{exact(row,['time','arabic','meaning','sourceCueIndex','evidence']);at(row.time,transcript.durationSeconds);text(row.arabic,4000);text(row.meaning,4000);text(row.evidence,2000);const c=cue(row.sourceCueIndex,transcript,true);return {...row,transcriptMatched:Boolean(c&&row.evidence&&c.text.includes(row.evidence)),verified:false};});
 const quotations=array(value.quotationCandidates,20).map(row=>{exact(row,['time','text','speaker','sourceCueIndex','evidence']);at(row.time,transcript.durationSeconds);text(row.text,2000);text(row.speaker,240);text(row.evidence,2000);const c=cue(row.sourceCueIndex,transcript,true);return {...row,transcriptMatched:Boolean(c&&row.evidence&&c.text.includes(row.evidence)),audioVerified:false};});
 for(const note of array(value.reviewNotes,100))text(note,2000);
 // Do not pass a canonical schema, transcript, references, quotation verification
 // or any model-supplied native ids into the established learner allowlist.
 const learner=learnerCompanion({summary:value.summary,lessonReference:'',application:value.application,taskAssigned:value.taskAssigned,topics:value.topics,topicNotes:value.topicNotes,references:[]},{academic:style==='ACADEMIC'});
 const result={schema:'VIDEO_PROCESSING_PRIVATE_CANDIDATE_V1',style,learnerPreview:learner,reviewRequired:true,privateEvidence:{lessonReferenceCandidate:value.lessonReference,references,quotations,assignments,assignmentReviewRequired:value.taskAssigned,reviewNotes:value.reviewNotes}};
 if(new TextEncoder().encode(JSON.stringify(result)).byteLength>400000)invalid();
 return result;
}
