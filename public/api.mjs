export const identity={account:null,generation:0};
let observedCoursePolicyEpoch=null;
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('maktab-web-account'):null;
export function changed(account){identity.account=account;identity.generation++;resetRenewals();channel?.postMessage({accountId:account?.accountId||null});window.dispatchEvent(new CustomEvent('website-account-changed',{detail:account}));}
channel?.addEventListener('message',()=>{identity.account=null;identity.generation++;resetRenewals();window.dispatchEvent(new CustomEvent('website-session-ended',{detail:{externalAccountChange:true}}));});
let refreshing=null,renewalTail=Promise.resolve();const accessRefreshes=new Map(),readFlights=new Map();
function resetRenewals(){refreshing=null;renewalTail=Promise.resolve();accessRefreshes.clear();readFlights.clear();observedCoursePolicyEpoch=null;}
function renew(fn){const generation=identity.generation,run=renewalTail.then(()=>{if(generation!==identity.generation)throw new DOMException('Your account changed.','AbortError');return fn();});renewalTail=run.catch(()=>{});return run;}
function renewAccess(offeringId){const key=identity.generation+':'+(offeringId||'');if(!accessRefreshes.has(key)){const run=renew(()=>api('/auth/access',{body:{offeringId},refreshed:true})).finally(()=>{if(accessRefreshes.get(key)===run)accessRefreshes.delete(key);});accessRefreshes.set(key,run);}return accessRefreshes.get(key);}
function renewStatus(){if(!refreshing){const run=renew(()=>api('/auth/refresh',{body:{},refreshed:true})).finally(()=>{if(refreshing===run)refreshing=null;});refreshing=run;}return refreshing;}
// Share only identical reads that are still running. Completed private replies
// are never stored here: returning later still reaches the current server gate.
const sharedRead=path=>/^\/api\/(?:config|me|public\/circles|websites(?:\/[^/?]+)?|circles\/classrooms\/mothers)(?:\?|$)/.test(path);
export function api(path,options={}){
 const {body,method=body===undefined?'GET':'POST',headers={},blob=false,refreshed=false,accessRefreshed=false,statusRefreshed=false,optionalSession=false}=options;
 if(method!=='GET'||body!==undefined){readFlights.clear();return request(path,options);}
 if(!sharedRead(path)||readFlights.size>=64)return request(path,options);
 const key=JSON.stringify([identity.account?.accountId,identity.generation,path,Object.entries(headers).map(([name,value])=>[name.toLowerCase(),value]).sort(([a],[b])=>a.localeCompare(b)),blob,refreshed,accessRefreshed,statusRefreshed,optionalSession]);
 let pending=readFlights.get(key);
 if(!pending){pending=request(path,options).finally(()=>{if(readFlights.get(key)===pending)readFlights.delete(key);});readFlights.set(key,pending);}
 // Callers edit their own view models. Do not share mutable JSON between them.
 return pending.then(value=>blob?value:JSON.parse(JSON.stringify(value)));
}
async function request(path,{body,method=body===undefined?'GET':'POST',headers={},blob=false,refreshed=false,accessRefreshed=false,statusRefreshed=false,optionalSession=false}={}){
 const generation=identity.generation,response=await fetch(path,{method,credentials:'same-origin',headers:{...(body!==undefined&&!(body instanceof Blob)?{'Content-Type':'application/json'}:{}),...headers},...(body===undefined?{}:{body:body instanceof Blob?body:JSON.stringify(body)})});
 const result=blob&&response.ok?await response.blob():await response.json();if(generation!==identity.generation)throw new DOMException('Your account changed.','AbortError');
 if(response.ok&&Number.isSafeInteger(result.coursePolicyEpoch)){const previous=observedCoursePolicyEpoch;observedCoursePolicyEpoch=result.coursePolicyEpoch;if(previous!==null&&previous!==observedCoursePolicyEpoch)window.dispatchEvent(new CustomEvent('website-course-policy-changed',{detail:{revision:observedCoursePolicyEpoch}}));}
 if(!response.ok){
  if(result.code==='ACCESS_REFRESH_REQUIRED'&&!refreshed&&!accessRefreshed&&path!=='/auth/access'){await renewAccess(result.offeringId);return api(path,{body,method,headers,blob,refreshed,accessRefreshed:true,statusRefreshed,optionalSession});}
  if(response.status===401&&['ADMIN_STATUS_EXPIRED','STATUS_EXPIRED'].includes(result.code)&&!refreshed&&!statusRefreshed&&path!=='/auth/refresh'){await renewStatus();return api(path,{body,method,headers,blob,refreshed,accessRefreshed,statusRefreshed:true,optionalSession});}
  if(response.status===401&&!['/auth/login','/auth/exchange'].includes(path)&&!(optionalSession&&path==='/api/me'&&!identity.account)){changed(null);window.dispatchEvent(new Event('website-session-ended'));}
  throw Object.assign(new Error(result.error||'This action is unavailable.'),{status:response.status,code:result.code,offeringId:result.offeringId});
 }return result;
}
const pending=new Map();
export async function mutate(path,body){const key=path+JSON.stringify(body);if(!pending.has(key))pending.set(key,{...body,operationId:crypto.randomUUID()});const result=await api(path,{body:pending.get(key)});pending.delete(key);return result;}
window.addEventListener('website-session-ended',()=>pending.clear());
window.addEventListener('website-account-changed',()=>pending.clear());
export function downloadJSON(value,filename){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
