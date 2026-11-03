import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {dashboardWorkspace,readDashboardPreference} from '../public/shared/dashboard-home.mjs';

const helper=readFileSync(new URL('../public/shared/dashboard-bootstrap.mjs',import.meta.url),'utf8').replace(/^import .*$/gm,'').replace(/export /g,'');
const entry=readFileSync(new URL('../public/circles-home-entry.mjs',import.meta.url),'utf8').replace(/^import .*$/gm,'').replace(/await import\(([^)]+)\)/g,'await moduleImport($1)');
function fixture({workspace='learn',preference=null,gate=true,redirect=null}={}){
 const window=new EventTarget(),calls=[],events=[],identity={account:null,generation:0},modules=[];let time=0,releaseInterface;
 window.AcademyCirclesHomeEntry={pending:gate,fail:()=>events.push('failed')};
 const context=vm.createContext({window,identity,URLSearchParams,DOMException,dashboardWorkspace,readDashboardPreference,dashboardViewStorage:()=>({getItem:()=>preference?JSON.stringify(preference):null}),api(path,options){events.push('bootstrap');let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});calls.push({path,options,at:time,resolve,reject});return promise;},location:{href:'https://site.test/?dashboard=1'+(workspace?'&workspace='+workspace:''),search:workspace?'?workspace='+workspace:'',replace:value=>events.push('redirect:'+value)},canonicalCirclesDestination:()=>redirect,moduleImport:async name=>{events.push(name);modules.push(name);if(name==='./circles/app.js')await new Promise(resolve=>releaseInterface=resolve);},document:{querySelector:()=>({childElementCount:1})}});
 vm.runInContext(helper+'\nwindow.bootstrapTest={startDashboardBootstrap,takeDashboardBootstrap};',context);
 return {window,context,identity,calls,events,modules,entry:()=>vm.runInContext('(async()=>{'+entry+'})();',context),start:mode=>window.bootstrapTest.startDashboardBootstrap(mode),take:mode=>window.bootstrapTest.takeDashboardBootstrap(mode),release:()=>releaseInterface(),tick:ms=>time+=ms};
}
test('the actual Home entry starts one checked request before loading interface modules and consumes its completed result once',async t=>{
 const f=fixture(),loading=f.entry();assert.equal(f.calls.length,1);assert.equal(f.calls[0].path,'/api/circles/bootstrap?mode=learn');assert.equal(f.calls[0].options.optionalSession,true);assert.deepEqual(f.events,['bootstrap','./circles/app.js']);assert.equal(f.identity.account,null);
 f.tick(100);const result={account:{accountId:'one'},dashboard:{mode:'learn'}};f.calls[0].resolve(result);await Promise.resolve();f.tick(50);f.release();await loading;
 assert.equal(await f.take('learn'),result);assert.equal(f.calls.length,1,'An already completed early reply must not cause a second bootstrap');assert.equal(f.identity.account,null,'The checked controller, not a preload, installs identity and mounts private views');
 t.diagnostic(JSON.stringify({syntheticOnly:true,interfaceReadyAtMs:150,checkedRequestStartedAtMs:f.calls[0].at,checkedRequestDurationMs:100,serialRequestStartWouldBeMs:150,overlappedReadyAtMs:150,serialReadyAtMs:250,requestCount:1,preVerificationPrivateDisplay:false}));
});
test('public or redirecting Home entries start no speculative account request',async()=>{
 for(const options of [{gate:false},{redirect:'https://site.test/studio/'}]){
  const f=fixture(options),loading=f.entry();if(!options.redirect)f.release();await loading;assert.equal(f.calls.length,0);
 }
});
test('bootstrap uses the existing account-bound preference and invalid modes cannot request elevated authority',async()=>{
 for(const [workspace,expected]of [['admin','mode=admin'],[null,'preferredAccount=one&preferredMode=learn'],['owner','preferredAccount=one&preferredMode=learn']]){
  const f=fixture({workspace,preference:{accountId:'one',mode:'learn'}});f.start(workspace);f.start(workspace);assert.equal(f.calls.length,1);assert.equal(f.calls[0].path,'/api/circles/bootstrap?'+expected);f.calls[0].resolve({});await f.take(workspace);
 }
});
test('account switching, session end or display invalidation rejects an old pending bootstrap before it is consumed',async()=>{
 for(const event of ['website-account-changed','website-session-ended','website-display-invalidated','website-course-policy-changed']){
  const f=fixture();f.start('learn');const old=f.take('learn'),rejected=assert.rejects(old,/account or dashboard changed/);if(event==='website-account-changed'){f.identity.generation++;f.identity.account={accountId:'two'};}f.window.dispatchEvent(new Event(event));f.calls[0].resolve({account:{accountId:'one'}});await rejected;
  const fresh=f.take('learn');assert.equal(f.calls.length,2);const checked={account:{accountId:'two'}};f.calls[1].resolve(checked);assert.equal(await fresh,checked);
 }
});
test('a failed early request is consumed as the same failure, without another call or unhandled rejection',async()=>{
 const f=fixture();f.start('learn');const error=Object.assign(Error('Unavailable'),{status:503});f.calls[0].reject(error);await new Promise(resolve=>setImmediate(resolve));await assert.rejects(f.take('learn'),value=>value===error);assert.equal(f.calls.length,1);
});
