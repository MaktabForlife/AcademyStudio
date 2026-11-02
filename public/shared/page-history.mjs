// Position markers contain no URLs, credentials or permission decisions.
// A verified account change starts a new trace; content gates still run normally.
export function documentNavigationFingerprint(value){let hash=2166136261;for(const char of value){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);}
export function installPageHistory({document=globalThis.document,window=globalThis.window,canLeave=()=>true,target:requestedTarget}={}){
 const {history,location}=window,key='m4l_circles_page_history_v1',marker='m4lCirclesNavigation',push=history.pushState.bind(history),replace=history.replaceState.bind(history);
 let state=null,owner,bar;
 const pendingKey=key+'_document';
 const dropPending=()=>{try{if(window.sessionStorage.removeItem)window.sessionStorage.removeItem(pendingKey);else window.sessionStorage.setItem(pendingKey,'');}catch{}};
 function noteNavigation(destination){if(!state)return;try{const url=new URL(destination,location.href);if(url.origin!==location.origin)return;window.sessionStorage.setItem(pendingKey,JSON.stringify({owner,trace:state.trace,index:state.index,target:documentNavigationFingerprint(url.href),at:Date.now()}));}catch{}}
 function pendingNavigation(){try{const row=JSON.parse(window.sessionStorage.getItem(pendingKey));return row&&row.owner===owner&&row.trace===state?.trace&&Number.isSafeInteger(row.index)&&row.index>=0&&row.index<10000&&Date.now()-row.at>=0&&Date.now()-row.at<30000&&row.target===documentNavigationFingerprint(location.href)?row:null;}catch{return null;}}
 const fresh=value=>({owner:value,trace:window.crypto.randomUUID(),index:0,max:0});
 const read=()=>{try{const s=JSON.parse(window.sessionStorage.getItem(key));return s&&typeof s.owner==='string'&&typeof s.trace==='string'&&Number.isSafeInteger(s.index)&&s.index>=0&&Number.isSafeInteger(s.max)&&s.max>=s.index&&s.max<10000?s:null;}catch{return null;}};
 function save(){try{window.sessionStorage.setItem(key,JSON.stringify(state));}catch{}}
 const marked=data=>({...((data&&typeof data==='object'&&!Array.isArray(data))?data:{}),[marker]:{trace:state.trace,index:state.index}});
 function render(){if(!bar)return;const back=bar.querySelector('[data-page-back]'),noBack=!state||state.index===0;if(back.disabled!==noBack)back.disabled=noBack;}
 function sync(){if(!state)return;dropPending();const m=history.state?.[marker],saved=read();if(saved?.owner===owner&&saved.trace===state.trace)state.max=Math.max(state.max,saved.max);if(m?.trace===state.trace&&Number.isSafeInteger(m.index)&&m.index>=0){state.index=m.index;state.max=Math.max(state.max,state.index);}else {state.index++;state.max=state.index;}replace(marked(history.state),'');save();render();}
 history.replaceState=(data,title,url)=>{replace(state?marked(data):data,title,url);if(state){save();render();}};
 history.pushState=(data,title,url)=>{dropPending();if(state){state.index++;state.max=state.index;}push(state?marked(data):data,title,url);if(state){save();render();}};
 function update(account){
  const next=account?.accountId||'public';if(state&&owner===next){render();return;}
  const previousOwner=owner;owner=next;const saved=read();state=saved?.owner===owner&&previousOwner===undefined?saved:fresh(owner);
  const m=history.state?.[marker],pending=pendingNavigation();let fromApp=false;try{fromApp=new URL(document.referrer).origin===location.origin;}catch{}
  if(m?.trace===state.trace&&Number.isSafeInteger(m.index)&&m.index>=0){state.index=m.index;state.max=Math.max(state.max,state.index);}
  else if(previousOwner===undefined&&saved?.owner===owner&&pending&&history.length>1){state.index=pending.index+1;state.max=state.index;}
  else if(previousOwner===undefined&&saved?.owner===owner&&fromApp&&history.length>1){state.index++;state.max=state.index;}
  else state=fresh(owner);
  dropPending();replace(marked(history.state),'');save();render();
 }
 function mount(){
  if(!bar){bar=document.createElement('nav');bar.className='circles-page-navigation';bar.setAttribute('aria-label','Page navigation');bar.innerHTML='<button type="button" data-page-back aria-label="Go back" title="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7M7 12h14"/></svg><span>Back</span></button>';bar.onclick=event=>{const direction=event.target.closest('[data-page-back]');if(!direction||direction.disabled||!state||!canLeave())return;if(direction.hasAttribute('data-page-back')&&state.index>0)history.back();};}
  const target=(typeof requestedTarget==='function'?requestedTarget():requestedTarget)||document.querySelector('.programme-page-actions')||document.querySelector('.public-login')?.parentElement||document.querySelector('.site-header .account-controls')||document.querySelector('header')||document.querySelector('main');if(target&&bar.parentElement!==target)target.append(bar);render();
 }
 window.addEventListener('pageshow',event=>{if(event.persisted)window.location.reload();});window.addEventListener('popstate',sync);window.addEventListener('hashchange',sync);
 document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link||event.defaultPrevented||event.button&&event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.hasAttribute('download')||link.target&&link.target!=='_self')return;noteNavigation(link.href);window.setTimeout(()=>{if(event.defaultPrevented)dropPending();},0);},true);
 const observer=new window.MutationObserver(mount);observer.observe(document.body,{childList:true,subtree:true});mount();
 return {update,bar,noteNavigation,get position(){return state?{index:state.index,max:state.max}:null;}};
}
