const zone='Africa/Johannesburg',cacheKey='m4l_circles_header_dates_v1';
export const academyDay=now=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
export function validHeaderDate(value,now){return value?.gregorian===academyDay(now)&&value.timezone===zone&&value.source==='https://jamiat.org.za/'&&(value.hijri===null||typeof value.hijri==='string'&&value.hijri.length<=100&&/^\d{1,2} [A-Za-z ’'\-]+ \d{4}$/.test(value.hijri));}
export function installHeaderDates({document=globalThis.document,window=globalThis.window,fetcher=globalThis.fetch,now=()=>Date.now()}={}){
 const header=document.querySelector('.public-home-header,.site-header');if(!header)return;
 let host=header.querySelector('.circles-header-dates');if(!host){host=document.createElement('div');host.className='circles-header-dates';header.append(host);}
 let value=null,pending=false,nextAttempt=0,timer;const storage=()=>{try{return window.localStorage;}catch{return null;}};
 function draw(){const today=academyDay(now()),valid=validHeaderDate(value,now());const stamp=JSON.stringify([today,valid?value.hijri:null]);if(host.dataset.dateStamp===stamp)return;host.dataset.dateStamp=stamp;host.replaceChildren();const date=document.createElement('time');date.dateTime=today;date.textContent=new Intl.DateTimeFormat('en-GB',{timeZone:zone,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(now()));const hijri=document.createElement('span');hijri.textContent=valid&&value.hijri?value.hijri:'Hijri date unavailable';host.append(date,document.createTextNode(' · '),hijri);host.title='Academy dates · '+zone.replace('_',' ');}
 async function refresh(){draw();if(document.hidden||pending||now()<nextAttempt)return;let saved;try{saved=JSON.parse(storage()?.getItem(cacheKey)||'null');}catch{}if(validHeaderDate(saved,now())&&Number.isFinite(saved.savedAt)&&now()>=saved.savedAt&&now()-saved.savedAt<(saved.hijri?900000:60000)){value=saved;draw();return;}
  pending=true;nextAttempt=now()+60000;
  try{const response=await fetcher('/api/public/header-date');if(!response.ok)return;const result=await response.json();if(validHeaderDate(result,now())){value={...result,savedAt:now()};try{storage()?.setItem(cacheKey,JSON.stringify(value));}catch{}draw();}}catch{}finally{pending=false;}
 }
 function midnight(){window.clearTimeout(timer);const delay=Math.max(1000,Date.parse(academyDay(now())+'T22:00:00Z')-now()+1000);timer=window.setTimeout(()=>{void refresh();midnight();},delay);}
 void refresh();midnight();window.addEventListener('focus',()=>void refresh());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});window.addEventListener('online',()=>{nextAttempt=0;void refresh();});
 return {refresh};
}
