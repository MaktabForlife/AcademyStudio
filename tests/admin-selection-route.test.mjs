import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {esc} from '../public/shared/model.mjs';

async function screen(){
 const {document,window}=parseHTML('<html><body><main></main></body></html>');
 const initial='https://studio.test/studio/?manage=1&offering=tafseer&section=media&playlist=old#stale',routes=[],calls=[],identity={account:{accountId:'admin'},generation:1},host=document.querySelector('main');
 const location={href:initial},marker={m4lCirclesNavigation:{trace:'same-history',index:2}};
 Object.defineProperties(window,{location:{value:location,configurable:true},history:{value:{state:marker,replaceState(state,_title,url){assert.equal(state,marker);location.href=new URL(url,location.href).href;routes.push(location.href);}},configurable:true}});
 let leave=true,denied=false,held=false,release;
 const record={canManageContent:true,websites:[],participants:[],months:[],requests:[],media:[]};
 const api=async path=>{calls.push(path);if(path==='/api/config')return {authorityMode:'ACADEMY'};if(path==='/api/admin/offerings')return {offerings:[{offering_id:'tafseer',kind:'TAFSEER',title:'Tafseer'},{offering_id:'mothers',kind:'TAFSEER',programme_key:'mothers',title:'MOU'}]};if(denied)throw Object.assign(Error('Current scope denied'),{status:403});if(held)return new Promise(resolve=>release=()=>resolve(record));return record;};
 const mount=()=>Object.assign(()=>{},{canLeave:()=>leave});
 const source=readFileSync(new URL('../public/admin.mjs',import.meta.url),'utf8').replace(/^import .*$/gm,'').replace(/export /g,'')+'\nwindow.subject={open,close};';
 vm.runInNewContext(source,{window,document,api,mutate(){throw Error('Read-only navigation must not change data');},identity,esc,clearMonthlyMediaCache(){},mountMonthlyMedia:mount,mountNativeCourseMedia:mount,URL,URLSearchParams,DOMException,FormData,crypto});
 await window.subject.open(host,{offeringId:'tafseer',section:'media'});
 return {window,host,identity,location,routes,calls,initial,change:value=>host.querySelector('#offering-selector').onchange({target:{value}}),deny:()=>denied=true,dirty:()=>leave=false,hold:()=>held=true,release:()=>release()};
}

test('checked Offering and section changes keep the refresh URL in sync without another lookup or history entry',async()=>{
 const f=await screen();assert.equal(f.routes.length,0);const before=f.calls.length;
 await f.change('mothers');const selected=new URL(f.location.href);assert.equal(selected.searchParams.get('offering'),'mothers');assert.equal(selected.searchParams.get('section'),'media');assert.equal(selected.searchParams.get('playlist'),null);assert.equal(selected.hash,'');assert.equal(f.calls.length,before+1);
 await f.host.querySelector('[data-tab=participants]').onclick();assert.equal(new URL(f.location.href).searchParams.get('section'),'participants');assert.equal(f.routes.length,2);assert.equal(f.calls.length,before+2);
});
test('unsaved-work cancellation keeps the selected Offering, URL and request count intact',async()=>{
 const f=await screen(),before=f.calls.length;f.dirty();const target={value:'mothers'};await f.host.querySelector('#offering-selector').onchange({target});assert.equal(target.value,'tafseer');assert.equal(f.location.href,f.initial);assert.equal(f.calls.length,before);assert.deepEqual(f.routes,[]);
});
test('a denied current scope cannot promote a requested Offering into the saved navigation URL',async()=>{
 const f=await screen();f.deny();await assert.rejects(f.change('mothers'),/Current scope denied/);assert.equal(f.location.href,f.initial);assert.deepEqual(f.routes,[]);assert.match(f.host.textContent,/Current scope denied/);assert(!f.host.querySelector('#offering-selector'));
});
test('a delayed response after account switching cannot restore private Admin content or alter the route',async()=>{
 const f=await screen();f.hold();const pending=f.change('mothers');f.identity.generation++;f.identity.account={accountId:'student'};f.window.dispatchEvent(new f.window.Event('website-account-changed'));f.release();await pending;assert.equal(f.host.textContent,'');assert.equal(f.location.href,f.initial);assert.deepEqual(f.routes,[]);
});
