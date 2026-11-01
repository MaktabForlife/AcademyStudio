// Disposable native access rehearsal only. No hosted account, data or media.
import {createServer} from 'node:http';import {readFile,realpath} from 'node:fs/promises';import {resolve,extname,sep} from 'node:path';import {studioFixture} from '../tests/studio-access-fixture.mjs';
const port=Number(process.env.ACCESS_UI_PORT||9062),origin='http://127.0.0.1:'+port;if(!Number.isInteger(port)||port<1024||port>65534)throw Error('Choose a loopback port.');
const {f,x,handover,nativeLogin}=await studioFixture({mou:true,navigation:{mothers:'programB'}});
console.log('Preparing disposable Tafseer and Course access…');await handover(x.programA);await handover(x.courseA);const token=await nativeLogin();
const native=async(path,body)=>{const response=await f.runtime.dispatchFetch('https://academy.test'+path,{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json',Authorization:'Bearer '+token,'X-Academy-Workspace':'ADMIN'},body:JSON.stringify(body)});const data=await response.json();if(response.status!==200)throw Error(JSON.stringify(data));return data;};
console.log('Preparing disposable MOU monthly access…');await native('/api/admin/platform/programme-studio/register',{programmeKey:'mothers',accessModel:'MONTHLY',noMediaMigration:true,operationId:crypto.randomUUID()});await x.recover(15);const mou=f.source.f.scopes.programB;await handover(mou);
const offerings=[{area:'tafseer',activityKey:x.programA,title:'Tafseer and Tadabbur'},{area:'mothers',activityKey:mou,title:'Mothers of the Ummah'},{area:'courses',activityKey:x.courseA,title:'Sample course'}];
const source=await realpath(f.source.root),ui=resolve(source,'tools/access-review'),mime={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2'};
const files=new Map([['/access-review.js',resolve(ui,'access-review.js')],['/access-review.css',resolve(ui,'access-review.css')],['/js/m4l-studio-access.js',resolve(source,'js/m4l-studio-access.js')],['/css/m4l-studio-access.css',resolve(source,'css/m4l-studio-access.css')],['/ummabbadacademy.png',resolve(source,'ummabbadacademy.png')]]);
const server=createServer(async(req,res)=>{try{
 if(req.headers.host!=='127.0.0.1:'+port){res.writeHead(403);return res.end('Local preview only.');}
 const path=new URL(req.url,origin).pathname;
 if(path==='/'&&req.method==='GET'){
  let html=await readFile(resolve(ui,'index.html'),'utf8');const setup='<script>window.M4L_CONFIG={API_BASE:""};localStorage.setItem("m4l_account_token",'+JSON.stringify(token)+');</script>';
  html=html.replace('<script src="/js/m4l-studio-access.js">',setup+'<script src="/js/m4l-studio-access.js">').replace('</body>','<script>window.accessReview=M4L_ACCESS_REVIEW.mount('+JSON.stringify(offerings)+');</script></body>');
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex'});return res.end(html);
 }
 if(path==='/api/admin/platform/studio-access'&&req.method==='POST'){
  if(req.headers.origin!==origin){res.writeHead(403);return res.end('Invalid local origin.');}let body='';for await(const chunk of req){body+=chunk;if(body.length>131072)throw Error('Local request too large.');}
  const response=await f.runtime.dispatchFetch('https://academy.test'+path,{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json',Authorization:req.headers.authorization||'','X-Academy-Workspace':'ADMIN'},body});res.writeHead(response.status,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(await response.text());
 }
 let file=files.get(path);if(!file&&/^\/academy\/course-websites\/assets\/(?:fonts\.css|course-font-[1-5]\.ttf)$/.test(path))file=resolve(source,'.'+path);
 if(file&&['GET','HEAD'].includes(req.method)){file=await realpath(file);if(!file.startsWith(source+sep))throw Error('Unknown preview asset.');res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(req.method==='HEAD'?undefined:await readFile(file));}
 res.writeHead(404);res.end('Not part of this local review.');
 }catch(error){res.writeHead(503,{'Content-Type':'text/plain'});res.end('Local review could not load.');console.error(error.message);}});
await new Promise((done,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',done);});console.log(JSON.stringify({preview:origin,areas:offerings.map(o=>o.area),data:'Disposable synthetic accounts; native access API',liveChanges:false}));
let closing=false;async function close(){if(closing)return;closing=true;server.close();await f.close();process.exit(0);}process.on('SIGINT',close);process.on('SIGTERM',close);
