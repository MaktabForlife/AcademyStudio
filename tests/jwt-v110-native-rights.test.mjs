import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT,base64url} from 'jose';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions,compatibilityDate,runtimeEvidence} from './jwt-v110-runtime.mjs';
import {fixture} from './fixture.mjs';
import {Store} from '../src/database.mjs';
import {websiteAccess} from '../src/content.mjs';
import {mediaGate} from '../src/media.mjs';
import {playlistEntitlementSQL} from '../src/mou-playlists.mjs';
import {createNativeAccessEngine,projectStudioRights,projectAcademyRights,validateNativeRights,packNativeRights,unpackNativeRights,MAX_NATIVE_BYTES} from '../src/auth/v110/native-rights.mjs';
import {createAccessEngine,accessCookie,refreshCookie,cookieSizeReport} from '../src/auth/v110/claims.mjs';
import {randomRefresh} from '../src/auth/v110/store.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true','Disposable GitHub runners only.');
const NOW=1793818800;
const origins={academy:'https://ummabbadacademy.app',studio:'https://worshipuponbaseera.ummabbadacademy.app',hifz:'https://mahadarwa-hifz.ummabbadacademy.app'};
const cookieConfig={academyIssuer:origins.academy,academyCookieDomain:'ummabbadacademy.app'};
const evidence={source:'synthetic native rows and unchanged native policy functions',runtime:runtimeEvidence,productionRequests:0,productionRouteImports:0,sourceFactsAreNative:true,nativeAtomicIssuance:'not yet integrated',capacity:[]};
async function reject(p,code){let e;try{await p;}catch(error){e=error;}assert.ok(Boolean(e),'Expected sanitized rejection.');if(code)assert.ok(e.code===code,'Unexpected sanitized error code.');}
const person=(app='studio')=>({sub:'synthetic-account',sid:app==='academy'?'synthetic-parent':'synthetic-'+app,psid:'synthetic-parent',bsid:'synthetic-browser',bv:1,ce:1,pv:1,ue:0,s_iat:NOW,s_exp:NOW+604800});
const emptyStudio=()=>({v:1,app:'studio',globalAdmin:false,participation:[],staff:[],paidMonths:[],websiteMonths:[],surahGrants:[],retainedPlaylists:[]});
const academyState=()=>({account:{global_admin:0,substitute_grants:JSON.stringify([{id:'substitute-1',activityKey:'PROGRAM:one'}])},roles:[{activity_key:'PROGRAM:one',role:'PROGRAM_ADMIN'},{activity_key:'COURSE:one',role:'STUDENT'}],subscriptions:[{activity_key:'COURSE:acquired'}],monthlyMedia:[{activity_key:'PROGRAM:one',lesson_month:'2024-01',revision:2,class_ids_json:'["class-a","class-c"]'},{activity_key:'PROGRAM:one',lesson_month:'2024-03',revision:3,class_ids_json:'["class-c"]'}],monthlyMediaEnabled:true,surahGrants:[{activity_key:'PROGRAM:one',surah_id:'surah-additional',revision:4}],surahGrantsEnabled:true,myLinksAvailable:true});
async function engine(app='studio',options={}){
 const pair=await generateKeyPair('ES256'),pub={...await exportJWK(pair.publicKey),kid:'current'};
 return {pair,pub,api:await createNativeAccessEngine({app,issuer:origins[app],publicKeys:[pub],signingKey:pair.privateKey,signingKid:'current',...options})};
}
test('Academy native projection preserves all authority fields without Studio-owned media grants',async()=>{
 const native=projectAcademyRights(academyState(),{websiteAdmitted:true}),wire=await packNativeRights('academy',native),decoded=await unpackNativeRights('academy',wire);
 assert.deepEqual(decoded,native);assert.equal(decoded.roles.length,2);assert.equal(decoded.subscriptions.length,1);
 assert.deepEqual(decoded.monthlyMedia.map(x=>x[1]),['2024-01','2024-03']);
 assert.ok(!Object.hasOwn(decoded,'retainedPlaylists'));assert.equal(decoded.websiteAdmitted,true);
 const {hasAdminAuthority,actualRole}=await import(new URL('../../Academy/backend/src/academy/d1/workspace-access.js',import.meta.url));
 const original={state:academyState()},restored={state:{account:{global_admin:decoded.globalAdmin},roles:decoded.roles.map(([activity_key,role])=>({activity_key,role}))}};
 for(const scope of ['PROGRAM:one','COURSE:one','PROGRAM:outside'])for(const role of ['PROGRAM_ADMIN','TEACHER','STUDENT']){
  assert.equal(hasAdminAuthority(restored,scope),hasAdminAuthority(original,scope));
  assert.equal(actualRole(restored,scope,role),actualRole(original,scope,role));
 }
 const global=academyState();global.account.global_admin=1;const g=projectAcademyRights(global,{websiteAdmitted:false});
 assert.equal(g.globalAdmin,true);
});
test('strict native schemas reject missing, unknown, duplicate and widened rights',async()=>{
 const valid=emptyStudio();assert.equal(validateNativeRights('studio',valid),true);
 for(const bad of [
  {...valid,globalAdmin:'true'},{...valid,unexpected:true},{...valid,app:'academy'},
  {...valid,staff:[['course','OWNER',1]]},{...valid,participation:[['course',1,1,2,'']]},
  {...valid,paidMonths:[['course','2024-00','a']]},{...valid,paidMonths:[['course','2024-01','a'],['course','2024-01','a']]},
  {...valid,retainedPlaylists:[['playlist','course','2024-01','ALL']]},
  {...valid,surahGrants:['site','site']}
 ])assert.equal(validateNativeRights('studio',bad),false);
 const missing={...valid};delete missing.retainedPlaylists;assert.equal(validateNativeRights('studio',missing),false);
 await reject(packNativeRights('studio',missing),'INVALID_NATIVE_RIGHTS');
 await reject(Promise.resolve().then(()=>projectStudioRights({global_admin:0})),'INCOMPLETE_NATIVE_RIGHTS');
 const a=academyState();a.roles.push({activity_key:'other',role:'GLOBAL_ADMIN'});
 await reject(Promise.resolve().then(()=>projectAcademyRights(a,{websiteAdmitted:true})),'INVALID_NATIVE_RIGHTS');
});
test('signed native tokens are app-bound and signature validation precedes decompression',async()=>{
 const e=await engine(),native=emptyStudio(),issued=await e.api.issue(person(),native,NOW);
 assert.deepEqual((await e.api.verify(issued.token,NOW)).rights,native);
 const other=await engine('academy');await reject(other.api.verify(issued.token,NOW),'INVALID_TOKEN');
 const wrong=await generateKeyPair('ES256');
 const forged=await new SignJWT(issued.claims).setProtectedHeader({alg:'ES256',kid:'current',typ:'uaa-access+jwt'}).sign(wrong.privateKey);
 const Original=globalThis.DecompressionStream;let decompressed=0;
 globalThis.DecompressionStream=class {constructor(){decompressed++;throw Error('An unverified token reached decompression.');}};
 try{await reject(e.api.verify(forged,NOW),'INVALID_TOKEN');}finally{globalThis.DecompressionStream=Original;}
 assert.equal(decompressed,0);
});
test('bounded decoder rejects malformed, wrong-app and expansion-limit inputs',async()=>{
 const valid=await packNativeRights('studio',emptyStudio());
 await reject(unpackNativeRights('academy',valid),'INVALID_PACKED_RIGHTS');
 await reject(unpackNativeRights('studio',{...valid,codec:'unknown'}),'INVALID_PACKED_RIGHTS');
 await reject(unpackNativeRights('studio',{...valid,body:'bad'}),'INVALID_PACKED_RIGHTS');
 const bomb=new TextEncoder().encode('x'.repeat(MAX_NATIVE_BYTES+1));
 const compressed=new Uint8Array(await new Response(new Blob([bomb]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
 await reject(unpackNativeRights('studio',{v:2,app:'studio',codec:'native-zjson-1',body:base64url.encode(compressed)}),'NATIVE_RIGHTS_TOO_LARGE');
});
async function nativeRows(db,account){
 const names=['participation','staff','paid_months','website_months','surah_grants','mou_playlist_retained'];
 const columns=['offering_id,enrolled,live,purchased,cohort','offering_id,role,can_create_account','offering_id,month,cohort','offering_id,month','website_id','playlist_id,offering_id,source_month,kind'];
 const rs=await db.batch([db.prepare('SELECT global_admin FROM accounts WHERE account_id=?').bind(account),...names.map((name,i)=>db.prepare('SELECT '+columns[i]+' FROM '+name+' WHERE account_id=?').bind(account))]);
 return {global_admin:rs[0].results[0].global_admin,...Object.fromEntries(names.map((name,i)=>[name,rs[i+1].results]))};
}
async function restoreRows(db,account,r){
 const pairs=[
  ['participation',['offering_id','enrolled','live','purchased','cohort'],r.participation],
  ['staff',['offering_id','role','can_create_account'],r.staff],
  ['paid_months',['offering_id','month','cohort'],r.paidMonths],
  ['website_months',['offering_id','month'],r.websiteMonths],
  ['surah_grants',['website_id'],r.surahGrants.map(x=>[x])],
  ['mou_playlist_retained',['playlist_id','offering_id','source_month','kind'],r.retainedPlaylists]
 ];
 const statements=pairs.map(([table])=>db.prepare('DELETE FROM '+table+' WHERE account_id=?').bind(account));
 statements.push(db.prepare('UPDATE accounts SET global_admin=? WHERE account_id=?').bind(Number(r.globalAdmin),account));
 for(const [table,columns,rows] of pairs)for(const row of rows){
  const cols=['account_id',...columns,...(table==='surah_grants'?['reason']:[])],values=[account,...row,...(table==='surah_grants'?['Synthetic roundtrip']:[])];
  statements.push(db.prepare('INSERT INTO '+table+'('+cols.join(',')+') VALUES('+cols.map(()=>'?').join(',')+')').bind(...values));
 }
 await db.batch(statements);
}
async function policyMatrix(f,account){
 const actor=await f.db.prepare('SELECT * FROM accounts WHERE account_id=?').bind(account).first(),out={};
 for(const website of ['site-course','site-surah','site-playlist']){
  try{await websiteAccess(new Store({...f.env,DB:f.db}),actor,website);out['website:'+website]='allowed';}catch(e){if(!e.code&&!e.status)throw e;out['website:'+website]=e.code||e.status;}
 }
 for(const media of ['record-course','record-historical','record-other-cohort']){
  try{await mediaGate(new Store({...f.env,DB:f.db}),actor,media);out['media:'+media]='allowed';}catch(e){if(!e.code&&!e.status)throw e;out['media:'+media]=e.code||e.status;}
 }
 for(const paidOnly of [true,false]){
  const clause=playlistEntitlementSQL({paidOnly,month:"'2024-03'"});
  const args=Array(paidOnly?2:3).fill(account);
  const row=await f.db.prepare('SELECT 1 ok FROM mou_playlists p JOIN websites w USING(website_id) WHERE p.playlist_id=? AND w.enabled=1 AND w.published_key IS NOT NULL AND '+clause).bind('retained-playlist',...args).first();
  out[paidOnly?'playlist:recordings':'playlist:text']=Boolean(row);
 }
 return out;
}
test('native database rows roundtrip preserves actual website, cohort recording and retained-playlist policy decisions',async t=>{
 const f=await fixture();t.after(()=>f.close());
 await f.run("INSERT INTO website_months VALUES('grant-only','tafseer','2024-02')");
 const key=(await f.db.prepare("SELECT published_key FROM websites WHERE website_id='site-surah'").first()).published_key;
 await f.run("INSERT INTO websites(website_id,offering_id,title,completion_month,draft_key,published_key,revision,enabled) VALUES('site-playlist','tafseer','Synthetic playlist','2024-03',?,?,0,1)",key,key);
 await f.run("INSERT INTO mou_playlists(playlist_id,offering_id,website_id,created_at) VALUES('retained-playlist','tafseer','site-playlist',?)",NOW*1000);
 await f.run("INSERT INTO mou_playlist_retained VALUES('retained-playlist','tafseer','former','2024-01','PAID')");
 await f.run("INSERT INTO mou_playlist_retained VALUES('retained-playlist','tafseer','grant-only','2024-02','WEBSITE')");
 for(const [id,offer,cohort] of [['record-course','course',''],['record-historical','tafseer','historic-cohort'],['record-other-cohort','tafseer','other-cohort']]){
  await f.run('INSERT INTO objects(asset_id,object_key,mime_type,filename,byte_size,sha256) VALUES(?,?,?,?,?,?)','asset-'+id,'synthetic/'+id,'application/pdf','synthetic.pdf',1,'a'.repeat(64));
  await f.run("INSERT INTO attachments(attachment_id,offering_id,asset_id,lesson_id,lesson_date,cohort,title,audience,published) VALUES(?,?,?,'lesson','2024-01-10',?,'Synthetic recording','RECORDING',1)",id,offer,'asset-'+id,cohort);
 }
 const result={};
 for(const account of ['admin','teacher','learner','former','grant-only','outsider']){
  const native=projectStudioRights(await nativeRows(f.db,account)),before=await policyMatrix(f,account);
  const decoded=await unpackNativeRights('studio',await packNativeRights('studio',native));assert.deepEqual(decoded,native);
  await restoreRows(f.db,account,decoded);const after=await policyMatrix(f,account);assert.deepEqual(after,before);
  result[account]=after;
 }
 assert.equal(result.former['media:record-historical'],'allowed');
 assert.notEqual(result.former['media:record-other-cohort'],'allowed');
 assert.equal(result.former['playlist:recordings'],true);
 assert.equal(result['grant-only']['playlist:text'],true);assert.equal(result['grant-only']['playlist:recordings'],false);
 assert.notEqual(result.outsider['website:site-course'],'allowed');
 await f.run("UPDATE websites SET enabled=0 WHERE website_id='site-surah'");
 assert.notEqual((await policyMatrix(f,'grant-only'))['website:site-surah'],'allowed');
 evidence.nativePolicyRoundtrip={accounts:6,decisionsPerAccount:8,matchingBeforeAfter:48,textDoesNotGrantRecordings:true,historicalCohortRetained:true,currentWithdrawalStillEnforced:true,productionJWTIntegration:false};
});
function nativeAcademySize(scopes,randomIds=false){
 const state=academyState();state.roles=[];state.subscriptions=[];state.monthlyMedia=[];state.surahGrants=[];
 const substitutes=[];
 for(let i=0;i<scopes;i++){
  const scope=randomIds?crypto.randomUUID():'ACADEMY-SCOPE:'+i.toString(16).padStart(8,'0')+'-a111-4b22-8c33-d444eeeeffff';
  state.roles.push({activity_key:scope,role:i%2?'TEACHER':'PROGRAM_ADMIN'});
  state.subscriptions.push({activity_key:scope});
  substitutes.push({id:randomIds?crypto.randomUUID():'assignment-'+i,activityKey:scope});
  for(const month of ['2024-01','2024-03','2024-11'])state.monthlyMedia.push({activity_key:scope,lesson_month:month,revision:1,class_ids_json:JSON.stringify([randomIds?crypto.randomUUID():'class-a',randomIds?crypto.randomUUID():'class-c'])});
  state.surahGrants.push({activity_key:scope,surah_id:randomIds?crypto.randomUUID():'surah-'+i,revision:1});
 }
 state.account.substitute_grants=JSON.stringify(substitutes);
 return projectAcademyRights(state,{websiteAdmitted:true});
}
function nativeStudioSize(scopes,randomIds=false){
 const r=emptyStudio();
 for(let i=0;i<scopes;i++){
  const scope=randomIds?crypto.randomUUID():'COURSE:'+i.toString(16).padStart(8,'0')+'-a111-4b22-8c33-d444eeeeffff';
  r.participation.push([scope,0,0,1,'cohort-2024']);
  r.staff.push([scope,i%2?'TEACHER':'ADMIN',0]);
  for(const m of ['2024-01','2024-03','2024-11'])r.paidMonths.push([scope,m,'cohort-2024']);
  r.websiteMonths.push([scope,'2024-02']);
  r.surahGrants.push(randomIds?crypto.randomUUID():'site-'+i);
  r.retainedPlaylists.push([randomIds?crypto.randomUUID():'playlist-'+i,scope,'2024-01','PAID']);
 }
 return r;
}
test('full native permission capacity profiles include complete cookies and an honest high-entropy failure boundary',async()=>{
 const a=await engine('academy',{maxTokenBytes:150000}),s=await engine('studio',{maxTokenBytes:150000});
 const hPair=await generateKeyPair('ES256'),h=await createAccessEngine({app:'hifz',issuer:origins.hifz,publicKeys:[{...await exportJWK(hPair.publicKey),kid:'current'}],signingKey:hPair.privateKey,signingKid:'current',maxTokenBytes:150000});
 const hifz=await h.issue(person('hifz'),NOW);
 function cookie(app,x){try{return accessCookie(app,x.token,x.claims.exp,NOW,cookieConfig);}catch{return (app==='academy'?'__Secure-uaa_a':app==='studio'?'__Host-uas_a':'__Host-uah_a')+'='+x.token+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=900'+(app==='academy'?'; Domain=ummabbadacademy.app':'');}}
 const reserved=['__Host-uas_csrf='+'x'.repeat(43),'__Secure-uaa_browser_reserved='+'x'.repeat(1200),'__Secure-uaa_ui_reserved='+'x'.repeat(43),'__Host-maktab_web='+'x'.repeat(43)];
 for(const randomIds of [false,true])for(const scopes of [1,16,64,256]){
  const master=await a.api.issue(person('academy'),nativeAcademySize(scopes,randomIds),NOW);
  const native=nativeStudioSize(scopes,randomIds),issued=await s.api.issue(person(),native,NOW);
  assert.deepEqual((await s.api.verify(issued.token,NOW)).rights,native);
  const studioReport=cookieSizeReport([cookie('academy',master),cookie('studio',issued),refreshCookie('studio',randomRefresh(),NOW+604800,NOW)],reserved);
  const hifzReport=cookieSizeReport([cookie('academy',master),cookie('hifz',hifz),refreshCookie('hifz',randomRefresh(),NOW+604800,NOW)],reserved.slice(0,3));
  evidence.capacity.push({scopes,randomIds,rawNativeBytes:new TextEncoder().encode(JSON.stringify(native)).length,academyTokenBytes:master.token.length,studioTokenBytes:issued.token.length,hifzTokenBytes:hifz.token.length,studio:studioReport,hifz:hifzReport,qualification:'complete native entitlement basis; arbitrary synthetic growth, not a verified product/account maximum; browser marker bytes reserved pending contract'});
 }
 assert.ok(evidence.capacity.some(x=>x.studio.fits));
 assert.ok(evidence.capacity.some(x=>!x.studio.fits),'High-entropy over-capacity must remain visible.');
 const production=await engine();await reject(production.api.issue(person(),nativeStudioSize(256,true),NOW),'CLAIMS_TOO_LARGE');
});
test('native codec and JOSE run together inside the selected Worker runtime',async t=>{
 const entry=new URL('../src/auth/v110/native-rights.mjs',import.meta.url).pathname;
 const native=nativeStudioSize(16),code='import {createNativeAccessEngine} from '+JSON.stringify(entry)+';import {generateKeyPair,exportJWK} from "jose";export default {async fetch(){const pair=await generateKeyPair("ES256");const engine=await createNativeAccessEngine({app:"studio",issuer:'+JSON.stringify(origins.studio)+',publicKeys:[{...await exportJWK(pair.publicKey),kid:"current"}],signingKey:pair.privateKey,signingKid:"current"});const native='+JSON.stringify(native)+';const issued=await engine.issue('+JSON.stringify(person())+',native,'+NOW+');const checked=await engine.verify(issued.token,'+NOW+');return Response.json({same:JSON.stringify(checked.rights)===JSON.stringify(native),tokenBytes:issued.token.length});}};';
 const bundled=await build({stdin:{contents:code,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'native-jwt',modules:true,script:bundled.outputFiles[0].text,compatibilityDate,compatibilityFlags:['nodejs_compat']}]}));t.after(()=>mf.dispose());
 const response=await mf.dispatchFetch('https://synthetic.invalid/');assert.equal(response.status,200);assert.equal((await response.json()).same,true);
 evidence.workerNativeCodec={verified:true,compatibilityDate,privateKeysTokensOrRightsReturned:false};
});
test('non-credential native evidence',t=>t.diagnostic('V110_NATIVE_EVIDENCE='+JSON.stringify(evidence)));
