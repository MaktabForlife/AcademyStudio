// Loopback-only review of the copied bundle. This is not a hosted importer.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {Readable} from 'node:stream';
import assert from 'node:assert/strict';
import {fixture} from '../tests/fixture.mjs';
import {boundedAge} from '../src/protocol.mjs';
import {seedReconciledFixture,contentHash} from './reconciled-content.mjs';
import {validatePackage} from '../public/shared/content-schema.mjs';
import {THEMES} from '../public/shared/model.mjs';
import {recordingGuides} from '../public/shared/recording-companion.mjs';
import {bindRecordingGuides} from '../public/shared/media-bindings.mjs';
import {circlesReviewPage} from './circles-review-page.mjs';

if(!process.argv[2]||!process.argv[3])throw Error('Specify project root and a private evidence directory.');
const root=resolve(process.argv[2]),out=resolve(process.argv[3]),publicRoot=resolve('public');
const bundle=join(root,'outputs/academy-content-copy-20261030/circles-bundle');
const manifestBytes=await readFile(join(bundle,'manifest.json'));
const manifest=JSON.parse(manifestBytes),port=Number(process.env.PREVIEW_PORT||8901),origin='http://localhost:'+port;
if(manifest.format!=='CIRCLES_RECONCILED_CONTENT_V1'||!manifest.private||manifest.hostedWrites!==0)throw Error('Choose the private copied-content bundle.');
const bundleObject=async ref=>{
 const file=resolve(bundle,ref.file);if(!file.startsWith(bundle+sep))throw Error('Bundle path is outside this review.');
 const bytes=await readFile(file);if(contentHash(bytes)!==ref.sha256||bytes.length!==ref.bytes)throw Error('The copied object changed.');return bytes;
};
const f=await fixture(),seeded=await seedReconciledFixture(f,bundle,{validateDocument:validatePackage});
const admin=await f.login('admin'),siteMap=new Map(manifest.sites.map(s=>[s.websiteId,s]));
const websites=[],sourceChecks=[];
let nativeVideos=0,pdfRanges=0,boundGuides=0;
for(const site of manifest.sites){
 const path='/api/websites/'+site.websiteId;
 const published=await f.request(path,{cookie:admin.cookie}),draft=await f.request(path+'/edit',{cookie:admin.cookie});
 assert.equal(published.status,200);assert.equal(draft.status,200);
 assert.deepEqual(published.body.document,JSON.parse(await bundleObject(site.editions.published)));
 assert.deepEqual(draft.body.document,JSON.parse(await bundleObject(site.editions.reviewDraft)));
 const feed=await f.request('/api/offerings/'+site.offeringId+'/media?website='+site.websiteId,{cookie:admin.cookie});assert.equal(feed.status,200);
 const guides=bindRecordingGuides(recordingGuides(draft.body.document),feed.body.media,site.mediaBindings);
 for(const binding of site.mediaBindings){assert(guides.some(g=>g.lessonId===binding.nativeLessonId&&g.editorialLessonId===binding.editorialLessonId));boundGuides++;}
 for(const row of feed.body.media){
  const checked=await f.request('/api/media/'+row.attachment_id,{cookie:admin.cookie,...(row.type==='application/pdf'?{headers:{Range:'bytes=0-4'}}:{})});
  if(row.type==='application/pdf'){assert.equal(checked.status,206);assert.equal(Buffer.from(checked.body).toString(),'%PDF-');pdfRanges++;}
  else {assert.equal(checked.status,200);assert(site.recordings.some(r=>r.status==='MATCHED'&&r.native.youtubeId===checked.body.videoId));nativeVideos++;}
 }
 const matched=site.recordings.filter(r=>r.status==='MATCHED').length,pending=site.recordings.length-matched,doc=draft.body.document,theme=THEMES[doc.theme];
 const cover=draft.body.assets.find(a=>a.asset_id===doc.home.imageId);
 websites.push({key:site.key,title:site.title,kind:site.kind,accent:theme.accent,soft:theme.soft,url:'/?website='+encodeURIComponent(site.websiteId),cover:cover?.url||'',meta:matched+' linked recordings · '+doc.lessons.length+' readings',status:pending?pending+' recording '+(pending===1?'link':'links')+' awaiting confirmation':site.key==='foundations'?'Public text policy retained; recordings keep their access rules.':''});
 sourceChecks.push({key:site.key,websiteId:site.websiteId,reviewDraftExact:true,originalPublicationExact:true,revision:draft.body.revision,publishedVersion:published.body.publishedVersion,reviewDraftVersion:draft.body.draftVersion,nativeRecordings:matched,unmappedRecordings:pending,readings:doc.lessons.length});
}
assert.equal(nativeVideos,32);assert.equal(pdfRanges,11);assert.equal(boundGuides,32);
for(const item of manifest.catalogue)if(!websites.some(w=>w.key===item.key))websites.push({key:item.key,title:item.name,kind:'TAFSEER',accent:'#805764',soft:'#eee2df',meta:'Source and access mapping pending',status:'No date or access has been inferred.'});

const runtimeFolders={tawakkul:'tawakkul-pdf-review',resilience:'resilience-pdf-review',qanaah:'qanaah-pdf-review',salaah:'salaah-pdf-review','imratun-muminah':'imratun-muminah-video-review',spending:'spending-pdf-review'};
const pending=new Map(),courses=[],academyDrafts=[];
for(const entry of manifest.pending){
 const wrapperBytes=await bundleObject(entry.sourceFile),wrapper=JSON.parse(wrapperBytes),doc=JSON.parse(await bundleObject(entry.document));
 assert.deepEqual(wrapper.course||wrapper.document||wrapper,doc);
 const theme=THEMES[doc.theme],source=runtimeFolders[entry.key];
 if(!source){academyDrafts.push({key:entry.key,title:'Mothers of the Ummah · '+entry.title,kind:'ACADEMY',accent:theme.accent,soft:theme.soft,meta:entry.lessons+' readings · separate Academy draft',status:'Retained separately. Programme/access mapping and its existing Mothers page are not changed here.'});continue;}
 const assetPaths=new Map();for(const asset of wrapper.assets||[]){const copied=entry.assets.find(a=>a.assetId===asset.id);if(copied){await bundleObject(copied);assetPaths.set(asset.url,copied);}}
 pending.set(entry.key,{entry,wrapperBytes,assetPaths,runtime:join(root,'outputs',source,'preview')});
 const cover=(wrapper.assets||[]).find(a=>a.id===doc.home.imageId);
 courses.push({key:entry.key,title:entry.title,kind:'COURSE',accent:theme.accent,soft:theme.soft,url:'/guidance/'+entry.key+'/',cover:cover?'/guidance/'+entry.key+'/'+cover.url:'',meta:entry.lessons+' web lessons',status:'Private author draft · Academy course/access mapping pending'});
}
const transferNotes=[
 'Nine mapped websites retain 103 readings and 45 recording companions. Thirty-two recordings use copied native Academy references; thirteen links remain unresolved.',
 'All eleven original Academy PDFs are checksum-matched. Existing publications, existing private drafts and the new review drafts remain separate.',
 'Six guidance courses are private author drafts. Their copied teaching and artwork are shown here for review without assigning them to a paid Academy course.',
 'Mothers of the Ummah is retained separately with Academy. Fatir is a placeholder immediately before Yaseen; its date and mapping are not inferred.',
 'Six additional Academy recording references are retained and await a website association:',
 ...manifest.unassignedAcademyReferences.map(r=>(r.name||r.filename||'Academy recording')+' · '+r.date),
 'This uses a disposable local backend and synthetic accounts. The final V108.0 integration and its access/read-budget acceptance remain separate. No hosted edition or source permission has changed.'
];
const hub=circlesReviewPage({websites,courses,catalogue:manifest.catalogue,academyDrafts,transferNotes});
await mkdir(out,{recursive:true,mode:0o700});
await writeFile(join(out,'reconciled-server-checks.json'),JSON.stringify({localOnly:true,manifestSha256:contentHash(manifestBytes),...seeded,nativeVideos,pdfRanges,boundGuides,sourceChecks,unresolvedRecordings:13,unassignedAcademyReferences:manifest.unassignedAcademyReferences.length,pending:manifest.pending.map(p=>({key:p.key,lessons:p.lessons,operationalMapping:false,rendered:pending.has(p.key)})),publishedAnyReviewDraft:false,hostedCalls:0,sourceQueries:0,browserVerified:false},null,2),{mode:0o600});

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ttf':'font/ttf','.woff2':'font/woff2','.json':'application/json'};
const send=(response,bytes,type,status=200)=>{response.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(bytes);};
const administrator=async cookie=>{const me=await f.request('/api/me',{cookie});return me.status===200&&me.body.globalAdmin&&me.body.verifiedAt>=Date.now()-boundedAge(f.env,true);};
const runtimeFiles=new Set(['index.html','reader.js','review.css','reading-focus.js','builder.html','builder.js','studio.css','assets/fonts.css','assets/arabic-font.css','assets/favicon.svg','assets/amiri-regular.ttf',...Array.from({length:5},(_,i)=>'assets/course-font-'+(i+1)+'.ttf')]);
const server=createServer(async(request,response)=>{
 try{
  const url=new URL(request.url,origin),cookie=request.headers.cookie;
  if(url.pathname==='/local-start'){
   // Renew only this fixture identity's freshness through the signed fixture bridge.
   // Carry its current admission/role/epoch values; never restore a removed right.
   const account=await f.db.prepare('SELECT * FROM accounts WHERE account_id=?').bind('admin').first();
   assert(account&&account.display_name==='Synthetic admin');
   if(!account.active||!account.admitted||!account.global_admin)return send(response,'This local identity no longer has review access.','text/plain',403);
   await f.deliver({type:'account',account:{accountId:account.account_id,displayName:account.display_name,active:Boolean(account.active),admitted:Boolean(account.admitted),epoch:account.epoch,verifiedAt:Date.now(),globalAdmin:Boolean(account.global_admin)}});
   const login=await f.login('admin'),id=url.searchParams.get('website');
   if(id&&!siteMap.has(id))return send(response,'Not found','text/plain',404);
   response.writeHead(302,{'Set-Cookie':login.result.response.headers.get('Set-Cookie'),'Location':id?'/?website='+encodeURIComponent(id):'/local-review','Cache-Control':'no-store'});return response.end();
  }
  if(url.pathname==='/local-review'){
   if(!await administrator(cookie)){response.writeHead(302,{'Location':'/local-start'});return response.end();}
   return send(response,hub,'text/html; charset=utf-8');
  }
  if(url.pathname.startsWith('/guidance/')){
   if(!await administrator(cookie))return send(response,'This private author draft needs the local review account.','text/plain',403);
   const parts=decodeURIComponent(url.pathname).split('/'),source=pending.get(parts[2]),relative=parts.slice(3).join('/')||'index.html';
   if(!source)return send(response,'Not found','text/plain',404);
   if(relative==='draft.json')return send(response,source.wrapperBytes,'application/json');
   const asset=source.assetPaths.get(relative);if(asset)return send(response,await bundleObject(asset),asset.mimeType);
   if(!runtimeFiles.has(relative))return send(response,'Not found','text/plain',404);
   let bytes=await readFile(join(source.runtime,relative));
   if(relative==='index.html'){
    bytes=Buffer.from(bytes.toString().replace('</head>','<link rel="stylesheet" href="/shared/recording-companion.css"><link rel="stylesheet" href="/shared/circles-theme.css"><link rel="stylesheet" href="/shared/recording-website.css"></head>').replace('</body>','<script type="module" src="/shared/author-recording-website.mjs"></script></body>').replace('academy-course-reader"','academy-course-reader circles-theme"').replace(/<header class="local-header"><strong>[^<]*<\/strong><div>([\s\S]*?)<\/div><\/header>/,(_,controls)=>'<header class="local-header"><a class="brand" href="/local-review"><img src="/academy-logo.png" alt=""><span>Umm Abbad<br><strong>Academy</strong></span></a><details class="source-review-tools"><summary>Website tools</summary><div>'+controls+'</div></details></header>').replace(/(<div class="local-help" id="preview-description">)/,'$1Private copied author draft · Academy course/access mapping pending. '));
   }
   return send(response,bytes,mime[extname(relative)]||'application/octet-stream');
  }
  const match=url.pathname.match(/^\/api\/websites\/([-A-Za-z0-9_:]+)$/),site=match&&siteMap.get(match[1]);
  if(site&&request.method==='GET'){
   const published=await f.request(url.pathname,{cookie});
   if(published.status!==200)return send(response,JSON.stringify(published.body),'application/json',published.status);
   let record=published.body;
   if(record.canEdit){
    const edition=url.searchParams.get('edition')==='published'?'published':'reviewDraft';
    if(edition==='reviewDraft'){const draft=await f.request(url.pathname+'/edit',{cookie});if(draft.status!==200)return send(response,JSON.stringify(draft.body),'application/json',draft.status);record=draft.body;}
    record={...record,localReview:{edition,mediaBindings:site.mediaBindings,unmappedEditorialLessonIds:site.recordings.filter(r=>r.status!=='MATCHED').map(r=>r.editorialLessonId)}};
   }
   return send(response,JSON.stringify(record),'application/json');
  }
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/')){
   const headers=new Headers();for(const [key,value]of Object.entries(request.headers))if(value&&!['host','connection','content-length','accept-encoding'].includes(key))headers.set(key,Array.isArray(value)?value.join(','):value);
   if(headers.get('Origin')===origin)headers.set('Origin',f.env.WEBSITE_ORIGIN);
   let length=0,chunks=[];for await(const chunk of request){length+=chunk.length;if(length>17*1024*1024)return send(response,'Request too large','text/plain',413);chunks.push(chunk);}
   const r=await f.runtime.dispatchFetch(f.env.WEBSITE_ORIGIN+request.url,{method:request.method,headers,...(['GET','HEAD'].includes(request.method)?{}:{body:Buffer.concat(chunks)})});
   response.writeHead(r.status,Object.fromEntries(r.headers));if(!r.body||request.method==='HEAD')return response.end();return Readable.fromWeb(r.body).on('error',()=>response.destroy()).pipe(response);
  }
  if(url.pathname.startsWith('/internal/'))return send(response,'Not found','text/plain',404);
  const file=resolve(publicRoot,'.'+(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
  if(!file.startsWith(publicRoot+sep))return send(response,'Not found','text/plain',404);
  let bytes=await readFile(file);
  if(url.pathname==='/')bytes=Buffer.from(bytes.toString().replace('<a class="brand" href="/">','<a class="brand" href="/local-review">').replace('<body class="website-reader academy-course-reader circles-theme">','<body class="website-reader academy-course-reader circles-theme"><aside role="note">Private local review · Copied Academy content · Synthetic review account · Published editions unchanged.</aside>'));
  return send(response,bytes,mime[extname(file)]||'application/octet-stream');
 }catch(error){if(!response.headersSent)send(response,'Local review unavailable.','text/plain',error.code==='ENOENT'?404:500);else response.destroy();}
});
await new Promise((yes,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',yes);});
console.log(JSON.stringify({url:origin+'/local-start',copiedWebsites:manifest.sites.length,nativeVideos,pdfRanges,pendingRecordings:13,privateAuthorDrafts:manifest.pending.length,localOnly:true}));
let closing=false;async function close(){if(closing)return;closing=true;server.close();await f.close();process.exit(0);}process.on('SIGINT',close);process.on('SIGTERM',close);
