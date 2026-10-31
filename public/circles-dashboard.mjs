import {api,identity} from './api.mjs';
import {dashboardHTML} from './shared/circles-dashboard-view.mjs';
export function circlesDashboard({onUpdate,openAcademy,show=()=>true,onWorkspace=()=>{}}){
 let data=null,available=[],mode=null,pending=false,error='',ticket=0;const cache=new Map(),headers=new WeakMap();let renderedHost,renderedHTML;
 function refresh(){
  const signed=Boolean(identity.account),hero=document.getElementById('learning-circles');
  for(const nav of document.querySelectorAll('.public-home-header .site-nav')){
   if(!headers.has(nav))headers.set(nav,{html:nav.innerHTML,signature:''});const record=headers.get(nav),signature=JSON.stringify([signed,available,mode,pending]);if(record.signature===signature)continue;record.signature=signature;
   if(!signed){nav.innerHTML=record.html;nav.setAttribute('aria-label','Website navigation');continue;}
   nav.setAttribute('aria-label','Your workspaces');nav.innerHTML=(identity.account.globalAdmin?['learn','teach','admin']:available.length?available:['learn']).map(key=>`<button type="button" data-circles-workspace="${key}" aria-pressed="${key===mode}"${pending?' disabled':''}>${key==='learn'?'Learn':key==='teach'?'Teach':'Admin'}</button>`).join('');
  }
  let host=document.getElementById('circles-dashboard');if(!signed||!show()){host?.remove();return;}if(!hero)return;
  if(!host){host=document.createElement('section');host.id='circles-dashboard';host.className='circles-dashboard';host.setAttribute('aria-label','Your Academy dashboard');hero.after(host);}
  const html=data&&!pending?dashboardHTML(data):`<div class="circles-dashboard-panel"><h2>Your Academy dashboard</h2><p role="status">${pending?'Loading your Academy dashboard…':'Your dashboard could not be loaded.'}</p>${error?'<p>Open Academy or try again to check your dashboard.</p>':''}<button type="button" data-circles-dashboard-refresh${pending?' disabled':''}>${pending?'Loading…':'Try again'}</button><button type="button" data-circles-dashboard-home>Open Academy</button></div>`;
  if(renderedHost!==host||renderedHTML!==html){renderedHost=host;renderedHTML=html;host.innerHTML=html;}
 }
 async function load(selected=mode,force=false){
  if(!identity.account)return;const current=++ticket,generation=identity.generation;mode=selected;pending=true;error='';refresh();
  try{const key=selected||'default';const value=!force&&cache.has(key)?cache.get(key):await api('/api/circles/dashboard',{body:{...(selected?{mode:selected}:{}),...(force?{refresh:true}:{})}});if(current!==ticket||generation!==identity.generation)return;data=value;available=value.availableModes;mode=value.mode;cache.set(mode,value);cache.set(key,value);}
  catch(e){if(current!==ticket||generation!==identity.generation)return;data=null;error=e.message;}
  finally{if(current===ticket&&generation===identity.generation){pending=false;onUpdate();}}
 }
 function clear(){ticket++;cache.clear();data=null;available=[];mode=null;pending=false;error='';refresh();}
 window.addEventListener('website-course-policy-changed',()=>{const visible=Boolean(data)&&show();ticket++;cache.clear();data=null;pending=false;if(visible&&identity.account)void load(mode);else refresh();});
 document.addEventListener('click',event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const choice=event.target.closest('[data-circles-workspace]');if(choice){event.preventDefault();event.stopImmediatePropagation();onWorkspace();if(choice.dataset.circlesWorkspace!==mode)void load(choice.dataset.circlesWorkspace);return;}
  if(event.target.closest('[data-circles-dashboard-refresh]')){event.preventDefault();event.stopImmediatePropagation();void load(mode,true);return;}
  if(event.target.closest('[data-circles-dashboard-home]')){event.preventDefault();event.stopImmediatePropagation();openAcademy(null,{mode:mode||'learn',tool:'home'});return;}
  const action=event.target.closest('[data-circles-academy-action]');if(action){event.preventDefault();event.stopImmediatePropagation();openAcademy(null,JSON.parse(action.dataset.circlesAcademyAction));}
 },true);
 return {refresh,load,clear,get data(){return data;},get mode(){return mode;},get adminBadge(){return data?.adminBadge;}};
}
