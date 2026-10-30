import {circleBlockNavigation} from './shared/circles-block-navigation.mjs';
import {api,identity,changed} from './api.mjs';
import {accessArea,signInFromCircles,openAcademyFromCircles} from './shared/circles-sign-in.mjs';

const labels={general:'Your Academy account',academy:'Islamic Academia',tafseer:'Tafseer and Tadabbur',courses:'Your classrooms',mothers:'Classrooms to nurture minds',hifz:'Ma’had Arwa Hifz Academy',studio:'Studio','arabic-adventures':'Arabic Adventures'};
const dialog=document.createElement('dialog');dialog.id='circles-sign-in';dialog.className='circles-sign-in';dialog.setAttribute('aria-labelledby','circles-sign-in-title');
dialog.innerHTML=`<button type="button" class="circles-sign-in-close" aria-label="Close sign-in">×</button><p class="eyebrow" id="circles-sign-in-area">Your Academy account</p><h2 id="circles-sign-in-title">Ahlan wa Sahlan</h2><p>Log in with your existing Academy account.</p><form id="circles-sign-in-form"><label>Academy account ID<input name="uniqueid" autocomplete="username" maxlength="160" required></label><label>PIN<input name="pin" type="password" inputmode="numeric" autocomplete="current-password" pattern="[0-9]{4}" maxlength="4" required></label><label id="circles-confirm-pin" hidden>Confirm your Academy PIN<input name="pinConfirmation" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{4}" maxlength="4"></label><button type="submit" class="btn">Log in</button></form><p id="circles-sign-in-status" role="status" aria-live="polite"></p>`;
document.body.append(dialog);
const element=id=>document.getElementById(id),form=element('circles-sign-in-form'),message=element('circles-sign-in-status'),renderBlocks=circleBlockNavigation(document);
let config,selected='general',attempt=0,handoff,navigation=null,navRequest=null,homeMessage='';
function showHomeMessage(text){homeMessage=text;refreshHeader();}
function refreshHeader(){
 const brand=document.querySelector('a.academy-brand');if(brand)brand.href='/';
 const skip=document.querySelector('a.skip-link');if(skip)skip.href=location.pathname+location.search+'#experience';
 for(const entry of document.querySelectorAll('[data-access-login]')){
  if(entry.classList.contains('public-login')){const label=identity.account?.displayName||'Log in';if(entry.textContent!==label)entry.textContent=label;}
  entry.href=identity.account?'/#learning-circles':'/?login=1&area='+accessArea(entry.dataset.accessArea);entry.removeAttribute('target');entry.removeAttribute('rel');
  if(identity.account)entry.removeAttribute('aria-haspopup');else entry.setAttribute('aria-haspopup','dialog');
  const existing=entry.parentElement.querySelector('[data-circles-sign-out]');
  if(identity.account&&!existing){const signout=document.createElement('button');signout.type='button';signout.className='circles-header-sign-out';signout.dataset.circlesSignOut='';signout.textContent='Sign out';entry.after(signout);}else if(!identity.account)existing?.remove();
 }
 for(const entry of document.querySelectorAll('a[data-action="visitor-access"],a[href="https://ummabbadacademy.com/my-account/"],a[href="/circles/?login=1"],a[href="/?login=1"]')){const area=accessArea(entry.dataset.id);entry.href='/?login=1&area='+area;entry.removeAttribute('target');entry.removeAttribute('rel');if(!entry.dataset.action&&!entry.dataset.programmeKey)entry.dataset.circlesLogin='';}
 renderBlocks(Boolean(identity.account),navigation);
 const home=element('learning-circles');if(home){let status=element('circles-navigation-status');if(!status){status=document.createElement('p');status.id='circles-navigation-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');home.append(status);}if(status.textContent!==homeMessage)status.textContent=homeMessage;status.hidden=!homeMessage;}
}
async function loadNavigation(){
 const generation=identity.generation,accountId=identity.account?.accountId;if(!accountId)return;
 const key=accountId+':'+generation;if(navRequest?.key===key)return navRequest.promise;
 const promise=api('/api/circles/navigation').then(value=>{if(identity.generation===generation&&identity.account?.accountId===accountId){navigation=value;refreshHeader();}}).finally(()=>{if(navRequest?.promise===promise)navRequest=null;});navRequest={key,promise};return promise;
}
const ready=(async()=>{config=await api('/api/config');try{identity.account=await api('/api/me',{optionalSession:true});}catch(error){if(error.status!==401)throw error;}if(identity.account)try{await loadNavigation();}catch{showHomeMessage('Your programme links could not be loaded. Please log in again.');}refreshHeader();})();ready.catch(()=>{});
function returnToCircles(){if(dialog.open)dialog.close();refreshHeader();const card=selected==='general'?element('learning-circles'):document.querySelector(`.hub-panel[data-home-area="${selected}"]`);if(card){card.scrollIntoView({behavior:'smooth',block:'center'});if(!card.hasAttribute('tabindex'))card.tabIndex=-1;card.focus({preventScroll:true});}}
async function begin(area){const opening=++attempt;selected=accessArea(area);message.textContent='';try{await ready;if(opening!==attempt)return;if(identity.account){returnToCircles();return;}element('circles-sign-in-area').textContent=labels[selected];if(!dialog.open)dialog.showModal();}catch{if(!dialog.open)dialog.showModal();message.textContent='Sign-in is temporarily unavailable. Please try again.';}}
dialog.querySelector('.circles-sign-in-close').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>{attempt++;form.reset();delete form.dataset.setup;element('circles-confirm-pin').hidden=true;form.elements.pinConfirmation.required=false;message.textContent='';});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!form.reportValidity())return;const button=form.querySelector('[type="submit"]');if(button.disabled)return;
 const opening=++attempt;button.disabled=true;message.textContent='Signing in…';
 try{
  config||=await api('/api/config');
  const me=await signInFromCircles(api,{uniqueid:form.elements.uniqueid.value.trim(),pin:form.elements.pin.value,setup:form.dataset.setup==='1',pinConfirmation:form.elements.pinConfirmation.value},{current:()=>opening===attempt&&dialog.open});
  form.reset();delete form.dataset.setup;element('circles-confirm-pin').hidden=true;form.elements.pinConfirmation.required=false;changed(me);showHomeMessage('');
  try{await loadNavigation();}catch(error){if(error.name!=='AbortError')showHomeMessage('You are logged in. Your programme links could not be loaded. Please sign out and try again.');}
  if(opening!==attempt||!dialog.open)return;returnToCircles();
 }catch(error){
  if(opening!==attempt||error.name==='AbortError')return;
  if(error.code==='PIN_NOT_SET'){form.dataset.setup='1';element('circles-confirm-pin').hidden=false;form.elements.pinConfirmation.required=true;message.textContent='Confirm your PIN to finish setting up your Academy account.';form.elements.pinConfirmation.focus();}
  else{form.elements.pin.value='';form.elements.pinConfirmation.value='';message.textContent=error.message;}
 }finally{button.disabled=false;}
});
function openAcademy(navigationKey){try{handoff?.close();handoff=openAcademyFromCircles({academyOrigin:config.academyOrigin,request:api,navigation:navigationKey,onError:showHomeMessage});}catch(error){showHomeMessage(error.message);}}
async function signOut(button){button.disabled=true;try{await api('/auth/logout',{body:{}});changed(null);showHomeMessage('You are signed out.');}catch(error){showHomeMessage(error.message);}finally{button.disabled=false;}}
// Capture before prototype handlers; the signed-in blocks contain real links.
document.addEventListener('click',event=>{
 if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const signout=event.target.closest('[data-circles-sign-out]');if(signout){event.preventDefault();event.stopImmediatePropagation();void signOut(signout);return;}
 const programme=event.target.closest('[data-programme-key]');if(programme&&identity.account){event.preventDefault();event.stopImmediatePropagation();openAcademy(programme.dataset.programmeKey);return;}
 const target=event.target.closest('[data-access-login],[data-circles-login],[data-action="visitor-access"],[data-action="dashboard"],[data-action="academy"],[data-action="collection"],[data-action="course"]');if(!target)return;
 if(target.dataset.action==='visitor-access'&&!identity.account)return;
 event.preventDefault();event.stopImmediatePropagation();
 const area=target.hasAttribute('data-access-login')?target.dataset.accessArea:target.dataset.action==='visitor-access'?target.dataset.id:target.dataset.action==='collection'?'courses':['academy','course'].includes(target.dataset.action)?'academy':'general';
 const prototypeDialog=element('detail');if(prototypeDialog?.open)prototypeDialog.close();void begin(area);
},true);
const observer=new MutationObserver(refreshHeader);for(const id of ['experience','detail'])if(element(id))observer.observe(element(id),{childList:true,subtree:true});
function clearAccountNavigation(){handoff?.close();navigation=null;navRequest=null;homeMessage='';refreshHeader();}
window.addEventListener('website-session-ended',clearAccountNavigation);window.addEventListener('website-account-changed',clearAccountNavigation);
window.addEventListener('pagehide',()=>{handoff?.close();observer.disconnect();});
const entry=window.AcademyCirclesEntry;if(entry?.login)void begin(entry.area);
