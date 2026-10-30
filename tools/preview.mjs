import {createServer} from 'node:http';import {readFile,stat} from 'node:fs/promises';import {resolve,extname} from 'node:path';import {Readable} from 'node:stream';import {fixture} from '../tests/fixture.mjs';

// Disposable, synthetic data only. These origins never contact a hosted account.
const sitePort=Number(process.env.PREVIEW_PORT||8791),academyPort=sitePort+1;
if(!Number.isInteger(sitePort)||sitePort<1024||sitePort>65534)throw Error('Choose a local preview port between 1024 and 65534.');
const websiteOrigin='http://localhost:'+sitePort,academyOrigin='http://localhost:'+academyPort;
const publicRoot=resolve(process.env.PREVIEW_PUBLIC_ROOT||'public'),circles=process.env.PREVIEW_CIRCLES==='1',f=await fixture({academy:true,authorityMode:circles?'ACADEMY':'WEBSITE'});
if(circles){const {circlesFixture}=await import('../tests/circles-fixture.mjs');const x=await circlesFixture(f);await x.recover(8);}else{
for(const [account,globalAdmin] of [[f.source.f.actors.global,1],[f.source.f.actors.studentA,0]])await f.run('INSERT INTO accounts VALUES(?,?,1,1,1,?,?)',account,'Synthetic Academy '+(globalAdmin?'Admin':'Learner'),Date.now(),globalAdmin);
await f.run("INSERT INTO participation VALUES(?,'course',1,1,1,'')",f.source.f.actors.studentA);
const {seedTimetables}=await import('../tests/timetable-fixture.mjs');await seedTimetables(f);await f.runtime.dispatchFetch('https://academy.test/__local/recover');
if(process.env.PREVIEW_CONTENT_ROOT){const{seedReviewedWebsites}=await import('./seed-reviewed-websites.mjs');console.log(JSON.stringify({contentReview:await seedReviewedWebsites(f,process.env.PREVIEW_CONTENT_ROOT)}));}
}
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.woff':'font/woff','.wasm':'application/wasm','.bcmap':'application/octet-stream','.ftl':'text/plain'};
const samplePdfUrl='https://archive.org/download/maktab-local-sample/sample.pdf';
function syntheticPdf(){
 const stream='BT /F1 20 Tf 60 720 Td (Synthetic Library PDF - local test only) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+object+'\nendobj\n';});const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';return Buffer.from(pdf);
}
async function staticFile(path,request,response,root=publicRoot){
 let file=resolve(root,'.'+decodeURIComponent(path));if(!file.startsWith(root+'/')&&file!==root)throw Error('Invalid file.');
 if((await stat(file)).isDirectory())file=resolve(file,'index.html');const data=await readFile(file);response.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(request.method==='HEAD'?undefined:data);
}
async function handler(request,response,isAcademy){
 try{
  const pathname=new URL(request.url,'http://localhost').pathname;
  if(!isAcademy&&circles&&pathname==='/__local/responsive'){response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return response.end('<!doctype html><meta charset="utf-8"><title>Local Circles responsive check</title><style>body{margin:12px;font:14px system-ui;background:#e9e3df}.frames{display:flex;align-items:start;gap:20px;flex-wrap:wrap}iframe{height:880px;border:1px solid #b7a8ad;background:#fff}</style><h1>Local synthetic responsive check</h1><div class="frames">'+[320,390,768].map(w=>'<section><h2>'+w+'px</h2><iframe title="Circles '+w+'px" width="'+w+'" src="/"></iframe></section>').join('')+'</div>');}
  if(isAcademy&&pathname==='/__local/read-metrics'){if(request.method==='POST')f.source.resetMetrics();response.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return response.end(JSON.stringify(f.source.metrics));}
  if(circles&&isAcademy&&pathname==='/academy/foundations/'){response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return response.end('<!doctype html><title>Synthetic Foundations</title><h1>Foundations of Tafseer</h1><p>Synthetic public text for the local connection rehearsal. Recordings remain protected separately.</p>');}
  if(!pathname.startsWith('/api/')&&!pathname.startsWith('/auth/')&&!pathname.startsWith('/internal/')){
   if(!isAcademy)return await staticFile(pathname,request,response);
   if(pathname==='/academy/open-library/catalogue'){response.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return response.end(JSON.stringify({books:[{id:'EXTERNAL:INTERNET_ARCHIVE:maktab-local-sample',title:'Synthetic Library PDF',pdfUrl:samplePdfUrl,resourceType:'EBOOK',subject:'Local rehearsal',learningAreaRefs:['GLOBAL:subject-1']}]}));}
   if(pathname==='/pdf-file/'+Buffer.from(samplePdfUrl).toString('base64url')){response.writeHead(200,{'Content-Type':'application/pdf','Content-Length':syntheticPdf().length,'Cache-Control':'no-store'});return response.end(request.method==='HEAD'?undefined:syntheticPdf());}
   if(pathname==='/js/m4l-config.js'){response.writeHead(200,{'Content-Type':'text/javascript'});return response.end('window.M4L_CONFIG={API_BASE:location.origin};');}
   if(pathname.startsWith('/academy/website-platform/connect/')){const name=pathname.endsWith('connect.mjs')?'connect.mjs':pathname.endsWith('/')||pathname.endsWith('index.html')?'index.html':null;if(!name)throw Error('Unknown connector file.');response.writeHead(200,{'Content-Type':mime[extname(name)]});return response.end(await readFile(f.source.root+'/academy/website-platform/connect/'+name));}
   if(pathname==='/academy/'){
    response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    return response.end('<!doctype html><meta charset="utf-8"><title>Local Academy handoff</title><h1>Academy session</h1><p id="status">Checking local handoff…</p><p>This page is an integration rehearsal with synthetic data. The Academy interface and Library are separate acceptance work.</p><script>document.getElementById("status").textContent=localStorage.getItem("m4l_account_token")?"Academy session connected":"No Academy session";</script>');
   }
   if(!/^\/(?:js|css|icons|images|fonts|pdf-viewer)\//.test(pathname)&&!/^\/academy\/(?:library|open-library|pdf-reader)\/(?:index.html)?$/.test(pathname)&&!['/academy/website-platform/library-return.mjs','/academy/website-platform/library-return.css'].includes(pathname)&&!['/ummabbadacademy.png','/admin-favicon-32x32.png'].includes(pathname)){response.writeHead(404);return response.end('Not part of this local Library rehearsal.');}
   return await staticFile(pathname,request,response,f.source.root);
  }
  let length=0,chunks=[];for await(const chunk of request){length+=chunk.length;if(length>17*1024*1024){response.writeHead(413);return response.end('Preview request too large.');}chunks.push(chunk);}
  const headers=new Headers();for(const [key,value] of Object.entries(request.headers))if(value&&!['host','connection','content-length','accept-encoding'].includes(key))headers.set(key,Array.isArray(value)?value.join(','):value);
  if(headers.get('Origin')===websiteOrigin)headers.set('Origin',f.env.WEBSITE_ORIGIN);else if(headers.get('Origin')===academyOrigin)headers.set('Origin',f.env.ACADEMY_ORIGIN);
  const result=await f.runtime.dispatchFetch((isAcademy?f.env.ACADEMY_ORIGIN:f.env.WEBSITE_ORIGIN)+request.url,{method:request.method,headers,...(['GET','HEAD'].includes(request.method)?{}:{body:Buffer.concat(chunks)})});
  const outputHeaders=Object.fromEntries(result.headers);outputHeaders['cache-control']='no-store';
  if(pathname==='/api/public/circles'||pathname==='/api/config'||pathname==='/api/website-platform/config'||pathname==='/api/website-platform/exchange'){
   const body=(await result.text()).replaceAll(f.env.WEBSITE_ORIGIN,websiteOrigin).replaceAll(f.env.ACADEMY_ORIGIN,academyOrigin);delete outputHeaders['content-length'];response.writeHead(result.status,outputHeaders);return response.end(body);
  }
  response.writeHead(result.status,outputHeaders);if(request.method==='HEAD'||!result.body)return response.end();Readable.fromWeb(result.body).on('error',()=>response.destroy()).pipe(response);
 }catch(error){if(!response.headersSent)response.writeHead(error.code==='ENOENT'?404:500,{'Content-Type':'text/plain'});response.end(error.code==='ENOENT'?'Page not found.':'Local preview error: '+error.message);}
}
const servers=[createServer((r,s)=>handler(r,s,false)),createServer((r,s)=>handler(r,s,true))];
try{await Promise.all(servers.map((server,i)=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(sitePort+i,'127.0.0.1',resolve);})));
 console.log(JSON.stringify({website:websiteOrigin,academy:academyOrigin,data:'Disposable synthetic data; resets when stopped',accounts:[{id:'separation-global',pin:'1234',role:'Admin'},{id:'separation-studentA',pin:'1234',role:'Learner'}],publicRoot}));
}catch(error){for(const server of servers)server.close();await f.close();throw error;}
let closing=false;async function close(){if(closing)return;closing=true;for(const server of servers)server.close();await f.close();process.exit(0);}process.on('SIGINT',close);process.on('SIGTERM',close);
