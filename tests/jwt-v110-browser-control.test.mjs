import test from 'node:test';
import assert from 'node:assert/strict';
import {browserBinding,browserOrigins,createBrowserControl,installBrowserRelay,validBrowserState} from '../src/auth/v110/browser-control-relay.mjs';
import {createBrowserControlClient} from '../src/auth/v110/browser-control-client.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true','Disposable GitHub runners only.');
const NOW=1793900000000,bindings={one:'a'.repeat(64),two:'b'.repeat(64)};
const origins={academy:'http://127.0.0.1:4101',studio:'http://127.0.0.1:4102',hifz:'http://127.0.0.1:4103'};
function storage(){const map=new Map();return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v),map};}
function setup(){
 let time=NOW,tail=Promise.resolve(),counter=0;const data=storage();
 const control=createBrowserControl({storage:data,clock:()=>time,revision:()=>('00000000-0000-4000-8000-'+String(++counter).padStart(12,'0')),exclusive:fn=>{const task=tail.then(fn);tail=task.catch(()=>{});return task;}});
 return {control,data,advance:ms=>time+=ms};
}
test('control state stores only opaque non-authorizing fields and binds apps by shared parent/browser rather than native user ID',async()=>{
 const s=setup();assert.equal(await s.control.snapshot(),null);
 const first=await s.control.clear('switch');
 const active=await s.control.establish({expectedRevision:first.revision,binding:bindings.one,expiresAtMs:NOW+604800000});
 assert.equal(validBrowserState(active),true);assert.equal((await s.control.assert({revision:active.revision,binding:bindings.one})).active,true);
 assert.deepEqual(Object.keys(active).sort(),['v','revision','active','binding','expiresAtMs'].sort());
 const a=await browserBinding({parentId:'parent',browserId:'browser',browserGeneration:1,accountId:'academy-native'});
 const b=await browserBinding({parentId:'parent',browserId:'browser',browserGeneration:1,accountId:'different-hifz-native'});
 assert.equal(a,b);assert.notEqual(a,await browserBinding({parentId:'parent',browserId:'browser',browserGeneration:2}));
});
test('clear blocks old assertions and delayed Master establishment cannot resurrect a replaced revision',async()=>{
 const s=setup(),intent=await s.control.clear('switch'),newer=await s.control.clear('logout');
 await assert.rejects(s.control.establish({expectedRevision:intent.revision,binding:bindings.one,expiresAtMs:NOW+1000}),/STALE/);
 const active=await s.control.establish({expectedRevision:newer.revision,binding:bindings.two,expiresAtMs:NOW+1000});
 await assert.rejects(s.control.assert({revision:active.revision,binding:bindings.one}),/CHANGED/);
 const ended=await s.control.clear('logout');assert.equal(ended.active,false);
 await assert.rejects(s.control.assert({revision:active.revision,binding:bindings.two}),/CHANGED/);
});
test('exclusive concurrent Master completions have one winner and one stale completion',async()=>{
 const s=setup(),intent=await s.control.clear('switch');
 const replies=await Promise.allSettled([bindings.one,bindings.two].map(binding=>s.control.establish({expectedRevision:intent.revision,binding,expiresAtMs:NOW+1000})));
 assert.equal(replies.filter(v=>v.status==='fulfilled').length,1);assert.equal(replies.filter(v=>v.status==='rejected').length,1);
});
test('the original absolute deadline blocks context and never grows on reads or clears',async()=>{
 const s=setup(),intent=await s.control.clear('switch'),active=await s.control.establish({expectedRevision:intent.revision,binding:bindings.one,expiresAtMs:NOW+1000});
 s.advance(999);assert.equal((await s.control.snapshot()).expiresAtMs,NOW+1000);
 s.advance(1);await assert.rejects(s.control.assert({revision:active.revision,binding:bindings.one}),/CHANGED/);assert.equal((await s.control.snapshot()).active,false);
});
test('disabled/corrupt storage and missing exclusive primitive fail closed',async()=>{
 assert.throws(()=>createBrowserControl({storage:storage()}),/UNAVAILABLE/);
 const s=setup();s.data.setItem('uaa-v110-ui-control-v1','broken');await assert.rejects(s.control.snapshot(),/UNAVAILABLE/);
 s.data.setItem('uaa-v110-ui-control-v1',JSON.stringify({v:1,revision:'00000000-0000-4000-8000-000000000001',active:false,binding:null,expiresAtMs:0,accessToken:'not-a-credential'}));await assert.rejects(s.control.snapshot(),/UNAVAILABLE/);
 const disabled=createBrowserControl({storage:{getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}},exclusive:fn=>fn()});
 await assert.rejects(disabled.snapshot(),/disabled/);await assert.rejects(disabled.clear('logout'),/disabled/);
});
test('origin grammar rejects inferred URLs, duplicate origins and non-local cleartext hosts',()=>{
 assert.throws(()=>browserOrigins({...origins,hifz:origins.studio}),/DISTINCT/);
 for(const bad of ['https://example.invalid/path','http://example.invalid','https://example.invalid/?next=elsewhere'])assert.throws(()=>browserOrigins({...origins,studio:bad}),/INVALID/);
 assert.throws(()=>browserOrigins({...origins,returnTo:'https://example.invalid'}),/INVALID/);
});
function relayHarness(t,app='studio'){
 const handlers=new Map(),sent=[],parent={postMessage:(value,origin)=>sent.push({value,origin})},win={location:{origin:origins.academy},parent,addEventListener:(type,fn)=>handlers.set(type,fn),removeEventListener:type=>handlers.delete(type)};
 const s=setup(),relay=installBrowserRelay({win,origins,control:s.control,channelFactory:()=>({addEventListener(){},removeEventListener(){},postMessage(){throw Error('Synthetic unavailable transport');},close(){}})});
 t.after(()=>relay.close());const nonce='n'.repeat(43),requestId='q'.repeat(43);
 return {...s,sent,parent,handlers,nonce,requestId,async receive(message,options={}){await handlers.get('message')({origin:origins[app],source:parent,data:{v:1,app,nonce,requestId,...message},...options});return sent.at(-1)?.value;}};
}
test('relay rejects wrong origin/source/nonce before state change; child cannot establish Master context',async t=>{
 const h=relayHarness(t),connect={type:'UAA_CONTROL_CONNECT'};
 await h.receive(connect,{origin:'https://hostile.invalid'});await h.receive(connect,{source:{postMessage(){}}});assert.equal(h.sent.length,0);
 assert.equal((await h.receive(connect)).ok,true);
 await h.receive({type:'UAA_CONTROL_CLEAR',reason:'logout'},{data:{v:1,app:'studio',nonce:'x'.repeat(43),requestId:h.requestId,type:'UAA_CONTROL_CLEAR',reason:'logout'}});assert.equal(await h.control.snapshot(),null);
 const count=h.sent.length;await h.receive({type:'UAA_CONTROL_ESTABLISH',expectedRevision:'00000000-0000-4000-8000-000000000001',binding:bindings.one,expiresAtMs:NOW+1000});assert.equal(h.sent.length,count);assert.equal(await h.control.snapshot(),null);
});
test('relay replies to its mutation before best-effort change notification and closes with no peer-clearing guarantee',async t=>{
 const h=relayHarness(t,'academy');await h.receive({type:'UAA_CONTROL_CONNECT'});h.sent.length=0;
 await h.receive({type:'UAA_CONTROL_CLEAR',reason:'switch'});await new Promise(setImmediate);
 assert.equal(h.sent[0].value.type,'UAA_CONTROL_REPLY');assert.equal(h.sent[0].value.ok,true);assert.ok(h.sent.some(x=>x.value.type==='UAA_CONTROL_CHANGED'));
 const intent=h.sent[0].value.state;h.sent.length=0;
 await h.receive({type:'UAA_CONTROL_ESTABLISH',expectedRevision:intent.revision,binding:bindings.one,expiresAtMs:NOW+1000});await new Promise(setImmediate);
 assert.equal(h.sent[0].value.ok,true);assert.equal(h.sent[0].value.state.active,true);
});

test('initial frame pageshow before CONNECT reply cannot cancel a fresh READ; established contexts still invalidate on changes',async t=>{
 const listeners=new Map(),frameListeners=new Map();let invalidated=0,first=true;
 let current={v:1,revision:'00000000-0000-4000-8000-000000000001',active:true,binding:bindings.one,expiresAtMs:NOW+10000},nonce;
 const frame={hidden:false,setAttribute(){},addEventListener:(type,fn)=>frameListeners.set(type,fn),remove(){},contentWindow:{postMessage(message){
  nonce=message.nonce;queueMicrotask(()=>{
   if(first){first=false;deliver({v:1,type:'UAA_CONTROL_CHANGED',nonce,state:{...current,revision:'00000000-0000-4000-8000-000000000000'}});}
   deliver({v:1,type:'UAA_CONTROL_REPLY',nonce,requestId:message.requestId,ok:message.type!=='UAA_CONTROL_ASSERT'||current.active,state:current});
  });
 }}};
 const win={location:{origin:origins.studio},addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
 const doc={createElement:()=>frame,body:{append(){queueMicrotask(()=>frameListeners.get('load')());}}};
 const deliver=(data,extra={})=>listeners.get('message')?.({origin:origins.academy,source:frame.contentWindow,data,...extra});
 const client=createBrowserControlClient({win,doc,app:'studio',origins,onInvalidate:()=>invalidated++,timeoutMs:1000});t.after(()=>client.close());
 const read=await client.read();assert.equal(read.revision,current.revision);assert.equal(invalidated,0);assert.equal(client.state().connected,true);
 deliver({v:1,type:'UAA_CONTROL_CHANGED',nonce,state:current});assert.equal(invalidated,0);
 deliver({v:1,type:'UAA_CONTROL_CHANGED',nonce:'wrong',state:null});assert.equal(invalidated,0);
 current={v:1,revision:'00000000-0000-4000-8000-000000000002',active:false,binding:null,expiresAtMs:0};
 deliver({v:1,type:'UAA_CONTROL_CHANGED',nonce,state:current});assert.equal(invalidated,1);
 await assert.rejects(client.assert({revision:read.revision,binding:read.binding}),/UNVERIFIABLE/);
 assert.equal((await client.read()).active,false);
});
