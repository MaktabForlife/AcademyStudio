import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
assert.equal(process.env.GITHUB_ACTIONS,'true','Disposable GitHub runners only.');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,message,timeout=10000){const end=Date.now()+timeout;for(;;){try{const value=await fn();if(value)return value;}catch{}if(Date.now()>=end)throw Error(message);await sleep(30);}}
class CDP{
 constructor(ws){this.ws=ws;this.next=0;this.pending=new Map();ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(!m.id)return;const entry=this.pending.get(m.id);if(!entry)return;this.pending.delete(m.id);clearTimeout(entry.timer);if(m.error)entry.reject(Error(entry.method+' failed'));else entry.resolve(m.result);});}
 static async open(url){const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',()=>reject(Error('CDP connection failed')),{once:true});});return new CDP(ws);}
 call(method,params={},sessionId){const id=++this.next;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error(method+' timed out'));},10000);this.pending.set(id,{resolve,reject,timer,method});this.ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
 async evaluate(tab,expression){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},tab.session);if(r.exceptionDetails)throw Error('Synthetic browser evaluation failed');return r.result.value;}
 async openTab(url){const {targetId}=await this.call('Target.createTarget',{url:'about:blank'}),{sessionId}=await this.call('Target.attachToTarget',{targetId,flatten:true}),tab={id:targetId,session:sessionId};await this.call('Page.enable',{},sessionId);await this.call('Runtime.enable',{},sessionId);await this.call('Target.activateTarget',{targetId});await this.call('Page.navigate',{url},sessionId);await until(()=>this.evaluate(tab,'Boolean(window.__lab)'), 'Synthetic app did not load.');return tab;}
}
async function server(app){
 const base=Date.now(),state={app,account:'alice',denied:false,offset:0,bootstrap:0,late:0,modules:0,lastFg:base};
 const module=await readFile(new URL('../src/auth/v110/browser-display-state.mjs',import.meta.url),'utf8'),script=await readFile(new URL('./jwt-v110-display-page.mjs',import.meta.url),'utf8');
 const session=()=>({app,accountId:state.account,sessionId:'session-'+state.account,parentId:'parent-'+state.account,browserId:'browser-one',browserGeneration:1,credentialEpoch:1,securityVersion:1,unlockGeneration:0,originalSignedAtMs:base,originalExpiresAtMs:base+604800000,lastForegroundRefreshMs:state.lastFg,serverNowMs:Date.now()+state.offset});
 const view=(s)=>({version:'view-'+s.accountId,items:[{id:'nav',label:'Synthetic '+s.accountId,href:'/courses/one'}]});
 const service=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const send=(value,status=200)=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(value));};
  if(url.pathname==='/ui-memory-v1.mjs'){state.modules++;res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'public, max-age=31536000, immutable'});res.end(module);return;}
  if(url.pathname==='/app-v1.mjs'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'public, max-age=31536000, immutable'});res.end(script);return;}
  if(url.pathname==='/bootstrap'){state.bootstrap++;if(state.denied){send({session:null,initialViews:[]});return;}const s=session();send({session:s,initialViews:[{key:'nav',context:s,view:view(s)}]});return;}
  if(url.pathname==='/late-view'){state.late++;const s=session(),body={context:s,view:view(s)};setTimeout(()=>send(body),350);return;}
  if(url.pathname==='/away'){res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-cache'});res.end('<!doctype html><title>Away</title>Public test page');return;}
  if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-cache'});res.end('<!doctype html><html data-app="'+app+'"><head><title>Synthetic display cache</title></head><body><main id="private" hidden></main><script type="module" src="/app-v1.mjs"></script></body></html>');
 });
 await new Promise(resolve=>service.listen(0,'127.0.0.1',resolve));
 return {state,url:'http://127.0.0.1:'+service.address().port,async close(){service.closeAllConnections();await new Promise(resolve=>service.close(resolve));}};
}
test('real Chromium clears local display state across tabs, rejects late context and masks restored navigation',async t=>{
 const executable=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);assert.ok(executable,'Use the GitHub runner installed browser.');
 const version=execFileSync(executable,['--version'],{encoding:'utf8'}).trim(),directory=await mkdtemp(join(tmpdir(),'jwt-display-lab-'));
 const chrome=spawn(executable,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--no-default-browser-check','--no-proxy-server','--remote-debugging-port=0','--user-data-dir='+directory,'about:blank'],{stdio:'ignore'});
 let client;
 t.after(async()=>{try{await client?.call('Browser.close');}catch{}client?.ws.close();chrome.kill('SIGKILL');await rm(directory,{recursive:true,force:true});});
 const portFile=await until(async()=>{try{return await readFile(join(directory,'DevToolsActivePort'),'utf8');}catch{return null;}},'Chromium did not start.');
 const [port,path]=portFile.trim().split('\n');client=await CDP.open('ws://127.0.0.1:'+port+path);
 const studio=await server('studio'),isolated=await server('studio');t.after(()=>studio.close());t.after(()=>isolated.close());
 const a=await client.openTab(studio.url+'/'),ready=tab=>until(()=>client.evaluate(tab,"window.__lab.state().phase==='ready'"),'Synthetic context did not verify.');
 await ready(a);const start=studio.state.bootstrap;assert.equal(await client.evaluate(a,'window.__lab.hit()'),true);assert.equal(await client.evaluate(a,'window.__lab.hit()'),true);assert.equal(studio.state.bootstrap,start);
 const b=await client.openTab(studio.url+'/');await ready(b);
 // Even if headless visibility differs, an app-local invalidation must reach
 // the active second tab and remove its actual rendered personal text.
 await client.evaluate(a,"window.__lab.clear('logout')");
 await until(()=>client.evaluate(b,"window.__lab.snapshot().hidden&&window.__lab.state().entryCount===0"),'Same-origin active tab retained private display.');
 assert.equal((await client.evaluate(b,'window.__lab.snapshot()')).text,'');
 const c=await client.openTab(isolated.url+'/');await ready(c);await client.evaluate(a,"window.__lab.clear('known-cancellation')");
 await sleep(80);const other=await client.evaluate(c,'window.__lab.snapshot()');assert.equal(other.state.phase,'ready');assert.ok(other.text.includes('alice'),'Negative control: the same app at another origin cannot receive this broadcast.');
 // Explicitly reverify the active Studio tab before testing a deliberately
 // non-abortable response from the previous person.
 await client.call('Target.activateTarget',{targetId:b.id});await client.evaluate(b,'window.__lab.recheck()');await ready(b);
 const before=studio.state.late;await client.evaluate(b,'window.__lab.beginLate()');await until(()=>studio.state.late>before,'Delayed request did not reach loopback server.');
 await client.evaluate(b,"window.__lab.clear('switch');window.__lab.watchOld()");
 studio.state.account='bob';await client.evaluate(b,'window.__lab.recheck()');await ready(b);
 await until(()=>client.evaluate(b,'window.__lateDone===true'),'Delayed response did not finish.');
 let snapshot=await client.evaluate(b,'window.__lab.snapshot()');assert.equal(await client.evaluate(b,'window.__lateAccepted'),false);assert.ok(snapshot.text.includes('bob'));assert.ok(!snapshot.text.includes('alice'));assert.equal(snapshot.oldVisibleFrames,0);
 // Native closed BroadcastChannel must fail independently of local DOM
 // clearing. The page wrapper records that the mask preceded failed delivery.
 await client.evaluate(b,'window.__lab.closeChannel()');
 await client.evaluate(b,"window.__lab.clear('logout')");
 const transportSnapshot=await client.evaluate(b,'window.__lab.snapshot()');
 assert.equal(transportSnapshot.channelPostFailures,1);assert.equal(transportSnapshot.maskedBeforePostFailure,true);
 assert.equal(transportSnapshot.hidden,true);assert.equal(transportSnapshot.text,'');assert.equal(transportSnapshot.state.entryCount,0);
 await client.evaluate(b,'window.__lab.recheck()');await ready(b);
 // Real history navigation executes pagehide and pageshow. Record whether
 // Chrome used BFCache; a full reload still must begin masked.
 await client.call('Page.navigate',{url:studio.url+'/away'},b.session);await until(()=>client.evaluate(b,'document.title==="Away"'),'Navigation did not complete.');
 studio.state.denied=true;
 const history=await client.call('Page.getNavigationHistory',{},b.session),back=history.entries[history.currentIndex-1];assert.ok(back);
 await client.call('Page.navigateToHistoryEntry',{entryId:back.id},b.session);await until(()=>client.evaluate(b,"Boolean(window.__lab)&&window.__lab.state().reason==='verification-failed'"),'Restored page did not fail closed on denied context.');
 snapshot=await client.evaluate(b,'window.__lab.snapshot()');assert.equal(snapshot.hidden,true);assert.equal(snapshot.text,'');assert.equal(snapshot.state.entryCount,0);
 const snapshots=await Promise.all([a,b,c].map(tab=>client.evaluate(tab,'window.__lab.snapshot()')));assert.ok(snapshots.every(s=>s.persistentCalls===0));
 const result={browser:version,loopbackOrigins:2,sameOriginTabs:2,cacheHitsAddedNetworkRequests:0,sameOriginClearRemovesRenderedText:true,crossOriginClearAutomatic:false,negativeControlOtherOriginRetainsOwnDisplay:true,lateOldResponseAccepted:false,observedOldAccountFramesAfterSwitch:0,closedChannelLocalDOMCleared:true,closedChannelPostFailures:transportSnapshot.channelPostFailures,localDOMMaskedBeforeFailedPost:transportSnapshot.maskedBeforePostFailure,historyReturnDeniedContextMasked:true,actualBFCacheRestore:snapshot.pageshowPersisted,persistentStorageWriteCalls:0,applicationDBCalls:0,realAppImports:0,realCookieOrMasterContextCoordination:false,scope:'Synthetic DOM and authoritative-view stub; no actual app/media/credential/BFCache-universal privacy or activation proof'};
 await mkdir('.build/jwt-v110-browser-memory',{recursive:true});await writeFile('.build/jwt-v110-browser-memory/browser.json',JSON.stringify(result,null,2)+'\n');t.diagnostic('V110_DISPLAY_MEMORY_BROWSER='+JSON.stringify(result));
});
