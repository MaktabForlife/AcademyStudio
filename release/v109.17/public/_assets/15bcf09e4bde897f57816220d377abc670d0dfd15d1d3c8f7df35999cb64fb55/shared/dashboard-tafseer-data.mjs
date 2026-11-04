// Card metadata is public. The checked access batch supplies display badges,
// never authority: opening a reader, recording or file retains its native gate.
export function dashboardTafseerData({api,identity,view,window=globalThis.window,now=Date.now}){
 const maxAge=43200_000;let owner=null,epoch=0,visible=false,catalogue=null,catalogueFlight=null,flight=null,state=null;
 const accountKey=()=>identity.account?.accountId?JSON.stringify([identity.account.accountId,identity.account.cacheSession||null,identity.generation]):null;
 // The renderer keeps unchanged nodes stable, but must still see updates after
 // the native dashboard replaces its host. A data-only signature misses that.
 function paint(value){view.update(value);}
 function clearView(){view.clear();}
 function valid(value){return value&&now()>=value.checkedAt&&now()-value.checkedAt<maxAge;}
 async function items(){
  if(catalogue)return catalogue;
  if(!catalogueFlight){const pending=api('/api/public/circles').then(value=>{
   if(!Array.isArray(value.items)||value.items.length>200)throw Error('Open Tafseer to review the available collections.');
   const rows=value.items.filter(row=>row.kind==='TAFSEER'),ids=[...new Set(rows.map(row=>row.websiteId).filter(Boolean))];
   if(ids.length>50)throw Error('Open Tafseer to view the full collection.');
   if(catalogueFlight===pending)catalogue={items:rows,ids};return {items:rows,ids};
  }).finally(()=>{if(catalogueFlight===pending)catalogueFlight=null;});catalogueFlight=pending;}
  return catalogueFlight;
 }
 async function update(show){
  const next=accountKey();if(next!==owner){epoch++;owner=next;state=null;flight=null;clearView();}
  visible=Boolean(show&&owner);if(!visible){paint({visible:false,items:[],rights:[],loading:false,error:''});return;}
  if(valid(state)){paint({visible:true,...state});return;}
  if(flight)return flight;
  const stamp=epoch,account=owner;paint({visible:true,items:[],rights:[],loading:true,error:''});
  const current=()=>stamp===epoch&&account===owner&&account===accountKey();
  const job=(async()=>{try{
   const page=await items();if(!current())return;
   const result=page.ids.length?await api('/api/circles/access?'+new URLSearchParams(page.ids.map(id=>['website',id]))):{websites:[]};if(!current())return;
   const rights=result.websites,seen=new Set();
   if(!Array.isArray(rights)||rights.length!==page.ids.length||rights.some(row=>{if(!row||!page.ids.includes(row.websiteId)||seen.has(row.websiteId)||typeof row.canOpen!=='boolean')return true;seen.add(row.websiteId);return false;}))throw Error('The Tafseer access list could not be checked. Try Refresh.');
   state={items:page.items,rights,loading:false,error:'',checkedAt:now()};
  }catch(error){if(current())state={items:[],rights:[],loading:false,error:error.message||'Tafseer could not be loaded. Try Refresh.',checkedAt:now()};}
  finally{if(flight===job)flight=null;if(current()&&visible&&state)paint({visible:true,...state});}})();
  flight=job;return job;
 }
 function invalidate({publicItems=false}={}){epoch++;state=null;flight=null;if(publicItems){catalogue=null;catalogueFlight=null;}clearView();}
 const listeners=[];
 for(const name of ['website-account-changed','website-session-ended']){const listener=()=>{invalidate();catalogueFlight=null;owner=accountKey();};window.addEventListener(name,listener);listeners.push([name,listener]);}
 for(const name of ['website-display-invalidated','website-course-policy-changed']){const listener=()=>{invalidate({publicItems:true});if(visible)void update(true);};window.addEventListener(name,listener);listeners.push([name,listener]);}
 return {update,refresh(){invalidate({publicItems:true});return update(visible);},clear(){visible=false;invalidate();owner=accountKey();},dispose(){for(const [name,listener]of listeners)window.removeEventListener(name,listener);visible=false;invalidate();}};
}
