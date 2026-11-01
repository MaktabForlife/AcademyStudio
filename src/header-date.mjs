import {bodyJSON,json} from './protocol.mjs';
const timezone='Africa/Johannesburg',source='https://jamiat.org.za/';
export async function publicHeaderDate(request,env,fetcher,{now=new Date(),cache=globalThis.caches?.default,warn=(...args)=>console.warn(...args)}={}){
 const gregorian=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now),key=new Request(new URL('/api/public/header-date?day='+gregorian,request.url));
 if(cache)try{const hit=await cache.match(key);if(hit)return hit;}catch{}
 let hijri=null,reason='source-request-failed';
 try{
  const result=await fetcher(new URL('/api/academy/header-date',env.ACADEMY_API_ORIGIN||env.ACADEMY_ORIGIN).href,{headers:{Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(20000)});
  // Workers rejects redirect:'error' before sending a request. Manual mode
  // keeps redirects blocked; the non-2xx branch below rejects their responses.
  if(!result.ok){reason='HTTP_'+result.status;await result.body?.cancel();}
  else{
   reason='source-response-invalid';
   const data=await bodyJSON(result.body,4096);
   if(data.gregorian!==gregorian||data.timezone!==timezone||data.source!==source)reason='source-date-mismatch';
   else if(data.hijri===null)reason='source-date-unavailable';
   else if(typeof data.hijri==='string'&&/^\d{1,2} [A-Za-z ’'\-]+ \d{4}$/.test(data.hijri)&&data.hijri.length<=100)hijri=data.hijri;
  }
 }catch(error){if(error?.name==='TimeoutError'||error?.name==='AbortError')reason='timeout';}
 // Only fixed reason codes are logged: no source body, account, request URL or
 // exception text. An unavailable date still uses the short shared cache.
 if(!hijri)warn('Circles header date source unavailable',{reason});
 const response=json({gregorian,hijri,timezone,source},200,{'Cache-Control':'public, max-age='+(hijri?900:60)});
 if(cache)try{await cache.put(key,response.clone());}catch{}
 return response;
}
