import {circlesCatalogue} from './circles-catalogue.mjs';

// Presentation only. The caller supplies the current account's checked rights.
// No requests, entitlement inference, storage or global account state live here.
export function tafseerRailHTML(items,rights){
 const catalogue=items.filter(item=>item?.kind==='TAFSEER');
 return '<header><h2 id="dashboard-tafseer-title">Tafseer and Tadabbur</h2><a href="/studio/?view=collections&collection=tafseer">Show all ↗</a></header><div class="connected-circles collection-card-only">'+circlesCatalogue(catalogue,rights,{applicationPath:'/studio/',kind:'TAFSEER',checkedOpening:true})+'</div>';
}

export function mountTafseerRail(document){
 let rail=null,content=null;
 const hiddenLinks=new Map();
 function restoreLinks(){for(const [link,wasHidden]of hiddenLinks)if(link.hidden!==wasHidden)link.hidden=wasHidden;hiddenLinks.clear();}
 function clear(){restoreLinks();rail?.remove();rail=null;content=null;}
 function update({visible=false,items=[],rights=[],loading=false,error=null}={}){
  const dashboard=document.querySelector('#circles-dashboard');
  if(!visible||!dashboard){clear();return;}
  if(!rail?.isConnected||rail.parentNode!==dashboard){clear();rail=document.createElement('section');rail.className='circles-tafseer-rail';rail.setAttribute('aria-labelledby','dashboard-tafseer-title');dashboard.append(rail);}
  const ready=!loading&&!error&&Array.isArray(items)&&Array.isArray(rights),catalogue=ready?items.filter(item=>item?.kind==='TAFSEER'):[];
  // Keep the working programme link during loading, empty results and errors.
  if(!catalogue.length)restoreLinks();
  else for(const link of dashboard.querySelectorAll('[data-circle-tafseer-link],.circles-programme-link[href*="collection=tafseer"]')){if(!hiddenLinks.has(link))hiddenLinks.set(link,link.hidden);if(!link.hidden)link.hidden=true;}
  const html=catalogue.length?tafseerRailHTML(catalogue,rights):'<header><h2 id="dashboard-tafseer-title">Tafseer and Tadabbur</h2></header><p role="status">'+(loading?'Loading your Tafseer cards…':error||!ready?'Your Tafseer cards could not be loaded. Open Tafseer above or try Refresh.':'No Tafseer subjects are available yet.')+'</p>';
  if(content!==html){rail.innerHTML=html;content=html;}
 }
 return {update,clear};
}
