// Existing Studio application is the SaaS origin. No second authentication service.
import {launch} from '../../src/launch-worker.mjs';
import {hostingOrigins,exactOrigin} from '../../src/deployment-origins.mjs';
import {pagesAsset} from './assets.mjs';
const error=(message,status)=>new Response(message,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive'}});
export async function saasWebsite(request,env,ctx,{application=launch,assetFetcher=fetch}={}){
 let origins,provider,redirects,assetSource;
 try{
  for(const name of ['WEBSITE_ORIGIN','STUDIO_BACKEND_ORIGIN','ACADEMY_ORIGIN','ACADEMY_PORTAL_ORIGIN'])exactOrigin(env[name],name);
  assetSource=env.PUBLIC_ASSET_SOURCE;
  if(!['pages','worker'].includes(assetSource))throw Error();
  if(assetSource==='pages')exactOrigin(env.PUBLIC_ASSET_ORIGIN,'public assets');
  origins=hostingOrigins(env);provider=exactOrigin(env.STUDIO_PROVIDER_ORIGIN,'Studio provider');
  redirects=JSON.parse(env.STUDIO_REDIRECT_ORIGINS||'[]');
  if(!Array.isArray(redirects)||redirects.length>8)throw Error();
  redirects=redirects.map(value=>exactOrigin(value,'Studio redirect'));
  if([provider,...redirects].includes(origins.website))throw Error();
  if(assetSource==='pages'&&[origins.website,origins.studioBackend,provider,...redirects].includes(env.PUBLIC_ASSET_ORIGIN))throw Error();
 }catch{return error('The website connection is not configured.',503);}
 const url=new URL(request.url),https=url.protocol==='http:'?'https://'+url.host:url.origin;
 if(url.port||!['https:','http:'].includes(url.protocol))return error('Unknown website address.',421);
 if([provider,...redirects].includes(https)||https===origins.website&&url.protocol==='http:'){
  if(!['GET','HEAD'].includes(request.method))return error('Reopen this action from the website.',403);
  return new Response(null,{status:307,headers:{Location:origins.website+url.pathname+url.search,'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive'}});
 }
 if(![origins.website,origins.studioBackend].includes(url.origin))return error('Unknown website address.',421);
 // Preserve the old front door's native Academy aliases without touching Hifz.
 if(/^\/(?:academy|account)(?:\/|$)/.test(url.pathname)){
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD','Cache-Control':'no-store'}});
  return new Response(null,{status:307,headers:{Location:origins.academy+url.pathname+url.search,'Cache-Control':'no-store'}});
 }
 const adapted=assetSource==='pages'?{...env,ASSETS:{fetch:assetRequest=>pagesAsset(assetRequest,env,assetFetcher)}}:env;
 return application(request,adapted,ctx);
}
export default {fetch:(request,env,ctx)=>saasWebsite(request,env,ctx)};
