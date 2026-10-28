// Separate deployment entrypoint. Temporary test identities never contact Academy.
// The production worker and all material/editing permission checks are unchanged.
import {handle} from './worker.mjs';
import {json,fail,failure} from './protocol.mjs';
import {previewDeadline,previewLogin,previewRefresh} from './preview-identity.mjs';

export async function preview(request,env,ctx){
 if(env.ENVIRONMENT!=='isolated-preview'||env.ACADEMY_ORIGIN!=='https://academy.invalid')return json({error:'The isolated preview configuration is required.'},503);
 const path=new URL(request.url).pathname,enabled=env.PREVIEW_LOGIN_ENABLED==='1',privateAPI=path.startsWith('/api/')&&!['/api/config','/api/public/home'].includes(path);
 let response;try{
  if(enabled&&(privateAPI||path==='/auth/preview/login'||path==='/auth/refresh'))previewDeadline(env);
  if(enabled&&path==='/auth/preview/login'&&request.method==='POST')response=await previewLogin(request,env);
  else if(enabled&&path==='/auth/refresh'&&request.method==='POST')response=await previewRefresh(request,env);
  else if(enabled&&path==='/auth/logout'&&request.method==='POST')response=await handle(request,env,ctx);
  else if(path.startsWith('/auth/')||path.startsWith('/internal/')||path==='/api/library-return'||/^\/api\/offerings\/[^/]+\/(provision|resume)$/.test(path))response=json({success:false,code:'PREVIEW_DISCONNECTED',error:'Academy integration is disconnected in this preview. Use Preview access and temporary test accounts; do not enter real credentials.'},503);
  else if(path==='/api/config')response=json({academyOrigin:env.ACADEMY_ORIGIN,localPreview:false,isolatedPreview:true});
  else response=await handle(request,env,ctx,async()=>{throw fail('Academy is disconnected in this isolated preview.',503,'PREVIEW_DISCONNECTED');});
 }catch(error){response=failure(error);}
 response=new Response(response.body,response);
 response.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
 response.headers.set('X-AcademyStudio-Preview','isolated');
 if(response.headers.get('Content-Type')?.includes('text/html')){
  response.headers.set('Cache-Control','no-store');
  response=new HTMLRewriter()
   .on('body',{element(el){el.prepend('<aside role="note" style="padding:12px 24px;background:#fff3cd;color:#493b16;text-align:center;font:16px system-ui">AcademyStudio isolated preview · '+(enabled?'Private website copies and test accounts · <a href="/preview/">Preview access</a>':'Sample content only')+' · Academy sign-in is disconnected. The live Academy is unchanged.</aside>',{html:true});}})
   .on('#sign-in-button, #academy-button, #sign-in-form button, #sign-in-form input',{element(el){el.setAttribute('disabled','');}})
   .on('#sign-in-title',{element(el){if(enabled)el.setInnerContent('Use Preview access');}})
   .on('#sign-in-dialog > p',{element(el){if(enabled&&el.getAttribute('class')!=='eyebrow')el.setInnerContent('Use your private test link: <a href="/preview/">open Preview access</a>. Academy credentials are not used here.',{html:true});}})
   .on('#sign-in-form input',{element(el){el.setAttribute('placeholder','Disconnected preview');}})
   .transform(response);
 }
 return response;
}
export default {fetch:preview};
