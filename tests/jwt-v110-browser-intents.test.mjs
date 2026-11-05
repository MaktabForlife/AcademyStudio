import test from 'node:test';
import assert from 'node:assert/strict';
import {installAppPrivacy} from '../src/auth/v110/browser-app-privacy.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true','Disposable GitHub runners only.');
const origins={academy:'http://127.0.0.1:4101',studio:'http://127.0.0.1:4102',hifz:'http://127.0.0.1:4103'},NOW=1793900000000;
const session=label=>({app:'academy',accountId:'account-'+label,sessionId:'parent-'+label,parentId:'parent-'+label,browserId:'browser',browserGeneration:1,credentialEpoch:1,securityVersion:1,unlockGeneration:0,originalSignedAtMs:NOW,originalExpiresAtMs:NOW+604800000,lastForegroundRefreshMs:NOW,serverNowMs:NOW});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
async function settled(){await new Promise(resolve=>setImmediate(resolve));}
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await settled();}throw Error('Synthetic adapter operation did not arrive');}
function harness(t,{deferEstablish=false}={}){
 let counter=0,head=null,verified=0,who='B';
 const clears=[],establishes=[],classes=new Set();
 const revision=()=>('00000000-0000-4000-8000-'+String(++counter).padStart(12,'0'));
 const win=new EventTarget();win.location={origin:origins.academy,reload(){throw Error('No private document was revealed in this fixture');}};
 const doc=new EventTarget();doc.visibilityState='visible';doc.documentElement={classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},dataset:{}};doc.querySelectorAll=()=>[];
 const broker={
  clear(reason){head={v:1,revision:revision(),active:false,binding:null,expiresAtMs:0};const response=structuredClone(head),d=deferred();clears.push({reason,response,resolve:()=>d.resolve(response),reject:d.reject});return d.promise;},
  async read(){return structuredClone(head);},
  async assert({revision,binding}){if(!head?.active||head.revision!==revision||head.binding!==binding)throw Error('BROWSER_CONTEXT_CHANGED');return structuredClone(head);},
  establish(args){
   if(!head||head.active||head.revision!==args.expectedRevision)return Promise.reject(Error('STALE_BROWSER_CONTROL'));
   head={v:1,revision:revision(),active:true,binding:args.binding,expiresAtMs:args.expiresAtMs};const response=structuredClone(head),d=deferred(),op={...args,resolve:()=>d.resolve(response),reject:d.reject};establishes.push(op);
   if(!deferEstablish)d.resolve(response);return d.promise;
  },close(){}
 };
 const runtime=installAppPrivacy({win,doc,app:'academy',origins,controlClientFactory:()=>broker,verifySession:async()=>{verified++;return{session:session(who),initialViews:[]};}});
 t.after(()=>runtime.close());
 return {runtime,clears,establishes,classes,who:value=>who=value,verified:()=>verified,head:()=>head};
}
test('a delayed older clear reply cannot overwrite a newer sign-in intent or borrow its generation',async t=>{
 const h=harness(t),old=h.runtime.beginMasterSignIn(),oldRejected=assert.rejects(old,{name:'AbortError'}),newer=h.runtime.beginMasterSignIn();
 h.clears[1].resolve();const b=await newer;h.clears[0].resolve();await oldRejected;
 await assert.rejects(h.runtime.completeMasterSignIn({revision:h.clears[0].response.revision,generation:b.generation},{session:session('A')}),{name:'AbortError'});
 assert.equal(h.establishes.length,0);assert.equal(await h.runtime.completeMasterSignIn(b,{session:session('B')}),true);assert.equal(h.establishes.length,1);
 assert.equal(h.establishes[0].expectedRevision,b.revision);
});
test('logout immediately invalidates a pending begin even if its broker notification fails; an old failure cannot erase the next intent',async t=>{
 const h=harness(t),old=h.runtime.beginMasterSignIn(),oldRejected=assert.rejects(old,{name:'AbortError'});
 const logout=h.runtime.clearAll('logout'),logoutRejected=assert.rejects(logout,/unavailable/);
 assert.equal(h.classes.has('uaa-v110-masked'),true);
 const next=h.runtime.beginMasterSignIn();h.clears[2].resolve();const b=await next;
 h.clears[0].resolve();await oldRejected;h.clears[1].reject(Error('broker unavailable'));await logoutRejected;
 assert.equal(await h.runtime.completeMasterSignIn(b,{session:session('B')}),true);
});
test('a failed superseded begin cannot null a later accepted intent',async t=>{
 const h=harness(t),old=h.runtime.beginMasterSignIn(),oldRejected=assert.rejects(old,/old transport/),next=h.runtime.beginMasterSignIn();
 h.clears[1].resolve();const b=await next;h.clears[0].reject(Error('old transport'));await oldRejected;
 assert.equal(await h.runtime.completeMasterSignIn(b,{session:session('B')}),true);
});
test('a newer local begin during binding calculation prevents an old completion from sending establishment',async t=>{
 const h=harness(t);h.who('A');const aPending=h.runtime.beginMasterSignIn();h.clears[0].resolve();const a=await aPending;
 const completion=h.runtime.completeMasterSignIn(a,{session:session('A')}),rejected=assert.rejects(completion,{name:'AbortError'});
 const bPending=h.runtime.beginMasterSignIn();h.clears[1].resolve();const b=await bPending;await rejected;assert.equal(h.establishes.length,0);
 h.who('B');assert.equal(await h.runtime.completeMasterSignIn(b,{session:session('B')}),true);
});
test('logout while establishment acknowledgement is pending keeps the old completion masked and never verifies it',async t=>{
 const h=harness(t,{deferEstablish:true});h.who('A');const begin=h.runtime.beginMasterSignIn();h.clears[0].resolve();const a=await begin;
 const completion=h.runtime.completeMasterSignIn(a,{session:session('A')}),rejected=assert.rejects(completion,{name:'AbortError'});
 await until(()=>h.establishes.length===1);
 const logout=h.runtime.clearAll('logout'),logoutRejected=assert.rejects(logout,/delivery failed/);
 h.establishes[0].resolve();await rejected;assert.equal(h.verified(),0);assert.equal(h.classes.has('uaa-v110-masked'),true);
 h.clears[1].reject(Error('delivery failed'));await logoutRejected;
 h.who('B');const next=h.runtime.beginMasterSignIn();h.clears[2].resolve();const b=await next;
 const accepted=h.runtime.completeMasterSignIn(b,{session:session('B')});await until(()=>h.establishes.length===2);h.establishes[1].resolve();assert.equal(await accepted,true);
});
test('a still-pending begin cannot be completed using a forged missing revision',async t=>{
 const h=harness(t);const pending=h.runtime.beginMasterSignIn();
 await assert.rejects(h.runtime.completeMasterSignIn({generation:1},{session:session('A')}),{name:'AbortError'});assert.equal(h.establishes.length,0);
 h.clears[0].resolve();await pending;
});
