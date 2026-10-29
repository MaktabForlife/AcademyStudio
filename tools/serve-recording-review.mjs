// Local-only review. Private website copies and source links never enter public assets.
import {createServer} from 'node:http';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {Readable} from 'node:stream';
import {previewFixture,loadPreparedPreview} from '../tests/preview-fixture.mjs';
const root=resolve(process.argv[2]||''),out=resolve(process.argv[3]||'');if(!process.argv[2]||!process.argv[3])throw Error('Specify project root and a local evidence directory.');
const port=Number(process.env.PREVIEW_PORT||8892),origin='http://localhost:'+port,f=await previewFixture();
const plan=JSON.parse(await readFile(join(root,'outputs/academy-studio-nine-site-preview-20261028/seed-plan.json'),'utf8'));await loadPreparedPreview(f,plan);
const website=plan.websites.find(w=>w.key==='yaseen');if(!website)throw Error('Yaseen source missing.');
const sources=JSON.parse(await readFile(join(root,'outputs/tafseer-saffat-video-import-20261028/attached-recordings.json'),'utf8')).filter(v=>v.surah==='Yaseen').sort((a,b)=>a.lessonDate.localeCompare(b.lessonDate));if(sources.length!==5)throw Error('Review the five-recording inventory.');
for(const [index,row] of sources.entries()){
 const asset='local-yaseen-'+row.videoId,attachment='local-yaseen-recording-'+String(index+1).padStart(2,'0');
 await f.run('INSERT INTO objects VALUES(?,?,?,?,?,?,?)',asset,null,'video/youtube',row.videoName,0,'local-reference-only',row.videoId);
 await f.run('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?)',attachment,website.offeringId,website.id,asset,row.lessonId,row.lessonDate,'local-review','Surah Yaseen · Lesson '+(index+1),'RECORDING',1);
}
const admin=await f.login('preview-admin');if(admin.status!==200)throw Error('Local synthetic account unavailable.');
let version=await f.db.prepare('SELECT revision FROM websites WHERE website_id=?').bind(website.id).first();
if(process.argv[4]){const revised=JSON.parse(await readFile(resolve(process.argv[4]),'utf8'));if(revised.websiteId!==website.id)throw Error('Choose the selected Yaseen package.');const saved=await f.request('/api/websites/'+website.id+'/edit',{cookie:admin.cookie,method:'POST',body:{action:'save',operationId:crypto.randomUUID(),revision:version.revision,document:revised.document}});if(saved.status!==200)throw Error('Local summary draft rejected: '+saved.body.error);version={revision:saved.body.revision};}
const published=await f.request('/api/websites/'+website.id+'/edit',{cookie:admin.cookie,method:'POST',body:{action:'publish',operationId:crypto.randomUUID(),revision:version.revision}});if(published.status!==200)throw Error('Local reviewed edition unavailable: '+published.body.error);
await mkdir(out,{recursive:true});await writeFile(join(out,'source-status.json'),JSON.stringify({localOnly:true,websiteId:website.id,recordings:sources.map(v=>({date:v.lessonDate,url:v.url,lessonId:v.lessonId,transcript:process.argv[4]?'Retrieved through the visible YouTube Transcript panel':'Not yet included in this local fixture'})),transcriptSummariesWritten:process.argv[4]?sources.length:0,hostedCalls:0},null,2));
const server=createServer(async(request,response)=>{
 try{
  if(request.url==='/local-start'){const auth=await f.login('preview-admin');if(auth.status!==200)throw Error();response.writeHead(302,{'Set-Cookie':auth.response.headers.get('Set-Cookie'),'Location':'/?website='+encodeURIComponent(website.id)});return response.end();}
  const headers=new Headers();for(const [key,value]of Object.entries(request.headers))if(value&&!['host','connection','content-length','accept-encoding'].includes(key))headers.set(key,Array.isArray(value)?value.join(','):value);
  if(headers.get('Origin')===origin)headers.set('Origin',f.env.WEBSITE_ORIGIN);
  let length=0,chunks=[];for await(const chunk of request){length+=chunk.length;if(length>17*1024*1024){response.writeHead(413);return response.end();}chunks.push(chunk);}
  const r=await f.runtime.dispatchFetch(f.env.WEBSITE_ORIGIN+request.url,{method:request.method,headers,...(['GET','HEAD'].includes(request.method)?{}:{body:Buffer.concat(chunks)})});
  response.writeHead(r.status,Object.fromEntries(r.headers));if(!r.body||request.method==='HEAD')response.end();else Readable.fromWeb(r.body).on('error',()=>response.destroy()).pipe(response);
 }catch{if(!response.headersSent)response.writeHead(500);response.end('Local review unavailable.');}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});console.log(JSON.stringify({url:origin+'/local-start',recordings:sources.length,localOnly:true}));
let closing=false;async function close(){if(closing)return;closing=true;server.close();await f.close();process.exit(0);}process.on('SIGINT',close);process.on('SIGTERM',close);
