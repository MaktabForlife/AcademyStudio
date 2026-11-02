import {playlistCardHTML,playlistCard,ensurePlaylistCardStyles} from './playlist-card.mjs';
import {esc} from './model.mjs';
import {headerIcon} from './header-icons.mjs';
import {mouSubjects} from './mou-subjects.mjs';
import {comingSoonLabel} from './course-notices.mjs';

const invalid=()=>{throw Error('The classroom response needs to be refreshed.');};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:invalid();
const text=(value,max=240)=>typeof value==='string'&&value.length>0&&value.length<=max?value:invalid();
const stableId=value=>/^[-A-Za-z0-9_:]{1,180}$/.test(text(value,180))?value:invalid();
const boolean=value=>typeof value==='boolean'?value:invalid();
const timestamp=value=>Number.isSafeInteger(value)&&value>=0&&value<=8_640_000_000_000_000?value:invalid();
const oneOf=(value,values)=>values.includes(value)?value:invalid();
const month=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(text(value,7))?value:invalid();
const list=(value,max)=>Array.isArray(value)&&value.length<=max?value:invalid();
const timezone=value=>{text(value,100);try{new Intl.DateTimeFormat('en',{timeZone:value});return value;}catch{return invalid();}};

// Only this versioned, current-account DTO supplies operational identities.
// Display keys, membership and monthly flags never manufacture website/Join rights.
export function normalizeMouClassroom(input,{accountId,epoch=null}={}){
 const value=object(input),context=object(value.context),programme=object(value.programme),monthly=object(value.monthly),timetable=object(value.timetable);
 if(value.schema!=='MOU_CLASSROOM_V1'||context.accountId!==accountId||!Number.isSafeInteger(context.epoch)||context.epoch<0||epoch!==null&&epoch!==context.epoch)invalid();
 if(programme.key!=='mothers'||programme.kind!=='PROGRAMME'||programme.accessModel!=='MONTHLY')invalid();
 const state=oneOf(programme.state,['PENDING_CONNECTION','ACTIVE','MATERIALS_ONLY']),pending=state==='PENDING_CONNECTION';
 if(pending&&(programme.offeringId!==null||programme.authority!==null))invalid();
 const offeringId=pending&&programme.offeringId===null?null:stableId(programme.offeringId);
 const authority=pending&&programme.authority===null?null:oneOf(programme.authority,['ACADEMY','STUDIO']);
 const monthlyState=oneOf(monthly.state,['NOT_CONNECTED','CONNECTED']),currentMonth=monthlyState==='CONNECTED'?month(monthly.month):null;
 if(monthlyState==='NOT_CONNECTED'&&monthly.month!==null)invalid();
 const hasCurrentMonth=boolean(monthly.hasCurrentMonth),hasRetainedMonths=boolean(monthly.hasRetainedMonths),materialsConnected=boolean(value.materialsConnected);
 if(pending&&(monthlyState!=='NOT_CONNECTED'||hasCurrentMonth||hasRetainedMonths||materialsConnected))invalid();
 if(!pending&&monthlyState!=='CONNECTED'||hasCurrentMonth&&!hasRetainedMonths)invalid();
 const subjects=list(value.subjects,10);if(subjects.length!==mouSubjects.length)invalid();
 const normalizedSubjects=subjects.map((subject,index)=>{
  object(subject);const plan=mouSubjects[index];if(subject.key!==plan.key)invalid();
  if(subject.state!=='COMING_SOON'){
   const state=oneOf(subject.state,['PREPARING','LOCKED','PUBLISHED']);if(subject.availabilityLabel!==null)invalid();
   let website=null;
   if(subject.website!==null){
    const source=object(subject.website),id=stableId(source.id),canOpen=boolean(source.canOpen),canEdit=boolean(source.canEdit);
    const href='/studio/?website='+encodeURIComponent(id),editorHref='/builder/?website='+encodeURIComponent(id);
    if(pending||state==='LOCKED'||canOpen!==(state==='PUBLISHED')||canOpen&&source.href!==href||canEdit&&source.editorHref!==editorHref)invalid();
    if(!canOpen&&source.href!=null||!canEdit&&source.editorHref!=null)invalid();
    website={id,title:text(source.title),completionMonth:source.completionMonth===null?null:month(source.completionMonth),canOpen,canEdit,...(canOpen?{href}:{}),...(canEdit?{editorHref}:{})};
   }
   if(state==='PUBLISHED'&&!website?.canOpen)invalid();
   return {...plan,state,website};
  }
  if(subject.state!=='COMING_SOON'||subject.availabilityLabel!==comingSoonLabel||subject.website!==null)invalid();
  return {...plan,state:'COMING_SOON',website:null};
 });
 const playlistIds=new Set(),playlists=list(value.playlists||[],100).map(row=>{object(row);const id=stableId(row.id),websiteId=stableId(row.websiteId),href='/studio/?website='+encodeURIComponent(websiteId);if(pending||playlistIds.has(id)||row.href!==href||!Number.isSafeInteger(row.recordings)||row.recordings<0)invalid();playlistIds.add(id);const canListen=boolean(row.canListen),canRead=boolean(row.canRead);if(!canListen&&!canRead)invalid();return {id,websiteId,card:playlistCard(row.card),title:text(row.title),closeDate:row.closeDate===null?null:/^\d{4}-\d{2}-\d{2}$/.test(text(row.closeDate,10))?row.closeDate:invalid(),recordings:row.recordings,canListen,canRead,href};});
 if(materialsConnected!==(normalizedSubjects.some(s=>s.website?.canOpen)||playlists.length>0))invalid();
 const timetableState=oneOf(timetable.state,['NOT_CONNECTED','PENDING','NO_UPCOMING_SESSIONS','PUBLISHED','LIVE_ACCESS_REQUIRED']),serverTime=timestamp(timetable.serverTime);
 const seen=new Set(),sessions=list(timetable.sessions,50).map(session=>{
  object(session);const id=stableId(session.id);if(seen.has(id))invalid();seen.add(id);
  const startsAt=timestamp(session.startsAt),endsAt=timestamp(session.endsAt),joinOpensAt=timestamp(session.joinOpensAt),eligibleToJoin=boolean(session.eligibleToJoin),canJoin=boolean(session.canJoin),eligibilityExpiresAt=timestamp(session.eligibilityExpiresAt);
  const joinPath='/api/offerings/'+encodeURIComponent(offeringId)+'/join';
  if(!offeringId||endsAt<=startsAt||joinOpensAt!==startsAt-300_000||session.joinPath!==joinPath||eligibilityExpiresAt>endsAt)invalid();
  if(canJoin!==Boolean(eligibleToJoin&&serverTime>=joinOpensAt&&serverTime<endsAt&&serverTime<eligibilityExpiresAt))invalid();
  const classIds=list(session.classIds,50).map(stableId),classes=list(session.classes,50).map(klass=>{object(klass);const id=stableId(klass.id);if(!classIds.includes(id))invalid();return {id,label:klass.label===null?null:text(klass.label,140)};});
  return {id,title:text(session.title),startsAt,endsAt,joinOpensAt,eligibleToJoin,canJoin,eligibilityExpiresAt,joinPath,timezone:timezone(session.timezone),classes,teacherLabels:list(session.teacherLabels,50).map(label=>text(label,140))};
 });
 if((timetableState==='PUBLISHED')!==Boolean(sessions.length)||pending&&timetableState!=='NOT_CONNECTED'||!pending&&timetableState==='NOT_CONNECTED')invalid();
 const management=value.management===undefined?{canManage:false,requiresAuthorityRefresh:false}:object(value.management);
 const canManage=boolean(management.canManage),requiresAuthorityRefresh=boolean(management.requiresAuthorityRefresh);
 if(value.management!==undefined&&(management.authority!=='ACADEMY_PROXY'||management.offeringId!==offeringId)||requiresAuthorityRefresh&&!canManage||pending&&canManage)invalid();
 return {schema:value.schema,context:{accountId:context.accountId,epoch:context.epoch},programme:{state,offeringId,authority},monthly:{state:monthlyState,month:currentMonth,hasCurrentMonth,hasRetainedMonths},materialsConnected,subjects:normalizedSubjects,playlists,management:{canManage,requiresAuthorityRefresh},timetable:{state:timetableState,serverTime,sessions}};
}

export const mouJoinIsOpen=(session,now)=>session.eligibleToJoin&&now>=session.joinOpensAt&&now<session.endsAt&&now<session.eligibilityExpiresAt;
const monthLabel=value=>new Intl.DateTimeFormat('en-GB',{year:'numeric',month:'long',timeZone:'UTC'}).format(new Date(value+'-01T00:00:00Z'));
const dateLabel=(value,zone)=>new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:zone}).format(new Date(value));
const timetableMessages={NOT_CONNECTED:'Published classes are being connected.',PENDING:'The published timetable is not available yet.',NO_UPCOMING_SESSIONS:'No upcoming published classes.',LIVE_ACCESS_REQUIRED:'Live class access is not available for this account.'};
function subjectsHTML(subjects){
 if(!subjects.length)return '';
 return `<section class="mou-subjects" aria-labelledby="mou-subjects-title"><h2 id="mou-subjects-title">Programme content</h2>${playlistTable(subjects.map(subject=>({title:subject.title,first:subject.first,count:null,access:subject.state==='COMING_SOON'?'Coming soon':subject.website?.canOpen?'Available':subject.state==='LOCKED'?'Content is not available with your current access.':'This subject is being prepared.',websiteId:subject.website?.canOpen?subject.website.id:null,href:subject.website?.canOpen?subject.website.href:null,editorHref:subject.website?.canEdit?subject.website.editorHref:null})))}</section>`;
}
function playlistTable(rows){return `<div class="mou-playlist-table-wrap" role="region" aria-label="Programme playlists" tabindex="0"><table class="mou-playlist-table"><caption>Choose a playlist to open its available recordings and reading.</caption><thead><tr><th scope="col">Playlist</th><th scope="col">Recordings</th><th scope="col">Access</th><th scope="col">Open</th></tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${row.first?'<small class="eyebrow">FIRST SUBJECT</small>':''}${esc(row.title)}</th><td>${row.count===null?'—':row.count+' '+(row.count===1?'recording':'recordings')}</td><td>${esc(row.access)}</td><td>${row.href?`<a data-circles-website="${esc(row.websiteId)}" href="${esc(row.href)}" aria-label="${esc('Open playlist: '+row.title)}">Open playlist →</a>`:''}${row.editorHref?`<a class="mou-playlist-edit" href="${esc(row.editorHref)}">Edit website →</a>`:''}</td></tr>`).join('')}</tbody></table></div>`;}
function playlistsHTML(playlists=[],subjects=[]){if(globalThis.document)ensurePlaylistCardStyles(globalThis.document,'/shared/playlist-card.css');return '<section class="mou-playlists" aria-labelledby="mou-playlists-title"><h2 id="mou-playlists-title">Your playlists</h2>'+(playlists.length?'<div class="playlist-card-grid" aria-label="Programme playlists">'+playlists.map(row=>'<article>'+playlistCardHTML(row,{href:row.href,websiteId:row.websiteId,kind:'PROGRAM',accessLabel:row.canListen?'Open':'Reading materials'})+(subjects.find(subject=>subject.website?.id===row.websiteId&&subject.website.canEdit)?.website.editorHref?'<a class="mou-playlist-edit" href="'+esc(subjects.find(subject=>subject.website?.id===row.websiteId).website.editorHref)+'">Edit website →</a>':'')+'</article>').join('')+'</div>':'<p>Your published playlists will appear here when they are included in your access.</p>')+'</section>';}

export function renderMouClassroom({phase='loading',classroom=null,now=Date.now(),joiningId=null,error=''}={}){
 const heading=`<header class="card"><p class="eyebrow">YOUR CLASSROOM</p><h1>Mothers of the Ummah</h1><button type="button" data-mou-refresh aria-label="Refresh Mothers of the Ummah"${phase==='loading'?' disabled':''}>${headerIcon('refresh')}</button></header>`;
 if(!classroom)return `<section class="mou-programme">${heading}<p role="status">${esc(error||(phase==='loading'?'Loading your classroom…':'Your classroom is unavailable. Refresh to check your access.'))}</p><section class="mou-playlists"><h2>Your playlists</h2><p>Your available playlists will appear after your access is checked.</p></section><p><a data-circles-dashboard-home href="/?dashboard=1">Return to Circles</a></p></section>`;
 const {monthly,timetable,management}=classroom;
 const monthlyText=monthly.state==='NOT_CONNECTED'?'Your monthly programme access is being connected.':(monthly.hasCurrentMonth?'Monthly access is recorded for ':'No monthly access is recorded for ')+monthLabel(monthly.month)+'.';
 const sessions=timetable.sessions.map(session=>{
  const open=mouJoinIsOpen(session,now),classes=session.classes.map(c=>c.label).filter(Boolean),details=[...classes,...session.teacherLabels];
  const message=now>=session.endsAt?'This class has ended.':!session.eligibleToJoin?'Live class access is unavailable.':now>=session.eligibilityExpiresAt?'Refresh to check your class access.':now<session.joinOpensAt?'Join opens five minutes before class.':'Join is unavailable.';
  return `<article class="card"><h3>${esc(session.title)}</h3><p><time datetime="${new Date(session.startsAt).toISOString()}">${esc(dateLabel(session.startsAt,session.timezone))}</time> – <time datetime="${new Date(session.endsAt).toISOString()}">${esc(dateLabel(session.endsAt,session.timezone))}</time><br><small>${esc(session.timezone)}</small></p>${details.length?`<p>${details.map(esc).join(' · ')}</p>`:''}${open?`<button type="button" class="primary" data-mou-join="${esc(session.id)}"${joiningId?' disabled':''}>${joiningId===session.id?'Opening class…':'Join class'}</button>`:`<p>${message}</p>`}</article>`;
 }).join('');
 return `<section class="mou-programme">${heading}${error?`<p role="status">${esc(error)}</p>`:''}<section class="card" aria-labelledby="mou-monthly-title"><h2 id="mou-monthly-title">Monthly access</h2><p>${esc(monthlyText)}</p>${monthly.hasRetainedMonths?'<p>Access for your recorded months is retained.</p>':''}${management.canManage?'<button type="button" data-academy-management>Manage programme →</button>':''}</section>${playlistsHTML(classroom.playlists,classroom.subjects)}${subjectsHTML(classroom.subjects.filter(s=>s.website&&!classroom.playlists?.some(p=>p.websiteId===s.website.id)))}<section aria-labelledby="mou-timetable-title"><h2 id="mou-timetable-title">Published classes</h2>${sessions?`<div class="card-grid">${sessions}</div>`:`<p>${timetableMessages[timetable.state]}</p>`}</section><p><a data-circles-dashboard-home href="/?dashboard=1">Return to Circles</a></p></section>`;
}

// A single account-bound request supplies the entire classroom. Timers only
// redraw known, unexpired eligibility; they never fetch or create permission.
export function createMouClassroom({request,identity,isCurrent,onChange,navigate,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
 let revision=0,classroom=null,phase='idle',error='',flight=null,joinFlight=null,joiningId=null,timer=null,offset=0,contextKey=null,pinnedEpoch=null;
 const accountKey=()=>identity.account?JSON.stringify([identity.account.accountId,identity.generation]):null;
 const valid=(ticket,key)=>ticket===revision&&key===accountKey()&&Boolean(key)&&isCurrent();
 const clock=()=>now()+offset;
 const state=()=>({phase,classroom,now:clock(),joiningId,error});
 const emit=()=>{if(isCurrent())onChange(state());};
 function stopTimer(){if(timer!==null)clearTimer(timer);timer=null;}
 function schedule(ticket,key){
  stopTimer();if(!classroom||!valid(ticket,key))return;
  const next=classroom.timetable.sessions.flatMap(s=>[s.joinOpensAt,s.endsAt,s.eligibilityExpiresAt]).filter(time=>time>clock()).sort((a,b)=>a-b)[0];
  if(next!==undefined)timer=setTimer(()=>{timer=null;if(valid(ticket,key)){emit();schedule(ticket,key);}},Math.min(next-clock()+20,2_147_483_647));
 }
 function clear(){revision++;stopTimer();classroom=null;phase='idle';error='';flight=null;joinFlight=null;joiningId=null;}
 function unavailable(message){stopTimer();classroom=null;phase='unavailable';error=message;joiningId=null;emit();}
 function load({refresh=false,checked=null,checkedError=null}={}){
  const key=accountKey();if(!key||!isCurrent()){clear();return Promise.resolve(null);}
  if(key!==contextKey){clear();contextKey=key;pinnedEpoch=null;}
  if(flight)return flight;if(classroom&&!refresh){emit();return Promise.resolve(classroom);}
  const ticket=++revision;stopTimer();classroom=null;phase='loading';error='';joiningId=null;joinFlight=null;emit();
  const operation=(async()=>{
   try{if(checkedError)throw checkedError;const response=checked||await request('/api/circles/classrooms/mothers');if(!valid(ticket,key))return null;
    const next=normalizeMouClassroom(response,{accountId:identity.account.accountId,epoch:pinnedEpoch});
    pinnedEpoch=next.context.epoch;classroom=next;offset=next.timetable.serverTime-now();phase='ready';emit();schedule(ticket,key);return next;
   }catch(cause){if(valid(ticket,key))unavailable(cause.status===403?'Mothers of the Ummah access is unavailable for this account.':cause.status===401?'Sign in to Academy to open your classroom.':'Your classroom could not be loaded. Refresh to check your access.');return null;}
  })().finally(()=>{if(flight===operation)flight=null;});flight=operation;return operation;
 }
 function join(sessionId){
  if(joinFlight)return joinFlight;
  const key=accountKey(),ticket=revision,bound=classroom,session=bound?.timetable.sessions.find(s=>s.id===sessionId);
  if(!valid(ticket,key)||!session||!mouJoinIsOpen(session,clock()))return Promise.resolve(false);
  joiningId=sessionId;error='';emit();
  const operation=(async()=>{
   try{const response=await request(session.joinPath,{body:{sessionId:session.id}});
    if(!valid(ticket,key)||classroom!==bound||!mouJoinIsOpen(session,clock()))return false;
    const url=new URL(response.destination);if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error('Invalid protected class destination.');
    navigate(url.href);return true;
   }catch(cause){if(valid(ticket,key)&&classroom===bound)unavailable('Class access has changed or is unavailable. Refresh your classroom before trying again.');return false;}
  })().finally(()=>{if(joinFlight===operation){joinFlight=null;joiningId=null;if(valid(ticket,key))emit();}});joinFlight=operation;return operation;
 }
 return {load,join,clear,state};
}
