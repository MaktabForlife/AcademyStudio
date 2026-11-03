import {localDay,sessionKey} from './learning-circle.mjs';
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

// Presentation groups retain the exact checked children for details and Join.
export function programmeDayRows(rows,{timezone='Africa/Johannesburg'}={}){
 const groups=new Map();
 for(const row of rows){
  if(!Number.isFinite(row.startsAt)||!Number.isFinite(row.endsAt)||row.endsAt<=row.startsAt)continue;
  const date=localDay(row.startsAt,timezone),key=JSON.stringify([date,row.kind,row.activityId]);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
 }
 return [...groups.values()].map(children=>{
  children.sort((a,b)=>a.startsAt-b.startsAt||a.endsAt-b.endsAt||sessionKey(a).localeCompare(sessionKey(b)));
  const first=children[0];
  return {...first,startsAt:Math.min(...children.map(r=>r.startsAt)),endsAt:Math.max(...children.map(r=>r.endsAt)),status:children.some(r=>r.status==='SCHEDULED')?'SCHEDULED':first.status,subjectName:'',moduleName:'',title:children.length+' '+(children.length===1?'session':'sessions'),constituents:children};
 }).sort((a,b)=>a.startsAt-b.startsAt||a.activityName.localeCompare(b.activityName));
}
