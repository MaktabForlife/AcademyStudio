import {addCircleDay,circleWeekStart,selectedCircleDay,teachingScheduleRows,joinableConstituent,programmeDayRows} from './shared/circle-days.mjs';
import {calendarMonth,offsetCalendarMonth,calendarMonthHTML} from './shared/calendar-month.mjs';
import {api,identity} from './api.mjs';
import {dashboardHTML,attentionRows,timetableProgrammes} from './shared/circles-dashboard-view.mjs';
import {sessionKey,mayOfferJoin,sessionSubject,sessionTime,localDay} from './shared/learning-circle.mjs';
import {createDashboardJoin} from './shared/dashboard-join.mjs';
import {esc} from './shared/model.mjs';

export function circlesDashboard({onUpdate,openAcademy,show=()=>true,onWorkspace=()=>{},getNavigation=()=>null}){
 let data=null,available=[],mode=null,pending=false,error='',ticket=0,cacheOwner='',dataOwner='',clock=null,dialog=null,dialogOwner=null,status='';
 const cache=new Map(),requests=new Map(),headers=new WeakMap();let renderedHost,renderedHTML,selectedDate='',viewedMonth='';
 const accountKey=()=>JSON.stringify([identity.account?.accountId,identity.generation]);
 const current=()=>Boolean(identity.account&&data&&dataOwner===accountKey()&&!pending&&data.mode===mode&&show());
 const grouped=()=>identity.account?.globalAdmin===true;
 const rows=()=>current()?(data.timetable||[]):[];
 const displayRows=()=>mode==='teach'?teachingScheduleRows(rows(),{timezone:data.timezone}):rows();
 const context=()=>({account:identity.account,generation:identity.generation,mode,data,pending,visible:current()});
 function selectedNavigation(){const navigation=getNavigation();if(!navigation)return null;const permitted=new Set((data?.programmeNavigation||[]).map(row=>row.navigationKey));return {...navigation,academia:(navigation.academia||[]).filter(row=>permitted.has(row.key))};}
 const join=createDashboardJoin({context,request:api,openWindow:()=>window.open('about:blank','_blank'),now:()=>Date.now(),onMessage:message=>{status=message;writeStatus();},onPending:()=>syncJoinButtons()});
 function writeStatus(){const el=document.querySelector('#circles-dashboard [data-circle-status]'),message=status||data?.checkedAt&&'Last checked '+new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:data.timezone}).format(new Date(data.checkedAt))||'';if(el&&el.textContent!==message)el.textContent=message;}
 function syncJoinButtons(){for(const button of document.querySelectorAll('#circles-dashboard [data-circle-join]'))button.disabled=join.pending;}
 function clearClock(){if(clock!==null)clearTimeout(clock);clock=null;}
 function closeDialog(){const old=dialog;dialog=null;dialogOwner=null;if(old){if(old.open)old.close();old.remove();}}
 function resetActions(){clearClock();closeDialog();join.clear();}
 function armClock(){
  clearClock();if(!current()||document.visibilityState==='hidden')return;
  const now=Date.now(),boundaries=rows().flatMap(row=>[row.startsAt-300000,row.startsAt,row.endsAt]).filter(value=>Number.isFinite(value)&&value>now);
  const next=Math.min(now+60000-now%60000,...boundaries),owner=accountKey(),snapshot=data;
  clock=setTimeout(()=>{clock=null;if(owner===accountKey()&&snapshot===data&&current())refresh();},Math.max(10,next-now));
 }
 function refresh(){
  const signed=Boolean(identity.account),visible=signed&&show(),hero=document.getElementById('learning-circles');
  document.body.classList.toggle('circles-dashboard-active',visible);
  if(visible&&mode)document.body.dataset.circlesDashboardMode=mode;else delete document.body.dataset.circlesDashboardMode;
  for(const nav of document.querySelectorAll('.public-home-header .site-nav')){
   if(!headers.has(nav))headers.set(nav,{html:nav.innerHTML,signature:''});const record=headers.get(nav),signature=JSON.stringify([signed,available,mode,pending]);if(record.signature===signature)continue;record.signature=signature;
   if(!signed){nav.innerHTML=record.html;nav.setAttribute('aria-label','Website navigation');continue;}
   nav.setAttribute('aria-label','Your workspaces');nav.innerHTML=(identity.account.globalAdmin?['learn','teach','admin']:available.length?available:['learn']).map(key=>`<button type="button" data-circles-workspace="${key}" aria-pressed="${key===mode}"${pending?' disabled':''}>${key==='learn'?'Learn':key==='teach'?'Teach':'Admin'}</button>`).join('');
  }
  let host=document.getElementById('circles-dashboard');if(!visible){resetActions();host?.remove();renderedHost=null;renderedHTML=null;return;}if(!hero)return;
  if(!host){host=document.createElement('section');host.id='circles-dashboard';host.className='circles-dashboard';host.setAttribute('aria-label','Your Academy dashboard');}
  if(hero.nextElementSibling!==host)hero.after(host);
  let content=host.querySelector('[data-circles-dashboard-content]');if(!content){content=document.createElement('div');content.dataset.circlesDashboardContent='';host.append(content);}
  const html=current()?dashboardHTML(data,{globalAdmin:identity.account?.globalAdmin===true,navigation:selectedNavigation(),now:Date.now(),selectedDate}):pending?'<div class="circles-dashboard-panel" role="status" aria-live="polite"><p>Opening your dashboard…</p></div>':`<div class="circles-dashboard-panel"><h2>Your Academy dashboard</h2><p role="status">Your dashboard could not be loaded.</p>${error?'<p>Open Academy or try again to check your dashboard.</p>':''}<button type="button" data-circles-dashboard-refresh>Try again</button><button type="button" data-circles-dashboard-home>Open Academy</button></div>`;
  if(renderedHost!==content||renderedHTML!==html){renderedHost=content;renderedHTML=html;content.innerHTML=html;}
  if(dialogOwner&&(dialogOwner.owner!==accountKey()||dialogOwner.data!==data||dialogOwner.mode!==mode||!current()))closeDialog();
  writeStatus();syncJoinButtons();armClock();
 }
 function request(selected,force,generation,accountId,date){
  const key=JSON.stringify([accountId,generation,selected||'default',force,circleWeekStart(date)]);if(requests.has(key))return requests.get(key);
  const query=new URLSearchParams({...(selected?{mode:selected}:{}),date,...(force?{refresh:'1'}:{})});
  const loading=api('/api/circles/dashboard?'+query).finally(()=>{if(requests.get(key)===loading)requests.delete(key);});requests.set(key,loading);return loading;
 }
 async function load(selected=mode,force=false,date=localDay(Date.now(),data?.timezone||'Africa/Johannesburg'),checked=null,checkedError=null){
  if(!identity.account)return;if(date==null||date==='')date=localDay(Date.now(),data?.timezone||'Africa/Johannesburg');const owner=accountKey();if(cacheOwner!==owner){cache.clear();requests.clear();cacheOwner=owner;}
  const key=JSON.stringify([selected||'default',circleWeekStart(date)]),saved=!force&&cache.get(key),age=saved?Date.now()-Number(saved.checkedAt):NaN,warm=Number.isFinite(age)&&age>=0&&age<43200000;
  resetActions();const currentTicket=++ticket,generation=identity.generation;mode=selected;pending=!warm;error='';status='';if(!warm)refresh();
  try{if(checkedError)throw checkedError;const value=checked||warm&&saved||await request(selected,force,generation,identity.account.accountId,date);if(currentTicket!==ticket||generation!==identity.generation||owner!==accountKey())return;data=value;selectedDate=selectedCircleDay(value,date,Date.now()).date;dataOwner=owner;available=value.availableModes;mode=value.mode;cache.set(JSON.stringify([mode,circleWeekStart(date)]),value);cache.set(key,value);}
  catch(e){if(currentTicket!==ticket||generation!==identity.generation||owner!==accountKey())return;data=null;dataOwner='';error=e.message;if([401,403,409].includes(e.status)){cache.clear();requests.clear();}}
  finally{if(currentTicket===ticket&&generation===identity.generation&&owner===accountKey()){pending=false;onUpdate();}}
 }
 function clear(){ticket++;resetActions();cache.clear();requests.clear();cacheOwner='';dataOwner='';data=null;available=[];mode=null;selectedDate='';pending=false;error='';status='';refresh();}
 function modal(kind,title,html){
  if(!current())return;closeDialog();const host=document.getElementById('circles-dashboard');if(!host)return;
  dialog=document.createElement('dialog');dialog.dataset.circlesDashboardDialog=kind;if(kind==='arabic')dialog.dataset.circlesArabicDialog='';dialogOwner={owner:accountKey(),data,mode};dialog.setAttribute('aria-labelledby','circles-dashboard-dialog-title');
  dialog.innerHTML=`<div class="circles-dialog-heading"><button type="button" class="circle-close" data-circle-dialog-close aria-label="Close">×</button><h2 id="circles-dashboard-dialog-title">${esc(title)}</h2></div>${html}`;
  const created=dialog;dialog.addEventListener('cancel',event=>{event.preventDefault();if(dialog===created)closeDialog();});dialog.addEventListener('close',()=>{if(dialog===created)closeDialog();});host.append(dialog);dialog.showModal();syncJoinButtons();
 }
 function sessionHTML(row){
  const details=[...(row.classNames||[]),...(row.teacherNames||[]),...(row.information||[])].filter(value=>typeof value==='string'),time=value=>sessionTime(value,data.timezone),title=sessionSubject(row)||'Lesson';
  return `<article class="circle-session-detail circle-detail-row"><h3>${esc(title)}</h3><p>${esc(row.activityName)} · ${esc(localDay(row.startsAt,data.timezone))}<br>${esc(time(row.startsAt))}–${esc(time(row.endsAt))} · ${esc(data.timezone)}</p>${details.length?'<p>'+[...new Set(details)].map(esc).join(' · ')+'</p>':''}<p>${row.status!=='SCHEDULED'?esc(row.status):Date.now()>=row.endsAt?'Session complete.':Date.now()<row.startsAt-300000?'Joining opens five minutes before this session.':'Current class access is checked when you select Join.'}</p>${mayOfferJoin(row,Date.now())?`<button type="button" data-circle-join="${esc(sessionKey(row))}">Join class ↗</button>`:''}</article>`;
 }
 function sessionInfo(row){const date=localDay(row.startsAt,data.timezone),all=(grouped()?rows().filter(value=>value.kind===row.kind&&value.activityId===row.activityId):row.constituents||[row]).filter(value=>localDay(value.startsAt,data.timezone)===date);modal('session',grouped()?row.activityName+' · '+date:'Session details · '+date,all.map(sessionHTML).join(''));}
 function allSessions(){const date=selectedCircleDay(data,selectedDate,Date.now()).date,all=rows().filter(row=>localDay(row.startsAt,data.timezone)===date);modal('timetable','Your timetable · '+date,grouped()?timetableProgrammes(all).map(group=>`<section><h3>${esc(group.activityName)}</h3>${group.lessons.map(sessionHTML).join('')}</section>`).join(''):all.length?[...all].sort((a,b)=>a.startsAt-b.startsAt).map(sessionHTML).join(''):'<p>No published sessions in this timetable.</p>');}
 function calendar(month=calendarMonth(Date.now(),data.timezone)){viewedMonth=month;modal('calendar','Academy calendar',calendarMonthHTML(data.calendar||[],{month,timezone:data.timezone,now:Date.now()}));}
 function mediaChooser(){
  if(!current()||mode!=='admin')return;const choices=(data.activities||[]).filter(row=>row.activityKey&&['PROGRAM','COURSE'].includes(row.kind)&&row.accessOwner!=='FROZEN');
  modal('media','Manage Media',choices.map(row=>`<p><button type="button" data-circle-media-choice="${esc(row.activityKey)}">${esc(row.name)}</button></p>`).join('')||'<p>No programmes or courses are available in your current Admin scope.</p>');
 }
 window.addEventListener('website-course-policy-changed',()=>{const visible=current(),selected=mode;clear();if(visible&&identity.account)void load(selected);});
 window.addEventListener('website-display-invalidated',()=>{const visible=current(),selected=mode;clear();if(visible&&identity.account)void load(selected);});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')clearClock();else if(current())refresh();});
 document.addEventListener('click',event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const choice=event.target.closest('[data-circles-workspace]');if(choice){event.preventDefault();event.stopImmediatePropagation();onWorkspace();if(choice.dataset.circlesWorkspace!==mode)void load(choice.dataset.circlesWorkspace);return;}
  const host=event.target.closest('#circles-dashboard');if(!host)return;
  const control=event.target.closest('button,a');if(!control)return;
  const handled=()=>{event.preventDefault();event.stopImmediatePropagation();};
  if(control.hasAttribute('data-circle-dialog-close')){handled();closeDialog();return;}
  if(control.hasAttribute('data-circles-dashboard-refresh')){handled();void load(mode,true,selectedDate||localDay(Date.now(),data?.timezone||'Africa/Johannesburg'));return;}
  if(control.hasAttribute('data-circles-dashboard-home')){handled();openAcademy(null,{mode:mode||'learn',tool:'home'});return;}
  if(!current())return;
  if(control.dataset.calendarMonth){handled();calendar(control.dataset.calendarMonth==='today'?calendarMonth(Date.now(),data.timezone):offsetCalendarMonth(viewedMonth,control.dataset.calendarMonth==='previous'?-1:1));return;}
  if(control.dataset.circleDay){handled();const selection=selectedCircleDay(data,selectedDate,Date.now()),date=control.dataset.circleDay==='today'?selection.today:addCircleDay(selection.date,control.dataset.circleDay==='previous'?-1:1);if(date>=selection.start&&date<=selection.end){selectedDate=date;closeDialog();refresh();}else void load(mode,false,date);return;}
  if(control.hasAttribute('data-circles-arabic-coming-soon')){handled();if(identity.account.globalAdmin===true&&mode==='learn')modal('arabic','Arabic Adventures','<p class="eyebrow">COMING SOON</p><p>Falling in love with the language of the Qur’an.</p><p>Programme details will be available here.</p>');return;}
  const rowKey=control.dataset.circleJoin||control.dataset.circleSession;
  if(rowKey){handled();const row=displayRows().find(row=>sessionKey(row)===rowKey)||rows().find(row=>sessionKey(row)===rowKey)||(grouped()?programmeDayRows(rows(),{timezone:data.timezone}).find(row=>sessionKey(row)===rowKey):null);if(row){if(control.hasAttribute('data-circle-join')){const live=joinableConstituent(row,Date.now());if(live)void join.join(live);}else sessionInfo(row);}return;}
  if(control.hasAttribute('data-circle-week')){handled();document.getElementById('circles-week')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
  if(control.hasAttribute('data-circle-all')){handled();allSessions();return;}
  if(control.hasAttribute('data-circle-attention-all')){handled();modal('attention','For your attention',attentionRows(data).map(row=>`<article><p class="eyebrow">${esc(row.kind)}</p><h3>${esc(row.title)}</h3><p>${esc(row.detail)}</p>${row.button}</article>`).join(''));return;}
  if(control.hasAttribute('data-circle-media')){handled();mediaChooser();return;}
  if(control.dataset.circleMediaChoice){handled();if(mode!=='admin')return;const area=(data.activities||[]).find(row=>row.activityKey===control.dataset.circleMediaChoice);if(!area||area.accessOwner==='FROZEN')return;
   if(area.accessOwner==='STUDIO'){if(typeof area.websiteOfferingId==='string'&&/^[-A-Za-z0-9_:]{1,160}$/.test(area.websiteOfferingId))window.location.assign('/studio/?manage=1&offering='+encodeURIComponent(area.websiteOfferingId)+'&section=media');else{status='This media workspace could not be checked. Refresh your dashboard.';writeStatus();}}
   else openAcademy(null,{mode:'admin',tool:'media',activityKey:area.activityKey});return;
  }
  if(control.hasAttribute('data-circle-courses')){handled();const target=document.querySelector(mode==='admin'?'#circles-dashboard .circles-manage':'#programmes.circles-dashboard-courses');if(target)target.scrollIntoView({behavior:'smooth',block:'start'});return;}
  if(control.hasAttribute('data-circle-dashboard')){handled();host.scrollIntoView({behavior:'smooth',block:'start'});return;}
  if(control.hasAttribute('data-circles-academy-action')){handled();let action;try{action=JSON.parse(control.dataset.circlesAcademyAction);}catch{return;}if(action.mode!==mode)return;if(action.tool==='calendar'&&mode!=='admin'){calendar();return;}if(action.tool==='home'&&!action.activityKey){allSessions();return;}openAcademy(null,action);}
 },true);
 return {refresh,load,clear,message(text){status=typeof text==='string'?text:'';writeStatus();},get data(){return current()?data:null;},get mode(){return mode;},get adminBadge(){return current()?data?.adminBadge:null;}};
}
