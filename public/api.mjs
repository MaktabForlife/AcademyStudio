export const identity={account:null,generation:0};
let observedCoursePolicyEpoch=null;
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('maktab-web-account'):null;
export function changed(account){clearPrivateReads();identity.account=account;identity.generation++;resetRenewals();channel?.postMessage({accountId:account?.accountId||null});window.dispatchEvent(new CustomEvent('website-account-changed',{detail:account}));}
channel?.addEventListener('message',event=>{if(event.data?.type==='reads-invalidated'){clearPrivateReads();window.dispatchEvent(new Event('website-display-invalidated'));return;}clearPrivateReads();identity.account=null;identity.generation++;resetRenewals();window.dispatchEvent(new CustomEvent('website-session-ended',{detail:{externalAccountChange:true}}));});
let refreshing=null,renewalTail=Promise.resolve();const accessRefreshes=new Map(),readFlights=new Map();
function resetRenewals(){refreshing=null;renewalTail=Promise.resolve();accessRefreshes.clear();readFlights.clear();observedCoursePolicyEpoch=null;}
window.addEventListener('website-course-policy-changed',()=>{readFlights.clear();clearPrivateReads();});
// Tab-private display copies only. Every reuse still makes a conditional read
// through the native current session/rights gates; offline/denied reads cannot
// reveal the saved reply. Neither credentials nor private drafts are stored.
const readStorageKey='m4l-private-display-v1',readLimit=2_000_000;
let readOwner='',readEntries=new Map(),readRevision=0;
const readStorage=()=>{try{return globalThis.sessionStorage;}catch{return null;}};
const ownerOf=account=>account?.cacheSession&&account.accountId?JSON.stringify([account.accountId,account.cacheSession]):null;
const readOwnerKey=()=>ownerOf(identity.account);
function clearPrivateReads(){readOwner='';readEntries.clear();readRevision++;try{readStorage()?.removeItem(readStorageKey);}catch{}}
function loadPrivateReads(account=identity.account){
 const owner=ownerOf(account);if(!owner)return null;if(owner===readOwner)return owner;
 readEntries.clear();readOwner=owner;
 try{const raw=readStorage()?.getItem(readStorageKey);if(raw&&raw.length<=readLimit){const saved=JSON.parse(raw);if(saved.owner===owner&&Array.isArray(saved.entries)&&saved.entries.length<=32)for(const entry of saved.entries)if(typeof entry.key==='string'&&entry.key.length<2000&&/^"pv1-[a-f0-9]{64}"$/.test(entry.etag)&&entry.expiresAt>Date.now()&&entry.expiresAt<=Date.now()+43200000&&entry.value&&typeof entry.value==='object')readEntries.set(entry.key,entry);}}catch{}
 return owner;
}
function savedPrivateRead(key,bootstrap=false){
 if(bootstrap&&!identity.account){try{const raw=readStorage()?.getItem(readStorageKey);if(raw&&raw.length<=readLimit){const saved=JSON.parse(raw),entry=saved.entries?.find(e=>e.key===key);if(entry?.value?.account&&saved.owner===ownerOf(entry.value.account))loadPrivateReads(entry.value.account);else return null;}else return null;}catch{return null;}}
 else if(!loadPrivateReads())return null;const entry=readEntries.get(key);if(!entry||entry.expiresAt<=Date.now()){readEntries.delete(key);return null;}return entry;}
function rememberPrivateRead(key,etag,value,bootstrap=false){
 const account=bootstrap?value.account:identity.account;
 if(!/^"pv1-[a-f0-9]{64}"$/.test(etag||'')||!loadPrivateReads(account))return;
 const expiresAt=Math.min(Number(account.sessionExpiresAt)||0,(Number(account.verifiedAt)||0)+43200000,Date.now()+43200000);if(expiresAt<=Date.now())return;
 const entry={key,etag,value,expiresAt};if(JSON.stringify(entry).length>1_600_000)return;
 readEntries.delete(key);readEntries.set(key,entry);
 while(readEntries.size>32)readEntries.delete(readEntries.keys().next().value);
 let encoded=JSON.stringify({owner:readOwner,entries:[...readEntries.values()]});
 while(encoded.length>readLimit&&readEntries.size){readEntries.delete(readEntries.keys().next().value);encoded=JSON.stringify({owner:readOwner,entries:[...readEntries.values()]});}
 try{readStorage()?.setItem(readStorageKey,encoded);}catch{/* Storage disabled/full: retain bounded current-page memory. */}
}
const privateRead=path=>/^\/api\/websites\/[-A-Za-z0-9_:]+(?:\?(?:edition=published))?$/.test(path)||/^\/api\/offerings\/[-A-Za-z0-9_:]+\/media(?:\?|$)/.test(path)||/^\/api\/circles\/(?:dashboard|bootstrap|classrooms\/mothers)(?:\?|$)/.test(path);
function renew(fn){const generation=identity.generation,run=renewalTail.then(()=>{if(generation!==identity.generation)throw new DOMException('Your account changed.','AbortError');return fn();});renewalTail=run.catch(()=>{});return run;}
function renewAccess(offeringId){const key=identity.generation+':'+(offeringId||'');if(!accessRefreshes.has(key)){const run=renew(()=>api('/auth/access',{body:{offeringId},refreshed:true})).finally(()=>{if(accessRefreshes.get(key)===run)accessRefreshes.delete(key);});accessRefreshes.set(key,run);}return accessRefreshes.get(key);}
function renewStatus(){if(!refreshing){const run=renew(()=>api('/auth/refresh',{body:{},refreshed:true})).finally(()=>{if(refreshing===run)refreshing=null;});refreshing=run;}return refreshing;}
// Share only identical reads that are still running. Completed private replies
// are never stored here: returning later still reaches the current server gate.
const sharedRead=path=>/^\/api\/(?:config|me|public\/circles|websites(?:\/[^/?]+)?|circles\/(?:classrooms\/mothers|dashboard|bootstrap|navigation))(?:\?|$)/.test(path)||privateRead(path);
export function api(path,options={}){
 const {body,method=body===undefined?'GET':'POST',headers={},blob=false,refreshed=false,accessRefreshed=false,statusRefreshed=false,optionalSession=false}=options;
 if(method!=='GET'||body!==undefined){
  readFlights.clear();const readonly=path.startsWith('/auth/')||path==='/api/circles/dashboard'||path==='/api/circles/lesson-join'||/^\/api\/offerings\/[-A-Za-z0-9_:]+\/join$/.test(path);
  if(!readonly)clearPrivateReads();
  return request(path,options).then(value=>{if(!readonly){clearPrivateReads();channel?.postMessage({type:'reads-invalidated'});window.dispatchEvent(new Event('website-display-invalidated'));}return value;},error=>{if(!readonly)clearPrivateReads();throw error;});
 }
 if(!sharedRead(path)||readFlights.size>=64)return request(path,options);
 const key=JSON.stringify([identity.account?.accountId,identity.generation,path,Object.entries(headers).map(([name,value])=>[name.toLowerCase(),value]).sort(([a],[b])=>a.localeCompare(b)),blob,refreshed,accessRefreshed,statusRefreshed,optionalSession]);
 let pending=readFlights.get(key);
 if(!pending){pending=request(path,options).finally(()=>{if(readFlights.get(key)===pending)readFlights.delete(key);});readFlights.set(key,pending);}
 // Callers edit their own view models. Do not share mutable JSON between them.
 return pending.then(value=>blob?value:JSON.parse(JSON.stringify(value)));
}
async function request(path,{body,method=body===undefined?'GET':'POST',headers={},blob=false,refreshed=false,accessRefreshed=false,statusRefreshed=false,optionalSession=false}={}){
 const generation=identity.generation,revision=readRevision,bootstrap=path.split('?')[0]==='/api/circles/bootstrap',key=JSON.stringify([path,Object.entries(headers).sort()]),eligible=method==='GET'&&!blob&&privateRead(path)&&!/[?&]refresh=1(?:&|$)/.test(path),saved=eligible?savedPrivateRead(key,bootstrap):null;
 const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:{...(body!==undefined&&!(body instanceof Blob)?{'Content-Type':'application/json'}:{}),...headers,...(saved?{'If-None-Match':saved.etag}:{})},...(body===undefined?{}:{body:body instanceof Blob?body:JSON.stringify(body)})});
 if(generation!==identity.generation)throw new DOMException('Your account changed.','AbortError');
 if(response.status===304){if(!saved||readRevision!==revision||readOwner!==(bootstrap?ownerOf(saved.value.account):readOwnerKey()))throw new DOMException('This saved view changed. Reopen it.','AbortError');const value=JSON.parse(JSON.stringify(saved.value)),serverTime=Number(response.headers.get('X-Maktab-Server-Time'));if(Number.isFinite(serverTime)){if(Object.hasOwn(value,'serverTime'))value.serverTime=serverTime;if(bootstrap&&value.dashboard)value.dashboard.serverTime=serverTime;if(path==='/api/circles/classrooms/mothers'&&value.timetable){value.timetable.serverTime=serverTime;for(const session of value.timetable.sessions||[])session.canJoin=Boolean(session.eligibleToJoin&&serverTime>=session.joinOpensAt&&serverTime<session.endsAt&&serverTime<session.eligibilityExpiresAt);}}return value;}
 const result=blob&&response.ok?await response.blob():await response.json();if(generation!==identity.generation)throw new DOMException('Your account changed.','AbortError');
 if(response.ok&&Number.isSafeInteger(result.coursePolicyEpoch)){const previous=observedCoursePolicyEpoch;observedCoursePolicyEpoch=result.coursePolicyEpoch;if(previous!==null&&previous!==observedCoursePolicyEpoch)window.dispatchEvent(new CustomEvent('website-course-policy-changed',{detail:{revision:observedCoursePolicyEpoch}}));}
 if(!response.ok){
  if([401,403,404,409].includes(response.status))clearPrivateReads();
  if(result.code==='ACCESS_REFRESH_REQUIRED'&&!refreshed&&!accessRefreshed&&path!=='/auth/access'){await renewAccess(result.offeringId);return api(path,{body,method,headers,blob,refreshed,accessRefreshed:true,statusRefreshed,optionalSession});}
  if(response.status===401&&['ADMIN_STATUS_EXPIRED','STATUS_EXPIRED'].includes(result.code)&&!refreshed&&!statusRefreshed&&path!=='/auth/refresh'){await renewStatus();return api(path,{body,method,headers,blob,refreshed,accessRefreshed,statusRefreshed:true,optionalSession});}
  if(response.status===401&&!['/auth/login','/auth/exchange'].includes(path)&&!(optionalSession&&['/api/me','/api/circles/bootstrap'].includes(path.split('?')[0])&&!identity.account)){changed(null);window.dispatchEvent(new Event('website-session-ended'));}
  throw Object.assign(new Error(result.error||'This action is unavailable.'),{status:response.status,code:result.code,offeringId:result.offeringId});
 }if(eligible&&revision===readRevision)rememberPrivateRead(key,response.headers.get('ETag'),result,bootstrap);return result;
}
const pending=new Map();
export async function mutate(path,body){const key=path+JSON.stringify(body);if(!pending.has(key))pending.set(key,{...body,operationId:crypto.randomUUID()});const result=await api(path,{body:pending.get(key)});pending.delete(key);return result;}
window.addEventListener('website-session-ended',()=>pending.clear());
window.addEventListener('website-account-changed',()=>pending.clear());
export function downloadJSON(value,filename){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
