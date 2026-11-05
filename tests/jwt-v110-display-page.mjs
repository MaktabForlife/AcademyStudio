// Browser lab page only, served by a loopback test server on GitHub.
import {createDisplayMemory} from '/ui-memory-v1.mjs';
const app=document.documentElement.dataset.app,root=document.querySelector('#private');
const events=[];let cache,channel,persistentCalls=0,oldVisibleFrames=0,watchOld=false,channelPostFailures=0,maskedBeforePostFailure=true;
for(const [proto,key]of [[globalThis.Storage?.prototype,'setItem'],[globalThis.IDBFactory?.prototype,'open'],[globalThis.CacheStorage?.prototype,'open']]){
 if(proto&&typeof proto[key]==='function'){const original=proto[key];proto[key]=function(...args){persistentCalls++;return original.apply(this,args);};}
}
function mask(){root.hidden=true;root.replaceChildren();}
function render(){
 const state=cache?.state(),value=cache?.peek('nav');
 if(state?.phase==='ready'&&value){root.textContent=value.items.map(x=>x.label).join(' ');root.hidden=false;}else mask();
}
cache=createDisplayMemory({app,verifySession:async({signal})=>{const r=await fetch('/bootstrap',{cache:'no-store',signal});if(!r.ok)throw Error('Unverifiable session.');return r.json();},channelFactory:name=>{channel=new BroadcastChannel(name);const post=channel.postMessage.bind(channel);channel.postMessage=message=>{try{return post(message);}catch(error){channelPostFailures++;maskedBeforePostFailure=maskedBeforePostFailure&&root.hidden&&root.textContent==='';throw error;}};return channel;},onClear:reason=>{mask();events.push({kind:'clear',reason});},onState:state=>{events.push({kind:'state',phase:state.phase});render();}});
cache.bindLifecycle(window,document);
window.__lastShowPersisted=false;window.addEventListener('pageshow',e=>{window.__lastShowPersisted=e.persisted;});
function frame(){if(watchOld&&!root.hidden&&root.textContent.includes('alice'))oldVisibleFrames++;requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.__lab={
 state:()=>cache.state(),
 snapshot:()=>({state:cache.state(),hidden:root.hidden,text:root.textContent,persistentCalls,oldVisibleFrames,channelPostFailures,maskedBeforePostFailure,visibility:document.visibilityState,pageshowPersisted:window.__lastShowPersisted,events:events.slice(-20)}),
 recheck:()=>cache.recheck('resume'),
 clear:reason=>cache.clear(reason,{broadcast:true}),
 hit:async()=>{const v=await cache.load('nav',async()=>{throw Error('A hot display unexpectedly fetched.');});return Boolean(v);},
 watchOld:()=>{watchOld=true;oldVisibleFrames=0;},
 beginLate:()=>{window.__lateDone=false;window.__lateAccepted=null;window.__latePromise=cache.load('nav',async()=>{const r=await fetch('/late-view',{cache:'no-store'});return r.json();},{force:true}).then(value=>{window.__lateAccepted=Boolean(value);window.__lateDone=true;render();});return true;},
 closeChannel:()=>channel.close(),
 close:()=>cache.close()
};
void cache.recheck('resume');
