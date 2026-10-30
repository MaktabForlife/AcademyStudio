import {esc} from '../public/shared/model.mjs';
import {tafseerCover} from '../public/shared/tafseer-cover.mjs';

// Catalogue presentation states are not grants of access.
export function catalogueLock(item){
 const state=item.subscriptionStatus||(item.key==='foundations'?'free':'required');
 if(state==='free')return '';
 const open=state==='subscribed',label=open?'Subscribed':'Subscription required';
 return `<span class="collection-lock" role="img" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/>${open?'<path d="M8 10V6a4 4 0 0 1 7.8-1.2"/>':'<path d="M8 10V6a4 4 0 0 1 8 0v4"/>'}<path d="M12 14v3"/></svg></span>`;
}

export function circlesReviewPage({websites,courses,catalogue=[]}) {
 const card=sourceItem=>{
  const item=sourceItem.key==='foundations'?{...sourceItem,title:'Qur’anic Studies'}:sourceItem;
  const ornament=tafseerCover(item),label=item.key==='fatir'?'Text pending':item.title,state=item.subscriptionStatus||(item.key==='foundations'?'free':'required'),accessible=item.title+(state==='free'?'':state==='subscribed'?' · Subscribed':' · Subscription required');
  const body=`${ornament||(item.cover?`<img src="${esc(item.cover)}" alt="" loading="lazy">`:'<span class="cover-circles"><i></i><i></i><i></i></span>')}${catalogueLock(item)}${!ornament?`<span class="collection-card-name">${esc(label)}</span>`:''}`;
  return `<article class="collection-card${ornament?' collection-tafseer':''}" style="--card-accent:${esc(item.accent)};--card-soft:${esc(item.soft)}">${item.url?`<a href="${esc(item.url)}" class="collection-cover${ornament?' tafseer-cover':''}" aria-label="${esc(accessible)}">${body}</a>`:`<div class="collection-cover${ornament?' tafseer-cover':''}" role="img" aria-label="${esc(item.title+' · '+label)}">${body}</div>`}</article>`;
 };
 const tafseer=catalogue.length?catalogue.map(x=>websites.find(w=>w.key===x.key)).filter(Boolean):websites.filter(x=>x.key!=='kahf'),kahf=websites.filter(x=>x.key==='kahf');
 return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>Self-paced learning · Umm Abbad Academy</title><link rel="icon" href="/shared/assets/favicon.svg"><link rel="stylesheet" href="/shared/assets/fonts.css"><link rel="stylesheet" href="/shared/assets/arabic-font.css"><link rel="stylesheet" href="/shared/circles-theme.css"><link rel="stylesheet" href="/circles-review.css"></head>
 <body class="circles-theme collection-review collection-card-only"><a class="skip-link" href="#main">Skip to learning</a><header class="collection-header"><a class="collection-brand" href="/local-review"><img src="/academy-logo.png" alt="Umm Abbad Academy"><span>Umm Abbad <strong>Academy</strong></span></a><nav aria-label="Learning collections"><a href="#tafseer">Tafseer</a><a href="#courses">Courses</a></nav></header>
 <main id="main"><h1 class="sr-only">Your learning collections</h1><section id="tafseer" class="collection-section" aria-label="Tafseer"><div class="collection-grid">${tafseer.map(card).join('')}</div></section><section id="courses" class="collection-section" aria-label="Courses"><div class="collection-grid">${[...courses,...kahf].map(card).join('')}</div></section></main>
 <script type="module">const show=()=>{const selected=location.hash==='#courses'?'courses':'tafseer';for(const section of document.querySelectorAll('.collection-section'))section.hidden=section.id!==selected;for(const link of document.querySelectorAll('.collection-header nav a'))link.setAttribute('aria-current',link.hash==='#'+selected?'page':'false');};window.addEventListener('hashchange',show);show();</script></body></html>`;
}
