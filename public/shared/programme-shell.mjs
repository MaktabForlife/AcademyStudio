import {installPageHistory} from './page-history.mjs';
import {headerIcon} from './header-icons.mjs';
import {dashboardHomeHref,updateDashboardHomeLinks} from './dashboard-home.mjs';

// One presentation shell for the existing learning pages. Move the native
// controls rather than replacing their sign-in, refresh, Home or sign-out code.
export function installProgrammeShell({document=globalThis.document,window=globalThis.window,canLeave=()=>true,checkAdministration=async()=>false}={}){
 const header=document.querySelector('.site-header');
 if(!header)return {update(){}};
 document.body.classList.add('circles-programme-page');
 if(!document.querySelector('link[href="/shared/programme-shell.css"]')){const style=document.createElement('link');style.rel='stylesheet';style.href='/shared/programme-shell.css';document.head.append(style);}
 const node=(tag,className)=>{const value=document.createElement(tag);value.className=className;return value;};
 const brand=header.querySelector('.brand'),dates=header.querySelector('.circles-header-dates'),controls=header.querySelector('.account-controls');
 brand.dataset.circlesDashboardHome='';brand.href=dashboardHomeHref();
 const branding=node('div','programme-brand-details');branding.append(brand);if(dates)branding.append(dates);
 const copy=brand.querySelector('span');copy.innerHTML='<strong>Umm Abbad<br>Academy</strong>';
 const welcome=node('span','programme-welcome');welcome.textContent='Ahlan wa Sahlan';
 const menu=document.getElementById('account-menu'),summary=menu.querySelector('summary'),name=document.getElementById('account-name');
 const profile=node('span','programme-profile');profile.append(welcome,name);summary.replaceChildren(profile);
 summary.setAttribute('title','Account menu');
 const actions=node('div','programme-page-actions');actions.setAttribute('role','group');actions.setAttribute('aria-label','Page actions');
 for(const [id,icon,label] of [['header-home-button','home','Home'],['header-refresh-button','refresh','Refresh']]){
  const button=document.getElementById(id);button.innerHTML=`<span class="programme-action-icon">${headerIcon(icon)}</span><span class="programme-action-label">${label}</span>`;actions.append(button);
 }
 const switcherButton=node('button','programme-switch');switcherButton.type='button';switcherButton.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4"/></svg>';switcherButton.setAttribute('aria-label','Account menu');switcherButton.title='Account menu';switcherButton.onclick=event=>{event.stopPropagation();menu.open=!menu.open;};
 const signout=document.getElementById('sign-out-button');signout.classList.add('programme-signout');signout.textContent='Sign out';signout.setAttribute('aria-label','Sign out');signout.title='Sign out';actions.append(document.getElementById('sign-in-button'),switcherButton,signout);
 const accountBox=node('div','programme-header-account');accountBox.append(menu,actions);controls.remove();header.replaceChildren(branding,accountBox);
 const banners=node('div','programme-banners');header.before(banners);banners.append(header);
 const navigation=node('nav','programme-dashboard-bar');navigation.setAttribute('aria-label','Your workspace');
 banners.append(navigation);
 let account=null,adminAvailable=false,mode='learn';
 const modes=node('nav','programme-studio-modes');modes.setAttribute('aria-label','Studio workspace');
 modes.innerHTML='<button type="button" data-studio-mode="learn" aria-current="page">Learn</button><button type="button" data-studio-mode="admin" aria-current="false" hidden>Admin</button>';header.insertBefore(modes,accountBox);
 modes.onclick=event=>{const button=event.target.closest('[data-studio-mode]');if(!button||button.hidden||!account||button.dataset.studioMode===mode)return;document.getElementById(button.dataset.studioMode==='admin'?'manage-button':'my-websites').click();};
 menu.addEventListener('toggle',async()=>{if(!menu.open||!account)return;const current=account;try{const allowed=await checkAdministration();if(account===current){adminAvailable=Boolean(account.globalAdmin||allowed);drawModes();}}catch{/* A later Admin action still uses its current native gate. */}});
 const historyControls=installPageHistory({document,window,canLeave});
 function drawModes(){modes.hidden=!account;const admin=modes.querySelector('[data-studio-mode=admin]');admin.hidden=!account||!adminAvailable;for(const b of modes.querySelectorAll('button'))b.setAttribute('aria-current',b.dataset.studioMode===mode?'page':'false');}
 const panel=document.getElementById('account-panel'),nav=panel.querySelector('nav');
 document.getElementById('home-button').textContent='Dashboard';
 document.getElementById('my-websites').textContent='All learning';
 document.getElementById('manage-button').textContent='Manage content';
 document.getElementById('academy-button').textContent='Programme pages';
 const switcher=document.createElement('a');switcher.href='/?login=1&switch=1';switcher.textContent='Switch user';switcher.setAttribute('aria-label','Switch user');
 const website=document.createElement('a');website.href='/?public=1';website.textContent='Visit website';website.setAttribute('aria-label','Visit website');nav.prepend(switcher,website);
 function update(next,{pending=false,canAdmin=false}={}){
  const changed=account?.accountId!==next?.accountId;account=next;if(changed){mode='learn';adminAvailable=Boolean(next?.globalAdmin);}else adminAvailable=Boolean(next?.globalAdmin||adminAvailable||canAdmin);if(!pending)historyControls.update(account);drawModes();
  updateDashboardHomeLinks(document,account);
  navigation.hidden=!account;switcherButton.hidden=!account;name.dataset.accountRole=account?.globalAdmin?'Global Admin':'';
  summary.setAttribute('aria-label',account?account.displayName+(account.globalAdmin?' · Global Admin':'')+' · Account menu':'Account menu');
 }
 update(null,{pending:true});return {update,noteNavigation:href=>historyControls.noteNavigation(href),setMode(value){if(!account||!['learn','admin'].includes(value)||value==='admin'&&!adminAvailable)return;mode=value;drawModes();},allowAdmin(value){if(account){adminAvailable=value===true;if(!adminAvailable)mode='learn';drawModes();}}};
}
