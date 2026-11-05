import test from 'node:test';
import assert from 'node:assert/strict';
import {createDisplayMemory,validDisplaySession} from '../src/auth/v110/browser-display-state.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true','Disposable GitHub runners only.');
const BASE=1790000000000,MINUTE=60000,DAY=86400000;
const view=(label='Synthetic access',version='v1')=>({version,items:[{id:'one',label,href:'/courses/one'}]});
function clock(){
 let now=0,next=0;const jobs=new Map();
 return {read:()=>now,set:(fn,ms)=>{const id=++next;jobs.set(id,{at:now+ms,fn});return id;},cancel:id=>jobs.delete(id),advance(ms){now+=ms;for(;;){const due=[...jobs].find(([,v])=>v.at<=now);if(!due)break;jobs.delete(due[0]);due[1].fn();}},size:()=>jobs.size};
}
function session(app,time,{account='alice',last=BASE,start=BASE,end=BASE+7*DAY}={}){
 return {app,accountId:account,sessionId:app==='academy'?'parent-'+account:'session-'+account,parentId:'parent-'+account,browserId:'browser-one',browserGeneration:1,credentialEpoch:1,securityVersion:1,unlockGeneration:0,originalSignedAtMs:start,originalExpiresAtMs:end,lastForegroundRefreshMs:last,serverNowMs:BASE+time};
}
const bundle=s=>({session:s,initialViews:[{key:'nav',context:s,view:view('Synthetic '+s.accountId)}]});
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function harness(t,{app='studio',time=clock(),channelFactory,...options}={}){
 const state={account:'alice',last:BASE,calls:0,denied:false},events=[];
 let verify=async()=>{state.calls++;return state.denied?{session:null}:bundle(session(app,time.read(),state));};
 const cache=createDisplayMemory({app,clock:time.read,setTimer:time.set,cancelTimer:time.cancel,verifySession:args=>verify(args),channelFactory,onClear:reason=>events.push({kind:'clear',reason}),onState:s=>events.push({kind:'state',phase:s.phase}),...options});
 t.after(()=>cache.close());return {cache,time,state,events,setVerify:fn=>{verify=fn;}};
}
test('verified bootstrap data is reused in memory without another request or caller mutation',async t=>{
 const h=harness(t);assert.equal(h.cache.state().phase,'masked');assert.equal(await h.cache.recheck(),true);
 const before=h.state.calls;let loads=0;
 const a=await h.cache.load('nav',async()=>{loads++;throw Error('A memory hit must not fetch.');});a.items[0].label='Changed externally';
 assert.equal(h.cache.peek('nav').items[0].label,'Synthetic alice');assert.equal(loads,0);assert.equal(h.state.calls,before);
});
test('cache activity and background verification do not advance the acknowledged foreground lock',async t=>{
 const h=harness(t);await h.cache.recheck();h.time.advance(89*MINUTE);
 for(let i=0;i<10;i++)assert.ok(h.cache.peek('nav'));
 assert.equal(await h.cache.recheck('resume'),true);assert.equal(h.cache.state().remainingMs,MINUTE);
 h.time.advance(MINUTE);assert.equal(h.cache.state().phase,'masked');assert.equal(h.cache.state().entryCount,0);assert.ok(h.events.some(x=>x.reason==='lock'));
});
test('only a newer authoritative same-app foreground acknowledgement can extend the display deadline',async t=>{
 const time=clock(),a=harness(t,{time,app:'studio'}),b=harness(t,{time,app:'hifz'});
 await a.cache.recheck();await b.cache.recheck();time.advance(80*MINUTE);b.state.last=BASE+80*MINUTE;await b.cache.recheck();
 assert.equal(a.cache.state().remainingMs,10*MINUTE);
 a.state.last=BASE+80*MINUTE;await a.cache.recheck();assert.equal(a.cache.state().remainingMs,90*MINUTE);
 time.advance(90*MINUTE);assert.equal(a.cache.state().phase,'masked');assert.equal(b.cache.state().phase,'masked');
});
test('the original seven-day end clips an otherwise unlocked view',async t=>{
 const time=clock();const h=harness(t,{time});h.setVerify(async()=>bundle(session('studio',time.read(),{start:BASE-7*DAY+1000,end:BASE+1000,last:BASE})));
 assert.equal(await h.cache.recheck(),true);assert.equal(h.cache.state().remainingMs,1000);time.advance(1000);assert.equal(h.cache.state().phase,'masked');
});
test('a delayed verification cannot add response time to the inactivity deadline',async t=>{
 const h=harness(t),wait=defer(),snapshot=bundle(session('studio',0));h.setVerify(()=>wait.promise);
 const task=h.cache.recheck();h.time.advance(MINUTE);wait.resolve(snapshot);assert.equal(await task,true);
 assert.equal(h.cache.state().remainingMs,89*MINUTE);h.time.advance(89*MINUTE);assert.equal(h.cache.state().phase,'masked');
});
test('logout clears before hooks and discards an old load even when its loader ignores abort',async t=>{
 const h=harness(t);await h.cache.recheck();const wait=defer();let signal;
 const task=h.cache.load('nav',args=>{signal=args.signal;return wait.promise;},{force:true});
 h.cache.clear('logout',{broadcast:true});assert.equal(signal.aborted,true);assert.equal(h.cache.peek('nav'),null);
 wait.resolve({context:session('studio',0),view:view('OLD PERSON')});assert.equal(await task,null);assert.equal(h.cache.state().entryCount,0);
});
test('account switching prevents an old completion or verification from repopulating the new context',async t=>{
 const h=harness(t);await h.cache.recheck();const load=defer(),old=h.cache.load('nav',()=>load.promise,{force:true});
 h.cache.clear('switch',{broadcast:true});h.state.account='bob';await h.cache.recheck();
 load.resolve({context:session('studio',0,{account:'alice'}),view:view('OLD PERSON')});assert.equal(await old,null);assert.equal(h.cache.peek('nav').items[0].label,'Synthetic bob');
 const verify=defer();h.setVerify(()=>verify.promise);const pending=h.cache.recheck();h.cache.clear('known-cancellation');verify.resolve(bundle(session('studio',0,{account:'bob'})));assert.equal(await pending,false);assert.equal(h.cache.state().phase,'masked');
});
test('a newer same-key request wins over an older response and older failure',async t=>{
 const h=harness(t);await h.cache.recheck();const a=defer(),b=defer();
 const first=h.cache.load('nav',()=>a.promise,{force:true}),second=h.cache.load('nav',()=>b.promise,{force:true});
 b.resolve({context:session('studio',0),view:view('NEW','v2')});assert.equal((await second).version,'v2');
 a.resolve({context:session('studio',0),view:view('OLD','v1')});assert.equal(await first,null);assert.equal(h.cache.peek('nav').version,'v2');
 const old=defer(),older=h.cache.load('nav',()=>old.promise,{force:true});
 await h.cache.load('nav',async()=>({context:session('studio',0),view:view('NEWER','v3')}),{force:true});old.reject(Error('late failure'));assert.equal(await older,null);assert.equal(h.cache.peek('nav').version,'v3');
});
test('failed verification and mismatched resource context keep displays empty',async t=>{
 const h=harness(t);await h.cache.recheck();h.state.denied=true;assert.equal(await h.cache.recheck(),false);assert.equal(h.cache.peek('nav'),null);
 h.state.denied=false;await h.cache.recheck();assert.equal(await h.cache.load('nav',async()=>({context:session('studio',0,{account:'bob'}),view:view('WRONG')}),{force:true}),null);assert.equal(h.cache.state().phase,'masked');
});
test('same-origin app tabs clear together while different origins remain isolated',async t=>{
 const buses=new Map();
 const factory=origin=>name=>{
  const key=origin+'|'+name,listeners=new Set(),channel={addEventListener(_,fn){listeners.add(fn);},removeEventListener(_,fn){listeners.delete(fn);},postMessage(data){for(const peer of buses.get(key)||[])if(peer!==channel)for(const fn of peer.listeners)fn({data});},close(){buses.get(key)?.delete(channel);},listeners};
  if(!buses.has(key))buses.set(key,new Set());buses.get(key).add(channel);return channel;
 };
 const a=harness(t,{channelFactory:factory('origin-one')}),b=harness(t,{channelFactory:factory('origin-one')}),c=harness(t,{channelFactory:factory('origin-two')});
 await a.cache.recheck();await b.cache.recheck();await c.cache.recheck();a.cache.clear('logout',{broadcast:true});
 assert.equal(a.cache.state().phase,'masked');assert.equal(b.cache.state().phase,'masked');assert.equal(c.cache.state().phase,'ready');
});
test('hidden/pagehide/restore lifecycle masks first and rechecks rather than revealing old data',async t=>{
 class Doc extends EventTarget{visibilityState='visible';}
 const win=new EventTarget(),doc=new Doc(),h=harness(t);h.cache.bindLifecycle(win,doc);await h.cache.recheck();
 doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));assert.equal(h.cache.state().phase,'masked');
 const calls=h.state.calls;assert.equal(await h.cache.recheck(),false);assert.equal(h.state.calls,calls);
 doc.visibilityState='visible';h.state.account='bob';doc.dispatchEvent(new Event('visibilitychange'));await new Promise(setImmediate);assert.equal(h.cache.peek('nav').items[0].label,'Synthetic bob');
 win.dispatchEvent(new Event('pagehide'));assert.equal(h.cache.state().phase,'masked');h.state.denied=true;win.dispatchEvent(new Event('pageshow'));await new Promise(setImmediate);assert.equal(h.cache.state().phase,'masked');
});
test('invalid/foreign session or credential-shaped view fields are rejected without cache retention',async t=>{
 const h=harness(t);h.setVerify(async()=>bundle({...session('studio',0),accessToken:'not-a-real-credential'}));assert.equal(await h.cache.recheck(),false);
 h.setVerify(async()=>bundle(session('hifz',0)));assert.equal(await h.cache.recheck(),false);
 assert.equal(validDisplaySession(session('studio',0),'studio'),true);
 h.setVerify(async()=>bundle(session('studio',0)));await h.cache.recheck();
 assert.equal(await h.cache.load('nav',async()=>({context:session('studio',0),view:{...view(),refreshToken:'not-a-real-credential'}}),{force:true}),null);assert.equal(h.cache.state().entryCount,0);
});
test('valid oversized views are not truncated and retire an older cached view for the same key',async t=>{
 const h=harness(t,{maxViewBytes:128});await h.cache.recheck();assert.ok(h.cache.peek('nav'));
 const large={version:'large-v2',items:Array.from({length:20},(_,i)=>({id:'item-'+i,label:'ALL ITEMS RETAINED '+i,href:'/courses/'+i}))};
 const value=await h.cache.load('nav',async()=>({context:session('studio',0),view:large}),{force:true});
 assert.equal(value.items.length,20);assert.deepEqual(value,large);assert.equal(h.cache.peek('nav'),null);
});
test('display links cannot normalize into a foreign origin or include URL control characters',async t=>{
 const h=harness(t);for(const href of ['//example.invalid/','/\\example.invalid/','/\nexample.invalid/','/has space']){
  await h.cache.recheck();
  assert.equal(await h.cache.load('nav',async()=>({context:session('studio',0),view:{version:'v1',items:[{id:'one',label:'Synthetic link',href}]}}),{force:true}),null);
  assert.equal(h.cache.state().entryCount,0);
 }
 assert.equal(validDisplaySession(session('academy',0),'academy'),true);
 assert.equal(validDisplaySession({...session('academy',0),sessionId:'other-session'},'academy'),false);
});
test('display-memory evidence is scoped to local UI mechanics',t=>t.diagnostic('V110_DISPLAY_MEMORY_UNIT='+JSON.stringify({cases:14,appImports:0,persistentStorageWrites:0,DBCalls:0,globalCrossOriginCoordinator:false,actualCookiesOrAuthorization:false,limits:'unit mechanics; authoritative session-view adapter and real app DOM/media integration pending'})));
