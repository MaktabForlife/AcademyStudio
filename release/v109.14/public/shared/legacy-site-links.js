// Presentation only. Keep original artwork/provenance; never navigate visitors
// into the retired site or change account/content/media authority.
(()=>{
 if(window.AcademyLegacyLinks)return;
 const hosts=['ummabbadacademy.com','ummeabbadacademy.com'];
 const legacy=value=>{try{const u=new URL(value,location.href);return ['http:','https:'].includes(u.protocol)&&hosts.some(host=>u.hostname===host||u.hostname.endsWith('.'+host));}catch{return false;}};
 const selector='a[href],a[data-legacy-source-href],area[href]';
 function enlarge(image){
  const dialog=document.createElement('dialog');dialog.setAttribute('aria-label',image.alt||'Programme prospectus');
  Object.assign(dialog.style,{maxWidth:'94vw',maxHeight:'94dvh',padding:'20px',border:'1px solid #ddcfd7',borderRadius:'12px',background:'#fffaf5',overflow:'auto'});
  const close=document.createElement('button');close.type='button';close.textContent='Close';close.style.cssText='display:block;margin:0 0 14px auto;padding:9px 18px';close.onclick=()=>dialog.close();
  const full=image.cloneNode(true);full.removeAttribute('loading');full.style.cssText='display:block;max-width:100%;width:auto;height:auto;margin:auto';dialog.append(close,full);dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
 }
 function cleanLink(link){
  const raw=link.getAttribute('href')||link.getAttribute('data-legacy-source-href');if(!raw||!legacy(raw))return false;
  const url=new URL(raw,location.href);
  // Existing member access stays in the current, unchanged sign-in flow.
  if(/^\/my-account\/?$/.test(url.pathname)){link.setAttribute('href','/?login=1');link.removeAttribute('target');link.removeAttribute('rel');link.removeAttribute('data-legacy-source-href');return false;}
  const image=link.querySelector('img');
  if(link.matches('.prospectus-sheet')&&image&&new URL(image.getAttribute('src'),location.href).href===url.href){
   const button=document.createElement('button');button.type='button';button.className=link.className;button.style.cssText='border:0;padding:0;background:transparent;color:inherit;text-align:inherit;cursor:zoom-in';button.setAttribute('aria-label',link.getAttribute('aria-label')||'View full programme flyer');while(link.firstChild)button.append(link.firstChild);button.onclick=()=>enlarge(button.querySelector('img'));link.replaceWith(button);return true;
  }
  if(/^(?:Original Academy site|Current website|Books & guides|Visit current workshops|Read more at the current website|Read the Academy journal|View the current Academy|Open the published course collection|Read the published Tafseer reflections)\b/i.test(link.textContent.trim())){link.remove();return true;}
  const text=document.createElement('span');text.className=link.className;while(link.firstChild)text.append(link.firstChild);link.replaceWith(text);return true;
 }
 function clean(root=document){
  if(root.matches?.(selector))cleanLink(root);
  for(const link of root.querySelectorAll?.(selector)||[])cleanLink(link);
 }
 window.AcademyLegacyLinks={isLegacy:legacy,clean};clean();
 document.addEventListener('click',event=>{const link=event.target.closest?.(selector);if(!link)return;const raw=link.getAttribute('href')||link.getAttribute('data-legacy-source-href');if(!legacy(raw))return;const removed=cleanLink(link);if(removed){event.preventDefault();event.stopImmediatePropagation();}},true);
 const observer=new MutationObserver(records=>{for(const record of records){if(record.type==='attributes')clean(record.target);else for(const node of record.addedNodes)if(node.nodeType===1)clean(node);}});
 observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['href']});
})();
