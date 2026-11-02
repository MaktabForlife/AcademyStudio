import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {mountMonthlyMedia,clearMonthlyMediaCache} from '../public/shared/monthly-media-page.mjs';
import {parseSeriesRoute} from '../public/shared/recording-website.mjs';
import {collectionPlan} from '../public/shared/existing-collection.mjs';

const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
async function screen(change={}){
 const {document,window}=parseHTML('<html><head></head><body><main></main></body></html>');globalThis.document=document;globalThis.window=window;clearMonthlyMediaCache();
 const host=document.querySelector('main'),websiteId='checked:source',href='/studio/?website='+encodeURIComponent(websiteId),calls=[];
 const review={schema:'EXISTING_MOU_COLLECTION_V1',websiteId,href,title:'Reviewed collection',sourceReview:{websiteId,revision:2,publishedKey:'internal-published-key'},recordings:['opaque:second','opaque:first'].map((attachmentId,index)=>({attachmentId,assetId:'internal-asset-'+index,title:'Original lesson',recordedDate:'2026-03-10',summary:'Genuine lesson summary '+index,topics:[],readingIds:[],published:true})),pdfs:[{attachmentId:'protected-pdf',assetId:'internal-pdf-asset',title:'Original shared notes',size:42}],unresolved:[],canAttach:true,...change};
 const table={revision:1,playlists:[{id:'target',websiteId:'target-site',name:'Private target',enabled:false}],items:[],pdfs:[]};
 const api=async(path,options)=>{calls.push({path,options});if(path==='/api/admin/mothers/playlists'||path==='/api/admin/mothers/playlists?playlist=target')return structuredClone(table);if(path==='/api/admin/mothers/existing-collection?website='+encodeURIComponent(websiteId))return structuredClone(review);throw Error('Unexpected review request '+path);};
 const dispose=mountMonthlyMedia(host,{api,identity:{account:{accountId:'admin'},generation:1},offering:{offering_id:'mothers',programme_key:'mothers'},current:()=>true,initialRecord:{canManageContent:true,mediaRevision:1,websites:[{website_id:websiteId,title:'Reviewed collection'}]}});
 await settle();host.querySelector('[data-lm=monthly-open]').click();await settle();host.querySelector('[data-monthly=existing]').click();await settle();host.querySelector('[data-existing-source] option[value="'+websiteId+'"]').selected=true;host.querySelector('[data-monthly=review-collection]').click();await settle();
 return {host,review,href,calls,dispose};
}

test('existing collection review opens the protected reader and exact recordings, shows lesson positions and retains internal identities without extra lookups',async()=>{
 const f=await screen();try{
  const links=[...f.host.querySelectorAll('a')],collection=links.find(link=>link.textContent==='Open existing recordings ↗');assert(collection);assert.equal(collection.getAttribute('href'),f.href);
  const rows=[...f.host.querySelectorAll('.monthly-existing-recordings > li')];assert.equal(rows.length,2);
  for(const [index,row]of rows.entries()){
   assert.match(row.textContent,new RegExp('Lesson '+(index+1)+' · 2026-03-10'));assert(!row.textContent.includes(f.review.recordings[index].attachmentId));
   const link=row.querySelector('a'),url=new URL(link.getAttribute('href'),'https://checked.local');assert.equal(url.origin,'https://checked.local');assert.equal(url.pathname,'/studio/');assert.equal(url.searchParams.get('website'),f.review.websiteId);assert.deepEqual(parseSeriesRoute(url.hash),{route:'recording',recordingId:f.review.recordings[index].attachmentId});
  }
  for(const link of links){assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener');assert.doesNotMatch(link.getAttribute('href'),/internal-|object_key|public\/|youtu/);}
  assert.equal(links.find(link=>link.textContent==='Original shared notes').getAttribute('href'),'/api/media/protected-pdf?draft=1');
  assert.deepEqual(collectionPlan(f.review,'target').items.map(item=>item.id),['opaque:second','opaque:first']);
  assert.deepEqual(f.calls.map(call=>call.path),['/api/admin/mothers/playlists','/api/admin/mothers/playlists?playlist=target','/api/admin/mothers/existing-collection?website=checked%3Asource']);assert(f.calls.every(call=>!call.options?.body));
 }finally{f.dispose();clearMonthlyMediaCache();}
});

test('collection review rejects a different website or reader destination instead of offering attachment or links',async()=>{
 for(const change of [{websiteId:'different-source'},{href:'https://external.invalid/studio/?website=checked%3Asource'},{href:'/api/media/internal-object-key'}]){
  const f=await screen(change);try{assert.match(f.host.textContent,/collection reader changed/);assert.equal(f.host.querySelector('[data-monthly=attach-collection]'),null);assert.equal(f.host.querySelector('a'),null);assert.equal(f.calls.length,3);}finally{f.dispose();clearMonthlyMediaCache();}
 }
});
