import {connected} from './parallel-worker.mjs';
import {json} from './protocol.mjs';
import {publicCirclesRoute} from './public-circles-routes.mjs';

// This entry changes the public address/presentation only. The connected entry
// retains real Academy identity, signed deliveries and all current access gates.
export async function launch(request,env,ctx){
 if(env.WEBSITE_ORIGIN!=='https://maktab4life.org')return json({success:false,error:'The website address is not configured.'},503);
 const url=new URL(request.url),branded=url.origin===env.WEBSITE_ORIGIN||request.headers.get('X-Maktab-Front-Door')==='maktab4life.org';
 if(url.origin==='https://academy-studio-parallel.naidu-hajira.workers.dev'&&!branded&&['GET','HEAD'].includes(request.method)&&!url.pathname.startsWith('/internal/'))return new Response(null,{status:307,headers:{Location:env.WEBSITE_ORIGIN+url.pathname+url.search,'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive'}});
 let response;
 if(/^\/_assets\/[a-f0-9]{64}\//.test(url.pathname)&&['GET','HEAD'].includes(request.method)){
  if(!/^\/_assets\/[a-f0-9]{64}\/[-A-Za-z0-9_./]+\.(?:js|mjs|css|png|jpe?g|svg|webp|gif|ico|woff2?|ttf|otf|bcmap|pfb|wasm|json|webmanifest|map|ftl|txt|md|pdf|properties|bin)$/.test(url.pathname)||url.pathname.split('/').some(p=>p.startsWith('.')))return new Response('Not found',{status:404});
  response=await connected(request,env,ctx);const headers=new Headers(response.headers);if(response.ok&&headers.get('Content-Type')?.includes('text/html'))return new Response('Not found',{status:404});
  if(response.ok&&!headers.get('Content-Type')?.includes('text/html'))headers.set('Cache-Control','public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options','nosniff');response=new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
 }else response=publicCirclesRoute(request)||await connected(request,env,ctx);
 response=new Response(response.body,response);
 response.headers.set('X-AcademyStudio-Mode','website');
 response.headers.set('X-AcademyStudio-Version',env.RELEASE_VERSION||'109');
 const publicHTML=['/','/prospectus-2027.html','/circles/free-learning.html'].includes(url.pathname)&&response.ok&&response.headers.get('Content-Type')?.includes('text/html');
 // Routing metadata controls discovery only. It never supplies an account,
 // permission or accepted action Origin, and is not an authentication proof.
 if(!publicHTML||!branded)response.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
 if(response.headers.get('Content-Type')?.includes('text/html')){
  response.headers.set('Cache-Control','no-store');
  if(publicHTML)response=new HTMLRewriter().on('head',{element(element){element.append('<link rel="canonical" href="https://maktab4life.org'+url.pathname+'">',{html:true});}}).transform(response);
 }
 return response;
}
export default {fetch:launch};
