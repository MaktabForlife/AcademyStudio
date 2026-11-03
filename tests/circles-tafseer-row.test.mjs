import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mountTafseerRail,tafseerRailHTML} from '../public/shared/circles-tafseer-row.mjs';
const {parseHTML}=createRequire(import.meta.url)('linkedom');
const items=[{kind:'TAFSEER',key:'yaseen',title:'Surah Yaseen',websiteId:'yaseen',accent:'#9e5f3c',soft:'#fff8ec'},{kind:'TAFSEER',key:'saffat',title:'Surah As-Saffat',websiteId:'saffat',accent:'#9e5f3c',soft:'#fff8ec'},{kind:'COURSE',key:'paid',title:'Other course',websiteId:'other'}];
const rights=[{websiteId:'yaseen',subscriptionStatus:'subscribed',canOpen:true},{websiteId:'saffat',subscriptionStatus:'required',canOpen:false}];
function fixture(){return parseHTML('<body><div id="circles-dashboard"><div class="circles-programme-links"><a class="circles-programme-link" data-circle-tafseer-link href="/studio/?view=collections&amp;collection=tafseer">Tafseer</a><a href="/mothers">MOU</a></div><div class="learning-wheel"></div></div><section id="programmes"><a>Existing course artwork</a></section></body>').document;}

test('rail uses shared covers, fixed reader routes and exact checked badges',()=>{
 const html=tafseerRailHTML(items,rights),{document}=parseHTML(html);
 assert.equal(document.querySelectorAll('.collection-card').length,2);
 assert.equal(document.querySelector('[data-circles-website="yaseen"]').getAttribute('href'),'/studio/?website=yaseen');
 assert.equal(document.querySelectorAll('.tafseer-surah-name').length,2);
 assert.equal(document.querySelector('[data-circles-website="yaseen"] .access-badge').textContent,'Open');
 assert.equal(document.querySelector('[data-circles-website="saffat"] .access-badge').textContent,'Locked');
 assert(!html.includes('Other course'));
});

test('no checked right produces a locked badge, never assumed Admin/purchase access',()=>{
 const {document}=parseHTML(tafseerRailHTML(items,[]));
 assert.equal(document.querySelectorAll('.access-locked').length,2);
 assert.equal(document.querySelectorAll('.access-open').length,0);
});

test('checked Admin opening access is Open without claiming a paid subscription; a denied row stays locked',()=>{
 const access=[{websiteId:'yaseen',canOpen:true,subscriptionStatus:'required',accessBasis:null},{websiteId:'saffat',canOpen:false,subscriptionStatus:'subscribed'}],before=JSON.stringify(access);
 const {document}=parseHTML(tafseerRailHTML(items,access));
 assert.equal(document.querySelector('[data-circles-website="yaseen"] .access-badge').textContent,'Open');assert.match(document.querySelector('[data-circles-website="yaseen"]').getAttribute('aria-label'),/ · Open$/);assert(!document.body.textContent.includes('Subscribed'));
 assert.equal(document.querySelector('[data-circles-website="saffat"] .access-badge').textContent,'Locked');assert.equal(JSON.stringify(access),before);
});

test('ready rail is directly above courses, replaces only Tafseer button and preserves artwork',async()=>{
 const document=fixture(),presenter=mountTafseerRail(document),originalCourses=document.querySelector('#programmes').innerHTML;
 presenter.update({visible:true,items,rights});
 assert.equal(document.querySelector('#circles-dashboard').lastElementChild.className,'circles-tafseer-rail');
 assert.equal(document.querySelector('#circles-dashboard').nextElementSibling.id,'programmes');
 assert(document.querySelector('[data-circle-tafseer-link]').hidden);
 assert(!document.querySelector('[href="/mothers"]').hidden);
 assert.equal(document.querySelector('#programmes').innerHTML,originalCourses);
 const cover=document.querySelector('.circles-tafseer-rail .collection-cover');
 const changes=[],observer=new document.defaultView.MutationObserver(rows=>changes.push(...rows));observer.observe(document.body,{childList:true,subtree:true,attributes:true});
 presenter.update({visible:true,items,rights});
 await new Promise(resolve=>setImmediate(resolve));observer.disconnect();assert.equal(changes.length,0);
 assert.equal(document.querySelector('.circles-tafseer-rail .collection-cover'),cover);
});

test('loading, empty catalogue and failure clear stale cards and retain working fallback',()=>{
 const document=fixture(),presenter=mountTafseerRail(document);
 for(const state of [{loading:true},{items:[]},{error:'Internal details must not be exposed'},{rights:null}]){
  presenter.update({visible:true,items,rights});
  presenter.update({visible:true,items,rights,...state});
  assert(!document.querySelector('[data-circle-tafseer-link]').hidden);
  assert.equal(document.querySelectorAll('.circles-tafseer-rail .collection-card').length,0);
  assert(!document.body.textContent.includes('Internal details must not be exposed'));
 }
});

test('account/session/public transition removes private rail and restores original visibility',()=>{
 const document=fixture(),presenter=mountTafseerRail(document);
 presenter.update({visible:true,items,rights});presenter.update({visible:false});
 assert.equal(document.querySelector('.circles-tafseer-rail'),null);
 assert(!document.querySelector('[data-circle-tafseer-link]').hidden);
 document.querySelector('[data-circle-tafseer-link]').hidden=true;
 presenter.update({visible:true,items,rights});presenter.clear();
 assert(document.querySelector('[data-circle-tafseer-link]').hidden);
});

test('native dashboard redraw gets one fresh rail and clears the old detached view',()=>{
 const document=fixture(),presenter=mountTafseerRail(document),dashboard=document.querySelector('#circles-dashboard');
 presenter.update({visible:true,items,rights});const previous=document.querySelector('.circles-tafseer-rail');
 dashboard.innerHTML='<a data-circle-tafseer-link href="/studio/?view=collections&amp;collection=tafseer">Tafseer</a>';
 presenter.update({visible:true,items:[items[1]],rights});
 assert(!previous.isConnected);assert.equal(document.querySelectorAll('.circles-tafseer-rail').length,1);
 assert.equal(document.querySelectorAll('.circles-tafseer-rail .collection-card').length,1);
 assert(document.querySelector('[data-circle-tafseer-link]').hidden);
});

test('catalogue titles remain escaped and foreign course rows are not displayed',()=>{
 const html=tafseerRailHTML([{...items[0],title:'<img src=x onerror=alert(1)>'}],rights),{document}=parseHTML(html);
 assert.equal(document.querySelector('img'),null);assert(html.includes('&lt;img'));
});
