import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,extname,sep} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
assert.equal(process.env.GITHUB_ACTIONS,'true','Disposable GitHub runners only.');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,message,timeout=12000){const end=Date.now()+timeout;for(;;){try{const value=await fn();if(value)return value;}catch{}if(Date.now()>=end)throw Error(message);await sleep(30);}}
class CDP{
 constructor(ws){this.events=[];this.ws=ws;this.next=0;this.pending=new Map();ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(!m.id){if(m.method==='Runtime.exceptionThrown')this.events.push({session:m.sessionId,text:m.params.exceptionDetails.text,url:m.params.exceptionDetails.url,line:m.params.exceptionDetails.lineNumber,description:String(m.params.exceptionDetails.exception?.description||'').split('\\n')[0]});return;}const entry=this.pending.get(m.id);if(!entry)return;this.pending.delete(m.id);clearTimeout(entry.timer);if(m.error)entry.reject(Error(entry.method+' failed'));else entry.resolve(m.result);});}
 static async open(url){const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',()=>reject(Error('CDP connection failed')),{once:true});});return new CDP(ws);}
 call(method,params={},sessionId){const id=++this.next;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error(method+' timed out'));},10000);this.pending.set(id,{resolve,reject,timer,method});this.ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
 async evaluate(tab,expression){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},tab.session);if(r.exceptionDetails)throw Error('Synthetic browser evaluation failed');return r.result.value;}
 async openTab(url){const {targetId}=await this.call('Target.createTarget',{url:'about:blank'}),{sessionId}=await this.call('Target.attachToTarget',{targetId,flatten:true}),tab={id:targetId,session:sessionId};await this.call('Page.enable',{},sessionId);await this.call('Runtime.enable',{},sessionId);await this.call('Target.activateTarget',{targetId});await this.call('Page.navigate',{url},sessionId);await until(()=>this.evaluate(tab,'document.readyState==="complete"&&location.href!=="about:blank"'), 'Synthetic app did not load.');return tab;}
}

const contentType=path=>({'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'}[extname(path)]||'application/octet-stream');
const makeSession=(app,state)=>({app,accountId:app==='hifz'?'hifz-'+state.account:'account-'+state.account,sessionId:app==='academy'?'parent-'+state.account:app+'-session-'+state.account,parentId:'parent-'+state.account,browserId:'browser-one',browserGeneration:1,credentialEpoch:1,securityVersion:1,unlockGeneration:0,originalSignedAtMs:state.base,originalExpiresAtMs:state.base+604800000,lastForegroundRefreshMs:state.base,serverNowMs:Date.now()});
const binding=state=>createHash('sha256').update(JSON.stringify(['uaa-ui-fence-v1','parent-'+state.account,'browser-one',1])).digest('hex');
async function nativeSites(){
 const paths={academy:resolve(process.env.ACADEMY_SOURCE||''),studio:resolve('public'),hifz:resolve(process.env.HIFZ_SOURCE||'')};
 assert.ok(process.env.ACADEMY_SOURCE&&process.env.HIFZ_SOURCE,'Pinned native frontend checkouts required.');
 const state={account:'alice',base:Date.now(),liveRevision:0,slowStarted:0,slowSent:0,requests:[],denied:false},services={},origins={};
 for(const app of ['academy','studio','hifz']){
  const service=http.createServer((req,res)=>{void serve(app,req,res).catch(()=>{if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end('{"code":"SYNTHETIC_FIXTURE_ERROR"}');});});
  await new Promise(resolve=>service.listen(0,'127.0.0.1',resolve));services[app]=service;origins[app]='http://127.0.0.1:'+service.address().port;
 }
 async function serve(app,req,res){
  const url=new URL(req.url,origins[app]);state.requests.push({app,path:url.pathname,method:req.method});
  const send=(body,status=200)=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
  const name='Synthetic '+state.account,accountId=app==='hifz'?'hifz-'+state.account:'account-'+state.account;
  if(url.pathname==='/auth/v110/context'){send(state.denied?{session:null,initialViews:[]}:{session:makeSession(app,state),initialViews:[]});return;}
  if(url.searchParams.get('slow')==='1'){state.slowStarted++;const old={accountId,displayName:name};setTimeout(()=>{state.slowSent++;send(old);},650);return;}
  if(app==='academy'&&url.pathname==='/api/account/session'){send({success:true,account:{accountId,displayName:name,uniqueid:'SYNTHETIC1'},context:{scope:'WEBSITE',courseId:'',role:'CONTENT_READER'},contexts:[],sessionStore:'D1'});return;}
  if(app==='academy'&&url.pathname==='/api/account/logout'){send({success:true});return;}
  if(app==='studio'){
   if(url.pathname==='/api/config'){send({academyOrigin:origins.academy,isolatedPreview:true,authorityMode:'WEBSITE'});return;}
   if(url.pathname==='/api/me'){send({accountId,displayName:name,globalAdmin:false,cacheSession:'synthetic-'+state.account,verifiedAt:Date.now(),sessionExpiresAt:state.base+604800000});return;}
   if(url.pathname==='/api/public/circles'){send({items:[]});return;}
   if(url.pathname==='/api/websites'){send({websites:[],playlists:[],more:false});return;}
  }
  if(app==='hifz'){
   if(url.pathname==='/profile'){send({id:accountId,login_id:'SYNTHETIC1',name,role:'student',active:1,setup_complete:1,academy_managed:1,maktab_timezone:'Asia/Riyadh',track_haidh:0});return;}
   if(url.pathname==='/sabaq'&&url.searchParams.has('live-probe')){send({revision:++state.liveRevision,rows:[]});return;}
   if(url.pathname==='/tajweed-tags'){send([]);return;}
   if(url.pathname==='/auth/policy'){send({academy_profiles_only:true});return;}
   if(!extname(url.pathname)&&!['/','/setup'].includes(url.pathname)){send([]);return;}
  }
  if(url.pathname==='/setup'){res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-cache'});res.end('<!doctype html><title>Fixture setup</title>');return;}
  if(url.pathname==='/away'){res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-cache'});res.end('<!doctype html><title>Away</title>Public fixture page');return;}
  if(url.pathname==='/auth/v110/browser-config.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-cache'});res.end('window.M4L_V110_CONFIG ||= '+JSON.stringify({enabled:true,app,origins,apiOrigins:[origins[app]]})+';');return;}
  let path=url.pathname;
  if(app==='academy'&&path==='/academy/')path='/academy/index.html';
  if(app==='studio'&&path==='/studio/')path='/studio/index.html';
  if(app==='hifz'&&path==='/')path='/index.html';
  const root=paths[app],file=resolve(root,'.'+path);if(!file.startsWith(root+sep)){send({code:'NOT_FOUND'},404);return;}
  let body;try{body=await readFile(file);}catch{send({code:'NOT_FOUND'},404);return;}
  const type=contentType(file);
  if(type==='text/html'&&url.pathname!=='/auth/v110/browser-control.html'){
   let html=body.toString('utf8');
   if(app==='academy'){
    // The real native sign-in controller and actual workspace markup are
    // executed. Other Academy workspace/data controllers are outside scope.
    html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('</body>','<script src="/js/m4l-academy-login.js"></script></body>');
   }
   if(app==='hifz')html=html.replace(/<script src="js\/app\.js/,'<script>rememberLoginId("SYNTHETIC1");setToken("synthetic-fixture-bearer");</script><script src="js/app.js');
   if(!html.includes('/auth/v110/browser-bootstrap.js'))html=html.replace(/<head([^>]*)>/,'<head$1><script src="/auth/v110/browser-bootstrap.js"></script>');
   body=Buffer.from(html);
  }
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self' "+origins.academy});res.end(body);
 }
 return {state,origins,async close(){for(const service of Object.values(services)){service.closeAllConnections();await new Promise(resolve=>service.close(resolve));}}};
}
test('native frontend hooks clear across three real origins and keep suspended/missed/late/unverifiable displays masked',async t=>{
 const executable=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);assert.ok(executable,'GitHub runner browser required.');
 const version=execFileSync(executable,['--version'],{encoding:'utf8'}).trim(),directory=await mkdtemp(join(tmpdir(),'jwt-native-browser-')),sites=await nativeSites();t.after(()=>sites.close());
 const chrome=spawn(executable,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--no-default-browser-check','--no-proxy-server','--remote-debugging-port=0','--user-data-dir='+directory,'about:blank'],{stdio:'ignore'});let c;
 t.after(async()=>{try{await c?.call('Browser.close');}catch{}c?.ws.close();chrome.kill('SIGKILL');await rm(directory,{recursive:true,force:true});});
 const portFile=await until(async()=>{try{return await readFile(join(directory,'DevToolsActivePort'),'utf8');}catch{return null;}},'Chromium did not start.');
 const[port,path]=portFile.trim().split('\n');c=await CDP.open('ws://127.0.0.1:'+port+path);
 async function page(app,url,{provider=false,brokenStorage=false}={}){
  const {targetId}=await c.call('Target.createTarget',{url:'about:blank'}),{sessionId}=await c.call('Target.attachToTarget',{targetId,flatten:true}),tab={id:targetId,session:sessionId};
  await c.call('Page.enable',{},sessionId);await c.call('Runtime.enable',{},sessionId);
  const origins={...sites.origins,...(provider?{hifz:new URL(url).origin}:{})},config={enabled:true,app,origins,apiOrigins:[new URL(url).origin]};
  const init=[
   '(()=>{const cfg=__CFG__;',
   'window.__protocol=[];window.addEventListener("message",event=>{const m=event.data;if(m?.type?.startsWith("UAA_CONTROL"))window.__protocol.push({type:m.type,origin:event.origin,ok:m.ok,code:m.code,active:m.state?.active});});',
   'if(window.top===window){',
   ' window.M4L_V110_CONFIG=cfg;window.M4L_CONFIG={API_BASE:cfg.origins.academy};',
   ' localStorage.setItem("m4l_account_token","synthetic-fixture-bearer");',
   ' if(cfg.app==="hifz")localStorage.setItem("hh_api_base",location.origin);',
   ' const original=window.fetch.bind(window);window.fetch=(input,options={})=>{if(String(input).includes("slow=1")){const next={...options};delete next.signal;return original(input,next);}return original(input,options);};',
   '}else if(__BROKEN__&&location.origin===__ACADEMY__){',
   ' const get=Storage.prototype.getItem;Storage.prototype.getItem=function(key){if(key==="uaa-v110-ui-control-v1")throw Error("Synthetic disabled storage");return get.call(this,key);};',
   '}})();'
  ].join('\n').replace('__CFG__',JSON.stringify(config)).replace('__BROKEN__',JSON.stringify(brokenStorage)).replace('__ACADEMY__',JSON.stringify(sites.origins.academy));
  await c.call('Page.addScriptToEvaluateOnNewDocument',{source:init},sessionId);
  await c.call('Target.activateTarget',{targetId});await c.call('Page.navigate',{url},sessionId);return tab;
 }
 const ready=async tab=>{try{return await until(()=>c.evaluate(tab,"document.documentElement.dataset.uaaV110State==='ready'"),'Native private display did not verify.');}catch(error){t.diagnostic('SAFE_BROWSER_DIAGNOSTIC='+JSON.stringify({page:await c.evaluate(tab,'({app:window.M4L_V110_CONFIG?.app,state:document.documentElement.dataset.uaaV110State,visibility:document.visibilityState,facade:Boolean(window.M4L_V110),header:document.getElementById("academy-header-name")?.textContent,gate:document.querySelector("[data-uaa-gate-message]")?.textContent,frames:document.querySelectorAll("iframe[data-uaa-control]").length,protocol:window.__protocol,frameInfo:(()=>{const w=document.querySelector("iframe[data-uaa-control]")?.contentWindow;try{return{url:w?.location.href,app:w?.M4L_V110_CONFIG?.app,enabled:w?.M4L_V110_CONFIG?.enabled,ready:w?.document.readyState,locks:Boolean(w?.navigator.locks),active:JSON.parse(w?.localStorage.getItem("uaa-v110-ui-control-v1"))?.active,protocol:w?.__protocol}}catch{return{inaccessible:true}}})()})'),requests:sites.state.requests,errors:c.events}));throw error;}},masked=tab=>until(()=>c.evaluate(tab,"document.documentElement.classList.contains('uaa-v110-masked')"),'Native private display remained visible.');
 const setup=await c.openTab(sites.origins.academy+'/setup');
 async function establish(){
  return c.evaluate(setup,'(async()=>{const{createBrowserControl}=await import("/auth/v110/browser-control-relay.mjs");const control=createBrowserControl({storage:localStorage,exclusive:fn=>navigator.locks.request("uaa-v110-ui-control",fn)});const intent=await control.clear("switch");await control.establish({expectedRevision:intent.revision,binding:'+JSON.stringify(binding(sites.state))+',expiresAtMs:'+JSON.stringify(sites.state.base+604800000)+'});return true;})()');
 }
 // This models an already completed Master sign-in via the actual control
 // module; it is not a test of the still-pending JWT issuer/PIN/admission.
 // Empty/blocked contexts must expose only the real Academy credential
 // dialog. The pre-existing workspace stays masked throughout re-entry.
 async function publicPinSurface(tab){
  await masked(tab);
  await until(()=>c.evaluate(tab,'Boolean(window.M4L_ACADEMY_LOGIN?.openPublicSignIn)&&Boolean(document.querySelector("[data-uaa-open-sign-in]"))'),'Public Academy sign-in action missing.');
  await c.evaluate(tab,'document.getElementById("academy-header-name").textContent="Synthetic previous account";document.querySelector("[data-uaa-open-sign-in]").click();true');
  await until(()=>c.evaluate(tab,'document.getElementById("academy-login-dialog").open'),'The actual native PIN dialog did not open.');
  const ui=await c.evaluate(tab,'({masked:document.documentElement.classList.contains("uaa-v110-masked"),pinVisible:getComputedStyle(document.getElementById("demo-pin")).visibility==="visible",formVisible:!document.getElementById("login-preview").hidden,workspaceHidden:getComputedStyle(document.getElementById("academy-home-card")).visibility==="hidden",nameHidden:getComputedStyle(document.getElementById("academy-header-name")).visibility==="hidden",pinBlank:document.getElementById("demo-pin").value==="",nameBlank:document.getElementById("academy-header-name").textContent===""})');
  assert.deepEqual(ui,{masked:true,pinVisible:true,formVisible:true,workspaceHidden:true,nameHidden:true,pinBlank:true,nameBlank:true});
  await c.call('Target.closeTarget',{targetId:tab.id});
 }
 sites.state.denied=true;const empty=await page('academy',sites.origins.academy+'/academy/#login');await publicPinSurface(empty);
 sites.state.denied=false;
 await c.evaluate(setup,'(async()=>{const{createBrowserControl}=await import("/auth/v110/browser-control-relay.mjs");const control=createBrowserControl({storage:localStorage,exclusive:fn=>navigator.locks.request("uaa-v110-ui-control",fn)});await control.clear("logout");return true;})()');
 const blocked=await page('academy',sites.origins.academy+'/academy/#login');await publicPinSurface(blocked);
 await establish();
 const a=await page('academy',sites.origins.academy+'/academy/#probe');await ready(a);assert.ok((await c.evaluate(a,"document.getElementById('academy-header-name').textContent")).includes('alice'));
 const b=await page('studio',sites.origins.studio+'/studio/');await ready(b);assert.ok((await c.evaluate(b,"document.getElementById('account-name').textContent")).includes('alice'));
 const h=await page('hifz',sites.origins.hifz+'/');await ready(h);await until(()=>c.evaluate(h,"document.querySelector('#authBand .user-name').textContent.includes('alice')"),'Native Hifz profile did not render.');
 const counts=()=>({academy:sites.state.requests.filter(r=>r.app==='academy'&&/^\/api\//.test(r.path)).length,context:sites.state.requests.filter(r=>r.path==='/auth/v110/context').length});
 const before=counts(),live=await c.evaluate(h,"Promise.all([apiFetch('/sabaq?live-probe=1'),apiFetch('/sabaq?live-probe=2')])");
 assert.notEqual(live[0].revision,live[1].revision);assert.deepEqual(counts(),before);
 // Cross-site provider negative control. Independently inspect its actual
 // Academy-origin frame's storage partition, not just the origin rejection.
 const providerURL=sites.origins.hifz.replace('127.0.0.1','localhost')+'/',provider=await page('hifz',providerURL,{provider:true});await sleep(4500);await masked(provider);
 const relayURL=sites.origins.academy+'/auth/v110/browser-control.html';
 assert.equal(await c.evaluate(provider,'document.querySelector("iframe[data-uaa-control]")?.src'),relayURL);
 // Cross-site frames normally have their own renderer/DevTools target.
 // Inspect that target; the parent's same-process frame tree may omit it.
 const targets=await c.call('Target.getTargets'),remote=targets.targetInfos.find(target=>target.type==='iframe'&&target.url===relayURL);
 const storageProbe='(()=>{try{return localStorage.getItem("uaa-v110-ui-control-v1")===null?"empty":"present"}catch{return "unavailable"}})()';
 let partition;
 if(remote){
  const attached=await c.call('Target.attachToTarget',{targetId:remote.targetId,flatten:true});
  await c.call('Runtime.enable',{},attached.sessionId);
  partition=await c.call('Runtime.evaluate',{expression:storageProbe,returnByValue:true},attached.sessionId);
 }else{
  const tree=await c.call('Page.getFrameTree',{},provider.session),all=[];
  const visit=node=>{all.push(node.frame);for(const child of node.childFrames||[])visit(child);};visit(tree.frameTree);
  const frame=all.find(frame=>frame.url===relayURL);assert.ok(frame,'Provider relay frame must be inspectable.');
  const world=await c.call('Page.createIsolatedWorld',{frameId:frame.id,worldName:'read-control-partition'},provider.session);
  partition=await c.call('Runtime.evaluate',{contextId:world.executionContextId,expression:storageProbe,returnByValue:true},provider.session);
 }
 assert.ok(['empty','unavailable'].includes(partition.result.value),'A cross-site provider must not share the Academy control baseline');
 await c.call('Target.activateTarget',{targetId:b.id});await ready(b);
 await c.call('Page.setWebLifecycleState',{state:'frozen'},h.session);
 const slowBefore=sites.state.slowStarted;await c.evaluate(b,"import('/api.mjs').then(({api})=>{window.__lateAccepted=false;api('/api/me?slow=1').then(()=>{window.__lateAccepted=true;},()=>{});return true;})");
 await until(()=>sites.state.slowStarted>slowBefore,'Late native query did not start.');
 // Actual native Academy sign-out handler, without activating that hidden tab:
 // Studio remains the active display when the cross-origin clear arrives.
 await c.evaluate(a,"document.getElementById('academy-sign-out').click();true");
 await masked(b);await until(()=>sites.state.slowSent>0,'Late native response did not arrive.');await sleep(100);
 assert.equal(await c.evaluate(b,"document.getElementById('account-name').textContent"),'');
 assert.equal(await c.evaluate(b,"window.__lateAccepted===true"),false);
 await c.evaluate(b,"window.postMessage({v:1,type:'UAA_CONTROL_REPLY',nonce:'wrong',requestId:'wrong',ok:true,state:{active:true}},'*');true");await sleep(50);await masked(b);
 await c.call('Page.setWebLifecycleState',{state:'active'},h.session);await c.call('Target.activateTarget',{targetId:h.id});await masked(h);
 await sleep(250);assert.equal(await c.evaluate(h,"document.documentElement.dataset.uaaV110State==='ready'"),false);
 await c.call('Target.activateTarget',{targetId:b.id});await c.call('Page.navigate',{url:sites.origins.studio+'/away'},b.session);await until(()=>c.evaluate(b,'document.title==="Away"'),'Public history page did not load.');
 const history=await c.call('Page.getNavigationHistory',{},b.session),back=history.entries[history.currentIndex-1];assert.ok(back);
 await c.call('Page.navigateToHistoryEntry',{entryId:back.id},b.session);await until(()=>c.evaluate(b,'Boolean(window.M4L_V110)'),'Native history return did not load.');await masked(b);
 // With a valid active baseline, storage failure still must not show a person.
 await establish();
 const control=await page('studio',sites.origins.studio+'/studio/');await ready(control);
 const broken=await page('studio',sites.origins.studio+'/studio/',{brokenStorage:true});await sleep(4500);await masked(broken);
 const result={browser:version,origins:3,actualFrontends:{academy:'workspace sign-in controller and real markup; other controllers excluded',studio:'reader app/native API',hifz:'full page/native scripts/API'},nativeResponses:'synthetic, including context; actual native Worker context producer tested separately',masterIssuerOrPINProved:false,emptyContextNativePINUIReachable:true,blockedContextNativePINUIReachable:true,previousWorkspaceRemainsMaskedDuringPINEntry:true,HifzLiveReads:2,HifzRevisionsDistinct:true,extraContextOrAcademyAPIReadsForThoseQueries:0,activeStudioCleared:true,oldNativeSessionsRemainValidInFixture:true,lateOldNativeResponsePainted:false,HifzAlreadyHiddenBeforeFreeze:true,frozenHifzResumeMasked:true,firstResumedPaintOrVisibleFreezeProved:false,historyReturnMasked:true,measuredBFCacheRestoration:false,providerFrameControlState:partition.result.value,providerMasked:true,positiveControlBeforeStorageFailure:true,brokenStorageMasked:true,forgedMessageCannotReveal:true,hostedSQL:0,liveDBChanges:0,productionRequests:0,completeJWTOrMediaCutover:false};
 await mkdir('.build/jwt-v110-native-browser',{recursive:true});await writeFile('.build/jwt-v110-native-browser/browser.json',JSON.stringify(result,null,2)+'\n');t.diagnostic('V110_NATIVE_BROWSER='+JSON.stringify(result));
});
