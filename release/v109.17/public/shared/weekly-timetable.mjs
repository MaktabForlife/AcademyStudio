import {esc} from './model.mjs';
import {localDay,sessionTime,sessionSubject,sessionKey,mayOfferJoin} from './learning-circle.mjs';
import {programmeDayRows} from './circle-days.mjs';

const dayPattern=/^\d{4}-\d{2}-\d{2}$/;
const addDay=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400_000).toISOString().slice(0,10);
export function timetableWeek(data,{now=Date.now(),grouped=false}={}){
 const timezone=data.timezone||'Africa/Johannesburg',today=localDay(now,timezone),weekday=new Date(today+'T12:00:00Z').getUTCDay();
 const start=dayPattern.test(data.startDate||'')?data.startDate:addDay(today,-weekday),days=Array.from({length:7},(_,i)=>addDay(start,i));
 const rows=(data.timetable||[]).filter(r=>Number.isFinite(r.startsAt)&&Number.isFinite(r.endsAt)&&r.endsAt>r.startsAt&&days.includes(localDay(r.startsAt,timezone))).sort((a,b)=>a.startsAt-b.startsAt||sessionKey(a).localeCompare(sessionKey(b)));
 const displayRows=grouped?programmeDayRows(rows,{timezone}):rows;
 const cells=new Map();for(const row of displayRows){const key=localDay(row.startsAt,timezone)+'|'+sessionTime(row.startsAt,timezone);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(row);}
 return {timezone,today,days,rows,displayRows,cells,times:[...new Set([...cells.keys()].map(key=>key.split('|')[1]))].sort()};
}
export function weeklyTimetableHTML(data,{now=Date.now(),grouped=false}={}){
 const week=timetableWeek(data,{now,grouped}),label=day=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
 const session=row=>{
  const cancelled=row.status!=='SCHEDULED',active=(row.constituents||[row]).some(child=>child.status==='SCHEDULED'&&child.startsAt<=now&&child.endsAt>now),finished=row.endsAt<=now,key=esc(sessionKey(row)),endDay=localDay(row.endsAt,week.timezone);
  return `<article class="week-lesson${cancelled?' is-cancelled':active?' is-active':finished?' is-finished':''}"><button type="button" class="week-lesson-detail" data-circle-session="${key}"><span class="week-lesson-time">${esc(sessionTime(row.startsAt,week.timezone))}–${esc(sessionTime(row.endsAt,week.timezone))}${endDay!==localDay(row.startsAt,week.timezone)?' · '+esc(label(endDay)):''}</span><strong>${esc(row.activityName)}${grouped?'<span aria-hidden="true"> ⓘ</span>':''}</strong>${sessionSubject(row)?'<span>'+esc(sessionSubject(row))+'</span>':''}${cancelled?'<small>'+esc(row.status)+'</small>':active?'<small>LIVE NOW</small>':''}</button>${mayOfferJoin(row,now)?'<button type="button" class="week-join" data-circle-join="'+key+'">Join class ↗</button>':''}</article>`;
 };
 return `<section class="circles-week" id="circles-week" aria-labelledby="circles-week-title"><header><div><p class="eyebrow">YOUR WEEK AT A GLANCE</p><h2 id="circles-week-title">Weekly timetable</h2></div><p>${esc(label(week.days[0]))} – ${esc(label(week.days[6]))} · ${esc(week.timezone==='Africa/Johannesburg'?'SAST':week.timezone)}</p></header><div class="week-table-scroll" tabindex="0" role="region" aria-label="Weekly timetable; scroll horizontally to view every day"><table><caption class="week-sr-only">Your published lessons from ${esc(week.days[0])} to ${esc(week.days[6])}. All times ${esc(week.timezone)}.</caption><thead><tr><th scope="col">Time</th>${week.days.map(day=>'<th scope="col"'+(day===week.today?' aria-current="date"':'')+'><span>'+new Intl.DateTimeFormat('en-GB',{weekday:'short',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'))+'</span><time datetime="'+day+'">'+esc(label(day))+'</time></th>').join('')}</tr></thead><tbody>${week.times.length?week.times.map(time=>'<tr><th scope="row">'+time+'</th>'+week.days.map(day=>'<td'+(day===week.today?' class="is-today"':'')+'>'+(week.cells.get(day+'|'+time)||[]).map(session).join('')+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="8" class="week-empty">No published lessons in this week’s timetable.</td></tr>'}</tbody></table></div><p class="week-help">Select a lesson for details. Join appears when the class opens.</p></section>`;
}
