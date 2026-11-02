import {applyTargetSchema} from './target-schema.mjs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {previewAccessCode} from '../src/preview-identity.mjs';
export async function previewFixture(){
 const entry=new URL('../src/preview-worker.mjs',import.meta.url).pathname,script=(await build({entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'browser'})).outputFiles[0].text;
 const env={ENVIRONMENT:'isolated-preview',PLATFORM_ENABLED:'1',ACADEMY_ORIGIN:'https://academy.invalid',WEBSITE_ORIGIN:'https://website.test',PREVIEW_LOGIN_ENABLED:'1',PREVIEW_ACCESS_EXPIRES_AT:String(Date.now()+7*86400_000),PREVIEW_INVITE_SECRET:'Synthetic local fixture key '+crypto.randomUUID(),ACCOUNT_MAX_AGE_SECONDS:'3600',ADMIN_MAX_AGE_SECONDS:'300'};
 const publicRoot=resolve('public'),mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf','.woff2':'font/woff2'};
 const runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script,compatibilityDate:'2026-09-28',compatibilityFlags:['nodejs_compat'],bindings:env,d1Databases:{DB:'private-preview'},r2Buckets:{CONTENT:'private-preview-content',MEDIA:'private-preview-media'},serviceBindings:{ASSETS:async request=>{
  const requested=new URL(request.url).pathname,path=requested==='/'?'/studio/':requested,file=resolve(publicRoot,'.'+(path.endsWith('/')?path+'index.html':path));
  if(!file.startsWith(publicRoot+'/'))return new Response('Not found',{status:404});
  try{return new Response(await readFile(file),{headers:{'Content-Type':mime[extname(file)]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}
 }}}));
 const db=await runtime.getD1Database('DB'),content=await runtime.getR2Bucket('CONTENT'),media=await runtime.getR2Bucket('MEDIA');
 await applyTargetSchema(db);
 const run=(sql,...args)=>db.prepare(sql).bind(...args).run();
 const request=async(path,{cookie,method='GET',body,headers={}}={})=>{
  const r=await runtime.dispatchFetch(env.WEBSITE_ORIGIN+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method==='POST'?{Origin:env.WEBSITE_ORIGIN,'Content-Type':'application/json'}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:r.status,response:r,body:r.headers.get('Content-Type')?.includes('application/json')?await r.json():await r.text()};
 };
 const login=async accountId=>{const accessCode=await previewAccessCode(env.PREVIEW_INVITE_SECRET,accountId,Number(env.PREVIEW_ACCESS_EXPIRES_AT)),r=await request('/auth/preview/login',{method:'POST',body:{accessCode}});return {...r,cookie:r.response.headers.get('Set-Cookie')?.split(';')[0]};};
 return {runtime,env,db,content,media,run,request,login,close:()=>runtime.dispose()};
}
export async function loadPreparedPreview(f,plan){
 for(const object of plan.objects)await f[object.bucket==='CONTENT'?'content':'media'].put(object.key,await readFile(object.file),{httpMetadata:{contentType:object.contentType}});
 for(const statement of plan.statements)await f.run(statement.sql,...statement.args);
}
