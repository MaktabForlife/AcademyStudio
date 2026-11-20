export const identity={account:null,generation:0};
const checkedV2Results=new WeakMap();
export const studioResultProvenance=value=>value&&typeof value==='object'?checkedV2Results.get(value)||null:null;
const selectorFields=['app','sub','sid','psid','bsid','bv','ce','ae','le','sv','ue'];
const sameProof=(left,right)=>Boolean(left&&right&&left.viewVersion===right.viewVersion&&selectorFields.every(k=>left.context?.[k]===right.context?.[k]));
function responseProof(session,response,started){const proof=session.responseProvenance?.(response);if(!proof||!sameProof(proof,started)&&!sameProof(proof.renewedFrom,started))throw new DOMException('This reply belongs to an earlier Studio request.','AbortError');const value=Object.freeze({context:proof.context,viewVersion:proof.viewVersion});if(!currentProvenance(value))throw new DOMException('This private view requires current validation.','AbortError');return value;}
const nativeReadOnly=(path,method)=>method==='POST'&&(['/api/circles/dashboard','/api/circles/lesson-join'].includes(path)||/^\/api\/offerings\/[-A-Za-z0-9_:]+\/join$/.test(path));
function currentProvenance(proof){if(!proof||!v2Session)return false;const state=v2Session.getState?.();return state&&Number.isSafeInteger(state.viewVersion)&&state.viewVersion===proof.viewVersion&&!state.suspended&&!state.validationRequired&&v2Session.checkCurrentContext(proof.context);}
export const studioResultContext=value=>{const proof=studioResultProvenance(value);return currentProvenance(proof)?proof.context:null;};
function checkedV2Result(value,proof){if(value&&typeof value==='object'&&proof){if(!currentProvenance(proof))throw new DOMException('This private view requires current validation.','AbortError');checkedV2Results.set(value,proof);for(const key of ['account','website','classroom','dashboard'])if(value[key]&&typeof value[key]==='object')checkedV2Results.set(value[key],proof);}return value;}
let v2Session=null,v2SessionPromise=null,v2Discovery=null;
const selectedV2Page=()=>typeof document!=='undefined'&&document.querySelector('meta[name="uaa-auth-version"][content="2"]')&&document.querySelector('meta[name="uaa-app"][content="studio"]');
async function discoverV2(){if(!v2Session&&selectedV2Page()){if(!v2Discovery)v2Discovery=fetch('/api/config',{credentials:'same-origin',cache:'no-store'}).then(async response=>{if(!response.ok)throw Error('The Studio session connection is unavailable.');return configureStudioAuth(await response.json());}).catch(error=>{v2Discovery=null;throw error;});await v2Discovery;}}
export const studioSession=()=>v2Session;
let previousV2Context=null;
const stableV2=['app','sub','sid','psid','bsid','bv','ce','ae','le'];
function endedV2(reason){clearPrivateReads();identity.account=null;identity.generation++;resetRenewals();window.dispatchEvent(new CustomEvent('website-session-ended',{detail:{v2:true,reason}}));}
function maskV2(masked,detail={}){
 window.dispatchEvent(new CustomEvent('studio-v2-mask',{detail:{masked,...detail}}));
 if(!masked)return;
 clearPrivateReads();
 if(['LOGOUT','GLOBAL','LOCAL','SWITCH','REMOTE_CONTEXT_CANCELLED','BROWSER_CLEAR','GLOBAL_UNCONFIRMED'].includes(detail.reason))endedV2(detail.reason);
}
function stateV2(state){
 const next=state.context;
 if(previousV2Context&&next&&stableV2.some(k=>previousV2Context[k]!==next[k]))endedV2('CONTEXT_CHANGED');
 previousV2Context=next;
 window.dispatchEvent(new CustomEvent('studio-v2-context',{detail:state}));
}
export async function configureStudioAuth(config,{factory}={}){if(config?.authVersion!==2)return null;if(!v2SessionPromise)v2SessionPromise=(async()=>{const {createStudioSession}=await import('./v111-session.mjs');return createStudioSession(config,{factory,onMask:maskV2,onState:stateV2});})().then(value=>v2Session=value).catch(error=>{v2SessionPromise=null;throw error;});return v2SessionPromise;}

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
const readStorage=()=>{if(v2Session||selectedV2Page())return null;try{return globalThis.sessionStorage;}catch{return null;}};
const ownerOf=account=>account?.cacheSession&&account.accountId?JSON.stringify([account.accountId,account.cacheSession]):null;
const readOwnerKey=()=>ownerOf(identity.account);
function clearPrivateReads(){readOwner='';readEntries.clear();readRevision++;try{readStorage()?.removeItem(readStorageKey);}catch{}}
function loadPrivateReads(account=identity.account){
 const owner=ownerOf(account);if(!owner)return null;if(owner===readOwner)return owner;
 readEntries.clear();readOwner=owner;
 try{const raw=readStorage()?.getItem(readStorageKey);if(raw&&raw.length<=readLimit){const saved=JSON.parse(raw);if(saved.owner===owner&&Array.isArray(saved.entries)&&saved.entries.length<=32)for(const entry of saved.entries)if(typeof entry.key==='string'&&entry.key.length<2000&&/^"pv1-[a-f0-9]{64}"$/.test(entry.etag)&&Number.isFinite(entry.expiresAt)&&entry.expiresAt>Date.now()&&entry.expiresAt<=Date.now()+43200000&&entry.value&&typeof entry.value==='object')readEntries.set(entry.key,entry);}}catch{}
 return owner;
}
function savedPrivateRead(key,bootstrap=false){
 if(bootstrap&&!identity.account){if(v2Session||selectedV2Page())return null;try{const raw=readStorage()?.getItem(readStorageKey);if(raw&&raw.length<=readLimit){const saved=JSON.parse(raw),entry=saved.entries?.find(e=>e.key===key);if(entry?.value?.account&&saved.owner===ownerOf(entry.value.account))loadPrivateReads(entry.value.account);else return null;}else return null;}catch{return null;}}
 else if(!loadPrivateReads())return null;const entry=readEntries.get(key);if(!entry||entry.expiresAt<=Date.now()){readEntries.delete(key);return null;}return entry;}
function rememberPrivateRead(key,etag,value,bootstrap=false){
 const account=bootstrap?value.account:identity.account;
 if(!/^"pv1-[a-f0-9]{64}"$/.test(etag||'')||!loadPrivateReads(account))return;
 const expiresAt=account.authVersion===2?Math.min(Number(account.validationDeadlineMs)||0,Number(account.originalExpiresAtMs)||0):Math.min(Number(account.sessionExpiresAt)||0,(Number(account.verifiedAt)||0)+43200000,Date.now()+43200000);if(expiresAt<=Date.now())return;
 const entry={key,etag,value,expiresAt};if(JSON.stringify(entry).length>1_600_000)return;
 readEntries.delete(key);readEntries.set(key,entry);
 while(readEntries.size>32)readEntries.delete(readEntries.keys().next().value);
 let encoded=JSON.stringify({owner:readOwner,entries:[...readEntries.values()]});
 while(encoded.length>readLimit&&readEntries.size){readEntries.delete(readEntries.keys().next().value);encoded=JSON.stringify({owner:readOwner,entries:[...readEntries.values()]});}
 try{readStorage()?.setItem(readStorageKey,encoded);}catch{/* Storage disabled/full: retain bounded current-page memory. */}
}
const privateRead=path=>/^\/api\/websites\/[-A-Za-z0-9_:]+(?:\?(?:edition=published))?$/.test(path)||/^\/api\/offerings\/[-A-Za-z0-9_:]+\/media(?:\?|$)/.test(path)||/^\/api\/circles\/(?:dashboard|(?:reader-)?bootstrap|classrooms\/mothers)(?:\?|$)/.test(path);
function renew(fn){const generation=identity.generation,run=renewalTail.then(()=>{if(generation!==identity.generation)throw new DOMException('Your account changed.','AbortError');return fn();});renewalTail=run.catch(()=>{});return run;}
function renewAccess(offeringId){const key=identity.generation+':'+(offeringId||'');if(!accessRefreshes.has(key)){const run=renew(()=>api('/auth/access',{body:{offeringId},refreshed:true})).finally(()=>{if(accessRefreshes.get(key)===run)accessRefreshes.delete(key);});accessRefreshes.set(key,run);}return accessRefreshes.get(key);}
function renewStatus(){if(!refreshing){const run=renew(()=>api('/auth/refresh',{body:{},refreshed:true})).finally(()=>{if(refreshing===run)refreshing=null;});refreshing=run;}return refreshing;}
// Share only identical reads that are still running. Completed private replies
// are never stored here: returning later still reaches the current server gate.
const sharedRead=path=>/^\/api\/(?:config|me|public\/circles|websites(?:\/[^/?]+)?|circles\/(?:classrooms\/mothers|dashboard|(?:reader-)?bootstrap|navigation))(?:\?|$)/.test(path)||privateRead(path);
export function api(path,options={}){
 if(v2Session&&path.startsWith('/auth/')&&!path.startsWith('/auth/v2/')){
  if(path==='/auth/logout')return v2Session.logout().then(()=>({signedOut:true}));
  if(path==='/auth/refresh'||path==='/auth/access')return v2Session.refresh().then(()=>({authVersion:2}));
  return Promise.reject(Object.assign(new Error('Reconnect through Academy.'),{code:'V1_AUTH_DISABLED',status:410}));
 }
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
 return pending.then(value=>blob?value:checkedV2Result(JSON.parse(JSON.stringify(value)),studioResultProvenance(value)));
}
async function request(path,{body,method=body===undefined?'GET':'POST',headers={},blob=false,refreshed=false,accessRefreshed=false,statusRefreshed=false,optionalSession=false}={}){
 if(path!=='/api/config'&&!v2Session&&selectedV2Page())await discoverV2();
 const publicRequest=path==='/api/config'||path.startsWith('/api/public/');
 if(v2Session&&!publicRequest)await v2Session.ensureFresh();
 const generation=identity.generation,revision=readRevision,bootstrap=['/api/circles/bootstrap','/api/circles/reader-bootstrap'].includes(path.split('?')[0]),key=JSON.stringify([path,Object.entries(headers).sort()]),eligible=method==='GET'&&!blob&&privateRead(path)&&!/[?&]refresh=1(?:&|$)/.test(path),saved=eligible?savedPrivateRead(key,bootstrap):null;
 const started=v2Session&&!publicRequest?Object.freeze({context:v2Session.getContext(),viewVersion:v2Session.getState?.().viewVersion}):null;
 const transport=v2Session&&!publicRequest?(path,init)=>v2Session.protectedFetch(path,init,{readOnly:nativeReadOnly(path,method)}):fetch;const response=await transport(path,{method,credentials:'same-origin',cache:'no-store',headers:{...(body!==undefined&&!(body instanceof Blob)?{'Content-Type':'application/json'}:{}),...headers,...(saved?{'If-None-Match':saved.etag}:{})},...(body===undefined?{}:{body:body instanceof Blob?body:JSON.stringify(body)})});
 const checkedContext=v2Session&&!publicRequest?responseProof(v2Session,response,started):null;
 if(generation!==identity.generation)throw new DOMException('Your account changed.','AbortError');
 if(response.status===304){if(!saved||readRevision!==revision||readOwner!==(bootstrap?ownerOf(saved.value.account):readOwnerKey()))throw new DOMException('This saved view changed. Reopen it.','AbortError');const value=JSON.parse(JSON.stringify(saved.value)),serverTime=Number(response.headers.get('X-Maktab-Server-Time'));if(Number.isFinite(serverTime)&&serverTime>0){if(Object.hasOwn(value,'serverTime'))value.serverTime=serverTime;if(bootstrap&&value.dashboard)value.dashboard.serverTime=serverTime;const classroom=path==='/api/circles/classrooms/mothers'?value:bootstrap?value.classroom:null;if(classroom?.timetable){classroom.timetable.serverTime=serverTime;for(const session of classroom.timetable.sessions||[])session.canJoin=Boolean(session.eligibleToJoin&&serverTime>=session.joinOpensAt&&serverTime<session.endsAt&&serverTime<session.eligibilityExpiresAt);}}return checkedV2Result(value,checkedContext);}
 const result=blob&&response.ok?await response.blob():await response.json();if(generation!==identity.generation)throw new DOMException('Your account changed.','AbortError');
 if(response.ok&&(result.authVersion===2&&result.app==='studio'||result.configuration?.authVersion===2))await configureStudioAuth(result.configuration||result);
  if(response.ok&&Number.isSafeInteger(result.coursePolicyEpoch)){const previous=observedCoursePolicyEpoch;observedCoursePolicyEpoch=result.coursePolicyEpoch;if(previous!==null&&previous!==observedCoursePolicyEpoch)window.dispatchEvent(new CustomEvent('website-course-policy-changed',{detail:{revision:observedCoursePolicyEpoch}}));}
 if(!response.ok){
  if([401,403,404,409].includes(response.status))clearPrivateReads();
  if(result.code==='ACCESS_REFRESH_REQUIRED'&&!refreshed&&!accessRefreshed&&path!=='/auth/access'){await renewAccess(result.offeringId);return api(path,{body,method,headers,blob,refreshed,accessRefreshed:true,statusRefreshed,optionalSession});}
  if(response.status===401&&['ADMIN_STATUS_EXPIRED','STATUS_EXPIRED'].includes(result.code)&&!refreshed&&!statusRefreshed&&path!=='/auth/refresh'){await renewStatus();return api(path,{body,method,headers,blob,refreshed,accessRefreshed,statusRefreshed:true,optionalSession});}
  if(response.status===401&&!['/auth/login','/auth/exchange'].includes(path)&&!(optionalSession&&['/api/me','/api/circles/bootstrap','/api/circles/reader-bootstrap'].includes(path.split('?')[0])&&!identity.account)){changed(null);window.dispatchEvent(new Event('website-session-ended'));}
  throw Object.assign(new Error(result.error||'This action is unavailable.'),{status:response.status,code:result.code,offeringId:result.offeringId});
 }if(eligible&&revision===readRevision)rememberPrivateRead(key,response.headers.get('ETag'),result,bootstrap);return checkedV2Result(result,checkedContext);
}
const pending=new Map();
export async function mutate(path,body){const key=path+JSON.stringify(body);if(!pending.has(key))pending.set(key,{...body,operationId:crypto.randomUUID()});const result=await api(path,{body:pending.get(key)});pending.delete(key);return result;}
window.addEventListener('website-session-ended',()=>pending.clear());
window.addEventListener('website-account-changed',()=>pending.clear());
export function downloadJSON(value,filename){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
