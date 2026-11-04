// Static bytes only. Cookies, credentials and request queries never reach Pages.
import publicManifest from '../../release/manifest.json' with {type:'json'};
import {exactOrigin} from '../../src/deployment-origins.mjs';
const paths=new Set(Object.keys(publicManifest.manifest));
const failure=(status=503)=>new Response(status===404?'Not found.':'The website files are temporarily unavailable.',{status,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff'}});
export function assetFile(path){
 const candidate=path.slice(1);
 if(paths.has(candidate))return candidate;
 const index=candidate.replace(/\/$/,'')+'/index.html';
 return paths.has(index)?index:null;
}
export async function pagesAsset(request,env,fetcher=fetch){
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD','Cache-Control':'no-store'}});
 let origin;try{origin=exactOrigin(env.PUBLIC_ASSET_ORIGIN,'public assets');}catch{return failure();}
 const incoming=new URL(request.url),file=assetFile(incoming.pathname);
 if(!file||file.split('/').some(part=>part.startsWith('.')))return failure(404);
 // Pages normalises .html and index.html URLs. Fetch their clean paths directly
 // so no service address can appear in a browser redirect.
 let path='/'+file;
 if(path.endsWith('/index.html'))path=path.slice(0,-10);
 else if(path.endsWith('.html'))path=path.slice(0,-5);
 if(!path)path='/';
 const target=new URL(origin);target.pathname=path;
 const headers=new Headers();
 for(const name of ['Accept','Accept-Encoding','If-None-Match','If-Modified-Since','Range','If-Range']){
  const value=request.headers.get(name);if(value!==null)headers.set(name,value);
 }
 let source;
 try{source=await fetcher(new Request(target,{method:request.method,headers,redirect:'manual'}));}catch{return failure();}
 if(source.status>=300&&source.status<400&&source.status!==304)return failure();
 if(source.ok&&!file.endsWith('.html')&&source.headers.get('Content-Type')?.includes('text/html'))return failure(404);
 const response=new Response(request.method==='HEAD'?null:source.body,source);
 response.headers.delete('Set-Cookie');
 response.headers.delete('X-Robots-Tag'); // The application owns public/private indexing.
 response.headers.set('X-Content-Type-Options','nosniff');
 if(file.endsWith('.html'))response.headers.set('Cache-Control','no-store');
 else if(incoming.pathname.startsWith('/_assets/'))response.headers.set('Cache-Control','public, max-age=31536000, immutable');
 else response.headers.set('Cache-Control','public, max-age=0, must-revalidate');
 return response;
}
