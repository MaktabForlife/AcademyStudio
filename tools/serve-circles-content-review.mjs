// Local-only review. Private website copies and source links never enter public assets.
import {createServer} from 'node:http';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve,join,extname,sep} from 'node:path';import {Readable} from 'node:stream';
import {previewFixture,loadPreparedPreview} from '../tests/preview-fixture.mjs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {recordingGuides} from '../public/shared/recording-companion.mjs';
import {circlesReviewPage} from './circles-review-page.mjs';
import {THEMES} from '../public/shared/model.mjs';
const root=resolve(process.argv[2]||''),out=resolve(process.argv[3]||'');if(!process.argv[2]||!process.argv[3])throw Error('Specify project root and a local evidence directory.');
const port=Number(process.env.PREVIEW_PORT||8901),origin='http://localhost:'+port,f=await previewFixture();
const results=[],globalPdfHashes=new Set();
const plan=JSON.parse(await readFile(join(root,'outputs/academy-studio-nine-site-preview-20261028/seed-plan.json'),'utf8'));await loadPreparedPreview(f,plan);
const config=JSON.parse(await readFile(join(root,'outputs/all-course-recording-review-20261029/private/all-nine-review-config.json'),'utf8'));
for(const item of config){let reviewedGuides=[];const selectedKey=item.key,website=plan.websites.find(w=>w.key===selectedKey);if(!website)throw Error('Missing website');const supplied=JSON.parse(await readFile(item.sources,'utf8'));if(supplied.websiteKey!==selectedKey)throw Error('Manifest mismatch');
const sources=(supplied?supplied.recordings:JSON.parse(await readFile(join(root,'outputs/tafseer-saffat-video-import-20261028/attached-recordings.json'),'utf8')).filter(v=>v.surah==='Yaseen')).sort((a,b)=>a.lessonDate.localeCompare(b.lessonDate));if(!Array.isArray(sources)||!sources.length||sources.length>80||sources.some(row=>!row.lessonId||!row.lessonDate||!row.videoName||!/^[A-Za-z0-9_-]{11}$/.test(row.videoId)))throw Error('Review the selected recording inventory.');if(!supplied&&sources.length!==5)throw Error('Review the five-recording inventory.');
for(const [index,row] of sources.entries()){
 const asset='local-'+selectedKey+'-'+row.videoId,attachment='local-'+selectedKey+'-recording-'+String(index+1).padStart(2,'0');
 await f.run('INSERT INTO objects VALUES(?,?,?,?,?,?,?)',asset,null,'video/youtube',row.videoName,0,'local-reference-only',row.videoId);
 await f.run('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?)',attachment,website.offeringId,website.id,asset,row.lessonId,row.lessonDate,'local-review',row.videoName,'RECORDING',1);
}
const materialHashes=new Set();for(const row of supplied?.materials||[]){
 const bytes=await readFile(resolve(row.path)),hash=createHash('sha256').update(bytes).digest('hex');if(row.type!=='application/pdf'||bytes.length>16*1024*1024||bytes.subarray(0,5).toString()!=='%PDF-'||hash!==row.sha256)throw Error('Review the local PDF source.');if(materialHashes.has(hash))continue;materialHashes.add(hash);
 const key='local-recording-review/'+hash+'.pdf',asset='local-pdf-'+hash.slice(0,32);if(!globalPdfHashes.has(hash)){await f.media.put(key,bytes,{httpMetadata:{contentType:row.type}});globalPdfHashes.add(hash);}
 await f.run('INSERT OR IGNORE INTO objects VALUES(?,?,?,?,?,?,?)',asset,key,row.type,row.name,bytes.length,hash,null);
 await f.run('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?)','local-'+selectedKey+'-pdf-'+hash.slice(0,16),website.offeringId,website.id,asset,row.lessonId,row.lessonDate,'local-review',row.name,'RECORDING',1);
}
const admin=await f.login('preview-admin');if(admin.status!==200)throw Error('Local synthetic account unavailable.');
const peersBefore=(await f.db.prepare('SELECT website_id,revision,published_key FROM websites WHERE website_id<>? ORDER BY website_id').bind(website.id).all()).results;
let version=await f.db.prepare('SELECT revision FROM websites WHERE website_id=?').bind(website.id).first();
if(item.package){const revised=JSON.parse(await readFile(resolve(item.package),'utf8'));if(revised.websiteId!==website.id)throw Error('Choose the selected website package.');reviewedGuides=recordingGuides(revised.document);if(reviewedGuides.some(guide=>!sources.some(source=>source.lessonId===guide.lessonId)))throw Error('A reviewed recording guide has no source in this fixture.');const saved=await f.request('/api/websites/'+website.id+'/edit',{cookie:admin.cookie,method:'POST',body:{action:'save',operationId:crypto.randomUUID(),revision:version.revision,document:revised.document}});if(saved.status!==200)throw Error('Local summary draft rejected: '+saved.body.error);version={revision:saved.body.revision};}
const published=await f.request('/api/websites/'+website.id+'/edit',{cookie:admin.cookie,method:'POST',body:{action:'publish',operationId:crypto.randomUUID(),revision:version.revision}});if(published.status!==200)throw Error('Local reviewed edition unavailable: '+published.body.error);
const peersAfter=(await f.db.prepare('SELECT website_id,revision,published_key FROM websites WHERE website_id<>? ORDER BY website_id').bind(website.id).all()).results;assert.deepEqual(peersAfter,peersBefore,'Peer websites must remain unchanged.');
const feed=await f.request('/api/offerings/'+encodeURIComponent(website.offeringId)+'/media?website='+encodeURIComponent(website.id),{cookie:admin.cookie});assert.equal(feed.status,200);let checkedVideos=0,checkedPdfs=0;for(const row of feed.body.media){if(row.type==='video/youtube'){const source=sources.find(v=>v.lessonId===row.lesson_id);assert(source);const checked=await f.request('/api/media/'+encodeURIComponent(row.attachment_id),{cookie:admin.cookie});assert.equal(checked.status,200);assert.equal(checked.body.videoId,source.videoId);checkedVideos++;}else if(row.type==='application/pdf'){const checked=await f.request('/api/media/'+encodeURIComponent(row.attachment_id),{cookie:admin.cookie,headers:{Range:'bytes=0-4'}});assert.equal(checked.status,206);assert.equal(checked.body,'%PDF-');checkedPdfs++;}}
const reviewedIds=new Set(reviewedGuides.map(guide=>guide.lessonId));await mkdir(out,{recursive:true});await writeFile(join(out,selectedKey+'-source-status.json'),JSON.stringify({localOnly:true,websiteId:website.id,nativeMappingPending:Boolean(supplied?.nativeMappingPending),recordings:sources.map(v=>({date:v.lessonDate,url:v.url,lessonId:v.lessonId,transcriptSummary:reviewedIds.has(v.lessonId)?'Reviewed companion included':'Pending'})),transcriptSummariesWritten:reviewedIds.size,topicLinks:reviewedGuides.reduce((total,guide)=>total+(guide.topics?.length||0),0),localPdfObjects:materialHashes.size,localFixtureChecks:{peerWebsitesUnchanged:peersAfter.length,videoReferencesResolved:checkedVideos,pdfRangesVerified:checkedPdfs,browserPlaybackVerified:false},hostedCalls:0},null,2));
const edition=await f.request('/api/websites/'+website.id,{cookie:admin.cookie});assert.equal(edition.status,200);const original=JSON.parse(await readFile(item.package,'utf8')).document;assert.deepEqual(edition.body.document,original,'Teaching document must remain byte-equivalent after JSON round-trip.');const theme=THEMES[original.theme];
results.push({kind:selectedKey==='kahf'?'COURSE':'TAFSEER',accent:theme.accent,soft:theme.soft,url:'/local-start?website='+encodeURIComponent(website.id),cover:edition.body.assets.find(a=>a.asset_id===original.home.imageId)?.url||'',meta:sources.length+' recordings · '+original.lessons.length+' readings',documentSha256:createHash('sha256').update(JSON.stringify(original)).digest('hex'),key:selectedKey,websiteId:website.id,title:website.title,companions:reviewedGuides.length,topics:reviewedGuides.reduce((n,g)=>n+g.topics.length,0),videoReferencesResolved:checkedVideos,pdfRangesVerified:checkedPdfs,nativeMappingPending:Boolean(supplied.nativeMappingPending)});
}
const totals={websites:results.length,recordingCompanions:results.reduce((n,x)=>n+x.companions,0),topicLinks:results.reduce((n,x)=>n+x.topics,0),localPdfObjects:globalPdfHashes.size};assert.equal(totals.websites,9);assert.equal(totals.recordingCompanions,45);assert.equal(totals.topicLinks,1193);await writeFile(join(out,'all-nine-review-fixture-check.json'),JSON.stringify({localOnly:true,...totals,results,hostedCalls:0,browserVisualReview:false,browserPlaybackVerified:false},null,2));
const guidanceSources=[['tawakkul','tawakkul-pdf-review'],['resilience','resilience-pdf-review'],['qanaah','qanaah-pdf-review'],['salaah','salaah-pdf-review'],['imratun-muminah','imratun-muminah-video-review'],['spending','spending-pdf-review']];
const guidance=new Map(),guidanceCards=[];
for(const [key,folder] of guidanceSources){
 const directory=join(root,'outputs',folder,'preview'),bytes=await readFile(join(directory,'draft.json')),draft=JSON.parse(bytes),course=draft.course,theme=THEMES[course.theme];
 const cover=draft.assets.find(a=>a.id===course.home.imageId);
 guidance.set(key,{directory,sha256:createHash('sha256').update(bytes).digest('hex')});
 guidanceCards.push({kind:'COURSE',title:course.name,accent:theme.accent,soft:theme.soft,url:'/guidance/'+key+'/',cover:cover?'/guidance/'+key+'/'+cover.url:'',meta:course.lessons.length+' web lessons'});
}
await writeFile(join(out,'content-preservation.json'),JSON.stringify({localOnly:true,teachingDocumentsUnchanged:true,websites:results.map(({key,documentSha256})=>({key,documentSha256})),guidance:[...guidance].map(([key,{sha256}])=>({key,sha256,readOnlySource:true})),hostedCalls:0},null,2));
const hub=circlesReviewPage({websites:results,courses:guidanceCards});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ttf':'font/ttf','.pdf':'application/pdf'};
const server=createServer(async(request,response)=>{
 try{
  const requestUrl=new URL(request.url,origin);if(requestUrl.pathname==='/local-start'){const auth=await f.login('preview-admin');if(auth.status!==200)throw Error();const id=requestUrl.searchParams.get('website');if(id&&!results.some(x=>x.websiteId===id)){response.writeHead(404);return response.end();}response.writeHead(302,{'Set-Cookie':auth.response.headers.get('Set-Cookie'),'Location':id?'/?website='+encodeURIComponent(id):'/local-review'});return response.end();}if(requestUrl.pathname==='/local-review'){response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return response.end(hub);}
  if(requestUrl.pathname.startsWith('/guidance/')){
   const parts=decodeURIComponent(requestUrl.pathname).split('/'),source=guidance.get(parts[2]);if(!source){response.writeHead(404);return response.end();}
   const relative=parts.slice(3).join('/')||'index.html',file=resolve(source.directory,relative);if(!file.startsWith(source.directory+sep)){response.writeHead(404);return response.end();}
   // Serve only this prepared source directory; originals are never edited.
   let bytes=await readFile(file);if(extname(file)==='.html')bytes=Buffer.from(bytes.toString().replace('</head>','<link rel="stylesheet" href="/shared/circles-theme.css"></head>').replace('academy-course-reader"','academy-course-reader circles-theme"'));
   if(extname(file)==='.html'&&relative==='index.html'){
    const html=bytes.toString().replace(/<header class="local-header"><strong>[^<]*<\/strong><div>([\s\S]*?)<\/div><\/header>/,(_,controls)=>'<header class="local-header"><a class="brand" href="/local-review"><img src="/academy-logo.png" alt=""><span>Umm Abbad<br><strong>Academy</strong></span></a><details class="source-review-tools"><summary>Website tools</summary><div>'+controls+'</div></details></header>');bytes=Buffer.from(html);
   }
   response.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});return response.end(bytes);
  }
  const headers=new Headers();for(const [key,value]of Object.entries(request.headers))if(value&&!['host','connection','content-length','accept-encoding'].includes(key))headers.set(key,Array.isArray(value)?value.join(','):value);
  if(headers.get('Origin')===origin)headers.set('Origin',f.env.WEBSITE_ORIGIN);
  let length=0,chunks=[];for await(const chunk of request){length+=chunk.length;if(length>17*1024*1024){response.writeHead(413);return response.end();}chunks.push(chunk);}
  const r=await f.runtime.dispatchFetch(f.env.WEBSITE_ORIGIN+request.url,{method:request.method,headers,...(['GET','HEAD'].includes(request.method)?{}:{body:Buffer.concat(chunks)})});
  if(r.headers.get('Content-Type')?.includes('text/html')&&requestUrl.pathname==='/'){
   const html=(await r.text()).replace('<a class="brand" href="/">','<a class="brand" href="/local-review">');response.writeHead(r.status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return response.end(html);
  }
  response.writeHead(r.status,Object.fromEntries(r.headers));if(!r.body||request.method==='HEAD')response.end();else Readable.fromWeb(r.body).on('error',()=>response.destroy()).pipe(response);
 }catch{if(!response.headersSent)response.writeHead(500);response.end('Local review unavailable.');}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});console.log(JSON.stringify({url:origin+'/local-start',...totals,localOnly:true}));
let closing=false;async function close(){if(closing)return;closing=true;server.close();await f.close();process.exit(0);}process.on('SIGINT',close);process.on('SIGTERM',close);
