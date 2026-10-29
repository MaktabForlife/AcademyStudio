import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import {random,sha256,challenge,signedHeaders} from '../src/protocol.mjs';
import {newCourse} from '../public/shared/model.mjs';
export async function fixture({academy=false,authorityMode='WEBSITE',academyApiOrigin}={}){
 const secret=random()+random(),entry=new URL('../src/worker.mjs',import.meta.url).pathname;
 const script=(await build({stdin:{contents:`import {handle} from ${JSON.stringify(entry)};export default {fetch(r,e,c){${academy?"if(new URL(r.url).hostname==='academy.test')return e.ACADEMY_TEST.fetch(r);":''}return handle(r,e,c,${academy?'(u,o)=>{if(e.ACADEMY_API_ORIGIN&&new URL(u).origin!==e.ACADEMY_API_ORIGIN)throw Error("Server commands must use the API origin");return e.ACADEMY_TEST.fetch(u,o)}':"async()=>{throw Error('No Academy network call is allowed in this fixture');}"});}};`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers']})).outputFiles[0].text;
 const env={PLATFORM_ENABLED:'1',ENVIRONMENT:'local',WEBSITE_ORIGIN:'https://website.test',ACADEMY_ORIGIN:'https://academy.test',AUTHORITY_MODE:authorityMode,...(academyApiOrigin?{ACADEMY_API_ORIGIN:academyApiOrigin}:{}),ACCOUNT_MAX_AGE_SECONDS:'86400',ADMIN_MAX_AGE_SECONDS:'300',ACADEMY_TO_WEBSITE_SECRET:secret,WEBSITE_TO_ACADEMY_SECRET:random()+random()};
 const source=academy?await (await import('./academy-runtime.mjs')).academyRuntime(env):null;
 const runtime=new Miniflare(convertV4MiniflareOptions({workers:[{name:'platform',modules:true,script,compatibilityDate:'2026-09-28',compatibilityFlags:['nodejs_compat'],bindings:env,d1Databases:{DB:'platform-local'},r2Buckets:{CONTENT:'content-local',MEDIA:'media-local'},...(academy?{serviceBindings:{ACADEMY_TEST:'academy'}}:{})},...(source?.workers||[])]}));
 if(source)try{await source.seed(runtime);}catch(error){await runtime.dispose();source.f.close();throw error;}
 const db=await runtime.getD1Database('DB','platform'),content=await runtime.getR2Bucket('CONTENT','platform'),media=await runtime.getR2Bucket('MEDIA','platform');
 const schema=['0001_platform.sql','0002_parallel_access.sql'].map(name=>readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8')).join('\n');for(const sql of schema.split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 const run=(sql,...args)=>db.prepare(sql).bind(...args).run();
 const deliver=async(event,{stream,version,operationId=crypto.randomUUID()}={})=>{
  stream||=(event.type==='account'?'account:'+event.account.accountId:event.type==='timetable'?'timetable:'+event.offering.id:'handoff:'+event.codeHash);
  if(!version)version=(await db.prepare('SELECT version FROM stream_heads WHERE stream=?').bind(stream).first('version')||0)+1;
  const value={issuedAt:Date.now(),operationId,stream,version,event},signed=await signedHeaders(secret,'/internal/academy/events',value);
  const response=await runtime.dispatchFetch('https://website.test/internal/academy/events',{method:'POST',headers:signed.headers,body:signed.payload});return {response,body:await response.json(),value,signed};
 };
 for(const [accountId,globalAdmin] of [['admin',true],['teacher',false],['learner',false],['former',false],['grant-only',false],['outsider',false]]){
  const result=await deliver({type:'account',account:{accountId,displayName:'Synthetic '+accountId,active:true,admitted:true,epoch:1,verifiedAt:Date.now(),globalAdmin}});if(result.response.status!==200)throw Error(JSON.stringify(result.body));
 }
 const now=Date.now();for(const [offer,kind] of [['course','COURSE'],['tafseer','TAFSEER'],['academy-only','ACADEMY']]){
  const result=await deliver({type:'timetable',offering:{id:offer,kind,title:'Synthetic '+offer,active:true},sessions:[{id:offer+'-session',title:'Live lesson',startsAt:now+60_000,endsAt:now+3660_000,zoomUrl:'https://example.zoom.us/j/123456789',cancelled:false}]});if(result.response.status!==200)throw Error(JSON.stringify(result.body));
 }
 await run("INSERT INTO staff VALUES('teacher','course','TEACHER',0)");
 await run("INSERT INTO participation VALUES('learner','course',1,1,1,'')");await run("INSERT INTO participation VALUES('former','course',0,0,1,'')");
 await run("INSERT INTO participation VALUES('former','tafseer',0,0,0,'new-cohort')");await run("INSERT INTO paid_months VALUES('former','tafseer','2024-01','historic-cohort','Original purchase')");
 const doc=newCourse();doc.name='Synthetic whole Course';doc.pages.assessments=false;const key='websites/site-course/versions/seed.json';await content.put(key,JSON.stringify(doc));
 await run("INSERT INTO websites VALUES('site-course','course','Whole Course',NULL,?,?,0,1,NULL)",key,key);const surah=structuredClone(doc);surah.name='Synthetic Surah';const skey='websites/site-surah/versions/seed.json';await content.put(skey,JSON.stringify(surah));
 await run("INSERT INTO websites VALUES('site-surah','tafseer','Historical Surah','2024-01',?,?,0,1,'2024-01-23')",skey,skey);await run("INSERT INTO surah_grants VALUES('grant-only','site-surah','Explicit website only')");
 await content.put('public/home.json',JSON.stringify({revision:0,title:'Umm Abbad Academy',cards:[{offering_id:'course',title:'Whole Course'}],sessions:[],announcements:[]}));
 const request=async(path,{cookie,method='GET',body,headers={}}={})=>{
  const response=await runtime.dispatchFetch('https://website.test'+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method!=='GET'&&method!=='HEAD'?{Origin:env.WEBSITE_ORIGIN}:{}),...(body&&typeof body==='object'&&!ArrayBuffer.isView(body)?{'Content-Type':'application/json'}:{}),...headers},...(body===undefined?{}:{body:typeof body==='object'&&!ArrayBuffer.isView(body)?JSON.stringify(body):body})});
  const result=response.headers.get('Content-Type')?.includes('application/json')?await response.json():new Uint8Array(await response.arrayBuffer());return {response,status:response.status,body:result,reads:Number(response.headers.get('X-Local-D1-Rows-Read')),queries:Number(response.headers.get('X-Local-D1-Queries'))};
 };
 const login=async(accountId='learner')=>{
  const code=random(),verifier=random(),state=random(),event={type:'handoff',codeHash:await sha256(code),accountId,epoch:1,challenge:await challenge(verifier),state,expiresAt:Date.now()+60_000};
  const made=await deliver(event);if(made.response.status!==200)throw Error(JSON.stringify(made.body));const result=await request('/auth/exchange',{method:'POST',body:{code,verifier,state}});if(result.status!==200)throw Error(JSON.stringify(result.body));
  return {cookie:result.response.headers.get('Set-Cookie').split(';')[0],code,verifier,state,result};
 };
 return {runtime,db,content,media,env,doc,run,deliver,request,login,source,async close(){await runtime.dispose();source?.f.close();}};
}
