// Cached history entries must not restore a previous account's private screen.
// This changes only this page's memory; it does not sign out other tabs.
export function protectAccountHistory({window,identity,clear}){
 window.addEventListener('pagehide',()=>{identity.account=null;identity.generation++;clear();});
 window.addEventListener('pageshow',event=>{if(event.persisted)window.location.reload();});
}
