import test from 'node:test';import assert from 'node:assert/strict';
import {build} from 'esbuild';import {Miniflare,convertV4MiniflareOptions} from 'miniflare';import {fileURLToPath} from 'node:url';
const record={gregorian:'2026-11-01',hijri:'21 Jumada al-ula 1448',timezone:'Africa/Johannesburg',source:'https://jamiat.org.za/'};
async function runtime(source){
 const module=fileURLToPath(new URL('../src/header-date.mjs',import.meta.url));
 const result=await build({stdin:{contents:`import {publicHeaderDate} from ${JSON.stringify(module)};export default {fetch(request,env){return publicHeaderDate(request,env,(url,init)=>{const outgoing=new Request(url,init);if(outgoing.redirect!=='manual')throw Error('Manual redirect mode required');return env.SOURCE.fetch(outgoing);},{now:new Date('2026-11-01T12:00:00Z'),cache:null,warn:()=>{}});}};`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 return new Miniflare(convertV4MiniflareOptions({workers:[{name:'date',modules:true,script:result.outputFiles[0].text,compatibilityDate:'2026-09-28',bindings:{ACADEMY_API_ORIGIN:'https://api.academy.test'},serviceBindings:{SOURCE:source}}]}));
}
test('the real Worker Request path accepts the Source date without unsupported redirect mode or any D1 binding',async()=>{
 let calls=0,seen;const worker=await runtime(request=>{calls++;seen={url:request.url,redirect:request.redirect,authorization:request.headers.get('Authorization')};return Response.json({...record,success:true});});
 try{const response=await worker.dispatchFetch('https://studio.test/api/public/header-date');assert.equal(calls,1);assert.deepEqual(await response.json(),record,JSON.stringify(seen));assert.equal(new URL(seen.url).pathname,'/api/academy/header-date');assert.equal(seen.authorization,null);assert.equal(response.headers.get('Cache-Control'),'public, max-age=900');}finally{await worker.dispose();}
});
test('the real Worker path rejects a redirected date without following it or disclosing credentials',async()=>{
 let calls=0;const worker=await runtime(request=>{calls++;return new Response('Redirect rejected',{status:302,headers:{Location:'https://outside.invalid/private'}});});
 try{const response=await worker.dispatchFetch('https://studio.test/api/public/header-date');assert.deepEqual(await response.json(),{...record,hijri:null});assert.equal(calls,1);assert.equal(response.headers.get('Cache-Control'),'public, max-age=60');}finally{await worker.dispose();}
});
