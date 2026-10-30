import {esc} from './model.mjs';
import {tafseerCover} from './tafseer-cover.mjs';

export function catalogueLock(state='required'){
 if(state==='free')return '';
 const open=state==='subscribed',label=open?'Subscribed':'Subscription required';
 return `<span class="collection-lock" role="img" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/>${open?'<path d="M8 10V6a4 4 0 0 1 7.8-1.2"/>':'<path d="M8 10V6a4 4 0 0 1 8 0v4"/>'}<path d="M12 14v3"/></svg></span>`;
}

export function circlesCatalogue(items,access=[]){
 const rights=new Map(access.map(r=>[r.websiteId,r]));
 const card=item=>{
  const right=rights.get(item.websiteId),state=item.publicTextUrl?'free':right?.subscriptionStatus==='subscribed'?'subscribed':'required';
  const ornament=tafseerCover(item),label=item.key==='fatir'?'Text pending':item.title;
  const body=`${ornament||(item.cover?`<img src="${esc(item.cover)}" alt="" loading="lazy">`:'<span class="cover-circles"><i></i><i></i><i></i></span>')}${catalogueLock(state)}${!ornament?`<span class="collection-card-name">${esc(label)}</span>`:''}`;
  const href=item.pending?null:(item.publicTextUrl&&!right?.canOpen?item.publicTextUrl:null)||(item.websiteId?'/?website='+encodeURIComponent(item.websiteId):null);
  const accessible=item.title+(state==='free'?'':state==='subscribed'?' · Subscribed':' · Subscription required');
  return `<article class="collection-card${ornament?' collection-tafseer':''}" style="--card-accent:${esc(item.accent)};--card-soft:${esc(item.soft)}">${href?`<a href="${esc(href)}" ${item.publicTextUrl&&!right?.canOpen?'':'data-circles-website="'+esc(item.websiteId)+'"'} class="collection-cover${ornament?' tafseer-cover':''}" aria-label="${esc(accessible)}">${body}</a>`:`<div class="collection-cover${ornament?' tafseer-cover':''}" role="img" aria-label="${esc(item.title+' · Text pending')}">${body}</div>`}</article>`;
 };
 return `<nav class="circles-collection-nav" aria-label="Learning collections"><button data-circles-tab="TAFSEER" aria-current="page">Tafseer</button><button data-circles-tab="COURSE" aria-current="false">Courses</button></nav>${['TAFSEER','COURSE'].map(kind=>`<section data-circles-section="${kind}" aria-label="${kind==='TAFSEER'?'Tafseer':'Courses'}" ${kind==='COURSE'?'hidden':''}><div class="collection-grid">${items.filter(i=>i.kind===kind).map(card).join('')}</div></section>`).join('')}`;
}
