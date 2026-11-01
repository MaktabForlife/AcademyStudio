import {esc} from './model.mjs';
const dateLabel=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'Africa/Johannesburg'}).format(date);};
const clock=value=>new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Johannesburg'}).format(new Date(value));
export const joinIsOpen=(session,now)=>!session.cancelled&&now>=session.starts_at-300_000&&now<session.ends_at;
export function mediaButton(row,{download=false}={}){const video=row.type.startsWith('video/');
 if(!video&&!download)return '<button class="sp-notes" data-sp="route" data-route="materials">Course materials →</button>';
 return `<button class="${video?'sp-recording':'sp-notes'}" data-material="${esc(row.attachment_id)}" data-type="${esc(row.type)}" data-filename="${esc(row.title||'Course material')}">${video?'▷ ':'↓ '}${esc(row.title|| (video?'Recording':'Download PDF'))}</button>`;
}
// Live timetable rows are independent of playlist recordings. Publication and
// recording order use the native playlist contract, never a session-ID match.
export function combinedSessionCards({sessions=[],now=Date.now()}){
 return `<div class="sp-session-grid rs-session-list">${[...sessions].sort((a,b)=>a.starts_at-b.starts_at).map(session=>{
  const finished=now>=session.ends_at,live=joinIsOpen(session,now),summary=session.summary||session.description,teacher=session.teacherName||session.teacher_name;
  return `<article class="sp-session rs-episode-card"><div class="rs-card-main"><div class="rs-card-meta"><span>${session.cancelled?'CANCELLED':live?'LIVE NOW':finished?'PAST SESSION':'UPCOMING SESSION'}</span><time>${esc(dateLabel(session.starts_at))}</time>${!finished?'<span>'+clock(session.starts_at)+'–'+clock(session.ends_at)+' · SAST</span>':''}</div><h3>${esc(session.title||'Lesson')}</h3>${teacher?'<p class="rs-reference">Teacher: '+esc(teacher)+'</p>':''}${summary?'<p class="rs-card-summary">'+esc(summary)+'</p>':''}<div class="rs-card-actions">${session.cancelled?'<span class="sp-status">Cancelled</span>':live?`<button class="sp-primary" data-join="${esc(session.session_id)}">Join now ↗</button>`:'<span class="sp-status">'+(finished?'Session ended':'Joining opens five minutes before the lesson.')+'</span>'}</div></div></article>`;
 }).join('')}</div>`;
}
