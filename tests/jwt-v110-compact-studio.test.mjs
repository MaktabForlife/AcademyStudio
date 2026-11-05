import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {generateKeyPair,exportJWK} from 'jose';
import {fixture} from './fixture.mjs';
import {applyTargetSchema} from './target-schema.mjs';
import {Miniflare,convertV4MiniflareOptions,compatibilityDate,runtimeEvidence} from './jwt-v110-runtime.mjs';
import {createStudioCompactEngine,createAccountBoundCompactStudioRefresh,authenticateCompactStudio} from '../src/auth/v110/compact-studio.mjs';
import {createAccountBoundStudioRefresh} from '../src/auth/v110/account-bound-issuer.mjs';
import {createNativeCookieEngine} from '../src/auth/v110/native-rights.mjs';
import {createPrototypeStore,randomRefresh,fingerprint} from '../src/auth/v110/store.mjs';
import {cookieSizeReport} from '../src/auth/v110/claims.mjs';
import {Store} from '../src/database.mjs';
import {websiteAccess} from '../src/content.mjs';
import {random,sha256,cookie} from '../src/protocol.mjs';
import {newCourse} from '../public/shared/model.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true','Disposable GitHub runners only.');
const issuer='https://worshipuponbaseera.ummabbadacademy.app';
const evidence={source:'selected compact Studio JWT',runtime:runtimeEvidence,liveImports:0,hostedSQL:0,realBusinessDataWrites:0,completeIntegration:false,materialClaims:false};
async function rejected(p,code){let e;try{await p;}catch(error){e=error;}assert.ok(Boolean(e),'Expected sanitized rejection.');if(code)assert.ok(e.code===code,'Unexpected sanitized rejection code.');}
async function schema(db){const sql=await readFile(new URL('../src/auth/v110/schema.sql',import.meta.url),'utf8');let text='';for(const part of sql.replace(/--[^\n]*/g,'').split(';')){text+=part+';';if(/CREATE TRIGGER/i.test(text)&&!/\sEND;\s*$/.test(text))continue;if(text.trim()!==';')await db.prepare(text).run();text='';}}
function input(now,account='learner'){return {sub:account,sid:'family-'+account,psid:'parent-'+account,bsid:'browser-'+account,bv:1,ce:1,pv:1,ue:0,s_iat:now,s_exp:now+604800};}
async function seedFamily(db,account,raw,now){await db.batch([db.prepare('INSERT INTO jwt_v110_accounts VALUES(?,1,1,1)').bind(account),db.prepare('INSERT INTO jwt_v110_browser_heads VALUES(?,1)').bind('browser-'+account),db.prepare('INSERT INTO jwt_v110_families(family_id,account_id,parent_session_id,browser_id,browser_generation,credential_epoch,permission_version,refresh_fp,original_signed_in_at_s,original_expires_at_s,last_fg_refresh_s,rotated_at_s) VALUES(?,?,?,?,1,1,1,?,?,?,?,?)').bind('family-'+account,account,'parent-'+account,'browser-'+account,await fingerprint('studio',raw),now,now+604800,now,now)]);}
async function setup(){
 const f=await fixture();
 try{await schema(f.db);const now=Math.floor(Date.now()/1000),raw=randomRefresh();await seedFamily(f.db,'learner',raw,now);const pair=await generateKeyPair('ES256'),pub={...await exportJWK(pair.publicKey),kid:'studio-current'},keys={app:'studio',issuer,publicKeys:[pub],signingKey:pair.privateKey,signingKid:pub.kid};return {f,now,raw,keys,engine:await createStudioCompactEngine(keys)};}catch(e){await f.close();throw e;}
}
const access=r=>r.setCookies.find(c=>c.startsWith('__Host-uas_a=')).split(';',1)[0].slice('__Host-uas_a='.length);
const refresh=r=>r.setCookies.find(c=>c.startsWith('__Host-uas_r=')).split(';',1)[0].slice('__Host-uas_r='.length);
async function unchanged(s){const row=await s.f.db.prepare("SELECT refresh_fp,previous_fp,refresh_generation,last_fg_refresh_s FROM jwt_v110_families WHERE family_id='family-learner'").first();assert.ok(row.refresh_fp===await fingerprint('studio',s.raw)&&row.previous_fp===null);assert.equal(row.refresh_generation,0);assert.equal(row.last_fg_refresh_s,s.now);assert.equal((await s.f.db.prepare('SELECT count(*) n FROM jwt_v110_security_audit').first()).n,0);}
function intercept(binding,change,{denyGrants=false}={}){
 return {withSession(mode){const db=binding.withSession(mode);return {batch:statements=>db.batch(statements),prepare(sql){if(denyGrants&&/\b(participation|staff|paid_months|website_months|surah_grants|mou_playlist_retained)\b/i.test(sql))throw Error('A compact refresh attempted a full grant scan.');const p=db.prepare(sql);if(!sql.includes('native_account_id')||!change)return p;return {bind(...args){const bound=p.bind(...args);return {async all(){const result=await bound.all();await change();return result;}};}};}};}};
}
test('compact Studio token carries identity/security only and rejects full-rights or wrong-app input',async t=>{
 const s=await setup();t.after(()=>s.f.close());const r=await s.engine.issue(input(s.now),s.now),claims=await s.engine.verify(r.token,s.now);
 assert.deepEqual(claims.r,{v:1,app:'studio',mode:'identity'});assert.equal(claims.sub,'learner');
 await rejected(s.engine.issue({...input(s.now),r:{surahGrants:['private']}},s.now),'INVALID_COMPACT_INPUT');
 await rejected(s.engine.issue({...input(s.now),rights:{courses:['private']}},s.now),'INVALID_CLAIMS');
 await rejected(createStudioCompactEngine({...s.keys,app:'academy'}),'INVALID_CONFIG');
 const other=await generateKeyPair('ES256'),wrong=await createStudioCompactEngine({...s.keys,publicKeys:[{...await exportJWK(other.publicKey),kid:'studio-current'}],signingKey:other.privateKey});await rejected(wrong.verify(r.token,s.now),'INVALID_TOKEN');
 await rejected(s.engine.verify(r.token,s.now+900),'INVALID_TOKEN');
 const old=await createNativeCookieEngine(s.keys),full=await old.issue(input(s.now),{v:1,app:'studio',globalAdmin:false,participation:[],staff:[],paidMonths:[],websiteMonths:[],surahGrants:[],retainedPlaylists:[]},s.now);
 await rejected(s.engine.verify(full.token,s.now),'INVALID_TOKEN');
 evidence.shape={fullFormatNotAcceptedAsCompact:true,materialListsAbsent:true,fullRightsInputRejected:true,appAndKeyBound:true,accessSeconds:900};
});
test('compact cookie and coexisting parent/refresh sizes fit for normal and maximum supported identity lengths',async t=>{
 const s=await setup();t.after(()=>s.f.close());const pair=await generateKeyPair('ES256'),pub={...await exportJWK(pair.publicKey),kid:'academy-current'},a=await createNativeCookieEngine({app:'academy',issuer:'https://ummabbadacademy.app',academyCookieDomain:'ummabbadacademy.app',publicKeys:[pub],signingKey:pair.privateKey,signingKid:pub.kid});
 const rows=[];
 for(const length of [36,180]){
  const make=()=>{let id=crypto.randomUUID();while(id.length<length)id+='-'+crypto.randomUUID();return id.slice(0,length);},claims={...input(s.now),sub:make(),sid:make(),psid:make(),bsid:make()},issued=await s.engine.issue(claims,s.now);
  for(const scopes of [0,16]){
   const ids=Array.from({length:scopes},()=>crypto.randomUUID()),rights={v:1,app:'academy',globalAdmin:false,roles:ids.map(x=>['PROGRAM:'+x,'STUDENT']),subscriptions:ids.map(x=>'PROGRAM:'+x),substituteGrants:[],monthlyMedia:[],monthlyMediaEnabled:false,surahGrants:[],surahGrantsEnabled:false,myLinksAvailable:true,websiteAdmitted:true};
   const parent=await a.issue({...claims,sid:claims.psid},rights,s.now),rCookie=s.engine.refreshCookie(s.raw,claims.s_exp,s.now),size=cookieSizeReport([parent.setCookie,issued.setCookie,rCookie]);
   assert.ok(size.fits&&size.cookieHeaderBytes+1024<=8192);
   rows.push({identityLength:length,parentOwnProgrammeScopes:scopes,compactTokenBytes:Buffer.byteLength(issued.token),compactSetCookieBytes:Buffer.byteLength(issued.setCookie),parentSetCookieBytes:Buffer.byteLength(parent.setCookie),refreshSetCookieBytes:Buffer.byteLength(rCookie),combinedKnownCookieHeaderBytes:size.cookieHeaderBytes,reservedOtherCookieBytes:1024,combinedWithReserveBytes:size.cookieHeaderBytes+1024});
  }
 }
 evidence.sizes={rows,tokenBudget:3600,setCookieBudget:3800,requestHeaderBudget:8192,parentCapacityStillIndependent:true,browserAcceptance:'not proven by byte calculation'};
});
test('compact refresh reads no material lists and stays fixed when the same user has 2000 additional Course rows',async t=>{
 const s=await setup();t.after(()=>s.f.close());const db=intercept(s.f.db,null,{denyGrants:true}),api=await createAccountBoundCompactStudioRefresh({binding:db,clock:()=>s.now,...s.keys}),before=await api.refreshAndIssue(s.raw,{foreground:false});
 const ids=JSON.stringify(Array.from({length:2000},(_,i)=>({id:crypto.randomUUID(),model:i%2?'FREE':'PAID',paid:i%2?0:1})));
 await s.f.db.batch([s.f.db.prepare("INSERT INTO offerings SELECT json_extract(value,'$.id'),'COURSE','Synthetic',1,0 FROM json_each(?)").bind(ids),s.f.db.prepare("INSERT INTO course_access_models(offering_id,access_model) SELECT json_extract(value,'$.id'),json_extract(value,'$.model') FROM json_each(?)").bind(ids),s.f.db.prepare("INSERT INTO participation SELECT 'learner',json_extract(value,'$.id'),1,0,json_extract(value,'$.paid'),'' FROM json_each(?)").bind(ids)]);
 const after=await api.refreshAndIssue(refresh(before),{foreground:false});
 assert.equal(after.kind,'rotated');assert.equal(Buffer.byteLength(access(after)),Buffer.byteLength(access(before)));
 assert.ok(after.metrics.identityRead.rowsRead<=before.metrics.identityRead.rowsRead+4);assert.equal(after.metrics.identityRead.statements,1);assert.equal(after.metrics.identityRead.rowsWritten,0);
 assert.ok(!JSON.stringify(after).includes(access(after))&&!JSON.stringify(after).includes(refresh(after)));
 evidence.grantGrowth={additionalSamePersonCourseRows:2000,paid:1000,free:1000,tokenByteIncrease:0,before:before.metrics,after:after.metrics,noGrantExportOrScan:true,currentResourceReadsRemainRequired:true};
});
test('matched compact versus retained full-rights refresh records issuance costs without a whole-flow savings claim',async()=>{
 const full=await setup(),compact=await setup();
 try{const a=await(await createAccountBoundStudioRefresh({binding:full.f.db,clock:()=>full.now,...full.keys})).refreshAndIssue(full.raw,{foreground:false}),b=await(await createAccountBoundCompactStudioRefresh({binding:compact.f.db,clock:()=>compact.now,...compact.keys})).refreshAndIssue(compact.raw,{foreground:false});
 assert.equal(a.kind,'rotated');assert.equal(b.kind,'rotated');assert.equal(b.metrics.identityRead.statements,1);assert.equal(a.metrics.nativeSnapshot.statements,7);
 evidence.refreshComparison={syntheticMatchedFixtures:true,retainedFullRights:a.metrics,compact:b.metrics,scope:'issuance only; native deployed request comparisons recorded separately',noProductionCPUClaim:true};
 }finally{await full.f.close();await compact.f.close();}
});
test('compact issuance re-prepares on policy-version change and rejects cancellation without losing the old secret',async()=>{
 for(const cancel of [false,true]){
  const s=await setup();
  try{let done=false;const db=intercept(s.f.db,async()=>{if(!done){done=true;await s.f.db.prepare(cancel?"UPDATE jwt_v110_accounts SET credential_epoch=2 WHERE account_id='learner'":"UPDATE jwt_v110_accounts SET permission_version=2 WHERE account_id='learner'").run();}});
   const api=await createAccountBoundCompactStudioRefresh({binding:db,clock:()=>s.now,...s.keys});
   if(cancel){await rejected(api.refreshAndIssue(s.raw),'SESSION_ENDED');await unchanged(s);await rejected(createPrototypeStore(s.f.db,{app:'studio'}).refresh(s.raw,{now:s.now}),'SESSION_ENDED');}
   else {const r=await api.refreshAndIssue(s.raw,{foreground:false});assert.equal((await s.engine.verify(access(r),s.now)).pv,2);assert.equal((await s.f.db.prepare("SELECT refresh_generation,last_fg_refresh_s FROM jwt_v110_families WHERE family_id='family-learner'").first()).refresh_generation,1);}
  }finally{await s.f.close();}
 }
 evidence.versions={boundedReprepare:true,cancellationReleasesNoAccess:true,grantFanoutImplemented:false,securityVersionHookIntegration:'pending'};
});
test('controlled signing/size failure before compact CAS preserves fingerprint, clock and audit',async()=>{
 for(const kind of ['size','signer']){
  const s=await setup();
  try{const api=await createAccountBoundCompactStudioRefresh({binding:s.f.db,clock:()=>s.now,...s.keys,...(kind==='size'?{maxTokenBytes:1}:{signingKey:undefined,signingKid:undefined})});
   await rejected(api.refreshAndIssue(s.raw,{foreground:true}),kind==='size'?'CLAIMS_TOO_LARGE':'SIGNER_UNAVAILABLE');await unchanged(s);
   assert.equal((await(await createAccountBoundCompactStudioRefresh({binding:s.f.db,clock:()=>s.now,...s.keys})).refreshAndIssue(s.raw)).kind,'rotated');
  }finally{await s.f.close();}
 }
});
test('compact identity keeps independent inactivity and original deadline without inventing fresh Admin authority',async t=>{
 const s=await setup();t.after(()=>s.f.close());const r=await(await createAccountBoundCompactStudioRefresh({binding:s.f.db,clock:()=>s.now,...s.keys})).refreshAndIssue(s.raw,{foreground:false});
 await rejected((await createAccountBoundCompactStudioRefresh({binding:s.f.db,clock:()=>s.now+5400,...s.keys})).refreshAndIssue(refresh(r),{foreground:true}),'PIN_REQUIRED');
 const last=await s.engine.issue(input(s.now),s.now+604799);assert.equal(last.claims.exp,s.now+604800);await rejected(s.engine.verify(last.token,s.now+604800),'INVALID_TOKEN');
 await s.f.db.prepare("UPDATE accounts SET global_admin=1,verified_at=? WHERE account_id='learner'").bind((s.now-13*3600)*1000).run();
 const read=await authenticateCompactStudio({engine:s.engine,binding:s.f.db,token:access(r),now:s.now});
 assert.equal(read.actor.verified_at,(s.now-13*3600)*1000);
 await rejected(new Store({...s.f.env,DB:s.f.db,ADMIN_MAX_AGE_SECONDS:'60'}).scope(read.actor,'course',{admin:true,readOnly:false}),'ADMIN_STATUS_EXPIRED');
 evidence.timing={localIdleEqualitySeconds:5400,absoluteOriginalDeadlineSeconds:604800,ordinaryLegacyVerifiedAtAgeNotACompactCheckpoint:true,staleNativeAdminStillRejected:true,SourceAgePolicyIntegration:'separate unresolved gate'};
});
test('matched native and compact GETs execute the same private website route and current Course rules in one Worker',async t=>{
 const now=Math.floor(Date.now()/1000),pair=await generateKeyPair('ES256',{extractable:true}),pub={...await exportJWK(pair.publicKey),kid:'studio-current'},engine=await createStudioCompactEngine({app:'studio',issuer,publicKeys:[pub],signingKey:pair.privateKey,signingKid:pub.kid});
 const entry=new URL('./jwt-v110-compact-worker.mjs',import.meta.url).pathname,workerPath=new URL('../src/worker.mjs',import.meta.url).pathname;
 const bundle=await build({entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers'],plugins:[{name:'synthetic-compact-actor-bridge',setup(b){b.onLoad({filter:/worker\.mjs$/},async args=>{
  if(args.path!==workerPath)return null;let code=await readFile(args.path,'utf8');
  const old="const token=parseCookie(request);if(!token)throw fail('Sign in to Academy to continue.',401,'SIGN_IN_REQUIRED');const actor=checkedActor||await store.actor(await sha256(token),Date.now(),{allowExpiredStatus:path==='/auth/refresh'||path==='/auth/access'||path==='/auth/logout'});";
  assert.ok(code.includes(old),'The exact current auth boundary must be reviewed before adapting this fixture.');
  code=code.replace('async function route(','export async function route(').replace(old,"let actor=checkedActor;if(!actor){const token=parseCookie(request);if(!token)throw fail('Sign in to Academy to continue.',401,'SIGN_IN_REQUIRED');actor=await store.actor(await sha256(token),Date.now(),{allowExpiredStatus:path==='/auth/refresh'||path==='/auth/access'||path==='/auth/logout'});}");
  return {contents:code,loader:'js',resolveDir:new URL('../src/',import.meta.url).pathname};
 });}}]});
 const testRefresh=randomRefresh();
 const mainConfig={name:'compact-native-route-lab',modules:true,script:bundle.outputFiles[0].text,compatibilityDate,compatibilityFlags:['nodejs_compat'],bindings:{PLATFORM_ENABLED:'1',ENVIRONMENT:'local',AUTHORITY_MODE:'WEBSITE',WEBSITE_ORIGIN:'https://website.test',ACADEMY_ORIGIN:'https://academy.test',ACCOUNT_MAX_AGE_SECONDS:'43200',ADMIN_MAX_AGE_SECONDS:'60',STUDIO_ISSUER:issuer,STUDIO_PUBLIC:pub,STUDIO_PRIVATE:await exportJWK(pair.privateKey),TEST_NOW:now},d1Databases:{DB:'matched-compact-lab'},r2Buckets:{CONTENT:'matched-compact-content',MEDIA:'matched-compact-media'}};
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[mainConfig,{...mainConfig,name:'compact-disabled-lab',bindings:{...mainConfig.bindings,PLATFORM_ENABLED:'0'}},{...mainConfig,name:'compact-misconfigured-lab',r2Buckets:{}}]}));t.after(()=>mf.dispose());
 const db=await mf.getD1Database('DB','compact-native-route-lab'),content=await mf.getR2Bucket('CONTENT','compact-native-route-lab');await applyTargetSchema(db);await schema(db);
 const keys={},compactCookies={};
 for(const account of ['learner','outsider']){
  const raw=random();keys[account]=cookie(raw,604800).split(';',1)[0];
  await db.batch([db.prepare('INSERT INTO accounts VALUES(?,?,1,1,1,?,0)').bind(account,'Synthetic '+account,now*1000),db.prepare('INSERT INTO sessions VALUES(?,?,1,?,0,NULL)').bind(await sha256(raw),account,(now+604800)*1000)]);
  await seedFamily(db,account,account==='learner'?testRefresh:randomRefresh(),now);compactCookies[account]=(await engine.issue(input(now,account),now)).setCookie.split(';',1)[0];
 }
 await db.batch([db.prepare("INSERT INTO offerings VALUES('course','COURSE','Synthetic',1,0)"),db.prepare("INSERT INTO course_access_models(offering_id,access_model) VALUES('course','PAID')"),db.prepare("INSERT INTO participation VALUES('learner','course',1,0,1,'')"),db.prepare("INSERT INTO websites VALUES('site-course','course','Synthetic',NULL,'seed.json','seed.json',0,1,NULL)")]);
 await content.put('seed.json',JSON.stringify(newCourse()));
 const renewal=await mf.dispatchFetch('https://website.test/compact-refresh',{method:'POST',headers:{Origin:'https://website.test',Cookie:'__Host-uas_r='+testRefresh}}),renewed=await renewal.json();assert.equal(renewal.status,200);assert.equal(renewed.kind,'rotated');assert.equal(renewal.headers.getSetCookie().length,2);assert.ok(renewal.headers.getSetCookie().every(x=>!x.includes('Domain=')));assert.equal(renewal.headers.get('Cache-Control'),'private, no-store');assert.equal(renewal.headers.get('X-Content-Type-Options'),'nosniff');assert.deepEqual(Object.keys(renewed).sort(),['kind','metrics']);
 evidence.workerRefresh={topLevelWorkerRequests:1,SetCookieHeaders:2,AcademyRequests:JSON.parse(renewal.headers.get('X-Lab-IO')).academyRequests,D1:JSON.parse(renewal.headers.get('X-Lab-D1')),metrics:renewed.metrics,bodyCredentialAllowlist:true};assert.equal(evidence.workerRefresh.AcademyRequests,0);
 const samples=[];
 async function request(mode,account,expected,phase){
  const response=await mf.dispatchFetch('https://website.test/'+mode+'/api/websites/site-course',{headers:{Cookie:mode==='native'?keys[account]:compactCookies[account]}});
  const body=await response.json();assert.equal(response.status,expected,'Matched resource decision changed.');
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(response.headers.getSetCookie().length,0);
  samples.push({phase,mode,account,HTTPStatus:response.status,topLevelWorkerRequests:1,D1:JSON.parse(response.headers.get('X-Lab-D1')),IO:JSON.parse(response.headers.get('X-Lab-IO')),harnessWallMilliseconds:Number(response.headers.get('X-Lab-Wall-Ms'))});
  assert.equal(samples.at(-1).IO.academyRequests,0);assert.equal(samples.at(-1).D1.rowsWritten,0);return body;
 }
 const denials=[];
 async function denial(fetcher,url,options,expected,label,{readAllowed=false}={}){
  const r=await fetcher(url,options),body=await r.json();
  assert.equal(r.status,expected,'Representative adapter did not reject safely.');assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.equal(r.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(r.headers.getSetCookie().length,0);
  assert.ok(Object.keys(body).every(k=>['code','kind','metrics'].includes(k)),'Error body must be allowlisted.');
  const db=JSON.parse(r.headers.get('X-Lab-D1')),io=JSON.parse(r.headers.get('X-Lab-IO'));assert.equal(db.rowsWritten,0);assert.equal(io.r2Get,0);assert.equal(io.academyRequests,0);if(!readAllowed)assert.equal(db.roundTrips,0);
  denials.push({label,HTTPStatus:r.status,privateNoStore:true,cookiesReleased:0,D1:db,IO:io});
 }
 const send=(url,options)=>mf.dispatchFetch(url,options),path='https://website.test/compact/api/websites/site-course';
 await denial(send,path,{},400,'missing-access-cookie');
 await denial(send,path,{headers:{Cookie:'__Host-uas_a=bad'}},401,'invalid-access-token');
 await denial(send,path,{headers:{Cookie:compactCookies.learner+'; '+compactCookies.learner}},400,'duplicate-access-cookie');
 await denial(send,path,{headers:{Cookie:'__Host-uas_r='+testRefresh}},400,'required-access-name-absent-with-only-refresh-name');
 await denial(send,path,{headers:{Cookie:'__Host-uas_a='+testRefresh}},401,'raw-refresh-value-under-access-name');
 await denial(send,'https://website.test/compact-refresh',{method:'POST',headers:{Origin:'https://website.test',Cookie:'__Host-uas_r='+compactCookies.learner.slice('__Host-uas_a='.length)}},400,'access-JWT-value-under-refresh-name');
 await denial(send,'https://website.test/compact-refresh',{method:'POST',headers:{Origin:'https://website.test',Cookie:'__Host-uas_r=not-a-refresh'}},400,'malformed-value-under-refresh-name');
 await denial(send,'https://unexpected.test/compact/api/websites/site-course',{headers:{Cookie:compactCookies.learner}},403,'unconfigured-host');
 await denial(send,path,{method:'PATCH',headers:{Cookie:compactCookies.learner}},405,'compact-mutation-not-integrated');
 await denial(send,'https://website.test/compact-refresh',{method:'POST'},403,'refresh-needs-configured-Origin');
 await denial(send,'https://website.test/compact-refresh',{method:'POST',headers:{Origin:'https://website.test'}},400,'missing-refresh-cookie');
 await denial(send,'https://website.test/compact-refresh',{method:'POST',headers:{Origin:'https://website.test',Cookie:'__Host-uas_a=bad'}},400,'required-refresh-name-absent-with-only-access-name');
 await denial(send,'https://website.test/compact-refresh',{method:'POST',headers:{Origin:'https://website.test',Cookie:'__Host-uas_r='+testRefresh+'; __Host-uas_r='+testRefresh}},400,'duplicate-refresh-cookie');
 await denial(send,'https://website.test/compact-refresh',{method:'POST',headers:{Origin:'https://website.test',Cookie:'__Host-uas_r='+testRefresh}},409,'previous-refresh-returns-in-progress',{readAllowed:true});
 const disabled=await mf.getWorker('compact-disabled-lab');await denial((url,options)=>disabled.fetch(url,options),path,{headers:{Cookie:compactCookies.learner}},503,'platform-disabled');
 const misconfigured=await mf.getWorker('compact-misconfigured-lab');await denial((url,options)=>misconfigured.fetch(url,options),path,{headers:{Cookie:compactCookies.learner}},503,'unexpected-configuration-error');
 evidence.HTTPBoundaries={denials,refreshUsesRequestCookie:true,refreshExactOriginRequired:true,successErrorsAndDenialsPrivateNoStore:true,unknownErrorsAllowlisted:true,noPlaintextCredentialsInErrorBodies:true,sessionBoundCSRFAndQualifyingForegroundAdmission:'not implemented by this background-refresh lab',allProductionEntryHostAliasParity:'not claimed'};
 const original=await request('native','learner',200,'paid-granted'),current=await request('compact','learner',200,'paid-granted');assert.deepEqual(current,original);
 await request('native','outsider',403,'paid-outsider');await request('compact','outsider',403,'paid-outsider');
 await db.prepare("UPDATE participation SET purchased=0 WHERE account_id='learner' AND offering_id='course'").run();
 await request('native','learner',403,'purchase-revoked');await request('compact','learner',403,'purchase-revoked');
 await db.prepare("UPDATE course_access_models SET access_model='FREE' WHERE offering_id='course'").run();
 const freeNative=await request('native','learner',200,'free-no-purchase'),freeCompact=await request('compact','learner',200,'free-no-purchase');assert.deepEqual(freeCompact,freeNative);
 await db.prepare("UPDATE websites SET enabled=0 WHERE website_id='site-course'").run();
 await request('native','learner',404,'withdrawn');await request('compact','learner',404,'withdrawn');
 await db.prepare("INSERT INTO jwt_v110_parent_tombstones VALUES('parent-learner',?)").bind(now+604800).run();
 await request('compact','learner',401,'parent-cancelled');
 evidence.matchedRoutes={samples,sameNativeBusinessRouteAndPublishedR2Body:true,unchangedJWTDuringPurchaseRevokeAndFreePolicyChange:true,accountIsolation:true,noGrantVersionFanoutForNativeDecision:true,ownershipMode:'WEBSITE only',adapter:'test-only exact source auth bridge; no real handler/route imported it in production',ordinaryCurrentAccountAndResourceQueriesExpected:true,rangeWritesSourceModeBrowserCSRFAndBilledCPU:'not proven',preflight:'GET dispatches only; not browser preflight evidence',outboxAndRefreshWrites:'not part of these GET samples'};
 t.diagnostic('V110_HTTP_BOUNDARIES_EVIDENCE='+JSON.stringify({runtime:runtimeEvidence,HTTPBoundaries:evidence.HTTPBoundaries,workerRefresh:evidence.workerRefresh,matchedRoutes:evidence.matchedRoutes}));
});
test('compact synthetic evidence',t=>t.diagnostic('V110_COMPACT_STUDIO_EVIDENCE='+JSON.stringify(evidence)));
