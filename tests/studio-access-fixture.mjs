import assert from 'node:assert/strict';import {fixture} from './fixture.mjs';import {accessFixture} from './access-fixture.mjs';
export async function studioFixture(){
 const f=await fixture({academy:true,authorityMode:'ACADEMY',verification:{accountSeconds:43200,adminSeconds:60,liveSeconds:43200}});try{
 const x=await accessFixture(f);await x.recover(25);
 for(const table of ['participation','staff','paid_months','surah_grants','access_members'])await f.run(`DELETE FROM ${table} WHERE account_id IN('learner','former','teacher','grant-only')`);
 const tokens=new Map();const nativeLogin=async(who='global')=>{if(tokens.has(who))return tokens.get(who);const r=await f.runtime.dispatchFetch('https://academy.test/api/account/login',{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json'},body:JSON.stringify({uniqueid:'separation-'+who,pin:'1234'})}),b=await r.json();assert.equal(r.status,200,JSON.stringify(b));tokens.set(who,b.token);return b.token;};
 const proxy=async(command,{who='global',activity=x.courseA,headers={},extra={}}={})=>{const token=await nativeLogin(who),r=await f.runtime.dispatchFetch('https://academy.test/api/admin/platform/studio-access',{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json',Authorization:'Bearer '+token,'X-Academy-Workspace':'ADMIN',...headers},body:JSON.stringify({activityKey:activity,command,...extra})});return {status:r.status,body:await r.json()};};
 const good=async(...args)=>{const r=await proxy(...args);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
 const handover=async(activity=x.courseA)=>{const transferId=crypto.randomUUID();await good({action:'handover-start',transferId},{activity});for(let i=0;i<9;i++){await good({action:'handover-reconcile',transferId},{activity});await x.recover(6);}let page;for(let i=0;i<20;i++){page=await good({action:'handover-page',transferId},{activity});if(!page.more)break;}assert.equal(page.more,false);await good({action:'handover-commit',transferId},{activity});return transferId;};
 return {f,x,proxy,good,nativeLogin,handover};
 }catch(e){await f.close();throw e;}
}
