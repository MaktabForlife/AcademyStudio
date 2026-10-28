import {createServer} from 'node:http';import {readFile,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {Readable} from 'node:stream';
import {previewFixture,loadPreparedPreview} from '../tests/preview-fixture.mjs';import {previewAccessCode} from '../src/preview-identity.mjs';
const out=resolve(process.argv[2]||'');if(!process.argv[2])throw Error('Choose prepared preview output.');
const port=Number(process.env.PREVIEW_PORT||8885),origin='http://localhost:'+port,f=await previewFixture();
await loadPreparedPreview(f,JSON.parse(await readFile(join(out,'seed-plan.json'),'utf8')));
const access={};for(const id of ['preview-admin','preview-course-admin','preview-learner','preview-surah','preview-outsider'])access[id]=await previewAccessCode(f.env.PREVIEW_INVITE_SECRET,id,Number(f.env.PREVIEW_ACCESS_EXPIRES_AT));
await writeFile(join(out,'local-browser-access.json'),JSON.stringify(access),{mode:0o600});
const server=createServer(async(request,response)=>{
 try{
  const headers=new Headers();for(const [key,value] of Object.entries(request.headers))if(value&&!['host','connection','content-length','accept-encoding'].includes(key))headers.set(key,Array.isArray(value)?value.join(','):value);
  if(headers.get('Origin')===origin)headers.set('Origin',f.env.WEBSITE_ORIGIN);
  let length=0,chunks=[];for await(const chunk of request){length+=chunk.length;if(length>17*1024*1024){response.writeHead(413);return response.end();}chunks.push(chunk);}
  const r=await f.runtime.dispatchFetch(f.env.WEBSITE_ORIGIN+request.url,{method:request.method,headers,...(['GET','HEAD'].includes(request.method)?{}:{body:Buffer.concat(chunks)})});
  response.writeHead(r.status,Object.fromEntries(r.headers));if(!r.body||request.method==='HEAD')response.end();else Readable.fromWeb(r.body).on('error',()=>response.destroy()).pipe(response);
 }catch{if(!response.headersSent)response.writeHead(500);response.end('Local preview error.');}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});console.log(JSON.stringify({origin,websites:9,localOnly:true}));
let closing=false;async function close(){if(closing)return;closing=true;server.close();await f.close();process.exit(0);}process.on('SIGINT',close);process.on('SIGTERM',close);
