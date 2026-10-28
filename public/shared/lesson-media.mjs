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
 return `<div class="sp-session-grid">${[...groups.values()].sort((a,b)=>new Date(a.session?.starts_at||a.media[0]?.lesson_date||0)-new Date(b.session?.starts_at||b.media[0]?.lesson_date||0)).map(({session,media:files})=>{const finished=session&&now>=session.ends_at,live=session&&joinIsOpen(session,now),date=session?.starts_at||files[0]?.lesson_date;return `<article class="sp-session"><span class="sp-eyebrow">${esc(dateLabel(date))}</span><h3>${esc(session?.title||files[0]?.title||'Lesson')}</h3>${session&&!finished?`<p>${clock(session.starts_at)}–${clock(session.ends_at)} · SAST</p>`:''}${session?.cancelled?'<span class="sp-status">Cancelled</span>':live?`<button class="sp-primary" data-join="${esc(session.session_id)}">Join lesson ↗</button>`:session?`<span class="sp-status">${finished?'Session ended':'Joining opens five minutes before the lesson.'}</span>`:''}<div class="sp-lesson-media">${files.map(mediaButton).join('')||'<span class="sp-status">Materials will appear here when published and available to your account.</span>'}</div></article>`;}).join('')}</div>`;
}
