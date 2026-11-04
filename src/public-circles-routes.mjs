import {canonicalCirclesDestination,retiredOperatorPath} from '../public/shared/canonical-circles.mjs';
import {hostingOrigins} from './deployment-origins.mjs';
// Run before connected/session handlers. Public aliases need no D1/R2 access.
export function publicCirclesRoute(request,env={}){
 const url=new URL(request.url),origins=hostingOrigins(env);
 if(retiredOperatorPath(url.pathname))return new Response(request.method==='HEAD'?null:'This page is no longer available. Return to '+origins.website+'/',{status:410,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex'}});
 if(!['GET','HEAD'].includes(request.method))return null;
 if(/^\/(?:programs|users|recorder|activities|pdf-viewer)(?:\/|$)/.test(url.pathname)||/^\/(?:admin|student)(?:\/|\.html$|$)/.test(url.pathname))return new Response(null,{status:307,headers:{location:origins.academy+url.pathname+url.search,'cache-control':'no-store'}});
 // Hashes are handled by the browser compatibility entry.
 const destination=canonicalCirclesDestination(url,{academyOrigin:origins.academy});
 if(origins.academyPortal!==origins.website){
  const portalAliases=new Set(['/login','/login/','/dashboard','/dashboard/']);
  const rootPages=new Set(['/','/index.html','/circles','/circles/','/circles/index.html']);
  if(portalAliases.has(url.pathname)){const target=new URL(origins.academyPortal);target.search=url.search;target.hash=url.hash;target.searchParams.set(url.pathname.startsWith('/login')?'login':'dashboard','1');return new Response(null,{status:307,headers:{location:target.href,'cache-control':'no-store'}});}
  if(rootPages.has(url.pathname)){const next=destination?new URL(destination,url.origin):url;if(next.origin===url.origin&&next.pathname==='/')return new Response(null,{status:307,headers:{location:origins.academyPortal+'/'+next.search+next.hash,'cache-control':'no-store'}});}
 }
 if(!destination)return null;
 return new Response(null,{status:307,headers:{location:new URL(destination,url.origin).href,'cache-control':'no-store'}});
}
