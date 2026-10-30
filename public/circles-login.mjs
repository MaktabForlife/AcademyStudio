import {pinEntry} from './shared/pin-entry.mjs';
import {protectAccountHistory} from './shared/account-history.mjs';
import {circlesDashboard} from './circles-dashboard.mjs';
import {readRemembered,rememberVerified,forgetRemembered} from './shared/remembered-accounts.mjs';
import {circleBlockNavigation} from './shared/circles-block-navigation.mjs';
import {api,identity,changed} from './api.mjs';
import {accessArea,signInFromCircles,openAcademyFromCircles} from './shared/circles-sign-in.mjs';

const labels={general:'Your Academy account',academy:'Islamic Academia',tafseer:'Tafseer and Tadabbur',courses:'Your classrooms',mothers:'Classrooms to nurture minds',hifz:'Ma’had Arwa Hifz Academy',studio:'Studio','arabic-adventures':'Arabic Adventures'};
const dialog=document.createElement('dialog');dialog.id='circles-sign-in';dialog.className='circles-sign-in';dialog.setAttribute('aria-labelledby','circles-sign-in-title');
dialog.innerHTML=`<button type="button" class="circles-sign-in-close" aria-label="Close sign-in">×</button><p class="eyebrow" id="circles-sign-in-area">Your Academy account</p><h2 id="circles-sign-in-title">Ahlan wa Sahlan</h2><p id="circles-sign-in-intro">Log in with your existing Academy account.</p><section id="circles-remembered-accounts" aria-label="Remembered accounts"></section><form id="circles-sign-in-form"><label>Academy account ID<input name="uniqueid" autocomplete="username" maxlength="160" required></label><label>PIN<input name="pin" type="password" inputmode="numeric" autocomplete="off" readonly pattern="[0-9]{4}" maxlength="4" required></label><label id="circles-confirm-pin" hidden>Confirm your Academy PIN<input name="pinConfirmation" type="password" inputmode="numeric" autocomplete="off" readonly pattern="[0-9]{4}" maxlength="4"></label><label class="circles-remember-choice"><input type="checkbox" name="rememberId" checked>Remember my ID on this browser</label><button type="submit" class="btn">Log in</button></form><p id="circles-sign-in-status" role="status" aria-live="polite"></p>`;
document.body.append(dialog);
const element=id=>document.getElementById(id),form=element('circles-sign-in-form'),message=element('circles-sign-in-status'),renderBlocks=circleBlockNavigation(document);
const pins=pinEntry(form);
let config,selected='general',attempt=0,handoff,navigation=null,navRequest=null,homeMessage='',switching=false;
const dashboard=circlesDashboard({onUpdate:refreshHeader,openAcademy});
const storage=()=>{try{return window.localStorage;}catch{return null;}};
function renderRemembered(){
 const host=element('circles-remembered-accounts');host.replaceChildren();const rows=readRemembered(storage(),config?.academyOrigin);if(!rows.length){host.hidden=true;return;}host.hidden=false;
 const title=document.createElement('h3');title.textContent='Choose an account';host.append(title);
 for(const row of rows){const line=document.createElement('div');line.className='circles-remembered-row';const choose=document.createElement('button');choose.type='button';choose.className='circles-remembered-choice';choose.textContent=(row.name?row.name+' · ':'')+row.id;choose.onclick=()=>{form.elements.uniqueid.value=row.id;form.elements.pin.value='';form.elements.pinConfirmation.value='';delete form.dataset.setup;element('circles-confirm-pin').hidden=true;form.elements.pinConfirmation.required=false;message.textContent='';pins.focus();};const forget=document.createElement('button');forget.type='button';forget.className='circles-forget-account';forget.textContent='Forget';forget.setAttribute('aria-label','Forget '+row.id);forget.onclick=()=>{forgetRemembered(storage(),config?.academyOrigin,row.id);renderRemembered();};line.append(choose,forget);host.append(line);}
 const all=document.createElement('button');all.type='button';all.className='circles-forget-account';all.textContent='Forget all remembered IDs';all.onclick=()=>{forgetRemembered(storage(),config?.academyOrigin);renderRemembered();};host.append(all);
}
function showHomeMessage(text){homeMessage=text;refreshHeader();}
function refreshHeader(){
 const brand=document.querySelector('a.academy-brand');if(brand)brand.href='/';
 const skip=document.querySelector('a.skip-link');if(skip)skip.href=location.pathname+location.search+'#experience';
 for(const entry of document.querySelectorAll('[data-access-login]')){
  if(entry.classList.contains('public-login')){const label=identity.account?.displayName||'Log in',badge=identity.account&&(dashboard.adminBadge||(identity.account.globalAdmin?'Global Admin':null)),stamp=JSON.stringify([label,badge]);if(entry.dataset.circlesIdentity!==stamp){entry.replaceChildren(document.createTextNode(label));if(badge){const tag=document.createElement('span');tag.className='circles-admin-badge';tag.textContent=badge;entry.append(tag);}entry.dataset.circlesIdentity=stamp;}}
  entry.href=identity.account?'/#learning-circles':'/?login=1&area='+accessArea(entry.dataset.accessArea);entry.removeAttribute('target');entry.removeAttribute('rel');
  if(identity.account)entry.removeAttribute('aria-haspopup');else entry.setAttribute('aria-haspopup','dialog');
  const switcher=entry.parentElement.querySelector('[data-circles-switch-user]');if(identity.account&&!switcher){const button=document.createElement('button');button.type='button';button.dataset.circlesSwitchUser='';button.className='circles-header-sign-out';button.textContent='Switch user';button.setAttribute('aria-haspopup','dialog');entry.after(button);}else if(!identity.account)switcher?.remove();
  const existing=entry.parentElement.querySelector('[data-circles-sign-out]');
  if(identity.account&&!existing){const signout=document.createElement('button');signout.type='button';signout.className='circles-header-sign-out';signout.dataset.circlesSignOut='';signout.textContent='Sign out';entry.after(signout);}else if(!identity.account)existing?.remove();
 }
 for(const entry of document.querySelectorAll('a[data-action="visitor-access"],a[href="https://ummabbadacademy.com/my-account/"],a[href="/circles/?login=1"],a[href="/?login=1"]')){const area=accessArea(entry.dataset.id);entry.href='/?login=1&area='+area;entry.removeAttribute('target');entry.removeAttribute('rel');if(!entry.dataset.action&&!entry.dataset.programmeKey)entry.dataset.circlesLogin='';}
 renderBlocks(Boolean(identity.account),navigation);dashboard.refresh();
 const home=element('learning-circles');if(home){let status=element('circles-navigation-status');if(!status){status=document.createElement('p');status.id='circles-navigation-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');home.append(status);}if(status.textContent!==homeMessage)status.textContent=homeMessage;status.hidden=!homeMessage;}
}
async function loadNavigation(){
 const generation=identity.generation,accountId=identity.account?.accountId;if(!accountId)return;
 const key=accountId+':'+generation;if(navRequest?.key===key)return navRequest.promise;
 const promise=api('/api/circles/navigation').then(value=>{if(identity.generation===generation&&identity.account?.accountId===accountId){navigation=value;refreshHeader();}}).finally(()=>{if(navRequest?.promise===promise)navRequest=null;});navRequest={key,promise};return promise;
}
const ready=(async()=>{config=await api('/api/config');try{identity.account=await api('/api/me',{optionalSession:true});}catch(error){if(error.status!==401)throw error;}if(identity.account)try{await loadNavigation();}catch{showHomeMessage('Your programme links could not be loaded. Please log in again.');}refreshHeader();if(identity.account)void dashboard.load();})();ready.catch(()=>{});
function returnToCircles(){if(dialog.open)dialog.close();refreshHeader();const card=selected==='general'?element('learning-circles'):document.querySelector(`.hub-panel[data-home-area="${selected}"]`);if(card){if(selected==='general')window.scrollTo({top:0,behavior:'smooth'});else card.scrollIntoView({behavior:'smooth',block:'center'});if(!card.hasAttribute('tabindex'))card.tabIndex=-1;card.focus({preventScroll:true});}}
async function begin(area,{switchUser=false}={}){const opening=++attempt;selected=accessArea(area);message.textContent='';try{await ready;if(opening!==attempt)return;if(identity.account&&!switchUser){returnToCircles();return;}switching=switchUser;form.reset();pins.clear();form.elements.rememberId.checked=true;element('circles-sign-in-title').textContent=switching?'Switch user':'Ahlan wa Sahlan';element('circles-sign-in-intro').textContent=switching?'Choose an account and enter its PIN. This switches all Circles tabs in this browser.':'Log in with your existing Academy account.';form.querySelector('[type=submit]').textContent=switching?'Switch user':'Log in';renderRemembered();element('circles-sign-in-area').textContent=labels[selected];if(!dialog.open)dialog.showModal();}catch{if(!dialog.open)dialog.showModal();message.textContent='Sign-in is temporarily unavailable. Please try again.';}}
dialog.querySelector('.circles-sign-in-close').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>{attempt++;switching=false;form.reset();pins.clear();delete form.dataset.setup;element('circles-confirm-pin').hidden=true;form.elements.pinConfirmation.required=false;message.textContent='';});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!pins.validate())return;const button=form.querySelector('[type="submit"]');if(button.disabled)return;
 const opening=++attempt,loginId=form.elements.uniqueid.value.trim(),remember=form.elements.rememberId.checked,credential=pins.take();button.disabled=true;message.textContent='Signing in…';
 try{
  config||=await api('/api/config');
  const me=await signInFromCircles(api,{uniqueid:loginId,pin:credential.pin,setup:form.dataset.setup==='1',pinConfirmation:credential.pinConfirmation},{current:()=>opening===attempt&&dialog.open,onExchange:()=>changed(null)});
  if(remember)rememberVerified(storage(),config.academyOrigin,{uniqueid:loginId,displayName:me.displayName});else forgetRemembered(storage(),config.academyOrigin,loginId);
  form.reset();pins.clear();delete form.dataset.setup;element('circles-confirm-pin').hidden=true;form.elements.pinConfirmation.required=false;changed(me);showHomeMessage('');
  try{await loadNavigation();}catch(error){if(error.name!=='AbortError')showHomeMessage('You are logged in. Your programme links could not be loaded. Please sign out and try again.');}
  if(opening!==attempt||!dialog.open)return;returnToCircles();
 }catch(error){
  if(opening!==attempt||error.name==='AbortError')return;
  if(error.code==='PIN_NOT_SET'){form.dataset.setup='1';element('circles-confirm-pin').hidden=false;form.elements.pinConfirmation.required=true;message.textContent='Enter your PIN again and confirm it to finish setting up your Academy account.';form.elements.pinConfirmation.focus();}
  else{form.elements.pin.value='';form.elements.pinConfirmation.value='';message.textContent=error.message;}
 }finally{button.disabled=false;}
});
function openAcademy(navigationKey,destination){try{handoff?.close();handoff=openAcademyFromCircles({academyOrigin:config.academyOrigin,request:api,navigation:navigationKey,dashboard:destination,onError:showHomeMessage});}catch(error){showHomeMessage(error.message);}}
async function signOut(button){button.disabled=true;try{await api('/auth/logout',{body:{}});changed(null);showHomeMessage('You are signed out.');}catch(error){showHomeMessage(error.message);}finally{button.disabled=false;}}
// Capture before prototype handlers; the signed-in blocks contain real links.
document.addEventListener('click',event=>{
 if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const switcher=event.target.closest('[data-circles-switch-user]');if(switcher){event.preventDefault();event.stopImmediatePropagation();void begin('general',{switchUser:true});return;}
 const signout=event.target.closest('[data-circles-sign-out]');if(signout){event.preventDefault();event.stopImmediatePropagation();void signOut(signout);return;}
 const programme=event.target.closest('[data-programme-key]');if(programme&&identity.account){event.preventDefault();event.stopImmediatePropagation();openAcademy(programme.dataset.programmeKey);return;}
 const target=event.target.closest('[data-access-login],[data-circles-login],[data-action="visitor-access"],[data-action="dashboard"],[data-action="academy"],[data-action="collection"],[data-action="course"]');if(!target)return;
 if(target.dataset.action==='visitor-access'&&!identity.account)return;
 event.preventDefault();event.stopImmediatePropagation();
 const area=target.hasAttribute('data-access-login')?target.dataset.accessArea:target.dataset.action==='visitor-access'?target.dataset.id:target.dataset.action==='collection'?'courses':['academy','course'].includes(target.dataset.action)?'academy':'general';
 const prototypeDialog=element('detail');if(prototypeDialog?.open)prototypeDialog.close();void begin(area);
},true);
const observer=new MutationObserver(refreshHeader);for(const id of ['experience','detail'])if(element(id))observer.observe(element(id),{childList:true,subtree:true});
function clearAccountNavigation(){handoff?.close();navigation=null;navRequest=null;homeMessage='';dashboard.clear();refreshHeader();if(identity.account)void dashboard.load();}
window.addEventListener('website-session-ended',event=>{clearAccountNavigation();if(event.detail?.externalAccountChange)location.reload();});
window.addEventListener('storage',event=>{if(event.key?.startsWith('m4l_circles_remembered_ids_v1:')&&dialog.open)renderRemembered();});window.addEventListener('website-account-changed',clearAccountNavigation);
protectAccountHistory({window,identity,clear(){observer.disconnect();handoff?.close();attempt++;form.reset();pins.clear();if(dialog.open)dialog.close();navigation=null;navRequest=null;homeMessage='';dashboard.clear();refreshHeader();}});
const entry=window.AcademyCirclesEntry;if(entry?.login)void begin(entry.area);
