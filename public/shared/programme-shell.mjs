import {headerIcon} from './header-icons.mjs';

// One presentation shell for the existing learning pages. Move the native
// controls rather than replacing their sign-in, refresh, Home or sign-out code.
export function installProgrammeShell({document=globalThis.document}={}){
 const header=document.querySelector('.site-header');
 if(!header)return {update(){}};
 document.body.classList.add('circles-programme-page');
 if(!document.querySelector('link[href="/shared/programme-shell.css"]')){const style=document.createElement('link');style.rel='stylesheet';style.href='/shared/programme-shell.css';document.head.append(style);}
 const node=(tag,className)=>{const value=document.createElement(tag);value.className=className;return value;};
 const brand=header.querySelector('.brand'),dates=header.querySelector('.circles-header-dates'),controls=header.querySelector('.account-controls');
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
 const signout=document.getElementById('sign-out-button');signout.classList.add('programme-signout');signout.innerHTML=headerIcon('signout');signout.setAttribute('aria-label','Sign out');signout.title='Sign out';actions.append(document.getElementById('sign-in-button'),switcherButton,signout);
 const account=node('div','programme-header-account');account.append(menu,actions);controls.remove();header.replaceChildren(branding,account);
 const banners=node('div','programme-banners');header.before(banners);banners.append(header);
 const navigation=node('nav','programme-dashboard-bar');navigation.setAttribute('aria-label','Your workspace');
 const home=node('a','programme-dashboard-link');home.href='/';home.textContent='Dashboard';navigation.append(home);banners.append(navigation);
 const panel=document.getElementById('account-panel'),nav=panel.querySelector('nav');
 document.getElementById('home-button').textContent='Dashboard';
 document.getElementById('my-websites').textContent='All learning';
 document.getElementById('manage-button').textContent='Manage content';
 document.getElementById('academy-button').textContent='Programme pages';
 const switcher=document.createElement('a');switcher.href='/?login=1&switch=1';switcher.textContent='Switch user';switcher.setAttribute('aria-label','Switch user');
 const website=document.createElement('a');website.href='/?public=1';website.textContent='Visit website';website.setAttribute('aria-label','Visit website');nav.prepend(switcher,website);
 function update(account){
  navigation.hidden=!account;switcherButton.hidden=!account;name.dataset.accountRole=account?.globalAdmin?'Global Admin':'';
  summary.setAttribute('aria-label',account?account.displayName+(account.globalAdmin?' · Global Admin':'')+' · Account menu':'Account menu');
 }
 update(null);return {update};
}
