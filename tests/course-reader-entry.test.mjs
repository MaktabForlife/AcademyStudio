import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {academyReaderOrigin,existingMaterialLinks,existingSourceWebsiteLinks} from '../public/shared/existing-media-view.mjs';
import {mountCourseMedia} from '../public/shared/course-media-workflow.mjs';
const portal='https://portal.example.test',studio='https://studio.example.test',website='COURSE-synthetic-original';
const options={portalOrigin:portal,studioOrigin:studio,currentOrigin:portal,websiteOrigin:studio};
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
test('configured current portal selects the existing entry; foreign/legacy/missing configuration keeps the checked Studio origin',()=>{
 assert.equal(academyReaderOrigin(options),portal);
 for(const changed of [{currentOrigin:'https://legacy.example.test'},{studioOrigin:'https://other.example.test'},{portalOrigin:portal+'/'},{portalOrigin:'https://user@portal.example.test'},{portalOrigin:'http://portal.example.test'},{portalOrigin:''},{studioOrigin:''}])assert.equal(academyReaderOrigin({...options,...changed}),studio);
});
test('published original reader keeps its exact id in a new noopener tab and the editor retains its checked Studio target',()=>{
 const readerOrigin=academyReaderOrigin(options),{document}=parseHTML('<html><body>'+existingSourceWebsiteLinks([{websiteId:website,title:'Synthetic original',websitePublished:true}],{origin:studio,readerOrigin})+'</body></html>'),links=[...document.querySelectorAll('a')];
 assert.equal(links[0].getAttribute('href'),portal+'/studio/?website='+website);assert.equal(links[1].getAttribute('href'),studio+'/builder/?website='+website);
 for(const a of links){assert.equal(a.getAttribute('target'),'_blank');assert(a.getAttribute('rel').includes('noopener'));assert(!/[?#&](?:token|pin|verifier|refresh)=/.test(a.getAttribute('href')));}
 const defaults=existingMaterialLinks({websiteId:website,websitePublished:true},{origin:studio});assert(defaults.includes(studio+'/studio/?website='+website));
 const privateLinks=existingSourceWebsiteLinks([{websiteId:website,title:'Private original',websitePublished:false}],{origin:studio,readerOrigin});assert(!privateLinks.includes('Read original website'));assert(privateLinks.includes(studio+'/builder/'));
});
test('real Course collection passes the reader entry through without writes',async()=>{
 const {document,window}=parseHTML('<html><head></head><body><main></main></body></html>');Object.assign(globalThis,{document,window});const host=document.querySelector('main'),calls=[];
 const dispose=mountCourseMedia(host,{cardTools:{},websiteOrigin:studio,readerOrigin:portal,request:async(action,body)=>{
  calls.push({action,body});
  if(action==='course-playlists')return {revision:1,playlists:[],legacy:[],websites:[{id:website,title:'Synthetic original',enabled:1,hasPublishedWebsite:1,recordings:0,pdfs:0}],unassigned:{recordings:0,pdfs:0}};
  if(action==='course-playlist-detail')return {revision:1,collection:{name:'Synthetic original',websiteId:website,websitePublished:true,pdfs:[],recordings:[]}};
  throw Error('Unexpected mutation');
 }});await dispose.ready;host.querySelector('[data-cmw=open-existing]').click();await settle();
 assert.equal(host.querySelector('a').getAttribute('href'),portal+'/studio/?website='+website);assert.deepEqual(calls.map(x=>x.action),['course-playlists','course-playlist-detail']);dispose();
});
