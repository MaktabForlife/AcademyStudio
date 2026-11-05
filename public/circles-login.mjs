import {installPageHistory} from './shared/page-history.mjs';
import {pinEntry} from './shared/pin-entry.mjs';
import {protectAccountHistory} from './shared/account-history.mjs';
import {circlesDashboard} from './circles-dashboard.mjs';
import {headerIcon} from './shared/header-icons.mjs';
import {installHeaderDates} from './shared/header-dates.mjs';
import {readRemembered,rememberVerified,forgetRemembered} from './shared/remembered-accounts.mjs';
import {circleBlockNavigation,dashboardProgrammeChoice} from './shared/circles-block-navigation.mjs?v=workspace-separation-1';
import {publicHome} from './shared/public-home.mjs';
import {circlesCourseRow} from './shared/circles-course-row.mjs';
import {mountTafseerRail} from './shared/circles-tafseer-row.mjs';
import {dashboardTafseerData} from './shared/dashboard-tafseer-data.mjs';
import {api,identity,changed} from './api.mjs';
import {takeDashboardBootstrap} from './shared/dashboard-bootstrap.mjs';
import {dashboardWorkspace,dashboardHomeHref,readDashboardView,rememberDashboardView,clearDashboardView,dashboardViewStorage} from './shared/dashboard-home.mjs';
import {accessArea,signInFromCircles,openAcademyFromCircles} from './shared/circles-sign-in.mjs';

const labels={general:'Your Academy account',academy:'Islamic Academia',tafseer:'Tafseer and Tadabbur',courses:'Your classrooms',mothers:'Mothers of the Ummah',hifz:'Ma’had Arwa Hifz Academy',studio:'Studio','arabic-adventures':'Arabic Adventures'};
const dialog=document.createElement('dialog');dialog.id='circles-sign-in';dialog.className='circles-sign-in';dialog.setAttribute('aria-labelledby','circles-sign-in-title');
dialog.innerHTML=`<button type="button" class="circles-sign-in-close" aria-label="Close sign-in">×</button><p class="eyebrow" id="circles-sign-in-area">Your Academy account</p><h2 id="circles-sign-in-title">Ahlan wa Sahlan</h2><p id="circles-sign-in-intro">Log in with your existing Academy account.</p><section id="circles-remembered-accounts" aria-label="Remembered accounts"></section><form id="circles-sign-in-form"><label>Academy account ID<input name="uniqueid" autocomplete="username" maxlength="160" required></label><label>PIN<input name="pin" type="password" inputmode="numeric" autocomplete="off" readonly pattern="[0-9]{4}" maxlength="4" required></label><label id="circles-confirm-pin" hidden>Confirm your Academy PIN<input name="pinConfirmation" type="password" inputmode="numeric" autocomplete="off" readonly pattern="[0-9]{4}" maxlength="4"></label><label class="circles-remember-choice"><input type="checkbox" name="rememberId" checked>Remember my ID on this browser</label><button type="submit" class="btn">Log in</button></form><p id="circles-sign-in-status" role="status" aria-live="polite"></p>`;
document.body.append(dialog);
const element=id=>document.getElementById(id),form=element('circles-sign-in-form'),message=element('circles-sign-in-status'),renderBlocks=circleBlockNavigation(document),renderCourses=circlesCourseRow(document),refinePublicHome=publicHome(document);
const pins=pinEntry(form),pageHistory=installPageHistory();let historyReady=false;
installHeaderDates();
const initialEntry=window.AcademyCirclesEntry||{},initialWorkspace=initialEntry.workspace||new URLSearchParams(location.search).get('workspace');
let config,selected='general',attempt=0,handoff,navigation=null,navRequest=null,homeMessage='',switching=false,refreshing=false,publicView=initialEntry.public||new URLSearchParams(location.search).get('public')==='1';
{const url=new URL(location.href);if(publicView)url.searchParams.set('public','1');if(['learn','teach','admin'].includes(initialWorkspace))url.searchParams.set('workspace',initialWorkspace);history.replaceState(null,'',url);}
const dashboard=circlesDashboard({getNavigation:()=>navigation,onUpdate:refreshHeader,openAcademy,show:()=>!publicView,onWorkspace:()=>setPublicView(false)});
const tafseerRail=dashboardTafseerData({api,identity,view:mountTafseerRail(document)});
const storage=()=>{try{return window.localStorage;}catch{return null;}};
function renderRemembered(){
 const host=element('circles-remembered-accounts');host.replaceChildren();const rows=readRemembered(storage(),config?.academyOrigin);if(!rows.length){host.hidden=true;return;}host.hidden=false;
 const title=document.createElement('h3');title.textContent='Choose an account';host.append(title);
 for(const row of rows){const line=document.createElement('div');line.className='circles-remembered-row';const choose=document.createElement('button');choose.type='button';choose.className='circles-remembered-choice';choose.textContent=(row.name?row.name+' · ':'')+row.id;choose.onclick=()=>{form.elements.uniqueid.value=row.id;form.elements.pin.value='';form.elements.pinConfirmation.value='';delete form.dataset.setup;element('circles-confirm-pin').hidden=true;form.elements.pinConfirmation.required=false;message.textContent='';pins.focus();};const forget=document.createElement('button');forget.type='button';forget.className='circles-forget-account';forget.textContent='Forget';forget.setAttribute('aria-label','Forget '+row.id);forget.onclick=()=>{forgetRemembered(storage(),config?.academyOrigin,row.id);renderRemembered();};line.append(choose,forget);host.append(line);}
 const all=document.createElement('button');all.type='button';all.className='circles-forget-account';all.textContent='Forget all remembered IDs';all.onclick=()=>{forgetRemembered(storage(),config?.academyOrigin);renderRemembered();};host.append(all);
}
function showHomeMessage(text){homeMessage=text;dashboard.message?.(text);refreshHeader();}
function refreshHeader(){
 if(historyReady)pageHistory.update(identity.account);
 if(identity.account&&dashboard.data?.mode){rememberDashboardView(dashboardViewStorage(),identity.account.accountId,dashboard.data.mode);const url=new URL(location.href);if(url.searchParams.get('workspace')!==dashboard.data.mode){url.searchParams.set('workspace',dashboard.data.mode);history.replaceState(null,'',url);}}
 const brand=document.querySelector('a.academy-brand');if(brand)brand.href=publicView?'/?public=1':identity.account?dashboardHomeHref(dashboard.mode):'/';
 const release=document.querySelector('meta[name="academy-release-version"]')?.content,brandCopy=brand?.querySelector('.brand-copy');
 if(release&&brandCopy){let label=brandCopy.querySelector('.circles-release-version');if(!label){label=document.createElement('span');label.className='circles-release-version';brandCopy.append(label);}if(label.textContent!=='V'+release)label.textContent='V'+release;}
 const skip=document.querySelector('a.skip-link');if(skip)skip.href=location.pathname+location.search+'#experience';
 for(let entry of document.querySelectorAll('[data-access-login]')){
  const accountEntry=entry.classList.contains('public-login');
  if(accountEntry){
   const tag=identity.account?'BUTTON':'A';if(entry.tagName!==tag){const next=document.createElement(tag);for(const attr of entry.attributes)next.setAttribute(attr.name,attr.value);next.innerHTML=entry.innerHTML;entry.replaceWith(next);entry=next;}
   const label=identity.account?.displayName||'Log in',badge=identity.account&&(dashboard.adminBadge||(identity.account.globalAdmin?'Global Admin':null)),stamp=JSON.stringify([label,badge]);
   if(entry.dataset.circlesIdentity!==stamp){entry.textContent=label;entry.dataset.circlesAccountRole=badge||'';entry.setAttribute('aria-label',label+(badge?' · '+badge:''));entry.title=badge||'';entry.dataset.circlesIdentity=stamp;}
   if(identity.account){entry.type='button';entry.setAttribute('aria-controls','circles-account-menu');if(!entry.hasAttribute('aria-expanded'))entry.setAttribute('aria-expanded','false');}
   else{entry.removeAttribute('type');entry.removeAttribute('aria-controls');entry.removeAttribute('aria-expanded');}
  }
  entry.href=identity.account?'/#learning-circles':'/?login=1&area='+accessArea(entry.dataset.accessArea);entry.removeAttribute('target');entry.removeAttribute('rel');
  if(identity.account)entry.removeAttribute('aria-haspopup');else entry.setAttribute('aria-haspopup','dialog');
  if(accountEntry){
   let menu=entry.parentElement.querySelector('.circles-account-menu');
   if(identity.account&&!menu){menu=document.createElement('nav');menu.id='circles-account-menu';menu.className='circles-account-menu';menu.setAttribute('aria-label','Account menu');menu.hidden=true;menu.innerHTML='<button type="button" data-circles-switch-user aria-haspopup="dialog">Switch user</button><a href="/?public=1" data-circles-visit-website>Visit website</a>';entry.parentElement.append(menu);}else if(!identity.account)menu?.remove();
   let home=entry.parentElement.querySelector('[data-circles-home]');if(identity.account&&!home){home=document.createElement('button');home.type='button';home.dataset.circlesHome='';home.className='circles-header-home';home.innerHTML=headerIcon('home');home.title='Home · Return to your dashboard';home.setAttribute('aria-label','Return to your dashboard');entry.after(home);}else if(!identity.account)home?.remove();
   let refresh=entry.parentElement.querySelector('[data-circles-refresh]');if(identity.account&&!refresh){refresh=document.createElement('button');refresh.type='button';refresh.dataset.circlesRefresh='';refresh.className='circles-header-refresh';refresh.innerHTML=headerIcon('refresh');entry.after(refresh);}else if(!identity.account)refresh?.remove();if(refresh){refresh.disabled=refreshing;refresh.classList.toggle('is-refreshing',refreshing);refresh.title=refreshing?'Refreshing…':'Refresh homepage and dashboard';refresh.setAttribute('aria-label','Refresh homepage and dashboard');}
  }
  const existing=entry.parentElement.querySelector('[data-circles-sign-out]');
  if(identity.account&&!existing){const signout=document.createElement('button');signout.type='button';signout.className='circles-header-sign-out';signout.dataset.circlesSignOut='';signout.innerHTML=headerIcon('signout');signout.title='Sign out';signout.setAttribute('aria-label','Sign out');entry.after(signout);}else if(!identity.account)existing?.remove();
 }
 for(const entry of document.querySelectorAll('a[data-action="visitor-access"],a[href="https://ummabbadacademy.com/my-account/"],a[href="/circles/?login=1"],a[href="/?login=1"]')){const area=accessArea(entry.dataset.id);entry.href='/?login=1&area='+area;entry.removeAttribute('target');entry.removeAttribute('rel');if(!entry.dataset.action&&!entry.dataset.programmeKey)entry.dataset.circlesLogin='';}
 refinePublicHome();renderBlocks(Boolean(identity.account)&&!publicView,navigation);renderCourses(Boolean(identity.account)&&!publicView,navigation,dashboard.mode);dashboard.refresh();void tafseerRail.update(Boolean(identity.account)&&!publicView&&Boolean(navigation));
 const home=element('learning-circles');if(home){let status=element('circles-navigation-status');if(!status){status=document.createElement('p');status.id='circles-navigation-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');home.append(status);}if(status.textContent!==homeMessage)status.textContent=homeMessage;status.hidden=!homeMessage;}
}
function closeAccountMenu({focus=false}={}){for(const menu of document.querySelectorAll('.circles-account-menu')){menu.hidden=true;const account=menu.parentElement.querySelector('.public-login');account?.setAttribute('aria-expanded','false');if(focus)account?.focus();}}
function setPublicView(value){publicView=value;const url=new URL(location.href);if(value)url.searchParams.set('public','1');else url.searchParams.delete('public');history.replaceState(null,'',url);closeAccountMenu();refreshHeader();if(value)window.scrollTo({top:0,behavior:'smooth'});}
async function refreshHomepage(){if(refreshing)return;refreshing=true;closeAccountMenu();refreshHeader();try{await Promise.all([loadNavigation(),dashboard.load(dashboard.mode,true),tafseerRail.refresh()]);showHomeMessage('');}catch(error){showHomeMessage(error.message||'Your homepage could not be refreshed.');}finally{refreshing=false;refreshHeader();}}
async function loadNavigation(){
 const generation=identity.generation,accountId=identity.account?.accountId;if(!accountId)return;
 const key=accountId+':'+generation;if(navRequest?.key===key)return navRequest.promise;
 const promise=api('/api/circles/navigation').then(value=>{if(identity.generation===generation&&identity.account?.accountId===accountId){navigation=value;refreshHeader();}}).finally(()=>{if(navRequest?.promise===promise)navRequest=null;});navRequest={key,promise};return promise;
}
const ready=(async()=>{
 const boot=await takeDashboardBootstrap(initialWorkspace).catch(error=>{if(error.status!==401)throw error;return null;});
 config=boot?.configuration||await api('/api/config');identity.account=boot?.account||null;if(identity.account&&window.M4L_V110)await window.M4L_V110.reveal(identity.account.accountId);
 if(boot){navigation=boot.navigation;if(boot.errors?.navigation)showHomeMessage('Your programme links could not be loaded. Please try Refresh.');refreshHeader();await dashboard.load(boot.dashboard?.mode||dashboardWorkspace(initialWorkspace)||undefined,false,boot.dashboard?.selectedDate,boot.dashboard,boot.errors?.dashboard);}
 else{clearDashboardView(dashboardViewStorage());refreshHeader();}
 window.AcademyCirclesHomeEntry?.complete();
})();ready.then(()=>{historyReady=true;pageHistory.update(identity.account);}).catch(()=>window.AcademyCirclesHomeEntry?.fail());
function returnToCircles(){if(dialog.open)dialog.close();refreshHeader();const card=selected==='general'?element('learning-circles'):document.querySelector(`.hub-panel[data-home-area="${selected}"]`);if(card){if(selected==='general')window.scrollTo({top:0,behavior:'smooth'});else card.scrollIntoView({behavior:'smooth',block:'center'});if(!card.hasAttribute('tabindex'))card.tabIndex=-1;card.focus({preventScroll:true});}}
async function begin(area,{switchUser=false}={}){const opening=++attempt;selected=accessArea(area);message.textContent='';try{await ready;if(opening!==attempt)return;if(identity.account&&!switchUser){if(publicView)setPublicView(false);returnToCircles();return;}switching=switchUser;form.reset();pins.clear();form.elements.rememberId.checked=true;element('circles-sign-in-title').textContent=switching?'Switch user':'Ahlan wa Sahlan';element('circles-sign-in-intro').textContent=switching?'Choose an account and enter its PIN. This switches all Circles tabs in this browser.':'Log in with your existing Academy account.';form.querySelector('[type=submit]').textContent=switching?'Switch user':'Log in';renderRemembered();element('circles-sign-in-area').textContent=labels[selected];if(!dialog.open)dialog.showModal();}catch{if(!dialog.open)dialog.showModal();message.textContent='Sign-in is temporarily unavailable. Please try again.';}}
dialog.querySelector('.circles-sign-in-close').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>{attempt++;switching=false;form.reset();pins.clear();delete form.dataset.setup;element('circles-confirm-pin').hidden=true;form.elements.pinConfirmation.required=false;message.textContent='';});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!pins.validate())return;const button=form.querySelector('[type="submit"]');if(button.disabled)return;
 const opening=++attempt,loginId=form.elements.uniqueid.value.trim(),remember=form.elements.rememberId.checked,credential=pins.take();button.disabled=true;message.textContent='Signing in…';
 try{
  config||=await api('/api/config');
  const boot=await signInFromCircles(api,{uniqueid:loginId,pin:credential.pin,setup:form.dataset.setup==='1',pinConfirmation:credential.pinConfirmation},{current:()=>opening===attempt&&dialog.open,onExchange:()=>changed(null),bootstrap:true});
  const me=boot.account;
  if(remember)rememberVerified(storage(),config.academyOrigin,{uniqueid:loginId,displayName:me.displayName});else forgetRemembered(storage(),config.academyOrigin,loginId);
  form.reset();pins.clear();delete form.dataset.setup;element('circles-confirm-pin').hidden=true;form.elements.pinConfirmation.required=false;nextAccountBootstrap=boot;changed(me);showHomeMessage(boot.errors?.navigation?'Your programme links could not be loaded. Please try Refresh.':'');
  if(opening!==attempt||!dialog.open)return;returnToCircles();
 }catch(error){
  if(opening!==attempt||error.name==='AbortError')return;
  if(error.code==='PIN_NOT_SET'){form.dataset.setup='1';element('circles-confirm-pin').hidden=false;form.elements.pinConfirmation.required=true;message.textContent='Enter your PIN again and confirm it to finish setting up your Academy account.';form.elements.pinConfirmation.focus();}
  else{form.elements.pin.value='';form.elements.pinConfirmation.value='';message.textContent=error.message;}
 }finally{button.disabled=false;}
});
function openAcademy(navigationKey,destination){try{handoff?.close();const accountId=identity.account?.accountId,generation=identity.generation;handoff=openAcademyFromCircles({academyOrigin:config.academyOrigin,request:api,navigation:navigationKey,dashboard:destination,onError:showHomeMessage,onReturn:mode=>{
 // Reuse only this still-open, same-account dashboard. This restores a view,
 // never authority: the existing Join, media and Admin gates remain current.
 if(!accountId||identity.account?.accountId!==accountId||identity.generation!==generation||dashboard.mode!==mode||!dashboard.data||!Number.isFinite(dashboard.data.checkedAt)||Date.now()<dashboard.data.checkedAt||Date.now()-dashboard.data.checkedAt>=43200_000)return false;
 setPublicView(false);window.focus();return true;
}});}catch(error){showHomeMessage(error.message);}}
async function signOut(button){button.disabled=true;const clearing=window.M4L_V110?.clearAll('logout').catch(()=>{});try{await api('/auth/logout',{body:{}});changed(null);showHomeMessage('You are signed out.');}catch(error){showHomeMessage(error.message);}finally{await clearing;button.disabled=false;}}
// Capture before prototype handlers; the signed-in blocks contain real links.
document.addEventListener('click',event=>{
 if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const account=event.target.closest('.public-login[data-access-login]');if(account&&identity.account){event.preventDefault();event.stopImmediatePropagation();const menu=account.parentElement.querySelector('.circles-account-menu');if(menu){menu.hidden=!menu.hidden;account.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)menu.querySelector('button')?.focus();}return;}
 if(!event.target.closest('.circles-account-menu'))closeAccountMenu();
 const switcher=event.target.closest('[data-circles-switch-user]');if(switcher){event.preventDefault();event.stopImmediatePropagation();closeAccountMenu();void begin('general',{switchUser:true});return;}
 const website=event.target.closest('[data-circles-visit-website]');if(website){event.preventDefault();event.stopImmediatePropagation();setPublicView(true);return;}
 if(event.target.closest('[data-circles-refresh]')){event.preventDefault();event.stopImmediatePropagation();void refreshHomepage();return;}
 if(event.target.closest('[data-circles-home]')){event.preventDefault();event.stopImmediatePropagation();setPublicView(false);window.scrollTo({top:0,behavior:'smooth'});return;}
 const signout=event.target.closest('[data-circles-sign-out]');if(signout){event.preventDefault();event.stopImmediatePropagation();void signOut(signout);return;}
 const programme=event.target.closest('[data-programme-key]');if(programme&&identity.account){event.preventDefault();event.stopImmediatePropagation();if(programme.dataset.programmeKey==='hifz'){openAcademy('hifz');return;}try{openAcademy(null,dashboardProgrammeChoice(programme.dataset.programmeKey,dashboard.mode,dashboard.data));}catch(error){showHomeMessage(error.message);}return;}
 const target=event.target.closest('[data-access-login],[data-circles-login],[data-action="visitor-access"],[data-action="dashboard"],[data-action="academy"],[data-action="collection"],[data-action="course"]');if(!target)return;
 if(target.dataset.action==='visitor-access'&&!identity.account)return;
 event.preventDefault();event.stopImmediatePropagation();
 const area=target.hasAttribute('data-access-login')?target.dataset.accessArea:target.dataset.action==='visitor-access'?target.dataset.id:target.dataset.action==='collection'?'courses':['academy','course'].includes(target.dataset.action)?'academy':'general';
 const prototypeDialog=element('detail');if(prototypeDialog?.open)prototypeDialog.close();void begin(area);
},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.querySelector('.circles-account-menu:not([hidden])')){event.preventDefault();closeAccountMenu({focus:true});}});
const observer=new MutationObserver(refreshHeader);for(const id of ['experience','detail'])if(element(id))observer.observe(element(id),{childList:true,subtree:true});
let nextAccountBootstrap=null;
function clearAccountNavigation(){const boot=nextAccountBootstrap;nextAccountBootstrap=null;handoff?.close();navigation=null;navRequest=null;homeMessage='';clearDashboardView(dashboardViewStorage());const url=new URL(location.href);url.searchParams.delete('workspace');history.replaceState(null,'',url);dashboard.clear();if(boot&&identity.account?.accountId===boot.account?.accountId){navigation=boot.navigation;config=boot.configuration;refreshHeader();void dashboard.load(boot.dashboard?.mode,false,boot.dashboard?.selectedDate,boot.dashboard,boot.errors?.dashboard);}else{refreshHeader();if(identity.account)void dashboard.load();}}
window.addEventListener('website-session-ended',event=>{clearAccountNavigation();if(event.detail?.externalAccountChange)location.reload();});
window.addEventListener('storage',event=>{if(event.key?.startsWith('m4l_circles_remembered_ids_v1:')&&dialog.open)renderRemembered();});window.addEventListener('website-account-changed',clearAccountNavigation);
protectAccountHistory({window,identity,clear(){observer.disconnect();tafseerRail.clear();handoff?.close();attempt++;form.reset();pins.clear();if(dialog.open)dialog.close();navigation=null;navRequest=null;homeMessage='';dashboard.clear();refreshHeader();}});
const entry=window.AcademyCirclesEntry;if(entry?.login)void begin(entry.area,{switchUser:new URLSearchParams(location.search).get('switch')==='1'});
