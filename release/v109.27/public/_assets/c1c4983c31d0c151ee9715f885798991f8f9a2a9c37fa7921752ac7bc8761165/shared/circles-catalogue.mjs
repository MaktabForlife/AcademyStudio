import {esc} from './model.mjs';
import {tafseerCover} from './tafseer-cover.mjs';
import {approvedCourseCover} from './approved-course-artwork.mjs';

export {accessBadge as catalogueLock} from './access-badge.mjs';
import {accessBadge as catalogueLock} from './access-badge.mjs';

export function circlesCatalogue(items,access=[],{applicationPath='/',kind='TAFSEER',checkedOpening=false}={}){
 applicationPath=applicationPath==='/studio/'?'/studio/':'/';kind=kind==='COURSE'?'COURSE':'TAFSEER';
 const rights=new Map(access.map(r=>[r.websiteId,r]));
 const card=source=>{
  const item={...source,...(source.key==='foundations'?{title:'Introduction to Qur’anic Studies'}:{}),...(approvedCourseCover(source.key)?{cover:approvedCourseCover(source.key)}:{})};
  const right=rights.get(item.websiteId),state=checkedOpening?(item.publicTextUrl?'free':right?.canOpen===true?'open':'required'):item.kind==='COURSE'?(right?.coursePolicy?.model==='FREE'?'free':right?.subscriptionStatus==='subscribed'?'subscribed':'required'):(item.publicTextUrl?'free':right?.subscriptionStatus==='subscribed'?'subscribed':'required');
  const ornament=tafseerCover(item),label=item.key==='fatir'?'Text pending':item.title;
  const body=`${ornament||(item.cover?`<img src="${esc(item.cover)}" alt="" loading="lazy">`:'<span class="cover-circles"><i></i><i></i><i></i></span>')}${catalogueLock(state)}${!ornament?`<span class="collection-card-name">${esc(label)}${Number.isSafeInteger(item.recordings)?'<small>'+item.recordings+' recordings</small>':''}</span>`:''}`;
  const href=item.pending?null:(item.publicTextUrl&&!right?.canOpen?item.publicTextUrl:null)||(item.websiteId?applicationPath+'?website='+encodeURIComponent(item.websiteId):null);
  const accessible=item.title+(state==='free'?'':state==='open'?' · Open':state==='subscribed'?' · Subscribed':' · Subscription required');
  return `<article class="collection-card${ornament?' collection-tafseer':''}" style="--card-accent:${esc(item.accent)};--card-soft:${esc(item.soft)}">${href?`<a href="${esc(href)}" ${item.publicTextUrl&&!right?.canOpen?'':'data-circles-website="'+esc(item.websiteId)+'"'} class="collection-cover${ornament?' tafseer-cover':''}" aria-label="${esc(accessible)}">${body}</a>`:`<div class="collection-cover${ornament?' tafseer-cover':''}" role="img" aria-label="${esc(item.title+' · Text pending')}">${body}</div>`}</article>`;
 };
 return `<nav class="circles-collection-nav" aria-label="Learning collections"><button data-circles-tab="TAFSEER" aria-current="${kind==='TAFSEER'?'page':'false'}">Tafseer</button><button data-circles-tab="COURSE" aria-current="${kind==='COURSE'?'page':'false'}">Courses</button></nav>${['TAFSEER','COURSE'].map(section=>`<section data-circles-section="${section}" aria-label="${section==='TAFSEER'?'Tafseer':'Courses'}" ${section!==kind?'hidden':''}><div class="collection-grid">${items.filter(i=>i.kind===section).map(card).join('')}</div></section>`).join('')}`;
}
