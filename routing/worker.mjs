// Domain routing in the existing Academy account. Studio remains in its own
// account with its existing private R2 buckets and D1. No database binding here.
const canonical='https://maktab4life.org';
const studio='https://academy-studio-parallel.naidu-hajira.workers.dev';
const academy='https://academy-maktab4life.pages.dev';
const unavailable=()=>new Response('The website is temporarily unavailable. Please try again shortly.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const redirect=(destination,status=307)=>new Response(null,{status,headers:{Location:destination,'Cache-Control':'no-store'}});
export async function routeWebsite(request,fetcher=fetch){
 const url=new URL(request.url);
 if(!['http:','https:'].includes(url.protocol)||!['maktab4life.org','www.maktab4life.org'].includes(url.hostname)||url.port)return new Response('Unknown website address.',{status:421,headers:{'Cache-Control':'no-store'}});
 if(url.protocol!=='https:'||url.hostname==='www.maktab4life.org'){
  if(!['GET','HEAD'].includes(request.method))return new Response('Reopen this action from https://maktab4life.org.',{status:403,headers:{'Cache-Control':'no-store'}});
  url.protocol='https:';url.hostname='maktab4life.org';return redirect(url.href);
 }
 if(/^\/(?:academy|account)(?:\/|$)/.test(url.pathname)){
  if(!['GET','HEAD'].includes(request.method))return new Response('Reopen this action from Academy.',{status:405,headers:{Allow:'GET, HEAD','Cache-Control':'no-store'}});
  return redirect(academy+url.pathname+url.search+url.hash);
 }
 // The destination is fixed, even for paths beginning with // or URL-like
 // query values. Preserve the browser Origin; Studio's exact-origin CSRF
 // check, host-only session, signatures, revisions and entitlements still apply.
 const upstream=new URL(studio);upstream.pathname=url.pathname;upstream.search=url.search;
 const headers=new Headers(request.headers);headers.delete('Host');
 headers.delete('Forwarded');headers.delete('X-Forwarded-Host');
 headers.set('X-Maktab-Front-Door','maktab4life.org');
 const forwarded=new Request(upstream.href,new Request(request,{headers,redirect:'manual'}));
 try{
  const result=await fetcher(forwarded),response=new Response(result.body,result);
  const location=response.headers.get('Location');
  if(location){const next=new URL(location,upstream);if(next.origin===studio)response.headers.set('Location',canonical+next.pathname+next.search+next.hash);}
  response.headers.set('X-Maktab-Website-Version','109');return response;
 }catch{return unavailable();}
}
export default {fetch:request=>routeWebsite(request)};
