import {canonicalCirclesDestination,retiredOperatorPath,canonicalAcademyOrigin} from '../public/shared/canonical-circles.mjs';
// Run before connected/session handlers. Public aliases need no D1/R2 access.
export function publicCirclesRoute(request){
 const url=new URL(request.url);
 if(retiredOperatorPath(url.pathname))return new Response(request.method==='HEAD'?null:'This page is no longer available. Return to https://maktab4life.org/',{status:410,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex'}});
 if(!['GET','HEAD'].includes(request.method))return null;
 if(/^\/(?:programs|users|recorder|activities|pdf-viewer)(?:\/|$)/.test(url.pathname)||/^\/(?:admin|student)(?:\/|\.html$|$)/.test(url.pathname))return new Response(null,{status:307,headers:{location:canonicalAcademyOrigin+url.pathname+url.search,'cache-control':'no-store'}});
 // Hashes are handled by the browser compatibility entry.
 const destination=canonicalCirclesDestination(url);
 if(!destination)return null;
 return new Response(null,{status:307,headers:{location:new URL(destination,url.origin).href,'cache-control':'no-store'}});
}
