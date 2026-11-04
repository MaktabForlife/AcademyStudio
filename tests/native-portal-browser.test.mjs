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
 assert.equal(calls.length,1);assert.equal(calls[0].url,hosting.academyApiOrigin+'/api/academy/hub/read');assert.equal(calls[0].init.credentials,'omit');assert.equal(calls[0].init.headers.Authorization,'Bearer old-native-token');assert.deepEqual(JSON.parse(calls[0].init.body),{kind:'navigation',input:{}});
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
 const result=await build({entryPoints:[root+'/portal/circles-home-entry.mjs'],bundle:true,write:false,format:'esm',platform:'browser',metafile:true,plugins:[{name:'portal-root-imports',setup(b){b.onResolve({filter:/^\//},args=>({path:resolve(root+'/portal','.'+args.path)}));}}]});
 assert(result.outputFiles[0].text.length>0);assert(Object.keys(result.metafile.inputs).length>10);
});
