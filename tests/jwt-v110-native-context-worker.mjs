// Synthetic GitHub-only wrapper around the UNMODIFIED native fetch entrypoints.
// It supplies isolated D1 identities/keys and counts SELECTs; no actor shortcut,
// production binding, hosted SQL or mutation route is used.
import academy from '@academy/backend/src/academy-split-runtime.js';
import studio from '../src/worker.mjs';
import hifz from '@hifz/worker/src/index.js';
const origins={academy:'https://ummabbadacademy.app',studio:'https://worshipuponbaseera.ummabbadacademy.app',hifz:'https://mahadarwa-hifz.ummabbadacademy.app'};
export default {async fetch(request,env,ctx){
 const url=new URL(request.url),app=Object.keys(origins).find(app=>origins[app]===url.origin)||'studio',queries=[];
 const original=env[app.toUpperCase()+'_DB'];
 const binding={withSession(mode){
  queries.push({session:mode});const db=original.withSession(mode);
  return {prepare(sql){
   if(!/^\s*SELECT\b/i.test(sql))throw Error('Synthetic context attempted a write.');
   return {bind(...args){const statement=db.prepare(sql).bind(...args);return {async all(){const result=await statement.all();queries.push({statements:1,read:result.meta?.rows_read||0,written:result.meta?.rows_written||0});return result;}};}};
  }};
 }};
 const local={...env,ACADEMY_D1_MODE:'ACTIVE',ACADEMY_LIBRARY_MODE:'PUBLIC_ONLY',ACADEMY_DEPLOYMENT_KIND:'SPLIT_PREVIEW',DB:binding,ACADEMY_DB:binding,PLATFORM_ENABLED:url.searchParams.get('lab')==='platform-off'?'0':'1',JWT_V110_BROWSER:url.searchParams.get('lab')==='off'?'0':'1',JWT_V110_REQUEST_ORIGIN:origins[app],JWT_V110_PUBLIC_KEYS_JSON:url.searchParams.get('lab')==='keys-missing'?'':env[app.toUpperCase()+'_KEYS'],ALLOWED_ORIGINS:Object.values(origins).join(','),ENVIRONMENT:'local'};
 const response=await ({academy,studio,hifz}[app]).fetch(request,local,ctx),headers=new Headers(response.headers);
 headers.set('X-Lab-Context-Statements',String(queries.reduce((n,q)=>n+(q.statements||0),0)));
 headers.set('X-Lab-Context-Rows-Read',String(queries.reduce((n,q)=>n+(q.read||0),0)));
 headers.set('X-Lab-Context-Rows-Written',String(queries.reduce((n,q)=>n+(q.written||0),0)));
 headers.set('X-Lab-Context-Primary',String(queries.filter(q=>q.session==='first-primary').length));
 return new Response(response.body,{status:response.status,headers});
}};
