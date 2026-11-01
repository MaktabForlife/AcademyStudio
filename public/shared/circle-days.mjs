import {localDay} from './learning-circle.mjs';
export const addCircleDay=(date,offset)=>new Date(Date.parse(date+'T12:00:00Z')+offset*86400_000).toISOString().slice(0,10);
export const circleWeekStart=date=>addCircleDay(date,-new Date(date+'T12:00:00Z').getUTCDay());
export function selectedCircleDay(data,date,now=Date.now()){
 const today=localDay(now,data.timezone),start=data.weekStart||data.startDate||circleWeekStart(today),end=data.weekEnd||data.endDate||addCircleDay(start,6);
 const requested=date||data.selectedDate||today;
 return {today,start,end,date:requested>=start&&requested<=end?requested:today>=start&&today<=end?today:start};
}
// Opaque meetingGroup comes from the checked native DTO. No title/URL guesses.
export function teachingScheduleRows(rows,{timezone='Africa/Johannesburg'}={}){
 const ordered=[...rows].sort((a,b)=>a.startsAt-b.startsAt),groups=[],last=new Map();
 for(const row of ordered){
  if(row.status!=='SCHEDULED'||!row.meetingGroup){groups.push(row);continue;}
  const key=JSON.stringify([localDay(row.startsAt,timezone),row.kind,row.activityId,row.meetingGroup]),previous=last.get(key);
  if(previous&&row.startsAt<=previous.endsAt){
   const children=[...(previous.constituents||[previous]),row],merged={...previous,constituents:children,endsAt:Math.max(previous.endsAt,row.endsAt),subjectName:[...new Set(children.map(r=>r.subjectName||r.title).filter(Boolean))].join(' / '),moduleName:[...new Set(children.map(r=>r.moduleName).filter(Boolean))].join(' / ')};
   groups[groups.indexOf(previous)]=merged;last.set(key,merged);
  }else {groups.push(row);last.set(key,row);}
 }
 return groups.sort((a,b)=>a.startsAt-b.startsAt);
}
export const joinableConstituent=(row,now)=>row.constituents?row.constituents.find(child=>child.status==='SCHEDULED'&&(child.nativeJoin||child.studioJoin)&&now>=child.startsAt-300000&&now<child.endsAt):row;
