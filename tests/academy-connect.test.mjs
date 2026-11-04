import test from 'node:test';import assert from 'node:assert/strict';
import {connectAcademy,checkedTarget,checkedTransaction} from '../public/academy-connect.mjs';
const origin='https://studio.example.test',portal='https://ummabbadacademy.app',key='m4l_studio_native_connect_v1';
const mapStorage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
function browser(search='',hash=''){const events=[],win={location:{origin,pathname:'/academy-connect.html',search,hash,replace:value=>events.push(['replace',value])},history:{replaceState:(_state,_title,value)=>events.push(['clean',value])}};return {win,events};}
test('connector top-level flow sends only challenge/state/target, consumes the local verifier and clears code before fetch',async()=>{
 const storage=mapStorage(),first=browser('?target='+encodeURIComponent('/studio/?website=site-course'));
 const config=async()=>Response.json({academyPortalOrigin:portal});
 await connectAcademy({win:first.win,storage,fetcher:config,clock:()=>1000});
 const saved=JSON.parse(storage.getItem(key)),destination=new URL(first.events[0][1]);
 assert.equal(destination.origin,portal);assert.equal(destination.pathname,'/academy/studio-authorize/');assert.deepEqual([...destination.searchParams.keys()].sort(),['challenge','state','target']);
 assert(!destination.href.includes(saved.verifier));assert.equal(destination.searchParams.get('state'),saved.state);
 const returned=browser('', '#code='+'c'.repeat(43)+'&state='+saved.state);let calls=0;
 await connectAcademy({win:returned.win,storage,clock:()=>2000,fetcher:async(path,options)=>{
  assert.equal(returned.events[0][0],'clean');calls++;if(path==='/api/config')return config();
  assert.equal(path,'/auth/exchange');assert.equal(options.credentials,'same-origin');assert.deepEqual(JSON.parse(options.body),{code:'c'.repeat(43),state:saved.state,verifier:saved.verifier});return Response.json({signedIn:true,accountId:'synthetic'});
 }});
 assert.equal(calls,2);assert.equal(storage.getItem(key),null);assert.deepEqual(returned.events.at(-1),['replace','/studio/?website=site-course']);
});
test('foreign targets, origin changes, stale tabs and unsolicited states never reach exchange',async()=>{
 for(const target of ['https://evil.test','//evil.test','/studio/../admin/','/studio/?next=https://evil.test','/academy/','/studio/?website=x&website=y','/studio/?website=x\\evil'])assert.throws(()=>checkedTarget(target,origin),target);
 const good={verifier:'v'.repeat(43),state:'s'.repeat(43),target:'/studio/',origin,portalOrigin:portal,issuedAt:1000};
 for(const changed of [{...good,state:'x'.repeat(43)},{...good,origin:'https://evil.test'},{...good,portalOrigin:'https://evil.test'},{...good,issuedAt:100000}])assert.throws(()=>checkedTransaction(changed,origin,portal,'s'.repeat(43),2000));
 assert.throws(()=>checkedTransaction(good,origin,portal,'s'.repeat(43),61001));
 const storage=mapStorage();storage.setItem(key,JSON.stringify(good));const f=browser('','#code='+'c'.repeat(43)+'&state='+'x'.repeat(43));let exchanges=0;
 await assert.rejects(connectAcademy({win:f.win,storage,clock:()=>2000,fetcher:async path=>{if(path==='/auth/exchange')exchanges++;return Response.json({academyPortalOrigin:portal});}}));assert.equal(exchanges,0);assert.equal(f.events[0][0],'clean');
});
test('blocked storage and an unactivated same-origin portal fail closed',async()=>{
 const blocked={getItem:()=>null,setItem:()=>{throw Error('blocked');},removeItem:()=>{}};
 const first=browser();await assert.rejects(connectAcademy({win:first.win,storage:blocked,fetcher:async()=>Response.json({academyPortalOrigin:portal})}),/temporary browser storage/);assert.equal(first.events.length,0);
 const same=browser();await assert.rejects(connectAcademy({win:same.win,storage:mapStorage(),fetcher:async()=>Response.json({academyPortalOrigin:origin})}),/not configured/);assert.equal(same.events.length,0);
});

test('only the saved Baqarah compatibility reader is accepted outside canonical Studio readers',()=>{
 for(const path of ['/circles/academy/mothers/surah-al-baqarah/','/circles/academy/mothers/surah-al-baqarah/index.html'])assert.equal(checkedTarget(path,origin),path);
 for(const path of ['/circles/academy/','/circles/academy/mothers/','/circles/academy/mothers/other/','/circles/academy/mothers/surah-al-baqarah/secret.html'])assert.throws(()=>checkedTarget(path,origin));
});
