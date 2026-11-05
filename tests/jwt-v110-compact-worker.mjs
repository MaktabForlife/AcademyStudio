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
 const content=new Proxy(env.CONTENT,{get(target,key){const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;return (...args)=>{if(key==='get')io.r2Get++;if(key==='head')io.r2Head++;return value.apply(target,args);};}});
 const local={...env,DB:tracedDB(env.DB,metrics),CONTENT:content},url=new URL(request.url),compact=url.pathname.startsWith('/compact/');
 const target=new URL(url.pathname.replace(/^\/(native|compact)/,''),'https://website.test');target.search=url.search;
 const actual=new Request(target,{method:request.method,headers:request.headers}),denyNetwork=()=>{io.academyRequests++;throw Error('No Academy/network call is allowed in this synthetic request.');};
 let response;
 try{
  if(url.pathname==='/compact-refresh'&&request.method==='POST'){
   const api=await createAccountBoundCompactStudioRefresh({binding:local.DB,clock:()=>env.TEST_NOW,app:'studio',issuer:env.STUDIO_ISSUER,publicKeys:[env.STUDIO_PUBLIC],signingKey:await importJWK(env.STUDIO_PRIVATE,'ES256'),signingKid:'studio-current'});
   const result=await api.refreshAndIssue(env.TEST_REFRESH,{foreground:false}),headers=new Headers({'Content-Type':'application/json','Cache-Control':'private, no-store'});for(const c of result.setCookies)headers.append('Set-Cookie',c);response=new Response(JSON.stringify({kind:result.kind,metrics:result.metrics}),{headers});
  }else{
  if(request.method!=='GET')return new Response(null,{status:405});
  if(compact){
   const engine=await createStudioCompactEngine({app:'studio',issuer:env.STUDIO_ISSUER,publicKeys:[env.STUDIO_PUBLIC]}),token=parseUniqueCookie(request.headers.get('Cookie'),'__Host-uas_a');
   const proof=await authenticateCompactStudio({engine,binding:local.DB,token,now:env.TEST_NOW});
   response=await route(actual,local,new Store(local),denyNetwork,proof.actor);
  }else response=await handle(actual,local,ctx,denyNetwork);
  }
 }catch(error){response=Response.json({code:error.code||'SYNTHETIC_FAILURE'},{status:error.status||401});}
 const headers=new Headers(response.headers);headers.set('X-Lab-D1',JSON.stringify(metrics));headers.set('X-Lab-IO',JSON.stringify(io));headers.set('X-Lab-Wall-Ms',String(performance.now()-started));
 return new Response(response.body,{status:response.status,headers});
}};
