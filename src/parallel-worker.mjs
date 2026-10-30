// Real-account parallel deployment; never imports temporary preview identities.
import {handle} from './worker.mjs';
import {json} from './protocol.mjs';
export async function parallel(request,env,ctx){
 if(env.ENVIRONMENT!=='parallel'||env.AUTHORITY_MODE!=='ACADEMY'||env.PREVIEW_LOGIN_ENABLED==='1'||!/^https:\/\//.test(env.ACADEMY_ORIGIN||'')||!/^https:\/\//.test(env.ACADEMY_API_ORIGIN||'')||env.ACADEMY_ORIGIN==='https://academy.invalid')return json({success:false,error:'The real parallel configuration is required.'},503);
 if(env.PLATFORM_ENABLED==='1'&&[env.ACADEMY_TO_WEBSITE_SECRET,env.WEBSITE_TO_ACADEMY_SECRET].some(s=>typeof s!=='string'||s.length<32))return json({success:false,error:'The Academy connection is not configured.'},503);
 const path=new URL(request.url).pathname,privateRoute=path.startsWith('/auth/')||path.startsWith('/api/')&&!['/api/config','/api/public/home','/api/public/circles'].includes(path)&&!/^\/api\/public\/circles\/covers\/[a-f0-9]{64}$/.test(path);
 // Signed imports can arrive while real browser access remains closed. The
 // ordinary receiver still authenticates every delivery before any mutation.
 let response=env.PARALLEL_ACCESS_ENABLED!=='1'&&privateRoute?json({success:false,error:'Parallel access is being synchronised. Existing Academy screens remain available.',code:'PARALLEL_PREPARING'},503):await handle(request,env,ctx);response=new Response(response.body,response);
 response.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
 response.headers.set('X-AcademyStudio-Mode','parallel');
 response.headers.set('X-AcademyStudio-Version',env.RELEASE_VERSION||'108.0');
 if(response.headers.get('Content-Type')?.includes('text/html')){
  response.headers.set('Cache-Control','no-store');
  response=new HTMLRewriter().on('body',{element(el){el.prepend('<aside role="note" style="padding:12px 24px;background:#fff3cd;color:#493b16;text-align:center;font:16px system-ui">Self-paced learning · V108.0 parallel testing · Existing Academy screens remain available</aside>',{html:true});}}).transform(response);
 }
 return response;
}
export default {fetch:parallel};
