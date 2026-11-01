import {esc} from './model.mjs';
const dateLabel=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'Africa/Johannesburg'}).format(date);};
const clock=value=>new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Johannesburg'}).format(new Date(value));
export const joinIsOpen=(session,now)=>!session.cancelled&&now>=session.starts_at-300_000&&now<session.ends_at;
export function mediaButton(row,{download=false}={}){const video=row.type.startsWith('video/');
 if(!video&&!download)return '<button class="sp-notes" data-sp="route" data-route="materials">Course materials →</button>';
 return `<button class="${video?'sp-recording':'sp-notes'}" data-material="${esc(row.attachment_id)}" data-type="${esc(row.type)}" data-filename="${esc(row.title||'Course material')}">${video?'▷ ':'↓ '}${esc(row.title|| (video?'Recording':'Download PDF'))}</button>`;
}
// Only stable lesson/session IDs associate media with cards; titles and dates
// are display values, never access or matching keys.
export function combinedSessionCards({sessions=[],media=[],now=Date.now()}){
 const groups=new Map(sessions.map(session=>[session.session_id,{session,media:[]} ]));
 for(const row of media){if(!groups.has(row.lesson_id))groups.set(row.lesson_id,{session:null,media:[]});groups.get(row.lesson_id).media.push(row);}
 return `<div class="sp-session-grid rs-session-list">${[...groups.values()].sort((a,b)=>new Date(a.session?.starts_at||a.media[0]?.lesson_date||0)-new Date(b.session?.starts_at||b.media[0]?.lesson_date||0)).map(({session,media:files})=>{
  const finished=session&&now>=session.ends_at,live=session&&joinIsOpen(session,now),date=session?.starts_at||files[0]?.lesson_date,summary=session?.summary||session?.description,teacher=session?.teacherName||session?.teacher_name;
  return `<article class="sp-session rs-episode-card"><div class="rs-card-main"><div class="rs-card-meta"><span>${session?.cancelled?'CANCELLED':live?'LIVE NOW':finished?'PAST SESSION':session?'UPCOMING SESSION':'RECORDING'}</span><time>${esc(dateLabel(date))}</time>${session&&!finished?'<span>'+clock(session.starts_at)+'–'+clock(session.ends_at)+' · SAST</span>':''}</div><h3>${esc(session?.title||files[0]?.title||'Lesson')}</h3>${teacher?'<p class="rs-reference">Teacher: '+esc(teacher)+'</p>':''}${summary?'<p class="rs-card-summary">'+esc(summary)+'</p>':''}<div class="rs-card-actions">${session?.cancelled?'<span class="sp-status">Cancelled</span>':live?`<button class="sp-primary" data-join="${esc(session.session_id)}">Join now ↗</button>`:session?`<span class="sp-status">${finished?'Session ended':'Joining opens five minutes before the lesson.'}</span>`:''}</div>${files.length?'<div class="sp-lesson-media">'+files.map(mediaButton).join('')+'</div>':finished?'<p class="sp-status">The recording will appear when published and available to your account.</p>':''}</div></article>`;
 }).join('')}</div>`;
}
