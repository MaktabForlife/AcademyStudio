import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {dashboardTafseerData} from '../public/shared/dashboard-tafseer-data.mjs';
import {mountTafseerRail} from '../public/shared/circles-tafseer-row.mjs';
const flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
test('connected checked cards survive a dashboard redraw without another read, then clear on account switching',async()=>{
 const {window,document}=parseHTML('<html><body><section id="circles-dashboard"><a data-circle-tafseer-link href="/studio/?view=collections&amp;collection=tafseer">Tafseer</a></section><section id="programmes">Original Course artwork</section></body></html>');
 const identity={account:{accountId:'admin'},generation:1},calls=[];
 const rail=dashboardTafseerData({identity,window,view:mountTafseerRail(document),api:async path=>{calls.push(path);return path==='/api/public/circles'?{items:[{key:'yaseen',kind:'TAFSEER',title:'Yaseen',websiteId:'exact-site'}]}:{websites:[{websiteId:'exact-site',canOpen:true,subscriptionStatus:'required',accessBasis:null}]};}});
 await rail.update(true);assert.equal(calls.length,2);assert.equal(document.querySelector('.access-badge').textContent,'Open');const original=document.querySelector('.collection-cover');
 await rail.update(true);assert.equal(document.querySelector('.collection-cover'),original);assert.equal(document.querySelector('#programmes').textContent,'Original Course artwork');
 document.querySelector('#circles-dashboard').innerHTML='<a data-circle-tafseer-link href="/studio/?view=collections&amp;collection=tafseer">Tafseer</a>';await rail.update(true);assert(document.querySelector('.circles-tafseer-rail'));assert.equal(calls.length,2);assert(document.querySelector('[data-circle-tafseer-link]').hidden);
 identity.account=null;identity.generation++;window.dispatchEvent(new window.Event('website-session-ended'));assert.equal(document.querySelector('.circles-tafseer-rail'),null);assert(!document.querySelector('[data-circle-tafseer-link]').hidden);rail.dispose();
});
test('a slow batch cannot display former-account cards after the page changes to a public view',async()=>{
 const {window,document}=parseHTML('<html><body><section id="circles-dashboard"><a data-circle-tafseer-link>Tafseer</a></section></body></html>');let release;
 const identity={account:{accountId:'one'},generation:1},rail=dashboardTafseerData({identity,window,view:mountTafseerRail(document),api:async path=>path==='/api/public/circles'?{items:[{key:'luqman',kind:'TAFSEER',title:'Luqman',websiteId:'checked'}]}:new Promise(resolve=>release=resolve)});
 const loading=rail.update(true);await flush();await rail.update(false);release({websites:[{websiteId:'checked',canOpen:true}]});await loading;assert.equal(document.querySelector('.circles-tafseer-rail'),null);assert(!document.querySelector('[data-circle-tafseer-link]').hidden);rail.dispose();
});
