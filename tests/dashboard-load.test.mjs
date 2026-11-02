import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as circleDays from '../public/shared/circle-days.mjs';
import {localDay} from '../public/shared/learning-circle.mjs';
import {createDashboardJoin} from '../public/shared/dashboard-join.mjs';

const source=readFileSync(new URL('../public/circles-dashboard.mjs',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace('export function circlesDashboard','function circlesDashboard')+'\nglobalThis.makeDashboard=circlesDashboard;';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const snapshot=(mode,label=mode)=>({mode,label,checkedAt:Date.now(),timezone:'Africa/Johannesburg',availableModes:['learn','teach','admin'],adminBadge:'Global Admin'});
function client(){
 const headerRenders=[],header={html:'',setAttribute(){},get innerHTML(){return this.html;},set innerHTML(value){this.html=value;headerRenders.push(value);}};
 const window=new EventTarget(),document=Object.assign(new EventTarget(),{body:{classList:{toggle(){}},dataset:{}},getElementById:()=>null,querySelector:()=>null,querySelectorAll:selector=>selector==='.public-home-header .site-nav'?[header]:[]}),identity={account:{accountId:'one',globalAdmin:true},generation:1},calls=[];
 const api=(path,options={})=>{if(path.startsWith('/api/circles/dashboard?')){const params=Object.fromEntries(new URL(path,'https://local.test').searchParams);options={body:{...params,...(params.refresh?{refresh:params.refresh==='1'}:{})}};}const value=deferred();calls.push({path,options,...value});return value.promise;};
 const context=vm.createContext({window,document,identity,api,createDashboardJoin,...circleDays,localDay,URL,URLSearchParams,setTimeout,clearTimeout,dashboardHTML:()=>''});vm.runInContext(source,context);
 let updates=0;const dashboard=context.makeDashboard({onUpdate:()=>{updates++;dashboard.refresh();},openAcademy:()=>{}});
 return {dashboard,identity,window,calls,headerRenders,get updates(){return updates;}};
}

test('identical pending loads and explicit refreshes share one request per account, generation and perspective',async()=>{
 const c=client(),first=[c.dashboard.load(),c.dashboard.load(),c.dashboard.load()];
 assert.equal(c.calls.length,1);c.calls[0].resolve(snapshot('admin'));await Promise.all(first);
 assert.equal(c.dashboard.mode,'admin');assert.equal(c.updates,1);await c.dashboard.load('admin');assert.equal(c.calls.length,1,'A return uses its existing private client snapshot');
 const refreshed=[c.dashboard.load('admin',true),c.dashboard.load('admin',true)];
 assert.equal(c.calls.length,2);assert.equal(c.calls[1].options.body.refresh,true);c.calls[1].resolve(snapshot('admin','fresh'));await Promise.all(refreshed);
 assert.equal(c.dashboard.data.label,'fresh');assert.equal(c.updates,3);
});

test('a warm dashboard return does not render an intermediate loading state or make another request',async()=>{
 const c=client(),first=c.dashboard.load('learn');c.calls[0].resolve(snapshot('learn'));await first;
 const updates=c.updates,before=c.headerRenders.length,returned=c.dashboard.load('learn');assert(c.dashboard.data,'The cached snapshot is restored in the same turn');assert.equal(c.calls.length,1);assert.equal(c.updates,updates+1);assert(!c.headerRenders.slice(before).some(html=>html.includes(' disabled')),'A warm return must never disable the header for a temporary loading screen');await returned;
});

test('different perspectives and explicit refresh intent do not share the wrong pending result',async()=>{
 const c=client(),learn=c.dashboard.load('learn'),teach=c.dashboard.load('teach'),fresh=c.dashboard.load('teach',true);
 assert.equal(c.calls.length,3);c.calls[2].resolve(snapshot('teach','fresh teaching'));await fresh;
 c.calls[0].resolve(snapshot('learn','old learning'));c.calls[1].resolve(snapshot('teach','old teaching'));await Promise.all([learn,teach]);
 assert.equal(c.dashboard.data.label,'fresh teaching');assert.equal(c.dashboard.mode,'teach');
});

test('clear or a policy change fences pending work and an old completion cannot delete the replacement request',async()=>{
 for(const invalidate of [c=>c.dashboard.clear(),c=>c.window.dispatchEvent(new Event('website-course-policy-changed'))]){
  const c=client(),old=c.dashboard.load('learn');invalidate(c);const next=c.dashboard.load('learn');
  assert.equal(c.calls.length,2);c.calls[0].resolve(snapshot('learn','old'));await old;assert.equal(c.dashboard.data,null);
  const same=c.dashboard.load('learn');assert.equal(c.calls.length,2,'The replacement is still coalesced');c.calls[1].resolve(snapshot('learn','new'));await Promise.all([next,same]);
  assert.equal(c.dashboard.data.label,'new');
 }
});

test('account changes reject old display results and denied loads never retry automatically',async()=>{
 const c=client(),old=c.dashboard.load('learn');c.identity.account={accountId:'two'};c.identity.generation++;c.dashboard.clear();const current=c.dashboard.load('learn');
 assert.equal(c.calls.length,2);c.calls[0].resolve(snapshot('learn','other account'));await old;assert.equal(c.dashboard.data,null);
 c.calls[1].reject(Object.assign(Error('Denied'),{status:403}));await current;assert.equal(c.dashboard.data,null);assert.equal(c.calls.length,2);
 const retry=c.dashboard.load('learn');assert.equal(c.calls.length,3,'A later explicit request can recover after rejection');c.calls[2].resolve(snapshot('learn','current account'));await retry;assert.equal(c.dashboard.data.label,'current account');
});

test('an authority denial during refresh invalidates older cached perspectives before any explicit return',async()=>{
 for(const status of [401,403,409]){
  const c=client(),first=c.dashboard.load('learn');c.calls[0].resolve(snapshot('learn','previous permission'));await first;
  const refresh=c.dashboard.load('learn',true);c.calls[1].reject(Object.assign(Error('Permission changed'),{status}));await refresh;assert.equal(c.dashboard.data,null);assert.equal(c.calls.length,2);
  const returned=c.dashboard.load('learn');assert.equal(c.calls.length,3,'An explicit return must check Source instead of restoring the older private cache');c.calls[2].resolve(snapshot('learn','current permission'));await returned;assert.equal(c.dashboard.data.label,'current permission');
 }
});
