// Local-only review. Private website copies and source links never enter public assets.
import {createServer} from 'node:http';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {Readable} from 'node:stream';
import {previewFixture,loadPreparedPreview} from '../tests/preview-fixture.mjs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]||''),out=resolve(process.argv[3]||'');if(!process.argv[2]||!process.argv[3])throw Error('Specify project root and a local evidence directory.');
const port=Number(process.env.PREVIEW_PORT||8892),origin='http://localhost:'+port,f=await previewFixture();
const plan=JSON.parse(await readFile(join(root,'outputs/academy-studio-nine-site-preview-20261028/seed-plan.json'),'utf8'));await loadPreparedPreview(f,plan);
const selectedKey=process.env.PREVIEW_COURSE||'yaseen',website=plan.websites.find(w=>w.key===selectedKey);if(!website)throw Error('Selected website source missing.');
const supplied=process.argv[5]?JSON.parse(await readFile(resolve(process.argv[5]),'utf8')):null;if(supplied&&supplied.websiteKey!==selectedKey)throw Error('Choose a source manifest for the selected website.');
const sources=(supplied?supplied.recordings:JSON.parse(await readFile(join(root,'outputs/tafseer-saffat-video-import-20261028/attached-recordings.json'),'utf8')).filter(v=>v.surah==='Yaseen')).sort((a,b)=>a.lessonDate.localeCompare(b.lessonDate));if(!Array.isArray(sources)||!sources.length||sources.length>80||sources.some(row=>!row.lessonId||!row.lessonDate||!row.videoName||!/^[A-Za-z0-9_-]{11}$/.test(row.videoId)))throw Error('Review the selected recording inventory.');if(!supplied&&sources.length!==5)throw Error('Review the five-recording inventory.');
for(const [index,row] of sources.entries()){
 const asset='local-'+selectedKey+'-'+row.videoId,attachment='local-'+selectedKey+'-recording-'+String(index+1).padStart(2,'0');
 await f.run('INSERT INTO objects VALUES(?,?,?,?,?,?,?)',asset,null,'video/youtube',row.videoName,0,'local-reference-only',row.videoId);
 await f.run('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?)',attachment,website.offeringId,website.id,asset,row.lessonId,row.lessonDate,'local-review',row.videoName,'RECORDING',1);
}
const materialHashes=new Set();for(const row of supplied?.materials||[]){
 const bytes=await readFile(resolve(row.path)),hash=createHash('sha256').update(bytes).digest('hex');if(row.type!=='application/pdf'||bytes.length>16*1024*1024||bytes.subarray(0,5).toString()!=='%PDF-'||hash!==row.sha256)throw Error('Review the local PDF source.');if(materialHashes.has(hash))continue;materialHashes.add(hash);
 const key='local-recording-review/'+hash+'.pdf',asset='local-pdf-'+hash.slice(0,32);await f.media.put(key,bytes,{httpMetadata:{contentType:row.type}});
 await f.run('INSERT INTO objects VALUES(?,?,?,?,?,?,?)',asset,key,row.type,row.name,bytes.length,hash,null);
 await f.run('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?)','local-'+selectedKey+'-pdf-'+hash.slice(0,16),website.offeringId,website.id,asset,row.lessonId,row.lessonDate,'local-review',row.name,'RECORDING',1);
}
const admin=await f.login('preview-admin');if(admin.status!==200)throw Error('Local synthetic account unavailable.');
const peersBefore=(await f.db.prepare('SELECT website_id,revision,published_key FROM websites WHERE website_id<>? ORDER BY website_id').bind(website.id).all()).results;
let version=await f.db.prepare('SELECT revision FROM websites WHERE website_id=?').bind(website.id).first();
if(process.argv[4]){const revised=JSON.parse(await readFile(resolve(process.argv[4]),'utf8'));if(revised.websiteId!==website.id)throw Error('Choose the selected website package.');const saved=await f.request('/api/websites/'+website.id+'/edit',{cookie:admin.cookie,method:'POST',body:{action:'save',operationId:crypto.randomUUID(),revision:version.revision,document:revised.document}});if(saved.status!==200)throw Error('Local summary draft rejected: '+saved.body.error);version={revision:saved.body.revision};}
const published=await f.request('/api/websites/'+website.id+'/edit',{cookie:admin.cookie,method:'POST',body:{action:'publish',operationId:crypto.randomUUID(),revision:version.revision}});if(published.status!==200)throw Error('Local reviewed edition unavailable: '+published.body.error);
const peersAfter=(await f.db.prepare('SELECT website_id,revision,published_key FROM websites WHERE website_id<>? ORDER BY website_id').bind(website.id).all()).results;assert.deepEqual(peersAfter,peersBefore,'Peer websites must remain unchanged.');
const feed=await f.request('/api/offerings/'+encodeURIComponent(website.offeringId)+'/media?website='+encodeURIComponent(website.id),{cookie:admin.cookie});assert.equal(feed.status,200);let checkedVideos=0,checkedPdfs=0;for(const row of feed.body.media){if(row.type==='video/youtube'){const source=sources.find(v=>v.lessonId===row.lesson_id);assert(source);const checked=await f.request('/api/media/'+encodeURIComponent(row.attachment_id),{cookie:admin.cookie});assert.equal(checked.status,200);assert.equal(checked.body.videoId,source.videoId);checkedVideos++;}else if(row.type==='application/pdf'){const checked=await f.request('/api/media/'+encodeURIComponent(row.attachment_id),{cookie:admin.cookie,headers:{Range:'bytes=0-4'}});assert.equal(checked.status,206);assert.equal(checked.body,'%PDF-');checkedPdfs++;}}
await mkdir(out,{recursive:true});await writeFile(join(out,'source-status.json'),JSON.stringify({localOnly:true,websiteId:website.id,nativeMappingPending:Boolean(supplied?.nativeMappingPending),recordings:sources.map(v=>({date:v.lessonDate,url:v.url,lessonId:v.lessonId,transcript:process.argv[4]?'Retrieved from the source YouTube recording':'Not yet included in this local fixture'})),transcriptSummariesWritten:process.argv[4]?sources.length:0,localPdfObjects:materialHashes.size,localFixtureChecks:{peerWebsitesUnchanged:peersAfter.length,videoReferencesResolved:checkedVideos,pdfRangesVerified:checkedPdfs,browserPlaybackVerified:false},hostedCalls:0},null,2));
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
