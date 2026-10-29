import {esc} from './model.mjs';

const date=value=>{const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'':new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',timeZone:'Africa/Johannesburg'}).format(parsed);};
const play='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="6"/><path d="m10 7 7 5-7 5Z"/></svg>';
export function recordingStart(value){const valid=typeof value==='number'||typeof value==='string'&&/^\d+$/.test(value);return valid&&Number.isSafeInteger(Number(value))&&Number(value)>=0&&Number(value)<=86400?Number(value):0;}
export function recordingTopics(items=[]){
 const seen=new Set();return items.flatMap(item=>{const match=typeof item==='string'&&item.match(/^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?\s+(.+)$/);if(!match||!match[4].trim())return [];const start=match[3]===undefined?Number(match[1])*60+Number(match[2]):Number(match[1])*3600+Number(match[2])*60+Number(match[3]);if(start>86400||seen.has(start))return [];seen.add(start);return [{time:match[1]+':'+match[2]+(match[3]===undefined?'':':'+match[3]),start,title:match[4].trim()}];}).sort((a,b)=>a.start-b.start);
}
const playable=row=>row?.attachment_id&&['video/youtube','video/mp4'].includes(row.type);
const watchButton=row=>playable(row)?`<button class="sp-watch-full" data-material="${esc(row.attachment_id)}" data-type="${esc(row.type)}" data-filename="${esc(row.title)}" aria-label="Watch the full video: ${esc(row.title)}">${play}<span>Watch the full video</span><span aria-hidden="true">→</span></button>`:'';
export const companionReadingEntry=()=>'<div class="sp-companion-reading-entry"><button class="sp-reading-along" data-sp="route" data-route="lessons">Read &amp; reflect →</button></div>';
export function recordingMomentLink(row,time){const moment=recordingTopics([time+' Quotation'])[0];return playable(row)&&moment?`<button type="button" class="sp-hear-quotation" data-material="${esc(row.attachment_id)}" data-type="${esc(row.type)}" data-filename="${esc(row.title)}" data-recording-start="${moment.start}">Hear this in the recording</button>`:'';}
export function recordingTopicGuide(row,topics=[]){if(!playable(row)||!topics.length)return '';return `<details class="sp-recording-topics"><summary>Follow the recording by topic</summary><ol>${topics.map(topic=>`<li><button type="button" data-material="${esc(row.attachment_id)}" data-type="${esc(row.type)}" data-filename="${esc(row.title)}" data-recording-start="${recordingStart(topic.start)}"><span class="sp-topic-time">${esc(topic.time)}</span><span>${esc(topic.title)}</span></button></li>`).join('')}</ol></details>`;}

export function recordingReadingIntro(row,guide){
 if(!playable(row)||guide?.status!=='reviewed'||!guide.summary?.trim())return '';
 return `<section class="sp-recorded-lesson sp-reading-recording" aria-label="Watch and follow along"><span class="sp-eyebrow">WATCH &amp; FOLLOW ALONG</span><h2>${esc(guide.title||row.title)}</h2><p class="sp-recorded-summary">${esc(guide.summary)}</p>${watchButton(row)}${recordingTopicGuide(row,guide.topics)}</section>`;
}

// Rearrange only the normal reader DOM. Both editors retain the original saved
// sections, block IDs, wording and shared Save/Publish process.
export function arrangeRecordingReading({root,guides=[],media=[]}){
 const body=root.querySelector('.sp-reading-body'),shown=new Set();if(!body)return shown;
 const doc=root.ownerDocument,managed=new Set(),quotes=[],introductions=[];
 for(const guide of guides){
  const row=media.find(row=>row.lesson_id===guide.lessonId&&playable(row)),intro=[...body.querySelectorAll('[data-recording-intro]')].find(node=>node.dataset.recordingIntro===guide.lessonId),html=recordingReadingIntro(row,guide);
  if(intro&&html){managed.add(intro.closest('.sp-reading-section'));const holder=doc.createElement('div');holder.innerHTML=html;introductions.push(holder.firstElementChild);intro.remove();shown.add(row.attachment_id);
   for(const list of body.querySelectorAll('[data-recording-topics]'))if(list.dataset.recordingTopics===guide.lessonId){managed.add(list.closest('.sp-reading-section'));list.remove();}
  }
  for(const quote of body.querySelectorAll('[data-recording-quote]'))if(quote.dataset.recordingQuote===guide.lessonId){managed.add(quote.closest('.sp-reading-section'));quotes.push(quote);}
 }
 let closing=[...body.querySelectorAll('.sp-reading-section')].find(section=>[...section.children].some(node=>node.tagName==='H2'&&node.textContent.trim().toLowerCase()==='carry the lesson into daily life'));
 if(quotes.length||closing){
  if(!closing){closing=doc.createElement('aside');closing.className='sp-reading-section sp-recording-closing';const heading=doc.createElement('h2');heading.textContent='Carry the lesson into daily life';closing.append(heading);}else closing.classList.add('sp-recording-closing');
  if(quotes.length){const words=doc.createElement('section'),heading=doc.createElement('h3');words.className='sp-carry-quote';heading.textContent='Words to carry';words.append(heading,...quotes);closing.append(words);}
  body.append(closing);
 }
 for(const section of managed)if(section&&section!==closing&&!section.querySelector('.sp-block'))section.remove();
 body.prepend(...introductions);return shown;
}

// Transcript summaries are ordinary editable source-note asides. The source key
// identifies the recorded lesson; it never contains or grants a playback URL.
export function recordingGuides(document){return (document?.lessons||[]).flatMap(reading=>reading.sections.flatMap(section=>section.blocks.filter(block=>block.type==='note'&&block.aside&&block.sourceKey?.startsWith('recording:')).map(block=>{
 const lessonId=block.sourceKey.slice('recording:'.length),quote=section.blocks.find(row=>row.type==='quote'&&!row.reference&&row.sourceKey==='recording-quote:'+lessonId),topicBlock=section.blocks.find(row=>row.type==='list'&&row.sourceKey==='recording-topics:'+lessonId);
 return {lessonId,readingId:reading.id,title:block.attribution,summary:block.text,status:'reviewed',...(quote?{quote:{text:quote.text,attribution:quote.attribution,timestamp:quote.caption||''}}:{}),...(topicBlock?{topics:recordingTopics(topicBlock.items)}:{})};
})));}

// Input is the existing permission-filtered media response, never raw YouTube URLs.
// A summary is shown only when its transcript has been reviewed. Missing text is
// never replaced with a summary inferred from a date, title or PDF passage.
export function recordingOverview({media=[],guides=[],more=false}={}){
 const seen=new Set(),videos=media.filter(row=>['video/youtube','video/mp4'].includes(row.type)&&row.attachment_id).sort((a,b)=>String(a.lesson_date||'').localeCompare(String(b.lesson_date||''))||String(a.attachment_id).localeCompare(String(b.attachment_id))).filter(row=>{const key=row.asset_id||row.attachment_id;if(seen.has(key))return false;seen.add(key);return true;});
 if(!videos.length)return '';
 return `<section class="sp-recording-overview" aria-labelledby="sp-recording-overview-title"><header><h2 id="sp-recording-overview-title">WATCH · LISTEN · <em>FOLLOW ALONG</em></h2></header><div class="sp-recorded-lessons">${videos.map((row,index)=>{
  const guide=guides.find(guide=>guide.lessonId===row.lesson_id&&guide.status==='reviewed'),summary=typeof guide?.summary==='string'?guide.summary.trim():'';
  return `<article class="sp-recorded-lesson"><div class="sp-recorded-meta"><span>LESSON ${String(index+1).padStart(2,'0')}</span><time datetime="${esc(row.lesson_date)}">${esc(date(row.lesson_date))}</time></div><h3>${esc(guide?.title||row.title||'Recorded lesson')}</h3>${summary?`<p class="sp-recorded-summary">${esc(summary)}</p>`:''}${guide?.quote?.text?`<blockquote class="sp-block sp-quote sp-recorded-quote"><p>${esc(guide.quote.text)}</p>${recordingMomentLink(row,guide.quote.timestamp)}</blockquote>`:''}<button class="sp-watch-full" data-material="${esc(row.attachment_id)}" data-type="${esc(row.type)}" data-filename="${esc(row.title)}" aria-label="Watch the full video: ${esc(row.title)}">${play}<span>Watch the full video</span><span aria-hidden="true">→</span></button>${guide?.readingId?`<button class="sp-read-recording-notes" data-sp="lesson" data-id="${esc(guide.readingId)}">Read alongside this lesson →</button>`:''}${recordingTopicGuide(row,guide?.topics)}</article>`;
 }).join('')}</div>${more?'<button class="sp-recordings-more" data-more-media>Show more recorded lessons</button>':''}</section>`;
}

export function companionPlayer({workspace,panel}){
 let returnFocus=null;
 function close({focus=false}={}){for(const video of panel.querySelectorAll('video'))video.pause();panel.replaceChildren();panel.hidden=true;workspace.classList.remove('is-listening');if(focus&&returnFocus?.isConnected)returnFocus.focus();returnFocus=null;}
 function open(element,title){
  close();returnFocus=document.activeElement;const heading=document.createElement('h2'),header=document.createElement('header'),eyebrow=document.createElement('span'),button=document.createElement('button'),body=document.createElement('div'),footer=document.createElement('div'),reading=document.createElement('button'),hint=document.createElement('p');
  eyebrow.className='sp-eyebrow';eyebrow.textContent='LESSON RECORDING';heading.id='companion-player-title';heading.textContent=title||'Recorded lesson';button.type='button';button.textContent='×';button.setAttribute('aria-label','Close recording player');button.onclick=()=>close({focus:true});
  header.append(eyebrow,button,heading);body.className='sp-companion-player-media';body.append(element);hint.textContent='Keep listening as you move between the companion readings.';reading.textContent='Read alongside →';reading.dataset.sp='route';reading.dataset.route='lessons';footer.append(hint,reading);panel.append(header,body,footer);panel.setAttribute('aria-labelledby',heading.id);panel.hidden=false;workspace.classList.add('is-listening');button.focus({preventScroll:true});
 }
 return {open,close};
}
