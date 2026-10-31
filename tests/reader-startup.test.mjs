import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {startReaderView,readerHasLiveSessions} from '../public/shared/reader-startup.mjs';
import {protectAccountHistory} from '../public/shared/account-history.mjs';
const main=()=>({hidden:false,attributes:new Map(),setAttribute(k,v){this.attributes.set(k,v);},removeAttribute(k){this.attributes.delete(k);}});
test('a completed Course never loads a timetable even when its saved author document contains a Sessions page',()=>{
 const record={kind:'COURSE',document:{pages:{sessions:true}},capabilities:{liveSessions:false}};
 assert.equal(readerHasLiveSessions(record),false);assert.equal(readerHasLiveSessions({...record,capabilities:{liveSessions:true}}),true);
 assert.equal(readerHasLiveSessions({...record,kind:'TAFSEER',capabilities:{liveSessions:true}}),false);assert.equal(readerHasLiveSessions(null),false);
});
test('initial reader HTML hides the legacy page before any application module or request runs',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(html,/<main[^>]+id="main"[^>]+aria-busy="true"[^>]+hidden>/);
 assert.match(html,/<section id="homepage" hidden>/);assert.match(html,/role="status" aria-live="polite">Loading your learning…/);
});
test('a slow Tafseer route stays hidden until ready, and loading failures remain visible',async()=>{
 const root=main(),status={textContent:'Loading your learning…'};let resolve;
 const pending=new Promise(done=>resolve=done),startup=startReaderView({main:root,status,load:()=>pending});
 assert.equal(root.hidden,true);assert.equal(root.attributes.get('aria-busy'),'true');assert.match(status.textContent,/Loading/);
 resolve();await startup;assert.equal(root.hidden,false);assert.equal(root.attributes.has('aria-busy'),false);assert.equal(status.textContent,'');
 await startReaderView({main:root,status,load:async()=>{throw Error('Please sign in again.');}});assert.equal(root.hidden,false);assert.equal(status.textContent,'Please sign in again.');
});
test('history snapshots discard private account state and restore through a new session check',()=>{
 const window=new EventTarget();let reloads=0,clears=0;window.location={reload:()=>reloads++};const identity={account:{accountId:'previous'},generation:4};
 protectAccountHistory({window,identity,clear(){clears++;assert.equal(identity.account,null);}});
 window.dispatchEvent(new Event('pagehide'));assert.equal(clears,1);assert.equal(identity.generation,5);
 window.dispatchEvent(new Event('pageshow'));assert.equal(reloads,0);
 const restored=new Event('pageshow');Object.defineProperty(restored,'persisted',{value:true});window.dispatchEvent(restored);assert.equal(reloads,1);
});
