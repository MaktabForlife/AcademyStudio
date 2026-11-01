const zone='Africa/Johannesburg',cacheKey='m4l_circles_header_dates_v1',retryMs=60_000,refreshMs=900_000;
export const academyDay=now=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
export function validHeaderDate(value,now){return value?.gregorian===academyDay(now)&&value.timezone===zone&&value.source==='https://jamiat.org.za/'&&(value.hijri===null||typeof value.hijri==='string'&&value.hijri.length<=100&&/^\d{1,2} [A-Za-z ’'\-]+ \d{4}$/.test(value.hijri));}
export function installHeaderDates({document=globalThis.document,window=globalThis.window,fetcher=globalThis.fetch,now=()=>Date.now(),programme=false}={}){
 const header=document.querySelector('.public-home-header,.site-header');if(!header)return;
 let host=header.querySelector('.circles-header-dates');if(!host){host=document.createElement('div');host.className='circles-header-dates';header.append(host);}
 let value=null,pending=false,nextAttempt=0,timer,day=academyDay(now());
 const storage=()=>{try{return window.localStorage;}catch{return null;}};
 function resetDay(){const today=academyDay(now());if(today!==day){day=today;value=null;nextAttempt=0;}}
 function draw(){const today=academyDay(now()),valid=validHeaderDate(value,now());const stamp=JSON.stringify([today,valid?value.hijri:null]);if(host.dataset.dateStamp===stamp)return;host.dataset.dateStamp=stamp;host.replaceChildren();const date=document.createElement('time');date.dateTime=today;date.textContent=new Intl.DateTimeFormat('en-GB',{timeZone:zone,...(programme?{}:{weekday:'long'}),day:'numeric',month:'long',year:'numeric'}).format(new Date(now()));const hijri=document.createElement('span');hijri.textContent=valid&&value.hijri?value.hijri:'Hijri date unavailable';if(programme)host.append(hijri,date);else host.append(date,document.createTextNode(' · '),hijri);host.title='Academy dates · '+zone.replace('_',' ');}
 function readCache(){
  let saved;try{saved=JSON.parse(storage()?.getItem(cacheKey)||'null');}catch{}
  if(!validHeaderDate(saved,now())||!Number.isFinite(saved.savedAt)||saved.savedAt>now())return;
  // A valid date remains useful for today even when its refresh age has elapsed.
  // A null result in another tab must not erase an already verified date.
  if(!validHeaderDate(value,now())||saved.hijri&&(!value.hijri||saved.savedAt>value.savedAt))value=saved;
  nextAttempt=Math.max(nextAttempt,saved.savedAt+(saved.hijri?refreshMs:retryMs));
 }
 function schedule(){
  window.clearTimeout(timer);if(document.hidden)return;
  const midnight=Date.parse(academyDay(now())+'T22:00:00Z')+1000;
  const due=pending?midnight:Math.min(midnight,nextAttempt);
  timer=window.setTimeout(()=>void refresh(),Math.max(1000,due-now()));
 }
 async function refresh(){
  resetDay();readCache();draw();
  if(document.hidden||pending||now()<nextAttempt){schedule();return;}
  pending=true;const attemptDay=day;nextAttempt=now()+retryMs;schedule();
  try{
   // Partition browser caching by day too; the shared public service still
   // chooses and validates its own current day without consulting D1.
   const response=await fetcher('/api/public/header-date?day='+encodeURIComponent(attemptDay),{credentials:'omit'});
   if(!response.ok)return;
   const result=await response.json();
   if(validHeaderDate(result,now())){
    if(result.hijri||!validHeaderDate(value,now())||!value.hijri){value={...result,savedAt:now()};try{storage()?.setItem(cacheKey,JSON.stringify(value));}catch{}}
    nextAttempt=now()+(result.hijri?refreshMs:retryMs);draw();
   }
  }catch{}finally{pending=false;if(academyDay(now())!==attemptDay)nextAttempt=0;schedule();}
 }
 void refresh();window.addEventListener('focus',()=>void refresh());document.addEventListener('visibilitychange',()=>{if(document.hidden)window.clearTimeout(timer);else void refresh();});window.addEventListener('online',()=>{nextAttempt=0;void refresh();});
 return {refresh};
}
