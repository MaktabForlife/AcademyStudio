import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {build} from 'esbuild';
const root=resolve(process.env.ACADEMY_SOURCE||'../Academy'),hosting={academyPortalOrigin:'https://ummabbadacademy.app',academyApiOrigin:'https://api.academy.test',studioOrigin:'https://maktab4life.org',hifzOrigin:'https://hifz.maktab4life.org',academyLegacyOrigins:['https://academy.test']};
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
async function browser(run,fetcher){
 const saved=Object.getOwnPropertyDescriptors(globalThis),events=[],local=storage(),session=storage(),win=new EventTarget();
 class Custom extends Event{constructor(type,options={}){super(type);this.detail=options.detail;}}
 Object.assign(globalThis,{AcademyHosting:hosting,window:win,location:{origin:hosting.academyPortalOrigin,href:hosting.academyPortalOrigin+'/'},localStorage:local,sessionStorage:session,CustomEvent:Custom,BroadcastChannel:undefined,fetch:fetcher});local.setItem('m4l_account_token','old-native-token');win.addEventListener('website-session-ended',()=>events.push('ended'));
 try{
  const prefix=await readFile(root+'/portal-adapter/api-prefix.mjs','utf8'),api=await readFile(new URL('../public/api.mjs',import.meta.url),'utf8'),source=prefix+'\n'+api.replace('await fetch(path,{method,credentials:','await portalFetch(path,{method,credentials:');
  const module=await import('data:text/javascript;base64,'+Buffer.from(source+'\n// '+crypto.randomUUID()).toString('base64'));return await run({module,local,session,win,events});
 }finally{for(const key of ['AcademyHosting','window','location','localStorage','sessionStorage','CustomEvent','BroadcastChannel','fetch'])if(saved[key])Object.defineProperty(globalThis,key,saved[key]);else delete globalThis[key];}
}
test('actual transformed portal module uses native Bearer only and suppresses an old account response',async()=>{
 let answer,started;const ready=new Promise(r=>started=r),calls=[];
 await browser(async({module,local})=>{
  const pending=module.api('/api/circles/navigation');await ready;local.setItem('m4l_account_token','replacement-account-token');answer(Response.json({purchasedCourses:[{label:'Old account private'}]}));
  await assert.rejects(pending,e=>e.name==='AbortError');assert.equal(module.identity.account,null);
 },async(url,init)=>{calls.push({url,init});started();return new Promise(r=>answer=r);});
 assert.equal(calls.length,1);const actual=new URL(calls[0].url);assert.equal(actual.origin+actual.pathname,hosting.academyApiOrigin+'/api/academy/hub/read');assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.body,undefined);assert.equal(calls[0].init.credentials,'omit');assert.equal(calls[0].init.headers.Authorization,'Bearer old-native-token');assert.deepEqual(JSON.parse(actual.searchParams.get('request')),{kind:'navigation',input:{}});
});
test('a late login cannot overwrite a switched account and revokes only its unused issued token',async()=>{
 let answer,started;const ready=new Promise(r=>started=r),calls=[];
 await browser(async({module,local})=>{
  const pending=module.api('/auth/native-login',{body:{uniqueid:'synthetic',pin:'1234'}});await ready;local.setItem('m4l_account_token','newer-account-token');answer(Response.json({token:'late-unused-token',account:{uniqueid:'synthetic'}}));
  await assert.rejects(pending,e=>e.name==='AbortError');assert.equal(local.getItem('m4l_account_token'),'newer-account-token');
 },async(url,init)=>{calls.push({url,init});if(url.endsWith('/hub/login')){started();return new Promise(r=>answer=r);}return Response.json({success:true});});
 assert.equal(calls.length,2);assert.equal(calls[1].url,hosting.academyApiOrigin+'/api/account/logout');assert.equal(calls[1].init.headers.Authorization,'Bearer late-unused-token');assert(!calls.some(c=>c.url.includes('/auth/exchange')));
});
test('the source portal homepage JavaScript import graph resolves on a disposable runner',async()=>{
 const result=await build({entryPoints:[root+'/portal/circles-home-entry.mjs'],bundle:true,write:false,format:'esm',platform:'browser',metafile:true,plugins:[{name:'portal-root-imports',setup(b){b.onResolve({filter:/^\//},args=>args.kind==='entry-point'?null:({path:resolve(root+'/portal','.'+args.path)}));}}]});
 assert(result.outputFiles[0].text.length>0);assert(Object.keys(result.metafile.inputs).length>10);
});

test('a switch during previous-token revocation cannot be overwritten by the older completed login',async()=>{
 let finishLogout,entered;const ready=new Promise(r=>entered=r),calls=[];
 await browser(async({module,local})=>{
  const pending=module.api('/auth/native-login',{body:{uniqueid:'synthetic',pin:'1234'}});await ready;local.setItem('m4l_account_token','newest-account-token');finishLogout(Response.json({success:true}));
  await assert.rejects(pending,e=>e.name==='AbortError');assert.equal(local.getItem('m4l_account_token'),'newest-account-token');
 },async(url,init)=>{
  calls.push({url,init});if(url.endsWith('/hub/login'))return Response.json({token:'older-login-token',account:{uniqueid:'synthetic'}});
  if(init.headers.Authorization==='Bearer old-native-token'){entered();return new Promise(r=>finishLogout=r);}
  return Response.json({success:true});
 });
 assert.equal(calls.filter(c=>c.init.headers.Authorization==='Bearer older-login-token'&&c.url.endsWith('/api/account/logout')).length,1);
});

test('native GET conditional read preserves private owner, fresh clock and denied-cache protections',async()=>{
 const tag='"pv1-'+'a'.repeat(64)+'"',now=Date.now(),account={accountId:'synthetic-account',cacheSession:'synthetic-session',verifiedAt:now,sessionExpiresAt:now+43200000},calls=[];
 let phase=0;
 await browser(async({module,session})=>{
  module.changed(account);
  const first=await module.api('/api/circles/dashboard');assert.equal(first.marker,'private-current-owner');assert(session.getItem('m4l-private-display-v1'));
  phase=1;const cached=await module.api('/api/circles/dashboard');assert.equal(cached.marker,'private-current-owner');assert.equal(cached.serverTime,now+1000);assert.notEqual(first,cached);
  phase=2;await assert.rejects(module.api('/api/circles/dashboard'),e=>e.status===403);assert.equal(session.getItem('m4l-private-display-v1'),null);
 },async(url,init)=>{
  calls.push({url,init});assert.equal(init.method,'GET');assert.equal(init.body,undefined);
  if(phase===0){assert.equal(init.headers['If-None-Match'],undefined);return Response.json({marker:'private-current-owner',serverTime:now},{headers:{ETag:tag}});}
  assert.equal(init.headers['If-None-Match'],tag);
  return phase===1?new Response(null,{status:304,headers:{ETag:tag,'X-Maktab-Server-Time':String(now+1000)}}):Response.json({error:'Access ended',code:'FORBIDDEN'},{status:403});
 });
 assert.equal(calls.length,3);
});
test('native opener return retains token-hashed context and only acknowledges exact live child/origin/mode',async()=>{
 await browser(async({local,win})=>{
  const content=await readFile(root+'/portal-adapter/circles-sign-in.mjs','utf8'),mod=await import('data:text/javascript;base64,'+Buffer.from(content+'\n// '+crypto.randomUUID()).toString('base64'));
  const messages=[],moves=[],child={closed:false,sessionStorage:storage(),postMessage:(data,origin)=>messages.push({data,origin}),close(){this.closed=true;}};
  let opened,failed;const ready=new Promise((resolve,reject)=>{opened=resolve;failed=reject;});
  child.location={replace:url=>{moves.push(url);opened();}};win.location=location;win.localStorage=local;win.open=()=>child;
  let calls=0,returns=0,current=true;const before=Date.now(),mode='teach',token='new-native-context-token';
  const link=mod.openAcademyFromCircles({window:win,dashboard:{mode,tool:'activity',activityKey:'PROGRAM:synthetic'},request:async(path)=>{
   calls++;assert.equal(path,'/auth/native-open');return {token,destination:location.origin+'/academy/',circles:{mode,returnUrl:location.origin+'/?workspace='+mode}};
  },onReturn:received=>{assert.equal(received,mode);if(!current)return false;returns++;return true;},onError:failed});
  await ready;const saved=JSON.parse(child.sessionStorage.getItem('m4l_circles_return')),owner=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
  assert.equal(saved.owner,owner);assert.equal(saved.websiteOrigin,location.origin);assert.equal(saved.returnUrl,location.origin+'/?workspace=teach');assert(saved.expiresAt>=before+43200000&&saved.expiresAt<=Date.now()+43200000);assert.equal(local.getItem('m4l_account_token'),token);assert.equal(moves.length,1);
  const requestId=crypto.randomUUID(),post=(extra={},origin=location.origin,source=child)=>{const e=new Event('message');Object.assign(e,{source,origin,data:{type:'ACADEMY_CIRCLES_RETURN',mode,requestId,...extra}});win.dispatchEvent(e);};
  post({},'https://evil.test');post({},location.origin,{});post({mode:'admin'});post({requestId:'bad'});assert.equal(returns,0);assert.equal(messages.length,0);
  current=false;local.setItem('m4l_account_token','another-account');post();assert.equal(messages.length,0);
  current=true;local.setItem('m4l_account_token',token);post();assert.equal(returns,1);assert.deepEqual(messages,[{data:{type:'CIRCLES_DASHBOARD_RETURNED',requestId,mode},origin:location.origin}]);post();assert.equal(returns,1);assert.equal(calls,1);
  link.close();
 },async()=>{throw Error('Returning to an open dashboard must not make an API request.');});
});
test('a late native opener cannot replace the newly selected account or leave return metadata',async()=>{
 await browser(async({local,win})=>{
  const content=await readFile(root+'/portal-adapter/circles-sign-in.mjs','utf8'),mod=await import('data:text/javascript;base64,'+Buffer.from(content+'\n// '+crypto.randomUUID()).toString('base64')),child={closed:false,sessionStorage:storage(),location:{replace(){throw Error('A stale opener must not navigate.');}},close(){this.closed=true;}};
  win.location=location;win.localStorage=local;win.open=()=>child;let answer,stopped;const done=new Promise(r=>stopped=r);
  mod.openAcademyFromCircles({window:win,request:()=>new Promise(r=>answer=r),dashboard:{mode:'learn',tool:'home'},onError:stopped});
  local.setItem('m4l_account_token','switched-account-token');answer({token:'stale-token',destination:location.origin+'/academy/',circles:{mode:'learn',returnUrl:location.origin+'/?workspace=learn'}});
  await done;assert.equal(local.getItem('m4l_account_token'),'switched-account-token');assert.equal(child.sessionStorage.getItem('m4l_circles_return'),null);assert(child.closed);
 },async()=>{throw Error('No API request is expected by the isolated opener helper.');});
});
