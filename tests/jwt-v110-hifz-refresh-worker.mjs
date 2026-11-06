import hifz from '@hifz/worker/src/index.js';
export default {async fetch(request,env,ctx){
 const metrics={statements:0,rowsRead:0,rowsWritten:0,remoteCalls:0,injectedWrites:0};const mode=request.headers.get('X-Lab-Mode');let injected=false;
 const count=rs=>{for(const r of Array.isArray(rs)?rs:[rs]){metrics.statements++;metrics.rowsRead+=r.meta?.rows_read||0;metrics.rowsWritten+=r.meta?.rows_written||0;}return rs;};
 const wrap=statement=>({bind(...args){return wrap(statement.bind(...args));},all:async()=>count(await statement.all()),first:async(...args)=>{metrics.statements++;return statement.first(...args);},run:async()=>count(await statement.run()),raw:async(...args)=>{metrics.statements++;return statement.raw(...args);},statement});
 const db={withSession:()=>({prepare:sql=>wrap(env.DB.prepare(sql)),batch:async statements=>{
  if(!injected&&['epoch-race','pv-race'].includes(mode)){injected=true;const sql=mode==='epoch-race'?'UPDATE students SET credential_epoch=credential_epoch+1':"UPDATE jwt_v110_accounts SET permission_version=permission_version+1";await env.DB.prepare(sql).run();metrics.injectedWrites++;}
  return count(await env.DB.batch(statements.map(s=>s.statement)));
 }})};
 const nativeEnv={...env,DB:db,JWT_V110_RATE_LIMITER:{limit:async()=>({success:mode!=='rate-deny'})},PLATFORM_ENABLED:mode==='platform-off'?'0':'1',JWT_V110_REFRESH:mode==='off'?'0':'1',JWT_V110_BROWSER:'1'};
 if(mode==='no-limiter')delete nativeEnv.JWT_V110_RATE_LIMITER;
 if(mode==='no-signer')nativeEnv.JWT_V110_PRIVATE_KEY_JSON='';
 if(mode==='no-csrf-key')nativeEnv.JWT_V110_CSRF_SECRET='';
 const response=await hifz.fetch(request,nativeEnv,ctx);
 const headers=new Headers(response.headers);for(const [key,value]of Object.entries(metrics))headers.set('X-Lab-'+key,String(value));
 return new Response(response.body,{status:response.status,headers});
}};
