import {esc,validateCourse} from './model.mjs';
import {inlineSession,decorateInlineText} from './inline-text.mjs?v=107.120';

export function createInlineEditor({root,request,active,allowed,workspace,enterAdmin,canStart=()=>true,launchEditor=async()=>false,showDraft,showPublished,published,route,dialog,dialogTitle,dialogBody}){
 const session=inlineSession({request,active}),host=document.createElement('section');
 host.className='sp-inline-toolbar';host.hidden=true;host.setAttribute('aria-label','Edit website text');root.before(host);
 let editing=false,notice='',opened=false,errorNotice=false;
 const busy=()=>opened||session.busy;
 const control=(action,label,primary=false)=>`<button type="button" data-inline-action="${action}"${primary?' class="sp-primary"':''}${busy()?' disabled':''}>${label}</button>`;
 function controls(){
  host.hidden=!editing&&!errorNotice;host.innerHTML=editing?`<div class="sp-inline-controls"><strong>Edit text</strong><span class="sp-inline-state" role="status">${esc(notice|| (session.dirty?'Unsaved text changes':'Editing the saved draft'))}</span><div>${control('save','Save draft',true)}${control('review','Publish')}${control('close','Close editing')}</div></div><p>Click any outlined heading or passage to edit it. Students see the published website until you publish.</p>`:errorNotice?`<p role="alert">${esc(notice)}</p>`:'';
  for(const field of root.querySelectorAll('[data-inline-path]')){const value=busy()?'false':'plaintext-only';if(field.getAttribute('contenteditable')!==value)field.setAttribute('contenteditable',value);}
 }
 const fail=error=>{if(active()&&error.name!=='AbortError'){notice=error.message;errorNotice=true;controls();}};
 function syncButtons(){for(const button of root.querySelectorAll('[data-inline-action="start"]'))button.remove();if(!allowed()||editing)return;
  for(const target of root.querySelectorAll('.sp-row-actions,.sp-sidebar')){const button=document.createElement('button');button.type='button';button.className='sp-inline-entry';button.dataset.inlineAction='start';button.textContent='Edit text';button.setAttribute('aria-label','Edit website text');target.insertBefore(button,target.classList.contains('sp-sidebar')?target.querySelector('nav'):null);}
 }
 async function start(){
  if(!allowed()||busy()||editing||!canStart())return;
  if(await launchEditor())return;
  if(workspace()!=='ADMIN'){enterAdmin();return;}
  opened=true;errorNotice=false;root.inert=true;
  try{const record=await session.open();if(!active())return;editing=true;notice='Editing the saved draft';showDraft(record);document.body.classList.add('website-inline-editing');controls();}
  catch(error){fail(error);throw error;}
  finally{opened=false;root.inert=false;controls();}
 }
 function close(){
  if(busy())return false;
  if(session.dirty&&!confirm('Close editing without saving your text changes?'))return false;
  session.clear();editing=false;notice='';errorNotice=false;document.body.classList.remove('website-inline-editing');controls();showPublished();return true;
 }
 async function save(){
  const job=session.save();notice='Saving draft…';controls();try{await job;notice='Draft saved · ready to publish';errorNotice=false;}finally{controls();}
 }
 async function review(){
  const errors=validateCourse(session.record.document,{review:true});if(errors.length)throw Error(errors.join(' '));await save();if(!active())return;
  dialogTitle.textContent='Publish text changes';dialogBody.innerHTML=`<p>Your updated text will be visible to students.</p><p><strong>${esc(session.record.document.name)}</strong> · ${session.record.document.lessons.length} web lesson${session.record.document.lessons.length===1?'':'s'}</p><div class="sp-inline-review-actions">${control('publish','Publish changes',true)}${control('back','Keep editing')}</div>`;dialog.showModal();
 }
 async function publish(){
  const job=session.publish();notice='Publishing text changes…';root.inert=true;controls();
  try{await job;if(!active())return;dialog.close();session.clear();editing=false;errorNotice=false;document.body.classList.remove('website-inline-editing');controls();await published();}
  finally{root.inert=false;controls();}
 }
 const click=async event=>{
  const button=event.target.closest('[data-inline-action]');if(!button||button.disabled||!active())return;event.preventDefault();
  try{const action=button.dataset.inlineAction;if(action==='start')await start();else if(action==='save')await save();else if(action==='review')await review();else if(action==='close')close();else if(action==='publish')await publish();else if(action==='back')dialog.close();}
  catch(error){fail(error);}
 };
 document.addEventListener('click',click);
 root.addEventListener('input',event=>{
  const field=event.target.closest('[data-inline-path]');if(!field||!editing||!active()||busy())return;
  try{const text=field.innerText.replace(/\u00a0/g,' ');session.change(field.dataset.inlinePath,text);notice='Unsaved text changes';
   for(const duplicate of root.querySelectorAll('[data-inline-path]'))if(duplicate!==field&&duplicate.dataset.inlinePath===field.dataset.inlinePath)duplicate.textContent=text;
   // Updating the controls leaves the active text node and caret untouched.
   controls();
  }catch(error){fail(error);}
 });
 root.addEventListener('paste',event=>{
  const field=event.target.closest('[data-inline-path]');if(!editing||!field||busy())return;event.preventDefault();const selection=window.getSelection();if(!selection?.rangeCount)return;const range=selection.getRangeAt(0);if(!field.contains(range.commonAncestorContainer))return;
  const node=document.createTextNode(event.clipboardData.getData('text/plain'));range.deleteContents();range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);field.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste'}));
 });
 root.addEventListener('drop',event=>{if(editing&&event.target.closest('[data-inline-path]'))event.preventDefault();});
 document.addEventListener('keydown',event=>{if(editing&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();if(!busy())void save().catch(fail);}});
 window.addEventListener('beforeunload',event=>{if(editing&&(session.dirty||busy())){event.preventDefault();event.returnValue='';}});
 return {
  get editing(){return editing;},get busy(){return busy();},start,close,
  canLeave(){return !busy()&&(!session.dirty||confirm('Leave without saving your website text changes?'));},
  draw(){root.classList.toggle('sp-inline-editing',editing);if(editing)decorateInlineText(root,session.record.document,route());syncButtons();controls();},
  clear(){session.clear();editing=false;opened=false;errorNotice=false;host.replaceChildren();host.hidden=true;document.body.classList.remove('website-inline-editing');},
  error:fail
 };
}
