import {renderCourse} from '/shared/student.mjs';
import {presentRecordingWebsite} from '/shared/recording-website.mjs';
import {weeklyTimetableHTML} from '/shared/weekly-timetable.mjs';
import {esc} from '/shared/model.mjs';
import {combinedSessionCards} from '/shared/lesson-media.mjs';
const {course,entries}=await fetch('/demo.json').then(r=>r.json()),root=document.getElementById('course-reader'),dialog=document.getElementById('demo-dialog'),body=document.getElementById('demo-dialog-body'),assets=new Map([['demo-cover',{id:'demo-cover',type:'image/webp',url:'/shared/assets/lilac-600.webp'}]]);
let ui={portal:true,route:'home',completed:[],reflections:{},readingSize:18},live=false;
function openDialog(html){body.innerHTML=html;dialog.showModal();}
function player(entry,start=0){const slot=root.querySelector('.rs-player-slot');if(!slot)return;slot.innerHTML=`<div class="demo-player"><p>WATCH · LISTEN · REFLECT</p><h2>${esc(entry.title)}</h2><button type="button" data-demo-play="${esc(entry.id)}" data-start="${start}">▶ Play recording${start?' from topic':''}</button><p>The reviewed Al-Kahf recording</p></div>`;}
function draw(){
 root.innerHTML=renderCourse(course,ui,assets);presentRecordingWebsite(root,{course,ui,assets,entries,loaded:true});
 root.querySelector('.rs-series-cover').innerHTML='<img src="/shared/assets/lilac-600.webp" alt="Lilac flowers, Surah Al-Kahf course artwork">';
 root.querySelector('.rs-collections-back')?.remove();
 const tools=root.querySelector('.rs-series-tools');if(live)tools.insertAdjacentHTML('beforeend','<button data-demo-join>Join now ↗</button>');
 const host=root.querySelector('[data-rs-live-sessions]');if(host){const start=Date.parse('2026-11-01T19:00:00+02:00');host.innerHTML=combinedSessionCards({sessions:[{session_id:'demo-live',title:'Surah Al-Kahf Bootcamp · Session 3',starts_at:start,ends_at:start+3600_000,teacherName:'Muallimah Shakirah Hunter',description:'A four-week journey through the four trials of Surah Al-Kahf. Online via Zoom.'}],now:live?start+10*60000:start-86400_000});const count=root.querySelector('.rs-list-heading>span');if(count)count.textContent=entries.length+' recordings · 1 '+(live?'live session':'upcoming session');for(const b of host.querySelectorAll('[data-join]')){b.removeAttribute('data-join');b.dataset.demoJoin='';}}

 if(ui.route==='recording'){const e=entries.find(e=>e.id===ui.recordingId);if(e)player(e);}
}
document.getElementById('demo-close').onclick=()=>dialog.close();
document.getElementById('demo-live').onchange=e=>{live=e.target.checked;draw();};
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.circleSession){const key=JSON.parse(button.dataset.circleSession),row=sessions.find(r=>r.activityId===key[1]&&r.date===key[2]&&r.startsAt===key[3]);if(row)openDialog('<h2>'+esc(row.activityName)+'</h2><p>'+esc(row.date+' · '+row.subjectName)+'</p><p>Sample timetable lesson for this design review.</p>');return;}
 if(button.dataset.demoPage){const week=button.dataset.demoPage==='week';root.hidden=week;document.getElementById('week-preview').hidden=!week;for(const b of document.querySelectorAll('[data-demo-page]'))b.setAttribute('aria-current',String(b===button?'page':'false'));return;}
 if(button.hasAttribute('data-demo-join')){openDialog('<h2>Join your class</h2><p>This is the live-class appearance preview. In the app, this action opens the current authorised Zoom link during the existing class Join window.</p>');return;}
 if(button.dataset.demoPlay){const e=entries.find(v=>v.id===button.dataset.demoPlay);if(e)root.querySelector('.rs-player-slot').innerHTML='<iframe title="'+esc(e.title)+'" src="https://www.youtube-nocookie.com/embed/'+e.authorVideo+'?playsinline=1&autoplay=1&start='+Number(button.dataset.start||0)+'" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe>';return;}
 if(button.dataset.authorVideo){const e=entries.find(e=>e.authorVideo===button.dataset.authorVideo);if(e)player(e,Number(button.dataset.recordingStart||0));return;}
 if(!button.dataset.sp)return;
 if(button.dataset.sp==='route'&&button.dataset.route==='about'){openDialog('<h2>About this course</h2><p>'+esc(course.home.subtitle)+'</p><p>'+esc(course.home.description)+'</p>');return;}
 if(button.dataset.sp==='route'&&button.dataset.route==='materials'){openDialog('<h2>Course PDF</h2><p>The Nurturing System of Allah in Surah Kahf · Chapter 1</p><iframe src="/course.pdf" title="Surah Al-Kahf course PDF"></iframe>');return;}
 if(button.dataset.sp==='recording'){ui={...ui,route:'recording',recordingId:button.dataset.id};draw();window.scrollTo({top:0,behavior:'smooth'});return;}
 if(button.dataset.sp==='lesson'){ui={...ui,route:'lesson',lessonId:button.dataset.id};draw();window.scrollTo({top:0,behavior:'smooth'});return;}
 if(button.dataset.sp==='route'){ui={...ui,route:button.dataset.route||'home'};draw();}
});
const start='2026-11-01',names=['Ma’had Arwa','Arabic Intensive','Aalimiyah','Reboot Your Maktab','Tafseer & Tadabbur','Mothers of the Ummah'],sessions=Array.from({length:7},(_,i)=>names.slice(0,i===5?2:4).map((name,j)=>{const date='2026-11-0'+(i+1),hour=6+j*2,startsAt=Date.parse(date+'T'+String(hour).padStart(2,'0')+':00:00+02:00');return {kind:'PROGRAM',activityId:String(j),activityName:name,subjectName:['Hifz and revision','Reading together','Fiqh','Daily practice'][j],date,startsAt,endsAt:startsAt+3600_000,status:'SCHEDULED'};})).flat();
document.getElementById('week-preview').innerHTML='<p class="week-demo-intro">Sample timetable · visual layout review</p><div id="circles-dashboard">'+weeklyTimetableHTML({startDate:start,timezone:'Africa/Johannesburg',timetable:sessions},{now:Date.parse('2026-11-01T08:20:00+02:00')})+'</div>';
draw();
