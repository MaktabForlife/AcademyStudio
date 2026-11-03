import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardTafseerData} from '../public/shared/dashboard-tafseer-data.mjs';
const flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
const item=(id='one')=>({key:id,kind:'TAFSEER',title:'Public '+id,websiteId:id});
function fixture(){
 const identity={account:{accountId:'admin',cacheSession:'current'},generation:1},window=new EventTarget(),calls=[],views=[];let time=1000;
 const view={update:value=>views.push(structuredClone(value)),clear:()=>views.push({cleared:true})};
 const rail=dashboardTafseerData({identity,window,view,now:()=>time,api:path=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});calls.push({path,resolve,reject});return promise;}});
 return {identity,window,calls,views,rail,tick:ms=>time+=ms,last:()=>views.at(-1),reply(index,value){calls[index].resolve(value);},switchAccount(){identity.generation++;identity.account={accountId:'student',cacheSession:'other'};window.dispatchEvent(new Event('website-account-changed'));}};
}
test('one public catalogue and one checked batch supply every card; warm updates add no requests',async()=>{
 const f=fixture(),first=f.rail.update(true),second=f.rail.update(true);assert.equal(f.calls.length,1);f.reply(0,{items:[item(),item('two'),{kind:'COURSE',websiteId:'not-tafseer'}]});await flush();assert.equal(f.calls.length,2);assert.equal(f.calls[1].path,'/api/circles/access?website=one&website=two');f.reply(1,{websites:[{websiteId:'one',canOpen:true},{websiteId:'two',canOpen:false}]});await Promise.all([first,second]);assert.equal(f.last().rights.length,2);for(let i=0;i<10;i++)await f.rail.update(true);assert.equal(f.calls.length,2);f.rail.dispose();
});
test('successful empty catalogues are cached and signed-out/public views issue no access reads',async()=>{
 const f=fixture();await f.rail.update(false);assert.equal(f.calls.length,0);const empty=f.rail.update(true);f.reply(0,{items:[]});await empty;await f.rail.update(true);assert.equal(f.calls.length,1);assert.deepEqual(f.last().items,[]);f.identity.account=null;f.window.dispatchEvent(new Event('website-session-ended'));await f.rail.update(true);assert.equal(f.last().visible,false);assert.equal(f.calls.length,1);f.rail.dispose();
});
test('account switching rejects old rights and uses a fresh current batch without displaying the former result',async()=>{
 const f=fixture(),old=f.rail.update(true);f.reply(0,{items:[item()]});await flush();f.switchAccount();const fresh=f.rail.update(true);await flush();assert.equal(f.calls.length,3);f.reply(1,{websites:[{websiteId:'one',canOpen:true}]});await old;assert(!f.views.some(value=>value.rights?.some(row=>row.canOpen)));f.reply(2,{websites:[{websiteId:'one',canOpen:false}]});await fresh;assert.equal(f.last().rights[0].canOpen,false);f.rail.dispose();
});
test('an in-flight public catalogue from an old generation cannot block the new account’s own load',async()=>{
 const f=fixture(),old=f.rail.update(true);f.switchAccount();const fresh=f.rail.update(true);assert.equal(f.calls.length,2);f.calls[0].reject(new DOMException('Old account','AbortError'));await old;f.reply(1,{items:[item('new')]});await flush();assert.equal(f.calls[2].path,'/api/circles/access?website=new');f.reply(2,{websites:[{websiteId:'new',canOpen:true}]});await fresh;assert.equal(f.last().items[0].websiteId,'new');f.rail.dispose();
});
test('denied access clears the rail and fails visibly without automatic retry or a cached permission fallback',async()=>{
 const f=fixture(),load=f.rail.update(true);f.reply(0,{items:[item()]});await flush();f.calls[1].reject(Object.assign(Error('Current access denied'),{status:403}));await load;assert.equal(f.last().error,'Current access denied');assert.deepEqual(f.last().rights,[]);await f.rail.update(true);assert.equal(f.calls.length,2);f.rail.dispose();
});
test('malformed or foreign access rows cannot label a card as permitted',async()=>{
 for(const websites of [[],[{websiteId:'foreign',canOpen:true}],[{websiteId:'one',canOpen:'true'}],[null]]){
  const f=fixture(),load=f.rail.update(true);f.reply(0,{items:[item()]});await flush();f.reply(1,{websites});await load;assert.match(f.last().error,/could not be checked/);assert.deepEqual(f.last().rights,[]);f.rail.dispose();
 }
});
test('Refresh and display/policy invalidation replace the bounded catalogue/access snapshot once',async()=>{
 const f=fixture(),load=f.rail.update(true);f.reply(0,{items:[item()]});await flush();f.reply(1,{websites:[{websiteId:'one',canOpen:true}]});await load;const refreshing=f.rail.refresh();f.reply(2,{items:[item()]});await flush();f.reply(3,{websites:[{websiteId:'one',canOpen:false}]});await refreshing;assert.equal(f.last().rights[0].canOpen,false);
 f.window.dispatchEvent(new Event('website-display-invalidated'));assert.equal(f.last().loading,true);f.reply(4,{items:[]});await flush();assert.deepEqual(f.last().items,[]);assert.equal(f.calls.length,5);f.rail.dispose();
});
test('twelve-hour display expiry reloads one batch on a later visit, with no idle polling',async()=>{
 const f=fixture(),load=f.rail.update(true);f.reply(0,{items:[item()]});await flush();f.reply(1,{websites:[{websiteId:'one',canOpen:true}]});await load;f.tick(43200_000);assert.equal(f.calls.length,2);const returned=f.rail.update(true);await flush();assert.equal(f.calls.length,3);f.reply(2,{websites:[{websiteId:'one',canOpen:false}]});await returned;assert.equal(f.last().rights[0].canOpen,false);f.rail.dispose();
});
test('large catalogues retain the normal Tafseer fallback without unbounded access batches',async()=>{
 const f=fixture(),load=f.rail.update(true);f.reply(0,{items:Array.from({length:51},(_,index)=>item('site-'+index))});await load;assert.match(f.last().error,/full collection/);assert.equal(f.calls.length,1);assert.deepEqual(f.last().rights,[]);f.rail.dispose();
});
