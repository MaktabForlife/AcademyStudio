import {esc} from './model.mjs';

// Keep the public card artwork and geometry. Only signed-in navigation changes.
export function circleBlockChoices(area,navigation){
 if(!navigation)return '<p class="circles-block-empty" role="status">Checking your access…</p>';
 const link=(href,label,key)=>`<a href="${esc(href)}"${key?` data-programme-key="${esc(key)}"`:''}>${esc(label)}</a>`;
 const items=area==='academy'?navigation.academia.map(item=>link('/?login=1&area=academy',item.label,item.key)):
  [...(navigation.mothers?[link('/studio/?classroom=mothers','Mothers of the Ummah')]:[]),...navigation.shortCourses.map(item=>link(item.href,item.label))];
 return items.length?`<nav class="circles-block-links" aria-label="${area==='academy'?'Your Academia programmes':'Your classrooms'}">${items.join('')}</nav>`:'<p class="circles-block-empty">No programmes assigned to your account in this area.</p>';
}

export function circleBlockNavigation(document){
 const templates=new Map(),rendered=new WeakMap();
 return (signedIn,navigation)=>{
  for(let card of document.querySelectorAll('.hub-panel[data-home-area]')){
   const area=card.dataset.homeArea;if(!['academy','mothers','tafseer','hifz','arabic-adventures'].includes(area))continue;
   if(!templates.has(area))templates.set(area,{html:card.innerHTML,href:card.getAttribute('href'),action:card.getAttribute('data-action')});
   card.hidden=Boolean(signedIn&&(area==='arabic-adventures'||area==='hifz'&&!navigation?.hifz||area==='academy'&&!navigation?.academia.length||area==='mothers'&&!navigation?.mothers&&!navigation?.shortCourses.length));
   const template=templates.get(area),signature=JSON.stringify([signedIn,navigation,area]);if(rendered.get(card)===signature)continue;
   const direct=signedIn&&(area==='tafseer'||area==='arabic-adventures'||area==='hifz'&&navigation?.hifz),tag=signedIn&&!direct?'SECTION':'A';
   if(card.tagName!==tag){const replacement=document.createElement(tag);for(const attr of card.attributes)replacement.setAttribute(attr.name,attr.value);card.replaceWith(replacement);card=replacement;}
   card.innerHTML=template.html;card.removeAttribute('data-circles-login');card.removeAttribute('data-programme-key');card.removeAttribute('target');card.removeAttribute('rel');
   if(!signedIn){card.href=template.href||'/?login=1';if(template.action)card.setAttribute('data-action',template.action);}
   else{
    card.removeAttribute('data-action');card.removeAttribute('href');
    if(area==='tafseer')card.href=navigation?.tafseer||'/studio/?view=collections&collection=tafseer';
    else if(area==='hifz'&&navigation?.hifz){card.href=navigation.hifz;card.dataset.programmeKey='hifz';}
    else if(area==='academy'){card.querySelector('p.meta')?.remove();card.insertAdjacentHTML('beforeend',circleBlockChoices(area,navigation));}
    else if(area==='mothers'){const copy=card.querySelector('.hub-panel-copy');copy.querySelector('.meta')?.remove();copy.querySelector('p')?.remove();copy.insertAdjacentHTML('beforeend',circleBlockChoices(area,navigation));}
    else if(area==='hifz'){card.querySelector('.hub-image-copy').insertAdjacentHTML('beforeend',`<p class="circles-block-empty">${navigation?'No Hifz programme assigned to your account.':'Checking your access…'}</p>`);}
   }
   rendered.set(card,signature);
  }
 };
}
