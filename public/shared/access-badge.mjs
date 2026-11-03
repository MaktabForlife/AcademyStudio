import {esc} from './model.mjs';
export const lockedCourseMessage='Access to this course can be purchased from Admin.';
export function showLockedAccessNotice(doc=document){
 let dialog=doc.getElementById('course-access-notice');
 if(!dialog){dialog=doc.createElement('dialog');dialog.id='course-access-notice';dialog.className='course-access-notice';dialog.setAttribute('aria-labelledby','course-access-notice-title');dialog.innerHTML='<h2 id="course-access-notice-title">Course access</h2><p>'+lockedCourseMessage+'</p><button type="button">Close</button>';dialog.querySelector('button').onclick=()=>dialog.close();doc.body.append(dialog);}
 if(!dialog.open)dialog.showModal();return dialog;
}
export function accessBadge(state='required'){
 const value=state==='free'?'Free':['subscribed','open'].includes(state)?'Open':'Locked';
 const icon=value==='Free'?'':`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/>${value==='Open'?'<path d="M8 10V6a4 4 0 0 1 7.8-1.2"/>':'<path d="M8 10V6a4 4 0 0 1 8 0v4"/>'}<path d="M12 14v3"/></svg>`;
 return `<span class="collection-lock access-badge access-${value.toLowerCase()}" aria-label="${esc(value)}">${icon}<span>${value}</span></span>`;
}
