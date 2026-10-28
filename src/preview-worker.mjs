// Separate deployment entrypoint. Never connects a preview to Academy identity,
// private material, or event delivery. The reviewed production worker is unchanged.
import {handle} from './worker.mjs';
import {json,fail} from './protocol.mjs';

export async function preview(request,env,ctx){
 if(env.ENVIRONMENT!=='isolated-preview'||env.ACADEMY_ORIGIN!=='https://academy.invalid')return json({error:'The isolated preview configuration is required.'},503);
 const path=new URL(request.url).pathname;
 let response;
 if(path.startsWith('/auth/')||path.startsWith('/internal/'))response=json({success:false,code:'PREVIEW_DISCONNECTED',error:'This isolated preview is not connected to Academy sign-in. Do not enter real credentials.'},503);
 else if(path==='/api/config')response=json({academyOrigin:env.ACADEMY_ORIGIN,localPreview:false,isolatedPreview:true});
 else response=await handle(request,env,ctx,async()=>{throw fail('Academy is disconnected in this isolated preview.',503,'PREVIEW_DISCONNECTED');});
 response=new Response(response.body,response);
 response.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
 response.headers.set('X-AcademyStudio-Preview','isolated');
 if(response.headers.get('Content-Type')?.includes('text/html')){
  response.headers.set('Cache-Control','no-store');
  response=new HTMLRewriter()
   .on('body',{element(el){el.prepend('<aside role="note" style="padding:12px 24px;background:#fff3cd;color:#493b16;text-align:center;font:16px system-ui">AcademyStudio isolated preview · Sample content only · Academy sign-in is disconnected. The live Academy is unchanged.</aside>',{html:true});}})
   .on('#sign-in-button, #sign-in-form button, #sign-in-form input',{element(el){el.setAttribute('disabled','');}})
   .on('#sign-in-form input',{element(el){el.setAttribute('placeholder','Disconnected preview');}})
   .transform(response);
 }
 return response;
}
export default {fetch:preview};
