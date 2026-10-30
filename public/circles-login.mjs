import {api,identity,changed} from './api.mjs';
import {accessArea,learningDestination,signInFromCircles,openAcademyFromCircles} from './shared/circles-sign-in.mjs';

const labels={general:'Your Academy account',academy:'Islamic Academia',tafseer:'Tafseer',courses:'Continuous learning',mothers:'Mothers of the Ummah',hifz:'Ma’had Arwa Hifz Academy',studio:'Studio'};
const dialog=document.createElement('dialog');dialog.id='circles-sign-in';dialog.className='circles-sign-in';dialog.setAttribute('aria-labelledby','circles-sign-in-title');
dialog.innerHTML=`<button type="button" class="circles-sign-in-close" aria-label="Close sign-in">×</button><p class="eyebrow" id="circles-sign-in-area">Your Academy account</p><h2 id="circles-sign-in-title">Ahlan wa Sahlan</h2><div id="circles-login-fields"><p>Log in with your existing Academy account.</p><form id="circles-sign-in-form"><label>Academy account ID<input name="uniqueid" autocomplete="username" maxlength="160" required></label><label>PIN<input name="pin" type="password" inputmode="numeric" autocomplete="current-password" pattern="[0-9]{4}" maxlength="4" required></label><label id="circles-confirm-pin" hidden>Confirm your Academy PIN<input name="pinConfirmation" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{4}" maxlength="4"></label><button type="submit" class="btn">Log in</button></form></div><div id="circles-account-links" hidden><p id="circles-account-greeting"></p><p id="circles-account-next"></p><nav aria-label="Your account"><button type="button" class="btn" id="circles-open-academy">Open Academy</button><a class="btn outline" href="/?view=collections">My learning</a><a class="btn outline" href="/?manage=1">Open Studio</a><button type="button" class="text-button" id="circles-sign-out">Sign out</button></nav></div><p id="circles-sign-in-status" role="status" aria-live="polite"></p>`;
document.body.append(dialog);
const element=id=>document.getElementById(id),form=element('circles-sign-in-form'),message=element('circles-sign-in-status');let config,selected='general',attempt=0,handoff;
const ready=(async()=>{config=await api('/api/config');try{identity.account=await api('/api/me',{optionalSession:true});}catch(error){if(error.status!==401)throw error;}refreshHeader();})();
ready.catch(()=>{});
function refreshHeader(){
 for(const entry of document.querySelectorAll('[data-access-login]')){if(entry.classList.contains('public-login')){const label=identity.account?.displayName||'Log in';if(entry.textContent!==label)entry.textContent=label;}entry.href='/circles/?login=1&area='+accessArea(entry.dataset.accessArea);entry.removeAttribute('target');entry.removeAttribute('rel');entry.setAttribute('aria-haspopup','dialog');}
 for(const entry of document.querySelectorAll('a[data-action="visitor-access"],a[href="https://ummabbadacademy.com/my-account/"],a[href="/circles/?login=1"]')){const area=accessArea(entry.dataset.id);entry.href='/circles/?login=1&area='+area;entry.removeAttribute('target');entry.removeAttribute('rel');if(!entry.dataset.action)entry.dataset.circlesLogin='';}
}
function accountView(){
 const signedIn=Boolean(identity.account);element('circles-login-fields').hidden=signedIn;element('circles-account-links').hidden=!signedIn;
 element('circles-sign-in-title').textContent=signedIn?'Welcome back':'Ahlan wa Sahlan';element('circles-sign-in-area').textContent=labels[selected];
 element('circles-account-greeting').textContent=signedIn?'Assalaamu alaykum, '+identity.account.displayName+'.':'';
 element('circles-account-next').textContent=['academy','mothers','hifz'].includes(selected)?'Continue to Academy to open your programmes.':'Choose where you would like to continue.';
 refreshHeader();
}
async function begin(area){selected=accessArea(area);message.textContent='';try{await ready;const destination=identity.account&&learningDestination(selected);if(destination){location.assign(destination);return;}accountView();if(!dialog.open)dialog.showModal();}catch{accountView();if(!dialog.open)dialog.showModal();message.textContent='Sign-in is temporarily unavailable. Please try again.';}}
const close=()=>dialog.close();dialog.querySelector('.circles-sign-in-close').onclick=close;
dialog.addEventListener('close',()=>{attempt++;form.reset();delete form.dataset.setup;element('circles-confirm-pin').hidden=true;form.elements.pinConfirmation.required=false;message.textContent='';});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!form.reportValidity())return;const button=form.querySelector('[type="submit"]');if(button.disabled)return;
 const opening=++attempt;button.disabled=true;message.textContent='Signing in…';
 try{
  config||=await api('/api/config');
  const me=await signInFromCircles(api,{uniqueid:form.elements.uniqueid.value.trim(),pin:form.elements.pin.value,setup:form.dataset.setup==='1',pinConfirmation:form.elements.pinConfirmation.value},{current:()=>opening===attempt&&dialog.open});
  changed(me);form.reset();delete form.dataset.setup;element('circles-confirm-pin').hidden=true;form.elements.pinConfirmation.required=false;message.textContent='';accountView();
  const destination=learningDestination(selected);if(destination)location.assign(destination);
 }catch(error){
  if(opening!==attempt||error.name==='AbortError')return;
  if(error.code==='PIN_NOT_SET'){form.dataset.setup='1';element('circles-confirm-pin').hidden=false;form.elements.pinConfirmation.required=true;message.textContent='Confirm your PIN to finish setting up your Academy account.';form.elements.pinConfirmation.focus();}
  else {form.elements.pin.value='';form.elements.pinConfirmation.value='';message.textContent=error.message;}
 }finally{button.disabled=false;}
});
element('circles-open-academy').onclick=()=>{try{handoff?.close();handoff=openAcademyFromCircles({academyOrigin:config.academyOrigin,request:api,onError:text=>message.textContent=text});}catch(error){message.textContent=error.message;}};
element('circles-sign-out').onclick=async()=>{const button=element('circles-sign-out');button.disabled=true;try{await api('/auth/logout',{body:{}});changed(null);accountView();message.textContent='You are signed out of this website.';}catch(error){message.textContent=error.message;}finally{button.disabled=false;}};
// Capture before prototype handlers: a design choice never grants or simulates
// membership. Public learning, enquiries and homepage navigation stay intact.
document.addEventListener('click',event=>{
 const target=event.target.closest('[data-access-login],[data-circles-login],[data-action="visitor-access"],[data-action="dashboard"],[data-action="academy"],[data-action="collection"],[data-action="course"]');
 if(!target||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 if(target.dataset.action==='visitor-access'&&!identity.account)return;
 event.preventDefault();event.stopImmediatePropagation();
 const area=target.hasAttribute('data-access-login')?target.dataset.accessArea:target.dataset.action==='visitor-access'?target.dataset.id:['collection'].includes(target.dataset.action)?'courses':['academy','course'].includes(target.dataset.action)?'academy':'general';
 const prototypeDialog=element('detail');if(prototypeDialog?.open)prototypeDialog.close();void begin(area);
},true);
const observer=new MutationObserver(refreshHeader);observer.observe(element('experience'),{childList:true,subtree:true});
observer.observe(element('detail'),{childList:true,subtree:true});
window.addEventListener('website-session-ended',()=>{handoff?.close();accountView();});
window.addEventListener('website-account-changed',accountView);
window.addEventListener('pagehide',()=>{handoff?.close();observer.disconnect();});
const entry=window.AcademyCirclesEntry;if(entry?.login)void begin(entry.area);
