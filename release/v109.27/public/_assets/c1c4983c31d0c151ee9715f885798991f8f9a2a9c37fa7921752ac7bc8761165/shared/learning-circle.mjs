import {esc} from './model.mjs';

// Presentation only. Every Join click resolves its current native/Studio gate.
export const sessionKey=row=>row.constituents?JSON.stringify(['combined',...row.constituents.map(sessionKey)]):JSON.stringify([row.kind,row.activityId,row.date,row.startsAt,row.endsAt,row.subjectName||'',row.moduleName||'',row.nativeJoin?.joinKey||row.studioJoin?.sessionId||'']);
export function circleSchedule(sessions,{now=Date.now(),limit=6}={}){
 const rows=sessions.filter(s=>s.status==='SCHEDULED'&&Number.isFinite(s.startsAt)&&Number.isFinite(s.endsAt)&&s.endsAt>s.startsAt).map(s=>({...s,state:s.endsAt<=now?'finished':s.startsAt<=now?'active':'later'})).sort((a,b)=>a.startsAt-b.startsAt||sessionKey(a).localeCompare(sessionKey(b)));
 const active=rows.filter(s=>s.state==='active'),future=rows.filter(s=>s.state==='later'),past=rows.filter(s=>s.state==='finished');
 if(future.length)future[0].state='next';
 const upcoming=[...active,...future].slice(0,limit),room=limit-upcoming.length,segments=[...upcoming,...(room>0?past.slice(-room):[])];
 return {segments,total:rows.length,remaining:rows.length-segments.length,activeCount:active.length,next:future[0]||null,phase:active.length?'active':future.length?'next':rows.length?'finished':'empty'};
}
export function sectorPath(index,count=6,{size=700,gap=.7}={}){
 const radius=size/2-8,centre=size/2,sweep=360/count,start=index*sweep-sweep/2+gap,end=start+sweep-gap*2,point=angle=>{const radians=(angle-90)*Math.PI/180;return [centre+radius*Math.cos(radians),centre+radius*Math.sin(radians)].map(n=>n.toFixed(3)).join(' ');};
 return `M ${centre} ${centre} L ${point(start)} A ${radius} ${radius} 0 ${sweep>180?1:0} 1 ${point(end)} Z`;
}
export function segmentPosition(index,count=6){const angle=index*2*Math.PI/count;return {left:50+32.2*Math.sin(angle),top:50-32.2*Math.cos(angle)};}
export function localDay(time,timezone){return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));}
export const sessionSubject=row=>[...new Set([row.subjectName,row.moduleName].filter(Boolean))].join(' · ')||row.title||'';
export const sessionTime=(time,timezone)=>new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:timezone}).format(new Date(time));
export function mayOfferJoin(row,now=Date.now()){
 if(row.constituents)return row.constituents.some(child=>mayOfferJoin(child,now));
 const reference=row.nativeJoin||row.studioJoin;
 return Boolean(reference&&row.status==='SCHEDULED'&&Number.isFinite(row.startsAt)&&Number.isFinite(row.endsAt)&&now>=row.startsAt-300000&&now<row.endsAt);
}
const statuses={active:'LIVE NOW',next:'UP NEXT',later:'LATER TODAY',finished:'FINISHED'};
const delay=(start,now)=>{const minutes=Math.max(0,Math.ceil((start-now)/60000));return minutes<60?`in ${minutes} min`:`in ${Math.floor(minutes/60)}h${minutes%60?' '+minutes%60+'m':''}`;};

export function learningCircleHTML(sessions,{now=Date.now(),timezone='Africa/Johannesburg',grouped=false,date=localDay(now,timezone)}={}){
 const today=date,daily=sessions.filter(row=>Number.isFinite(row.startsAt)&&localDay(row.startsAt,timezone)===today),groups=new Map();
 if(grouped)for(const row of daily.filter(row=>row.status==='SCHEDULED'&&Number.isFinite(row.endsAt)&&row.endsAt>row.startsAt)){const key=row.kind+':'+row.activityId,old=groups.get(key),priority=r=>r.endsAt>now?(r.startsAt<=now?0:1):2;if(!old||priority(row)<priority(old)||priority(row)===priority(old)&&(priority(row)===2?row.startsAt>old.startsAt:row.startsAt<old.startsAt))groups.set(key,row);}
 const schedule=circleSchedule(grouped?[...groups.values()]:daily,{now}),count=6,time=value=>sessionTime(value,timezone),zone=timezone==='Africa/Johannesburg'?'SAST':timezone;
 const shapes=Array.from({length:count},(_,i)=>`<path class="wheel-sector ${schedule.segments[i]?.state||'unused'}" d="${sectorPath(i,count)}"/>`).join('');
 const entries=schedule.segments.map((row,i)=>{const pos=segmentPosition(i,count),key=esc(sessionKey(row)),subject=sessionSubject(row);return `<li class="wheel-session ${row.state}" style="--x:${pos.left}%;--y:${pos.top}%"><button type="button" class="session-open" data-circle-session="${key}" aria-label="${esc(statuses[row.state]+': '+row.activityName+', '+subject+'. View session details')}"><span class="session-status">${row.state==='active'?'<i aria-hidden="true"></i>':row.state==='finished'?'✓ ':''}${row.state==='later'&&date!==localDay(now,timezone)?'SCHEDULED':statuses[row.state]}</span><strong class="session-title">${esc(row.activityName)}${grouped?'<span class="session-info" aria-hidden="true"> ⓘ</span>':''}</strong>${subject?`<span class="session-subject">${esc(subject)}</span>`:''}<time class="session-time">${time(row.startsAt)}–${time(row.endsAt)}</time></button>${mayOfferJoin(row,now)?`<button type="button" class="session-join" data-circle-join="${key}">Join class ↗</button>`:`<span class="session-hint">${row.state==='next'?'Starts '+delay(row.startsAt,now):row.state==='finished'?'Session complete':'View session'}</span>`}</li>`;}).join('');
 const centre=schedule.phase==='active'?`<span class="centre-eyebrow">IN PROGRESS</span><strong class="centre-time">${time(now)}</strong><span class="centre-detail">${esc(zone)}<br>${schedule.activeCount} ${schedule.activeCount===1?'class':'classes'} live now</span>`:schedule.phase==='next'?`<span class="centre-eyebrow">NEXT CLASS</span><strong class="centre-time">${time(schedule.next.startsAt)}</strong><span class="centre-detail">${esc(zone)}<br>Starts ${delay(schedule.next.startsAt,now)}</span>`:schedule.phase==='finished'?'<span class="centre-eyebrow">ALHAMDULILLAH</span><strong class="centre-time">A day of<br>learning.</strong><span class="centre-detail">Selected day’s sessions finished</span>':'<span class="centre-eyebrow">A LITTLE BREATHING SPACE</span><strong class="centre-time">No classes<br>this day.</strong><span class="centre-detail">View your timetable</span>';
 return `<div class="learning-wheel" role="group" aria-label="Learning circle for ${esc(date)}"><svg class="wheel-shape" viewBox="0 0 700 700" aria-hidden="true" focusable="false">${shapes}<circle class="wheel-ring" cx="350" cy="350" r="348"/></svg><ul class="wheel-sessions">${entries}</ul><div class="wheel-centre ${schedule.phase==='empty'||schedule.phase==='finished'?'empty':''}">${centre}</div></div><p class="wheel-summary">${schedule.phase==='active'?'Your class is in progress.':schedule.phase==='next'?'A little preparation for what’s next.':schedule.phase==='finished'?'A moment to reflect on today.':'Your next published sessions appear in the timetable.'}${schedule.remaining?` <button type="button" class="text-button" data-circle-all>View ${schedule.remaining} more</button>`:''}</p><div class="wheel-legend" aria-label="Session shading"><span><i class="legend-active"></i>Live now</span><span><i class="legend-next"></i>Up next</span><span><i class="legend-later"></i>Later</span><span><i class="legend-finished"></i>Finished</span></div>`;
}
