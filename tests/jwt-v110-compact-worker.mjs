// Synthetic GitHub-only adapter proof, never imported by production.
import {handle,route} from '../src/worker.mjs';
import {Store} from '../src/database.mjs';
import {parseUniqueCookie} from '../src/auth/v110/claims.mjs';
import {createStudioCompactEngine,authenticateCompactStudio,createAccountBoundCompactStudioRefresh} from '../src/auth/v110/compact-studio.mjs';
import {importJWK} from 'jose';
function tracedDB(binding,metrics){
 const raw=new WeakMap(),count=result=>{for(const r of Array.isArray(result)?result:[result]){metrics.statements++;metrics.rowsRead+=r.meta?.rows_read||0;metrics.rowsWritten+=r.meta?.rows_written||0;}return result;};
 const session=mode=>{
  const db=binding.withSession(mode);
  const wrap=statement=>{
   const value={bind(...args){return wrap(statement.bind(...args));},async all(){metrics.roundTrips++;return count(await statement.all());},async run(){metrics.roundTrips++;return count(await statement.run());},async first(column){const r=await value.all(),row=r.results[0]??null;return column&&row?row[column]:row;}};
   raw.set(value,statement);return value;
  };
  return {prepare:sql=>wrap(db.prepare(sql)),async batch(statements){metrics.roundTrips++;return count(await db.batch(statements.map(s=>raw.get(s)||s)));}};
 };
 return {withSession:session,prepare:sql=>session('first-primary').prepare(sql)};
}
export default{async fetch(request,env,ctx){
 const metrics={roundTrips:0,statements:0,rowsRead:0,rowsWritten:0},io={r2Get:0,r2Head:0,academyRequests:0},started=performance.now();
 let response;
 try{
  const url=new URL(request.url);
  if(url.origin!==env.WEBSITE_ORIGIN)throw Object.assign(Error('UNEXPECTED_ORIGIN'),{code:'UNEXPECTED_ORIGIN',status:403});
  if(env.PLATFORM_ENABLED!=='1')throw Object.assign(Error('PLATFORM_DISABLED'),{code:'PLATFORM_DISABLED',status:503});
 const content=new Proxy(env.CONTENT,{get(target,key){const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;return (...args)=>{if(key==='get')io.r2Get++;if(key==='head')io.r2Head++;return value.apply(target,args);};}});
 const local={...env,DB:tracedDB(env.DB,metrics),CONTENT:content},compact=url.pathname.startsWith('/compact/');
 const target=new URL(url.pathname.replace(/^\/(native|compact)/,''),'https://website.test');target.search=url.search;
 const actual=new Request(target,{method:request.method,headers:request.headers}),denyNetwork=()=>{io.academyRequests++;throw Error('No Academy/network call is allowed in this synthetic request.');};

  if(url.pathname==='/compact-refresh'&&request.method==='POST'){
   if(request.headers.get('Origin')!==env.WEBSITE_ORIGIN)throw Object.assign(Error('INVALID_ORIGIN'),{code:'INVALID_ORIGIN',status:403});
   const raw=parseUniqueCookie(request.headers.get('Cookie'),'__Host-uas_r');
   const api=await createAccountBoundCompactStudioRefresh({binding:local.DB,clock:()=>env.TEST_NOW,app:'studio',issuer:env.STUDIO_ISSUER,publicKeys:[env.STUDIO_PUBLIC],signingKey:await importJWK(env.STUDIO_PRIVATE,'ES256'),signingKid:'studio-current'});
   const result=await api.refreshAndIssue(raw,{foreground:false}),headers=new Headers({'Content-Type':'application/json','Cache-Control':'private, no-store'});for(const c of result.setCookies)headers.append('Set-Cookie',c);response=new Response(JSON.stringify({kind:result.kind,metrics:result.metrics}),{status:result.kind==='rotated'?200:result.kind==='in_progress'||result.kind==='retry_required'?409:401,headers});
  }else{
  if(request.method!=='GET')throw Object.assign(Error('METHOD_NOT_ALLOWED'),{code:'METHOD_NOT_ALLOWED',status:405});
  if(compact){
   const engine=await createStudioCompactEngine({app:'studio',issuer:env.STUDIO_ISSUER,publicKeys:[env.STUDIO_PUBLIC]}),token=parseUniqueCookie(request.headers.get('Cookie'),'__Host-uas_a');
   const proof=await authenticateCompactStudio({engine,binding:local.DB,token,now:env.TEST_NOW});
   response=await route(actual,local,new Store(local),denyNetwork,proof.actor);
  }else response=await handle(actual,local,ctx,denyNetwork);
  }
 }catch(error){
  const known=new Set(['UNEXPECTED_ORIGIN','PLATFORM_DISABLED','INVALID_ORIGIN','METHOD_NOT_ALLOWED','AMBIGUOUS_OR_MISSING_COOKIE','INVALID_COOKIE_HEADER','INVALID_TOKEN','INVALID_REFRESH','SESSION_ENDED','PIN_REQUIRED','TOKEN_UPDATE_REQUIRED','PREPARATION_EXPIRED','CLAIMS_TOO_LARGE','COOKIE_TOO_LARGE','SIGNER_UNAVAILABLE','MATERIAL_ACCESS_REQUIRED','SIGN_IN_REQUIRED','STATUS_EXPIRED','ADMIN_STATUS_EXPIRED','ACCESS_REFRESH_REQUIRED','HANDOVER_REQUIRED','ACCESS_GENERATION','JOIN_AUDIENCE','CHANGE_CONFLICT','FORBIDDEN']);
  const code=known.has(error.code)?error.code:error.status===404?'NOT_FOUND':error.status===403?'FORBIDDEN':'TEMPORARY_FAILURE';
  const status=error.status||(['TOKEN_UPDATE_REQUIRED','PREPARATION_EXPIRED'].includes(code)?409:['CLAIMS_TOO_LARGE','COOKIE_TOO_LARGE','SIGNER_UNAVAILABLE','TEMPORARY_FAILURE'].includes(code)?503:['AMBIGUOUS_OR_MISSING_COOKIE','INVALID_COOKIE_HEADER','INVALID_REFRESH'].includes(code)?400:401);
  response=Response.json({code},{status});
 }
 const headers=new Headers(response.headers);headers.set('Cache-Control','private, no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('X-Lab-D1',JSON.stringify(metrics));headers.set('X-Lab-IO',JSON.stringify(io));headers.set('X-Lab-Wall-Ms',String(performance.now()-started));
 return new Response(response.body,{status:response.status,headers});
}};
