const KEY='m4l_studio_native_connect_v1',MAX_AGE=60_000,token=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
export function checkedOrigin(value){
 let url;try{url=new URL(value);}catch{throw Error('The Academy connection is not configured.');}
 if(typeof value!=='string'||url.protocol!=='https:'||url.origin!==value||url.username||url.password||url.port||url.hostname.includes('*'))throw Error('The Academy connection is not configured.');
 return value;
}
export function checkedTarget(value,origin){
 if(typeof value!=='string'||value.length>1800||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))throw Error('Choose an existing Studio page.');
 const url=new URL(value,origin),simple=new Set(['website','offering','playlist','recording','lesson','course']);
 if(url.origin!==origin||!['/studio/','/circles/free-learning.html','/circles/academy/mothers/surah-al-baqarah/','/circles/academy/mothers/surah-al-baqarah/index.html'].includes(url.pathname)||url.hash.length>200)throw Error('Choose an existing Studio page.');
 for(const [key,value]of url.searchParams){
  if(url.searchParams.getAll(key).length!==1)throw Error('Choose one Studio destination.');
  if(simple.has(key)){if(!/^[-A-Za-z0-9_:]{1,180}$/.test(value))throw Error('Choose an existing Studio page.');}
  else if(key==='classroom'?value!=='mothers':key==='view'?value!=='collections':key==='collection'?!['tafseer','courses'].includes(value):key==='manage'?value!=='1':key==='mode'?!['learn','admin'].includes(value):true)throw Error('Choose an existing Studio page.');
 }
 return url.pathname+url.search+url.hash;
}
const encoded=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export function checkedTransaction(value,origin,portalOrigin,state,now){
 if(!value||!token(value.state)||!token(value.verifier)||value.state!==state||value.origin!==origin||value.portalOrigin!==portalOrigin||!Number.isSafeInteger(value.issuedAt)||value.issuedAt>now||now-value.issuedAt>MAX_AGE)throw Error('This connection expired. Open your learning again.');
 return {...value,target:checkedTarget(value.target,origin)};
}
export async function connectAcademy({win=window,storage=win.sessionStorage,fetcher=fetch,clock=Date.now,webCrypto=crypto}={}){
 const origin=checkedOrigin(win.location.origin),fragment=new URLSearchParams(win.location.hash.slice(1)),hasFragment=Boolean(win.location.hash);
 // Remove the one-use code before loading configuration or another resource.
 if(hasFragment)win.history.replaceState(null,'',win.location.pathname+win.location.search);
 const reply=await fetcher('/api/config',{credentials:'same-origin',cache:'no-store'});if(!reply.ok)throw Error('The Academy connection is unavailable. Try again.');
 const config=await reply.json(),portalOrigin=checkedOrigin(config.academyPortalOrigin);
 if(portalOrigin===origin)throw Error('The Academy connection is not configured.');
 if(hasFragment){
  if(fragment.size!==2||fragment.getAll('code').length!==1||fragment.getAll('state').length!==1||!token(fragment.get('code'))||!token(fragment.get('state')))throw Error('This connection is invalid. Open your learning again.');
  let saved;try{saved=JSON.parse(storage.getItem(KEY));}catch{throw Error('This connection expired. Open your learning again.');}
  const transaction=checkedTransaction(saved,origin,portalOrigin,fragment.get('state'),clock());
  try{
   const response=await fetcher('/auth/exchange',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:fragment.get('code'),state:transaction.state,verifier:transaction.verifier})});
   const result=await response.json();if(!response.ok||result.signedIn!==true)throw Error(result.error||'Your connection could not be completed. Try again.');
   storage.removeItem(KEY);win.location.replace(transaction.target);return {connected:true};
  }catch(error){storage.removeItem(KEY);throw error;}
 }
 const requested=new URLSearchParams(win.location.search),target=checkedTarget(requested.get('target')||'/studio/',origin);
 if([...requested.keys()].some(k=>k!=='target')||requested.getAll('target').length>1)throw Error('Choose one Studio destination.');
 const verifier=encoded(webCrypto.getRandomValues(new Uint8Array(32))),state=encoded(webCrypto.getRandomValues(new Uint8Array(32))),challenge=encoded(new Uint8Array(await webCrypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 const transaction={verifier,state,target,origin,portalOrigin,issuedAt:clock()};
 try{storage.setItem(KEY,JSON.stringify(transaction));}catch{throw Error('Allow temporary browser storage to connect your account.');}
 const destination=new URL('/academy/studio-authorize/',portalOrigin);destination.search=new URLSearchParams({challenge,state,target}).toString();
 win.location.replace(destination.href);return {connecting:true};
}
if(typeof window!=='undefined'&&typeof document!=='undefined'&&document.querySelector('[data-academy-connect]')){
 connectAcademy().catch(error=>{
  document.getElementById('academy-connect-status').textContent=error.message;
  const retry=document.getElementById('academy-connect-retry');let target='/studio/';try{target=checkedTarget(new URLSearchParams(location.search).get('target')||target,location.origin);}catch{}
  retry.href='/academy-connect.html?target='+encodeURIComponent(target);retry.hidden=false;
 });
}
