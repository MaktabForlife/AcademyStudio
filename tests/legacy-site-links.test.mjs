import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {parseHTML}=createRequire(import.meta.url)('linkedom'),script=readFileSync(new URL('../public/shared/legacy-site-links.js',import.meta.url),'utf8'),flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(html){
 const {window:domWindow,document}=parseHTML('<html><head></head><body>'+html+'</body></html>'),window={};let network=0;
 const create=document.createElement.bind(document);document.createElement=tag=>{const node=create(tag);if(tag==='dialog'){node.showModal=()=>node.setAttribute('open','');node.close=()=>node.dispatchEvent(new domWindow.Event('close'));}return node;};
 vm.runInNewContext(script,{window,document,location:{href:'https://maktab4life.org/'},URL,MutationObserver:domWindow.MutationObserver,fetch(){network++;throw Error('No new request is permitted');}});
 return {window,document,get network(){return network;}};
}
test('old-site navigation disappears while current sign-in, contact, media and source wording survive',()=>{
 const f=fixture('<a href="https://ummabbadacademy.com/" class="text-button">Current website ↗</a><a href="https://www.ummabbadacademy.com/my-account/" target="_blank">Member access</a><a href="https://ummabbadacademy.com/a-reference">Original source wording</a><a href="mailto:admin@ummabbadacademy.com">Contact admin</a><a href="https://wa.me/27828478639">WhatsApp</a><a href="/api/media/authorised">Authorised PDF</a><img src="https://ummabbadacademy.com/original-flyer.jpg">');
 const links=[...f.document.querySelectorAll('a[href]')];assert.equal(links.filter(a=>f.window.AcademyLegacyLinks.isLegacy(a.getAttribute('href'))).length,0);assert(links.some(a=>a.getAttribute('href')==='/?login=1'));assert(links.some(a=>a.getAttribute('href')==='mailto:admin@ummabbadacademy.com'));assert(links.some(a=>a.getAttribute('href')==='/api/media/authorised'));assert.match(f.document.body.textContent,/Original source wording/);assert.doesNotMatch(f.document.body.textContent,/Current website/);assert.equal(f.document.querySelector('img').getAttribute('src'),'https://ummabbadacademy.com/original-flyer.jpg');assert.equal(f.network,0);
 for(const url of ['https://www.ummabbadacademy.com/x','//ummabbadacademy.com/x','https://sub.ummeabbadacademy.com/x'])assert(f.window.AcademyLegacyLinks.isLegacy(url));for(const url of ['https://ummabbadacademy.com.example.test/','mailto:admin@ummabbadacademy.com','/academy/'])assert(!f.window.AcademyLegacyLinks.isLegacy(url));
});
test('later menus and rewritten anchors are cleaned without repeated page/API reloads',async()=>{
 const f=fixture(''),container=f.document.createElement('section');container.innerHTML='<a href="https://www.ummabbadacademy.com/workshops/">Published workshop source</a>';f.document.body.append(container);await flush();assert.equal(container.querySelectorAll('a[href]').length,0);assert.match(container.textContent,/Published workshop source/);
 const link=f.document.createElement('a');link.href='/current';link.textContent='Menu item';f.document.body.append(link);await flush();link.href='https://ummabbadacademy.com/courses/a';await flush();assert.equal(f.document.querySelectorAll('a[href]').length,0);assert.equal(f.network,0);
});
test('prospectus full-size view stays on this page using the existing original image',()=>{
 const f=fixture('<a class="prospectus-sheet" data-legacy-source-href="https://ummabbadacademy.com/flyer.jpg"><img src="https://ummabbadacademy.com/flyer.jpg" alt="Original course flyer"><span>Open full size</span></a>');
 const button=f.document.querySelector('button.prospectus-sheet');assert(button);assert.equal(f.document.querySelectorAll('a[href]').length,0);button.click();const dialog=f.document.querySelector('dialog[open]');assert(dialog);assert.equal(dialog.querySelector('img').getAttribute('src'),'https://ummabbadacademy.com/flyer.jpg');dialog.querySelector('button').click();assert.equal(f.document.querySelector('dialog'),null);assert.equal(f.network,0);
});
test('actual frozen prospectus no longer exposes old-domain hrefs and preserves all six flyer sources',()=>{
 const path=new URL('../public/prospectus-2027.html',import.meta.url),html=readFileSync(path,'utf8'),f=fixture(html.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1]);assert(![...f.document.querySelectorAll('a[href]')].some(a=>f.window.AcademyLegacyLinks.isLegacy(a.getAttribute('href'))));assert.equal(f.document.querySelectorAll('button.prospectus-sheet').length,6);assert.equal(f.document.querySelectorAll('.prospectus-sheet img').length,6);
});
