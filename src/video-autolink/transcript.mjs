// Offline input foundation for the proposed manual processing service.
// Parsed captions remain untrusted evidence; they never grant access/publication.
const encoder=new TextEncoder(),MAX_BYTES=512*1024,MAX_CUES=20000,MAX_DURATION=86400;
const bad=message=>Object.assign(new Error(message),{code:'TRANSCRIPT_INVALID',status:400});
function sourceText(input){
 let text;
 if(typeof input==='string'){if(/[\uD800-\uDFFF]/u.test(input))throw bad('Use valid Unicode caption text.');text=input;}
 else if(input instanceof Uint8Array){try{text=new TextDecoder('utf-8',{fatal:true}).decode(input);}catch{throw bad('Use a UTF-8 caption file.');}}
 else throw bad('Choose a VTT or SRT transcript.');
 if(encoder.encode(text).byteLength>MAX_BYTES)throw bad('This transcript exceeds the reviewed processing limit.');
 if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text))throw bad('Remove invalid control characters from the transcript.');
 return text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
}
function timecode(value,format){
 const match=value.match(format==='SRT'?/^(?:(\d{1,3}):)?(\d{2}):(\d{2}),(\d{3})$/:/^(?:(\d{1,3}):)?(\d{2}):(\d{2})\.(\d{3})$/);
 if(!match||Number(match[2])>59||Number(match[3])>59)throw bad('Use valid caption timestamps.');
 const ms=((Number(match[1]||0)*60+Number(match[2]))*60+Number(match[3]))*1000+Number(match[4]);
 if(!Number.isSafeInteger(ms)||ms>MAX_DURATION*1000)throw bad('Keep timestamps within the recording limit.');
 return ms;
}
function captionText(lines){
 const raw=lines.join('\n');
 const plain=raw.replace(/<[^>]*>/g,tag=>{
  if(/^<\/?(?:b|i|u|ruby|rt)(?:\s[^<>]*)?>$/.test(tag)||/^<\/?c(?:\.[-\w]+)*>$/.test(tag)||/^<(?:v|lang)(?:\s[^<>]*)?>$/.test(tag)||/^<\/(?:v|lang)>$/.test(tag)||/^<(?:\d{1,3}:)?\d{2}:\d{2}\.\d{3}>$/.test(tag))return '';
  throw bad('Use standard caption markup or plain text.');
 }).replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[a-f\d]+);/gi,entity=>{
  const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '},key=entity.toLowerCase();if(key in named)return named[key];
  const n=key.startsWith('&#x')?parseInt(key.slice(3,-1),16):parseInt(key.slice(2,-1),10);
  if(!Number.isInteger(n)||n<32||n>0x10ffff||n>=0xd800&&n<=0xdfff)throw bad('Use valid caption text entities.');
  return String.fromCodePoint(n);
 }).trim();
 if(!plain||plain.length>8000)throw bad('Each caption must contain bounded text.');
 return plain;
}
export function parseTimestampedTranscript(input,{format,durationSeconds}={}){
 if(!['VTT','SRT'].includes(format)||!Number.isInteger(durationSeconds)||durationSeconds<1||durationSeconds>MAX_DURATION)throw bad('Confirm transcript format and the actual recording duration.');
 let text=sourceText(input);
 if(!text)throw bad('Attach a timestamped transcript first.');
 if(format==='VTT'){
  const lines=text.split('\n');if(!/^WEBVTT(?:[ \t].*)?$/.test(lines[0]))throw bad('Choose a valid WEBVTT transcript.');
  let end=lines.indexOf('');if(end<0)throw bad('Separate the VTT header from its captions.');
  if(lines.slice(0,end).some(line=>line.startsWith('X-TIMESTAMP-MAP')))throw bad('Normalise the transcript clock against the recording before processing.');
  text=lines.slice(end+1).join('\n');
 }
 const cues=[];
 for(const block of text.split(/\n[ \t]*\n+/)){
  const lines=block.split('\n').map(line=>line.trimEnd());if(!lines.some(Boolean))continue;
  if(format==='VTT'&&/^(?:NOTE(?:[ \t]|$)|STYLE$|REGION$)/.test(lines[0]))continue;
  let index=0;if(!lines[0].includes('-->'))index=1;
  const match=lines[index]?.match(/^(\S+)\s+-->\s+(\S+)(?:[ \t]+.*)?$/);
  if(!match)throw bad('Every transcript caption needs start and end timestamps.');
  const startMs=timecode(match[1],format),endMs=timecode(match[2],format);
  if(endMs<=startMs||endMs>durationSeconds*1000||cues.length&&startMs<cues.at(-1).startMs)throw bad('Keep ordered caption times inside the actual recording.');
  const value=captionText(lines.slice(index+1));
  cues.push({startMs,endMs,text:value});if(cues.length>MAX_CUES)throw bad('This transcript exceeds the reviewed caption limit.');
 }
 if(!cues.length)throw bad('Attach a non-empty timestamped transcript.');
 return {format,cues,firstCueMs:cues[0].startMs,lastCueMs:cues.at(-1).endMs,durationSeconds};
}
