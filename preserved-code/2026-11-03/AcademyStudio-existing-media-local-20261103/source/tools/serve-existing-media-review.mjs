// Loopback-only, read-only inventory preview. No live authentication or writes.
import './preserve-local-files.mjs';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
if(!process.env.MEDIA_REVIEW_INVENTORY||!process.env.MEDIA_REVIEW_PDFS)throw Error('Provide private local inventory and verified PDF manifests.');
const inventory=JSON.parse(await readFile(process.env.MEDIA_REVIEW_INVENTORY)),pdfs=JSON.parse(await readFile(process.env.MEDIA_REVIEW_PDFS)),rows=inventory.attachments;
const files=new Map(pdfs.filter(p=>p.verified).map(p=>[p.expectedSha256,p]));
const mothers=rows.find(r=>r.website_id==='mou-kitabul-adhkar')?.offering_id;
const tafseer=rows.find(r=>r.website_id==='8ba50d57-ae3c-47db-9b2c-e658c95d355c')?.offering_id;
const site=id=>inventory.websites.find(w=>w.id===id);
const offers=[...new Set(rows.map(r=>r.offering_id))].map(id=>({id,kind:id===mothers||id===tafseer?'TAFSEER':'COURSE',name:id===mothers?'MOU':id===tafseer?'Tafseer':site(rows.find(r=>r.offering_id===id).website_id)?.name}));
const counts=rs=>({recordings:rs.filter(r=>r.mime_type!=='application/pdf').length,privateRecordings:rs.filter(r=>r.mime_type!=='application/pdf'&&!r.published).length,pdfs:new Set(rs.filter(r=>r.mime_type==='application/pdf').map(r=>r.asset_id)).size});
const groups=offer=>inventory.websites.filter(w=>rows.some(r=>r.offering_id===offer&&r.website_id===w.id)).map(w=>({...w,websiteId:w.id,title:w.name,enabled:Number(!w.private),hasPublishedWebsite:Number(!w.private),websitePublished:!w.private,legacy:true,...counts(rows.filter(r=>r.offering_id===offer&&r.website_id===w.id))}));
const groupRows=(offer,id)=>rows.filter(r=>r.offering_id===offer&&(id==='unassigned'?r.website_id===null:r.website_id===id));
const clean=r=>({attachment_id:r.attachment_id,asset_id:r.asset_id,lesson_id:r.lesson_id,lesson_date:r.lesson_date,website_id:r.website_id,title:r.title,published:r.published,mime_type:r.mime_type,type:r.mime_type,summary:r.index_json?JSON.parse(r.index_json).summary:'Open the existing Studio reading for the recording summary and follow-along. This inventory preview does not include the full website content.'});
const detail=(offer,id)=>{const rs=groupRows(offer,id).map(clean),w=site(id);return {id,name:w?.name||'Unassigned recordings and material',websiteId:w?.id||null,unassigned:id==='unassigned',websitePublished:w&&!w.private,recordings:rs.filter(r=>r.type!=='application/pdf').map(r=>({...r,attachmentId:r.attachment_id,recordedDate:r.lesson_date})),pdfs:rs.filter(r=>r.type==='application/pdf').map(r=>({...r,attachmentId:r.attachment_id,assetId:r.asset_id})),more:false};};
const projects=Object.fromEntries(inventory.websites.map(w=>[w.id,pdfs.filter(p=>p.verified&&p.websiteId===w.id&&!rows.some(r=>r.website_id===w.id&&r.sha256===p.expectedSha256)).map(p=>({title:p.course+' — original PDF',href:'/review-files/'+p.expectedSha256+'.pdf'}))]));
const json=(res,value)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Media collections · local review</title><link rel="stylesheet" href="/app.css"><link rel="stylesheet" href="/shared/course-media-workflow.css"><link rel="stylesheet" href="/shared/monthly-media-page.css"><style>body{background:#f8f5ef;padding:28px}main{max-width:1180px;margin:auto}.review-note{background:#eee7e3;padding:14px 20px;border-radius:10px;font-size:14px}#pick{max-width:100%;padding:10px;font:inherit;margin:20px 0}h1{font:400 38px Georgia;color:#584753}.review-label{font-size:13px;color:#7f777d}@media(max-width:600px){body{padding:12px}}</style><main><p class="review-note">Local review · Existing material inventory. Nothing here saves or publishes to Studio. Website and existing attachment links open the protected Studio site. Original project PDFs open locally.</p><h1>Recordings, PDFs and reading websites</h1><label for="pick">Review a Course or programme</label><br><select id="pick"></select><p class="review-label">This preview checks the collection layout. Full reading and follow-along remain available through the existing Studio links.</p><div id="media"></div></main><script type="module">
import {mountCourseMedia} from '/shared/course-media-workflow.mjs';import {mountMonthlyMedia} from '/shared/monthly-media-page.mjs';import * as cardTools from '/shared/playlist-card.mjs';
const data=await (await fetch('/review/config')).json(),pick=document.querySelector('#pick'),root=document.querySelector('#media');let dispose;
for(const o of data.offers){const option=document.createElement('option');option.value=o.id;option.textContent=o.name;pick.append(option);}
const q=new URLSearchParams(location.search);pick.value=q.get('offering')||data.offers.find(o=>o.name==='Surah Al Kahf').id;
const read=async(kind,input={})=>{const r=await fetch('/review/data?'+new URLSearchParams({kind,offering:pick.value,...input}));if(!r.ok)throw Error('This local preview is read-only.');return r.json();};
async function show(){dispose?.();const o=data.offers.find(o=>o.id===pick.value);if(o.kind==='COURSE'){dispose=mountCourseMedia(root,{cardTools,projectMaterials:data.projects,websiteOrigin:'https://maktab4life.org',request:async(action,input)=>{if(action==='course-playlists')return read('list');if(action==='course-playlist-detail')return read('detail',input);if(action==='course-playlist-recording')return read('recording',input);throw Error('Creation, editing and publication are disconnected in this local review.');}});await dispose.ready;}else{dispose=mountMonthlyMedia(root,{projectMaterials:data.projects,offering:{offering_id:o.id,programme_key:o.name==='MOU'?'mothers':null},identity:{account:{accountId:'local-review'},generation:1},current:()=>true,initialRecord:{canManageContent:true,mediaRevision:1},api:async(path,options)=>{if(options?.body)throw Error('This preview is read-only.');return read('monthly',{path});}});}window.reviewReady=true;}
pick.addEventListener('change',show);await show();
</script></html>`;
const server=createServer(async(req,res)=>{try{
 if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host||'')){res.writeHead(403);return res.end();}
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.writeHead(405);return res.end('Read-only local review');}
 const u=new URL(req.url,'http://localhost'),offer=u.searchParams.get('offering'),kind=u.searchParams.get('kind');
 if(u.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}
 if(u.pathname==='/review/config')return json(res,{offers,projects});
 if(u.pathname==='/review/data'){
  if(!offers.some(o=>o.id===offer))throw Error('Choose a known collection');
  if(kind==='list')return json(res,{revision:1,playlists:[],legacy:[],websites:groups(offer),unassigned:counts(groupRows(offer,'unassigned'))});
  if(kind==='detail')return json(res,{revision:1,collection:detail(offer,u.searchParams.get('unassigned')==='1'?'unassigned':u.searchParams.get('websiteId'))});
  if(kind==='recording'){const r=rows.find(r=>r.offering_id===offer&&r.attachment_id===u.searchParams.get('attachmentId'));if(!r)throw Error('Unknown recording');return json(res,{title:r.title,source:{url:'https://maktab4life.org/api/media/'+encodeURIComponent(r.attachment_id)+'?draft=1'},companion:r.index_json?JSON.parse(r.index_json):null});}
  if(kind==='monthly'){const p=new URL(u.searchParams.get('path'),'http://localhost');if(p.pathname.endsWith('/playlists'))return json(res,{revision:1,playlists:groups(offer),unassigned:counts(groupRows(offer,'unassigned'))});if(p.pathname.endsWith('/media-review'))return json(res,{media:groupRows(offer,p.searchParams.get('unassigned')==='1'?'unassigned':p.searchParams.get('website')).map(clean)});if(p.pathname.startsWith('/api/websites/'))return json(res,{document:{lessons:[]},assets:[]});if(p.pathname.endsWith('/media'))return json(res,{media:groupRows(offer,p.searchParams.get('website')).filter(r=>r.published).map(clean),companions:[],mediaBindings:[]});if(p.pathname.endsWith('/media-detail')){const r=rows.find(r=>r.attachment_id===p.searchParams.get('attachment'));return json(res,{title:r.title,published:r.published,recordedDate:r.lesson_date,source:{url:'https://maktab4life.org/api/media/'+encodeURIComponent(r.attachment_id)+'?draft=1'},supportingFiles:[]});}}
  throw Error('Unsupported local review action');
 }
 const pdf=u.pathname.match(/^\/review-files\/([a-f0-9]{64})\.pdf$/);if(pdf){const file=files.get(pdf[1]);if(!file)throw Error('Unverified PDF');res.setHeader('Content-Type','application/pdf');createReadStream(file.localCopy).pipe(res);return;}
 const file=resolve('public','.'+u.pathname);if(!file.startsWith(resolve('public')+'/'))throw Error('Unknown asset');
 res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'})[extname(file)]||'application/octet-stream');return res.end(await readFile(file));
 }catch(error){res.writeHead(404);res.end(error.message);}});
await new Promise(done=>server.listen(Number(process.env.MEDIA_REVIEW_PORT||0),'127.0.0.1',done));console.log(JSON.stringify({url:'http://127.0.0.1:'+server.address().port+'/',localOnly:true,readOnly:true,projectPdfs:files.size}));
