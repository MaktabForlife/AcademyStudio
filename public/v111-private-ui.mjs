// Temporary privacy masks preserve the page model. Reveal requires an exact
// checked response context, never a login flag or an arbitrary DOM render.
export function installStudioPrivateUI({session,resultContext,selectors,win=globalThis.window,doc=globalThis.document}={}){
 const marker='studio-v2-private-masked',saved=new Map();let masked=false;
 const selected=()=>Boolean(session()||doc.querySelector('meta[name="uaa-auth-version"][content="2"]'));
 const style=doc.createElement('style');style.textContent=selectors.map(s=>'.'+marker+' '+s).join(',')+'{visibility:hidden!important;pointer-events:none!important}';doc.head.append(style);
 function mask(value){if(!selected())return;masked=value;doc.documentElement.classList.toggle(marker,value);for(const root of doc.querySelectorAll(selectors.join(','))){if(value){if(!saved.has(root))saved.set(root,Boolean(root.inert));root.inert=true;for(const media of root.querySelectorAll('video,audio'))media.pause();for(const frame of root.querySelectorAll('iframe'))if(frame.src!=='about:blank')frame.src='about:blank';}else if(saved.has(root)){root.inert=saved.get(root);saved.delete(root);}}}
 const listener=event=>{if(event.detail?.masked!==false)mask(true);};win.addEventListener('studio-v2-mask',listener);mask(true);
 return {get masked(){return masked;},mask:()=>mask(true),checked(value){const s=session();if(!s)return true;const expected=resultContext(value);const state=s.getState?.();if(!expected||state?.suspended||state?.validationRequired||!s.checkCurrentContext(expected))return false;try{s.reveal(expected);mask(false);return true;}catch{mask(true);return false;}},dispose(){win.removeEventListener('studio-v2-mask',listener);style.remove();}};
}
