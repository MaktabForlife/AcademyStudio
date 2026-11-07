// Presentation adapter for the separate copied author-preview schema only.
// This module is injected by the loopback review server, never the paid reader.
import {presentRecordingWebsite,authorRecordings,parseSeriesRoute,seriesRoute} from './recording-website.mjs';
import {companionPlayer,recordingStart} from './recording-companion.mjs';
const root=document.querySelector('#course-reader'),host=document.querySelector('#reader-refresh-host');
const wrapper=await (await fetch('draft.json')).json(),course=wrapper.course;
const entries=authorRecordings(course),coverAsset=wrapper.assets.find(a=>a.id===course.home.imageId);
let ui={route:'home'},active=null;
const panel=document.createElement('aside');panel.className='sp-companion-player';panel.hidden=true;host.append(panel);host.classList.add('reader-workspace');
const player=companionPlayer({workspace:host,panel});
const editing=()=>document.querySelector('#edit-text')?.textContent==='Exit draft';
function routeFromHash(){
 if(location.hash.startsWith('#view='))return parseSeriesRoute(location.hash);
 let id='';try{id=decodeURIComponent(location.hash.slice(1));}catch{}
 return course.lessons.some(l=>l.id===id)?{route:'lesson',lessonId:id}:{route:entries.length?'home':'lessons'};
}
function present(){
 if(editing())return;
 presentRecordingWebsite(root,{course,ui,entries,pages:{materials:course.materials.files.length>0,sessions:false}});
 document.title=(ui.route==='recording'?entries.find(e=>e.id===ui.recordingId)?.title+' · ':ui.route==='lesson'?(course.lessons.find(l=>l.id===ui.lessonId)?.title||'Read')+' · ':'')+course.name;
 for(const status of root.querySelectorAll('[data-video-watch],[data-course-watch],[data-course-watch-bar]'))status.remove();
 const image=root.querySelector('.rs-series-cover img');if(image&&coverAsset){image.src=coverAsset.url;image.alt=course.home.imageAlt||course.name;}
}
function move(route,id=''){
 ui={route,...(route==='recording'?{recordingId:id}:route==='lesson'?{lessonId:id}:{})};
 history.pushState(null,'',location.pathname+'#'+seriesRoute(route,id));present();
 root.querySelector('.rs-episode h1,.rs-list-heading h1,.rs-list-heading h2,.rs-about h1')?.setAttribute('tabindex','-1');
 root.querySelector('.rs-episode h1,.rs-list-heading h1,.rs-list-heading h2,.rs-about h1')?.focus({preventScroll:true});
 window.scrollTo(0,0);
}
function listen(id,start=0){
 const entry=entries.find(e=>e.authorVideo===id);if(!entry||editing())return;
 start=recordingStart(start);
 if(active?.id===id&&active.element.isConnected){const url=new URL(active.element.src);url.searchParams.set('start',String(start));active.element.src=url.href;return;}
 const frame=document.createElement('iframe');frame.src='https://www.youtube-nocookie.com/embed/'+id+'?playsinline=1&autoplay=1&start='+start;frame.allow='autoplay; fullscreen; picture-in-picture';frame.title=entry.title;frame.referrerPolicy='strict-origin-when-cross-origin';player.open(frame,entry.title,{recordingId:entry.id});active={id,element:frame};
}
// Source renderers still own all original readings, reflection tools and editing.
window.addEventListener('kahf-view',()=>{ui=routeFromHash();present();});
document.addEventListener('click',event=>{
 if(editing())return;
 const button=event.target.closest('button,a[data-sp]');if(!button)return;
 if(button.id==='edit-text'){player.close();active=null;return;}
 if(button.dataset.authorVideo){event.preventDefault();event.stopImmediatePropagation();listen(button.dataset.authorVideo,button.dataset.recordingStart);return;}
 if(button.dataset.sp==='play-video'||button.dataset.sp==='follow-reading'){
  if(!entries.some(e=>e.authorVideo===button.dataset.video))return;
  event.preventDefault();event.stopImmediatePropagation();listen(button.dataset.video,button.dataset.start);return;
 }
 if(!root.contains(button)&&!panel.contains(button))return;
 if(button.dataset.sp==='recording'){event.preventDefault();event.stopImmediatePropagation();move('recording',button.dataset.id);}
 else if(button.dataset.sp==='route'&&['home','lessons','about'].includes(button.dataset.route)){event.preventDefault();event.stopImmediatePropagation();move(button.dataset.route);}
},true);
ui=routeFromHash();present();
