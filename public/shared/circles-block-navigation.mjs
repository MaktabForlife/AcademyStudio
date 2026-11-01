import {esc} from './model.mjs';

// Resolve only the current checked dashboard's exact native programme mapping.
// The selected view is presentation; native issuance/exchange recheck authority.
export function dashboardProgrammeChoice(key,mode,summary){
 if(!['alimiyah','reboot','arabic-intensive'].includes(key)||!['learn','teach','admin'].includes(mode)||summary?.mode!==mode||!summary.availableModes?.includes(mode))throw Error('Refresh your dashboard before opening this programme.');
 const rows=summary.programmeNavigation,keys=new Set(),ids=new Set();
 if(!Array.isArray(rows)||rows.length>3)throw Error('Refresh your dashboard before opening this programme.');
 for(const row of rows){if(!row||!['alimiyah','reboot','arabic-intensive'].includes(row.navigationKey)||typeof row.activityKey!=='string'||!/^PROGRAM:[-A-Za-z0-9_:]{1,160}$/.test(row.activityKey)||keys.has(row.navigationKey)||ids.has(row.activityKey.toUpperCase()))throw Error('This programme could not be checked. Refresh your dashboard and try again.');keys.add(row.navigationKey);ids.add(row.activityKey.toUpperCase());}
 const matches=rows.filter(row=>row.navigationKey===key);
 if(matches.length!==1)throw Error('This programme is unavailable in the selected workspace. Refresh your dashboard and try again.');
 const row=matches[0];
 return {mode,tool:'activity',activityKey:row.activityKey};
}

// Public artwork stays intact. Signed-in cards use the existing permitted links.
export function circleBlockChoices(area,navigation){
 if(!navigation)return '<p class="circles-block-empty" role="status">Checking your access…</p>';
 const link=(href,label,key)=>`<a class="circles-plain-card" href="${esc(href)}"${key?` data-programme-key="${esc(key)}"`:''}><h3>${esc(label)}</h3><span aria-hidden="true">↗</span></a>`;
 const items=area==='academy'?navigation.academia.map(item=>link('/?login=1&area=academy',item.label,item.key)):
  (navigation.mothers?[link('/studio/?classroom=mothers','Mothers of the Ummah')]:[]);
 return items.length?`<nav class="circles-navigation-cards" aria-label="${area==='academy'?'Your Academia programmes':'Your classrooms'}">${items.join('')}</nav>`:'<p class="circles-block-empty">No programmes assigned to your account in this area.</p>';
}

export function circleBlockNavigation(document){
 const templates=new Map(),rendered=new WeakMap(),layouts=new WeakMap();
 function arrange(signedIn){
  const home=document.querySelector('.single-circle-home'),hub=home?.querySelector('#animated-hub');if(!hub)return;
  home.classList.toggle('circles-button-dashboard',signedIn);
  let layout=layouts.get(hub);
  if(signedIn){
   if(!layout){
    layout={markers:new Map(),columns:[]};
    for(const side of ['left','right']){const column=document.createElement('div');column.className='circles-programme-column circles-programme-column-'+side;layout.columns.push(column);hub.append(column);}
    layouts.set(hub,layout);
   }
   for(const [index,areas]of [['hifz','academy'],['tafseer','mothers']].entries()){
    const column=layout.columns[index];
    for(const area of areas){const card=hub.querySelector('.hub-panel[data-home-area="'+area+'"]');if(!card||card.parentElement===column)continue;
     if(!layout.markers.has(area)){const marker=document.createComment('circle '+area);card.before(marker);layout.markers.set(area,marker);}
     column.append(card);
    }
    column.hidden=[...column.children].every(card=>card.hidden);
   }
  }else if(layout){
   for(const [area,marker]of layout.markers){const card=hub.querySelector('.hub-panel[data-home-area="'+area+'"]');if(card)marker.replaceWith(card);else marker.remove();}
   layout.columns.forEach(column=>column.remove());layouts.delete(hub);
  }
 }
 return (signedIn,navigation)=>{
  for(let card of document.querySelectorAll('.hub-panel[data-home-area]')){
   const area=card.dataset.homeArea;if(!['academy','mothers','tafseer','hifz','arabic-adventures'].includes(area))continue;
   if(!templates.has(area))templates.set(area,{html:card.innerHTML,href:card.getAttribute('href'),action:card.getAttribute('data-action'),label:card.getAttribute('aria-label')});
   card.hidden=Boolean(!signedIn&&area==='mothers'||signedIn&&(area==='arabic-adventures'||area==='hifz'&&!navigation?.hifz||area==='academy'&&!navigation?.academia.length||area==='mothers'&&!navigation?.mothers));
   const template=templates.get(area),signature=JSON.stringify([signedIn,navigation,area]);if(rendered.get(card)===signature)continue;
   const direct=signedIn&&(area==='tafseer'||area==='arabic-adventures'||area==='hifz'&&navigation?.hifz),tag=(!signedIn&&area==='tafseer')||signedIn&&!direct?'SECTION':'A';
   if(card.tagName!==tag){const replacement=document.createElement(tag);for(const attr of card.attributes)replacement.setAttribute(attr.name,attr.value);card.replaceWith(replacement);card=replacement;}
   card.innerHTML=template.html;card.classList.remove('circles-plain-card','circles-navigation-group');card.removeAttribute('data-circles-login');card.removeAttribute('data-programme-key');card.removeAttribute('target');card.removeAttribute('rel');
   if(!signedIn){card.href=template.href||'/?login=1';if(template.action)card.setAttribute('data-action',template.action);if(template.label)card.setAttribute('aria-label',template.label);if(area==='tafseer'){card.removeAttribute('href');card.removeAttribute('data-action');card.classList.add('public-combined-worship');card.setAttribute('aria-label','Worship with understanding');card.innerHTML='<h3>WORSHIP WITH UNDERSTANDING</h3><nav class="public-worship-links" aria-label="Qur’an and growth"><a href="/?login=1&area=tafseer" data-action="visitor-access" data-id="tafseer"><span>Tafseer &amp; Tadabbur</span><span lang="ar" dir="rtl">التفسير والتدبر</span></a><a href="/?login=1&area=mothers" data-action="visitor-access" data-id="mothers"><span>Mothers of the Ummah</span><span lang="ar" dir="rtl">أمهات الأمة</span></a></nav><p>Bringing knowledge into practice.</p>';}}
   else{
    card.classList.remove('public-combined-worship');card.removeAttribute('data-action');card.removeAttribute('href');
    if(area==='tafseer'||area==='hifz'&&navigation?.hifz){const label=area==='hifz'?'Hifz':'Tafseer and Tadabbur';card.classList.add('circles-plain-card');card.innerHTML=`<h3>${label}</h3><span aria-hidden="true">↗</span>`;card.setAttribute('aria-label',label);card.href=area==='hifz'?navigation.hifz:navigation?.tafseer||'/studio/?view=collections&collection=tafseer';if(area==='hifz')card.dataset.programmeKey='hifz';}
    else if(area==='academy'||area==='mothers'){card.classList.add('circles-navigation-group');card.setAttribute('aria-label',area==='academy'?'Your Academia programmes':'Your classrooms');card.innerHTML=circleBlockChoices(area,navigation);}
    else if(area==='hifz'){card.querySelector('.hub-image-copy').insertAdjacentHTML('beforeend',`<p class="circles-block-empty">${navigation?'No Hifz programme assigned to your account.':'Checking your access…'}</p>`);}
   }
   rendered.set(card,signature);
  }
  arrange(signedIn);
 };
}
