import {bodyJSON,fail,json} from './protocol.mjs';
import {normaliseAnnouncementFeed} from '../public/shared/announcement-feed.mjs';
const publicPath='/api/public/academy-announcements';
function authority(env){const value=env.ACADEMY_API_ORIGIN||env.ACADEMY_ORIGIN;let url;try{url=new URL(value);}catch{throw fail('The Academy connection is unavailable.',503);}if(url.protocol!=='https:'||url.origin!==value)throw fail('The Academy connection is unavailable.',503);return url.origin;}
// Public content only: never forward cookies, bearer tokens or source secrets.
// A validated empty publication is authoritative. Errors are never cached as empty.
export async function publishedAnnouncements(request,env,fetcher,{cache=globalThis.caches?.default}={}){
 const url=new URL(request.url),origin=authority(env),suffix=url.pathname.slice(publicPath.length),asset=['/image','/pdf'].includes(suffix),query=new URLSearchParams();
 if(suffix&&!asset)throw fail('Announcement not found.',404);
 if(asset){const id=url.searchParams.get('id'),hash=url.searchParams.get('asset');if(!/^[a-f0-9-]{36}$/i.test(id||'')||!/^[a-f0-9]{64}$/.test(hash||'')||[...url.searchParams.keys()].some(k=>!['id','asset'].includes(k)))throw fail('Announcement attachment not found.',404);query.set('id',id);query.set('asset',hash);}
 const cacheKey=new Request(new URL(publicPath+suffix+(asset?'?'+query:''),url.origin));
 if(cache)try{const hit=await cache.match(cacheKey);if(hit)return new Response(request.method==='HEAD'?null:hit.body,hit);}catch{}
 const upstream=await fetcher(origin+'/api/academy/announcements/'+(asset?suffix.slice(1):'published')+(asset?'?'+query:''),{method:asset?request.method:'GET',headers:{Accept:asset?'*/*':'application/json'},credentials:'omit',redirect:'manual',signal:AbortSignal.timeout(20000)});
 if(!upstream.ok){let code='ANNOUNCEMENTS_UNAVAILABLE';if(!asset&&upstream.status===503){try{const value=await bodyJSON(upstream.body,4096);if(value.code==='ANNOUNCEMENTS_NOT_ACTIVATED')code=value.code;}catch{}}else await upstream.body?.cancel();throw fail(asset?'Announcement attachment unavailable.':'Announcements could not be loaded.',asset&&upstream.status===404?404:503,code);}
 const headers={'Cache-Control':'public, max-age=60, must-revalidate','X-Content-Type-Options':'nosniff'};let response;
 if(asset){const type=upstream.headers.get('Content-Type')?.split(';')[0];if(suffix==='/pdf'?type!=='application/pdf':!['image/jpeg','image/png','image/webp'].includes(type)){await upstream.body?.cancel();throw fail('Announcement attachment unavailable.',503);}const length=Number(upstream.headers.get('Content-Length'));if(length>(suffix==='/pdf'?10:5)*1024*1024){await upstream.body?.cancel();throw fail('Announcement attachment unavailable.',503);}response=new Response(request.method==='HEAD'?null:upstream.body,{headers:{...headers,'Content-Type':type,...(length>0?{'Content-Length':String(length)}:{})}});
 }else{const checked=normaliseAnnouncementFeed(await bodyJSON(upstream.body,2_500_000),origin);for(const row of checked.announcements)for(const key of ['imageUrl','pdfUrl'])if(row[key]){const u=new URL(row[key]);row[key]=publicPath+'/'+(key==='imageUrl'?'image':'pdf')+u.search;}response=json(checked,200,headers);}
 if(cache&&request.method==='GET')try{await cache.put(cacheKey,response.clone());}catch{}
 if(request.method==='HEAD')return new Response(null,response);
 return response;
}
