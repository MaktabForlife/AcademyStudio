export const identity={account:null,generation:0};
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('maktab-web-account'):null;
export function changed(account){identity.account=account;identity.generation++;channel?.postMessage({accountId:account?.accountId||null});window.dispatchEvent(new CustomEvent('website-account-changed',{detail:account}));}
channel?.addEventListener('message',()=>{identity.account=null;identity.generation++;window.dispatchEvent(new Event('website-session-ended'));});
let refreshing=null;
export async function api(path,{body,method=body===undefined?'GET':'POST',headers={},blob=false,refreshed=false,optionalSession=false}={}){
 const generation=identity.generation,response=await fetch(path,{method,credentials:'same-origin',headers:{...(body!==undefined&&!(body instanceof Blob)?{'Content-Type':'application/json'}:{}),...headers},...(body===undefined?{}:{body:body instanceof Blob?body:JSON.stringify(body)})});
 const result=blob&&response.ok?await response.blob():await response.json();if(generation!==identity.generation)throw new DOMException('Your account changed.','AbortError');
 if(!response.ok){if(response.status===401&&['ADMIN_STATUS_EXPIRED','STATUS_EXPIRED'].includes(result.code)&&!refreshed&&path!=='/auth/refresh'){refreshing||=api('/auth/refresh',{body:{},refreshed:true}).finally(()=>refreshing=null);await refreshing;return api(path,{body,method,headers,blob,refreshed:true});}if(response.status===401&&!(optionalSession&&path==='/api/me'&&!identity.account)){changed(null);window.dispatchEvent(new Event('website-session-ended'));}throw Object.assign(new Error(result.error||'This action is unavailable.'),{status:response.status,code:result.code});}return result;
}
const pending=new Map();
export async function mutate(path,body){const key=path+JSON.stringify(body);if(!pending.has(key))pending.set(key,{...body,operationId:crypto.randomUUID()});const result=await api(path,{body:pending.get(key)});pending.delete(key);return result;}
window.addEventListener('website-session-ended',()=>pending.clear());
window.addEventListener('website-account-changed',()=>pending.clear());
export function downloadJSON(value,filename){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
