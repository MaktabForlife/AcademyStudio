import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {mountCourseMedia} from '../public/shared/course-media-workflow.mjs';
import {mountMonthlyMedia,clearMonthlyMediaCache} from '../public/shared/monthly-media-page.mjs';
import {existingMaterialLinks} from '../public/shared/existing-media-view.mjs';
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
function dom(){const {document,window}=parseHTML('<html><head></head><body><main></main></body></html>');Object.assign(globalThis,{document,window});return document.querySelector('main');}

test('existing Course collection opens its recordings, PDF and website together without mutation requests',async()=>{
 const host=dom(),calls=[];
 const request=async(action,body)=>{calls.push({action,body});if(action==='course-playlists')return {revision:1,playlists:[],legacy:[],websites:[{id:'kahf',title:'Surah Al Kahf',enabled:1,hasPublishedWebsite:1,recordings:2,pdfs:1}],unassigned:{recordings:0,pdfs:0}};if(action==='course-playlist-detail')return {revision:1,collection:{name:'Surah Al Kahf',websiteId:'kahf',websitePublished:true,pdfs:[{attachmentId:'notes',assetId:'pdf',title:'Original notes',published:1}],recordings:[{attachmentId:'one',title:'First recording',published:1,summary:'The first recording summary'},{attachmentId:'two',title:'Second recording',published:0,summary:'Private recording summary'}]}};throw Error('Unexpected action '+action);};
 const dispose=mountCourseMedia(host,{request,cardTools:{},websiteOrigin:'https://checked.studio'});await dispose.ready;
 assert(!host.textContent.includes('No playlists'));assert.equal(host.querySelector('tbody tr').children[1].textContent,'2');
 host.querySelector('[data-cmw=open-existing]').click();await settle();
 assert.match(host.textContent,/First recording/);assert.match(host.textContent,/Second recording/);assert.match(host.textContent,/Private draft/);assert.match(host.textContent,/The first recording summary/);
 assert.equal(host.querySelector('a[href="https://checked.studio/api/media/notes?draft=1"]').textContent,'Original notes');
 assert(host.querySelector('a[href="https://checked.studio/studio/?website=kahf"]'));
 assert.equal(host.querySelector('[data-cmw=publish-content]'),null);assert.deepEqual(calls.map(c=>c.action),['course-playlists','course-playlist-detail']);dispose();
});
test('Tafseer and MOU expose existing collections directly, label private material, and keep six unassigned recordings separate',async()=>{
 for(const mothers of [false,true]){
  const host=dom();clearMonthlyMediaCache();const calls=[],offer=mothers?'mothers':'tafseer';
  const api=async path=>{calls.push(path);if(path.endsWith('/playlists'))return {revision:1,playlists:[{id:'private',websiteId:'private',name:'Existing private collection',legacy:true,enabled:0,websitePublished:false,recordings:1,privateRecordings:1,pdfs:1}],unassigned:{recordings:6,pdfs:0}};
   if(path.endsWith('/media-review?website=private'))return {media:[{attachment_id:'recording',title:'Private recording',mime_type:'video/youtube',published:0,summary:'Private genuine summary'},{attachment_id:'pdf',asset_id:'asset',title:'Private PDF',mime_type:'application/pdf',published:0}]};
   if(path.endsWith('/media-review?unassigned=1'))return {media:Array.from({length:6},(_,i)=>({attachment_id:'u'+i,title:'Unassigned '+i,mime_type:'video/youtube',published:1}))};throw Error('Unexpected URL '+path);};
  const dispose=mountMonthlyMedia(host,{api,identity:{account:{accountId:'admin'},generation:1},offering:{offering_id:offer,programme_key:mothers?'mothers':null},current:()=>true,initialRecord:{canManageContent:true,mediaRevision:1}});await settle();
  assert(host.querySelector('.monthly-existing table'));assert.match(host.textContent,/6 recordings/);assert.equal(host.querySelector('details.monthly-historical'),null);
  host.querySelector('[data-monthly=legacy]').click();await settle();assert.match(host.textContent,/Private genuine summary/);assert.match(host.textContent,/Private PDF/);assert.match(host.textContent,/Private draft/);
  assert.equal([...host.querySelectorAll('a')].find(a=>a.textContent==='Read website'),undefined);assert(!calls.some(p=>p.startsWith('/api/websites/')));
  host.querySelector('[data-monthly=back]').click();await settle();host.querySelector('[data-monthly=unassigned]').click();await settle();assert.equal(host.querySelectorAll('.monthly-recording').length,6);assert.equal([...host.querySelectorAll('a')].find(a=>a.textContent==='Edit website'),undefined);dispose();
 }
});
test('project PDFs remain local-only links and private websites have no published reader link',()=>{
 const html=existingMaterialLinks({websiteId:'private',projectPdfs:[{title:'Verified original',href:'/review-files/'+'a'.repeat(64)+'.pdf'},{title:'Forged external',href:'https://external.invalid/secret.pdf'}]});
 assert.match(html,/Project copy · local review only/);assert.match(html,/Verified original/);assert(!html.includes('Forged external'));assert(!html.includes('Read website'));assert(!html.includes('https://external'));
});
test('a late Course collection response cannot paint after switching the account or Course',async()=>{
 const host=dom();let active=true,release;const delayed=new Promise(r=>release=r);
 const dispose=mountCourseMedia(host,{current:()=>active,cardTools:{},request:async action=>action==='course-playlists'?{revision:1,playlists:[],legacy:[],websites:[{id:'private',title:'Existing',recordings:1}]}:delayed});await dispose.ready;
 host.querySelector('[data-cmw=open-existing]').click();await settle();active=false;release({revision:1,collection:{name:'Secret late title',recordings:[],pdfs:[]}});await settle();assert(!host.textContent.includes('Secret late title'));dispose();
});
