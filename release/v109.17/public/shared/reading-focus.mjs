/* A header-free reading view that also works on iPhone without the Fullscreen API. */
(() => {
 'use strict';
 if(window.M4L_COURSE_READING)return;
 const root=document.documentElement,body=document.body;
 body.classList.add('academy-course-reader');
 let focused=false;
 const expand='<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',collapse='<path d="M3 8h5V3m13 5h-5V3M8 21v-5H3m13 5v-5h5"/>';
 function toolbar(){
  if(body.classList.contains('course-loading'))return null;
  return [...document.querySelectorAll('#view-lesson .reading-toolbar,#course-reader .sp-reading-toolbar')].find(node=>!node.closest('[hidden]'))||null;
 }
 function viewportTop(node){
  const banners=focused?0:document.querySelector('.academy-banners')?.getBoundingClientRect().bottom||0;
  return Math.max(0,banners,node?.getBoundingClientRect().bottom||0);
 }
 function place(node){
  const page=node?.closest('#view-lesson,.sp-page');if(!page)return null;
  const top=viewportTop(node),anchor=[...page.querySelectorAll('h1,.reading-section,.sp-reading-section')].find(el=>el.getBoundingClientRect().bottom>top);
  return anchor?{anchor,offset:anchor.getBoundingClientRect().top-top}:null;
 }
 function updateButton(button){
  const label=focused?'Exit full screen reading':'Full screen reading';
  if(button.getAttribute('aria-label')===label)return;
  button.setAttribute('aria-label',label);button.setAttribute('title',label);button.setAttribute('aria-pressed',String(focused));
  button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+(focused?collapse:expand)+'</svg><span class="course-reading-focus-label">'+(focused?'Exit':'Full screen')+'</span>';
 }
 function setFocus(value,{restoreFocus=true,preservePlace=true}={}){
  const node=toolbar();value=Boolean(value&&node);
  if(value===focused)return;
  const saved=preservePlace?place(node):null;
  focused=value;root.classList.toggle('academy-reading-focus',focused);
  document.querySelectorAll('[data-course-reading-focus]').forEach(updateButton);
  requestAnimationFrame(()=>{
   if(saved?.anchor.isConnected)window.scrollBy({top:saved.anchor.getBoundingClientRect().top-viewportTop(toolbar())-saved.offset,behavior:'instant'});
   if(restoreFocus)toolbar()?.querySelector('[data-course-reading-focus]')?.focus({preventScroll:true});
  });
 }
 function sync(){
  const next=toolbar();
  if(!next){setFocus(false,{restoreFocus:false,preservePlace:false});return;}
  let button=next.querySelector('[data-course-reading-focus]');
  if(!button){button=document.createElement('button');button.type='button';button.className='course-reading-focus-toggle';button.setAttribute('data-course-reading-focus','');next.append(button);}
  updateButton(button);
 }
 document.addEventListener('click',event=>{
  if(event.target.closest('[data-course-reading-focus]')){event.preventDefault();setFocus(!focused);}
 });
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&focused&&!document.querySelector('dialog[open]')){event.preventDefault();setFocus(false);}
 });
 const reset=()=>setFocus(false,{restoreFocus:false,preservePlace:false});
 window.addEventListener('website-session-ended',reset);
 window.addEventListener('website-account-changed',reset);
 window.addEventListener('m4l-academy-session-ended',reset);
 window.addEventListener('m4l-academy-session',reset);
 window.addEventListener('storage',event=>{if(event.key==='m4l_account_token'||event.key===null)reset();});
 window.addEventListener('kahf-view',sync);
 new MutationObserver(sync).observe(body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});
 window.M4L_COURSE_READING={sync,exit:reset};sync();
})();
