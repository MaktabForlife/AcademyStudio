// Presentation routes only. Every reader/editor request still uses its normal
// server session, publication and entitlement gate.
export function legacyStudioDestination(url){
 if(url.pathname!=='/'&&url.pathname!=='/index.html')return null;
 const p=url.searchParams;
 if(!p.has('website')&&p.get('view')!=='collections'&&p.get('manage')!=='1'&&p.get('destination')!=='academy')return null;
 return '/studio/'+url.search+url.hash;
}
export const applicationPath=document=>document.documentElement.dataset.circlesHomepage==='1'?'/studio/':'/';
export const collectionKind=value=>value==='courses'?'COURSE':'TAFSEER';
