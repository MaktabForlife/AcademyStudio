// A per-tab view preference is never identity or authority. Read it only after
// the current account is verified; the dashboard API still checks that mode.
const key='m4l_circles_dashboard_view_v1';
export const dashboardWorkspace=value=>['learn','teach','admin'].includes(value)?value:null;
export function readDashboardPreference(storage){try{const raw=storage?.getItem(key);if(!raw||raw.length>1024)return null;const value=JSON.parse(raw);return typeof value.accountId==='string'&&value.accountId.length<=200&&dashboardWorkspace(value.mode)?{accountId:value.accountId,mode:value.mode}:null;}catch{return null;}}
export function dashboardHomeHref(mode){return '/?dashboard=1'+(dashboardWorkspace(mode)?'&workspace='+mode:'');}
export function readDashboardView(storage,accountId){
 if(typeof accountId!=='string'||!accountId)return null;
 try{const raw=storage?.getItem(key);if(!raw||raw.length>1024)return null;const value=JSON.parse(raw);return value.accountId===accountId?dashboardWorkspace(value.mode):null;}catch{return null;}
}
export function rememberDashboardView(storage,accountId,mode){
 if(typeof accountId!=='string'||!accountId||accountId.length>200||!dashboardWorkspace(mode))return;
 try{const value=JSON.stringify({accountId,mode});if(storage?.getItem(key)!==value)storage?.setItem(key,value);}catch{}
}
export function clearDashboardView(storage){try{storage?.removeItem(key);}catch{}}
export function dashboardViewStorage(){try{return globalThis.sessionStorage;}catch{return null;}}
export function updateDashboardHomeLinks(document,account){
 const href=dashboardHomeHref(readDashboardView(dashboardViewStorage(),account?.accountId));
 for(const link of document.querySelectorAll('[data-circles-dashboard-home]'))link.setAttribute('href',href);
 return href;
}
