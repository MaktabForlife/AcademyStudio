import {childAuthorityRequest,withoutCookies,withoutSetCookie} from '../security/v2/http-cookie-boundary.mjs';
import {studioAuthorityTarget} from './v111-source-authority.mjs';
import {Store} from './database.mjs';
import {handle} from './worker.mjs';
import {json,failure} from './protocol.mjs';
import {hostingOrigins} from './deployment-origins.mjs';
import {bindV2Store} from './v111-native-context.mjs';
import {v2Enabled,studioV2Origin} from './v111-mode.mjs';
import {createNativeRuntime} from '../security/v2/native-runtime.mjs';

const publicAPI=path=>['/api/config','/api/public/home','/api/public/circles','/api/public/header-date','/api/public/academy-announcements'].includes(path)||/^\/api\/public\/academy-announcements\/(?:image|pdf)$/.test(path)||/^\/api\/public\/circles\/covers\/[a-f0-9]{64}$/.test(path);
const problem=(code,message,status)=>json({success:false,code,error:message},status);
const defaultRuntimeFor=async env=>(await import('../security/v2/runtime.mjs')).runtimeFor(env,{app:'studio',nativeFactory:createNativeRuntime});
export function createStudioV2Handler({getRuntime=defaultRuntimeFor,business=handle,fetcher=fetch}={}){
 return async function studioV2(request,env,ctx){
  if(!v2Enabled(env))return problem('V2_NOT_SELECTED','Studio V2 is not selected.',503);
  let runtime;try{
   const origins=hostingOrigins(env),url=new URL(request.url),path=url.pathname;
   if(url.origin!==studioV2Origin||origins.website!==studioV2Origin)return problem('CANONICAL_ORIGIN_REQUIRED','Open Studio at its configured website address.',421);
   if(path==='/api/config'&&request.method==='GET'){
    let sharedBookmarkEntry=false;
    try{sharedBookmarkEntry=Boolean(JSON.parse(env.UAA_V2_CONFIG).sharedChildEntry);}catch{}
    return json({sharedBookmarkEntry,authVersion:2,app:'studio',academyOrigin:origins.academy,academyPortalOrigin:origins.academyPortal,localPreview:false,authorityMode:env.AUTHORITY_MODE||'ACADEMY'});
   }
   // Keep old source intact, but never accept its credentials/receivers in V2.
   if((path==='/auth'||path.startsWith('/auth/'))&&!path.startsWith('/auth/v2/'))return problem('V1_AUTH_DISABLED','Reconnect through Academy to use Studio.',410);
   if(path==='/api'||path==='/auth'||path==='/internal')return problem('ROUTE_NOT_FOUND','This action was not found.',404);
   const internal=path.startsWith('/internal/'),guarded=path.startsWith('/auth/v2/')||internal;
   if(!guarded&&(publicAPI(path)&&['GET','HEAD'].includes(request.method)||!path.startsWith('/api/'))){
    return withoutSetCookie(await business(withoutCookies(request),env,ctx,fetcher));
   }
   if(internal&&(request.headers.has('Cookie')||request.headers.has('Origin'))){
    return problem('SERVICE_TRANSPORT_ONLY','This route accepts signed service requests.',401);
   }
   request=childAuthorityRequest(request);
   runtime=await getRuntime(env);const handled=await runtime.handle(request,ctx);if(handled)return handled;
   if(path==='/internal/academy/source-authority/v2')return await studioAuthorityTarget(request,runtime);
   if(path==='/internal/academy/portal/v2')return await (await import('./v111-hub-bridge.mjs')).receiveStudioPortal(request,runtime,{fetcher});
   if(path.startsWith('/internal/')&&!path.startsWith('/internal/auth/v2/'))return problem('V1_INTERNAL_DISABLED','This connection requires the current authenticated service protocol.',410);
   if(guarded)return problem('ROUTE_NOT_FOUND','This security action was not found.',404);
   const action=/^\/api\/media\//.test(path)?'media':['GET','HEAD'].includes(request.method)?'read':path.includes('/admin/')||path.includes('/upload')||path.includes('/publish')?'sensitive':'write';
   const cap=await runtime.authorise(request,{action}),store=bindV2Store(new Store(env),runtime,cap),actor=await store.actor();
   const response=await business(request,env,ctx,fetcher,{store,actor});return runtime.decorate(response,cap);
  }catch(error){return failure(error);}
 };
}
export const studioV2=createStudioV2Handler();
