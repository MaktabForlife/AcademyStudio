// Deliberate publication boundary. Never spread a private processing draft here.
const text=(v,max=20000)=>typeof v==='string'?v.slice(0,max):'';
const time=v=>typeof v==='string'&&/^\d{1,3}:[0-5]\d(?::[0-5]\d)?$/.test(v)?v:'';
export const seconds=value=>{const p=time(value).split(':').map(Number);return p.length===3?p[0]*3600+p[1]*60+p[2]:p.length===2?p[0]*60+p[1]:0;};
export function learnerCompanion(draft,{academic=false}={}){
 const d=draft||{},quote=d.quote,canonical=d.schema==='LEARNER_COMPANION_V1';
 return {schema:'LEARNER_COMPANION_V1',summary:text(d.summary),summaryFormat:academic||canonical&&d.summaryFormat==='bullets'?'bullets':'paragraph',lessonReference:text(d.lessonReference,2000),application:text(d.application),assignmentLabel:text(d.assignmentLabel||(d.taskAssigned||d.taskTime?'Task':academic?'Homework':'Practice'),80),
 topics:(Array.isArray(d.topics)?d.topics:[]).slice(0,100).map(t=>({time:time(t.time),start:seconds(t.time),title:text(t.title,500)})).filter(t=>t.time&&t.title),
 topicNotes:academic?[]:(Array.isArray(d.topicNotes)?d.topicNotes:[]).slice(0,100).map(t=>({time:time(t.time),title:text(t.title,500),chapter:text(t.chapter,2000),reflection:text(t.reflection),practice:text(t.practice)})),
 references:(Array.isArray(d.references)?d.references:[]).filter(r=>r.enabled!==false&&(canonical||r.status==='source-matched'||r.verification==='matched')).slice(0,100).map(r=>({arabic:text(r.arabic,4000),meaning:text(r.meaning,4000),time:time(r.time)})),
 quotations:canonical?(Array.isArray(d.quotations)?d.quotations:[]).slice(0,academic?1:8).map(q=>({text:text(q.text,2000),speaker:text(q.speaker,240),time:time(q.time)})).filter(q=>q.text&&q.time):quote?.verified===true&&quote.text?[{text:text(quote.text,2000),speaker:text(quote.speaker,240),time:time(quote.time)}]:[],
 ...(academic&&typeof d.transcript==='string'?{transcript:text(d.transcript,250000)}:{})};
}
export function publicationIndex(companion){return {summary:companion.summary,summaryFormat:companion.summaryFormat,lessonReference:companion.lessonReference};}
// Calendar month, clamped at month end. The original successful upload is immutable.
export function recordingRetention(uploadedAt,{permanent=false,now=Date.now()}={}){
 if(permanent)return {recordingExpiresAt:null,companionExpiresAt:null,recordingExpired:false,companionExpired:false};
 const start=Date.parse(uploadedAt);if(!Number.isFinite(start))throw Error('Confirm the original successful upload time before attaching temporary media.');
 const end=new Date(start),day=end.getUTCDate();end.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+1);const last=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();end.setUTCDate(Math.min(day,last));
 return {recordingExpiresAt:new Date(start+14*86400000).toISOString(),companionExpiresAt:end.toISOString(),recordingExpired:now>=start+14*86400000,companionExpired:now>=end.getTime()};
}
