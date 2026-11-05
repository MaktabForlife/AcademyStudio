import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {generateKeyPair,exportJWK} from 'jose';
import {createConfiguredAccessEngine,cookieNames} from '../src/auth/v110/claims.mjs';
import {createNativeCookieEngine} from '../src/auth/v110/native-rights.mjs';
import {createStudioCompactEngine} from '../src/auth/v110/compact-studio.mjs';
import {randomRefresh,fingerprint} from '../src/auth/v110/store.mjs';
import {Miniflare,convertV4MiniflareOptions,compatibilityDate,runtimeEvidence} from './jwt-v110-runtime.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true','Disposable GitHub runners only.');
const apps=['academy','studio','hifz'],origins={academy:'https://ummabbadacademy.app',studio:'https://worshipuponbaseera.ummabbadacademy.app',hifz:'https://mahadarwa-hifz.ummabbadacademy.app'};
const nativeID=app=>app==='hifz'?'hifz-permanent-student':'academy-account';
const evidence={runtime:runtimeEvidence,source:'actual three native fetch entrypoints; new context route only',hostedSQL:0,liveDBChanges:0,productionRequests:0,issuerOrRefreshImplemented:false,cases:[]};
let shared;
after(async()=>{await shared?.close();});
async function apply(db){
 const sql=await readFile(new URL('./fixtures/jwt-v110-auth-only.sql',import.meta.url),'utf8');let text='';
 for(const part of sql.replace(/--[^\n]*/g,'').split(';')){text+=part+';';if(/CREATE TRIGGER/i.test(text)&&!/\sEND;\s*$/.test(text))continue;if(text.trim()!==';')await db.prepare(text).run();text='';}
}
async function fixture(){
 const academy=process.env.ACADEMY_SOURCE,hifz=process.env.HIFZ_SOURCE;assert.ok(academy&&hifz,'Pinned native checkouts required.');
 const bundle=await build({entryPoints:[new URL('./jwt-v110-native-context-worker.mjs',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers','node:*'],alias:{'@academy':resolve(academy),'@hifz':resolve(hifz)}});
 const now=Math.floor(Date.now()/1000),keys={},engines={},tokens={},expiredTokens={},inputs={};
 for(const app of apps){
  const pair=await generateKeyPair('ES256'),pub={...await exportJWK(pair.publicKey),kid:app+'-feature-current'},config={app,issuer:origins[app],publicKeys:[pub],signingKey:pair.privateKey,signingKid:pub.kid,...(app==='academy'?{academyCookieDomain:'ummabbadacademy.app'}:{})};
  keys[app]=[pub];engines[app]=app==='academy'?await createNativeCookieEngine(config):app==='studio'?await createStudioCompactEngine(config):await createConfiguredAccessEngine(config);
  const input={sub:nativeID(app),sid:app==='academy'?'master-family':app+'-family',psid:'master-family',bsid:'shared-browser',bv:1,ce:1,pv:1,ue:0,s_iat:now-7200,s_exp:now-7200+604800};
  inputs[app]=input;
  const rights={v:1,app:'academy',globalAdmin:false,roles:[],subscriptions:[],substituteGrants:[],monthlyMedia:[],monthlyMediaEnabled:false,surahGrants:[],surahGrantsEnabled:false,myLinksAvailable:false,websiteAdmitted:true};
  const issued=app==='academy'?await engines[app].issue(input,rights,now):await engines[app].issue(input,now);
  tokens[app]=issued.token;
  const expired=app==='academy'?await engines[app].issue(input,rights,now-901):await engines[app].issue(input,now-901);expiredTokens[app]=expired.token;
 }
 const mf=new Miniflare(convertV4MiniflareOptions({name:'native-context-lab',modules:true,script:bundle.outputFiles[0].text,compatibilityDate,compatibilityFlags:['nodejs_compat'],bindings:Object.fromEntries(apps.map(app=>[app.toUpperCase()+'_KEYS',JSON.stringify(keys[app])])),d1Databases:Object.fromEntries(apps.map(app=>[app.toUpperCase()+'_DB','context-'+app]))}));
 const dbs={};
 try{
  for(const app of apps){
   const db=await mf.getD1Database(app.toUpperCase()+'_DB');dbs[app]=db;await apply(db);
   if(app==='academy'){
    await db.prepare('CREATE TABLE accounts(account_id TEXT PRIMARY KEY,active INTEGER)').run();
    await db.prepare('CREATE TABLE account_credentials(account_id TEXT PRIMARY KEY,pin_setup INTEGER,pin_hash TEXT,credential_epoch INTEGER)').run();
    await db.prepare('CREATE TABLE account_sessions(session_id TEXT PRIMARY KEY,account_id TEXT,credential_epoch INTEGER,expires_at TEXT,revoked_at TEXT)').run();
    await db.batch([db.prepare('INSERT INTO accounts VALUES(?,1)').bind(nativeID(app)),db.prepare('INSERT INTO account_credentials VALUES(?,1,?,1)').bind(nativeID(app),'synthetic-non-credential-marker'),db.prepare('INSERT INTO account_sessions VALUES(?,?,1,?,NULL)').bind(inputs[app].sid,nativeID(app),new Date(inputs[app].s_exp*1000).toISOString())]);
   }else if(app==='studio'){
    await db.prepare('CREATE TABLE accounts(account_id TEXT PRIMARY KEY,active INTEGER,admitted INTEGER,epoch INTEGER)').run();
    await db.prepare('INSERT INTO accounts VALUES(?,1,1,1)').bind(nativeID(app)).run();
   }else{
    await db.prepare('CREATE TABLE students(id TEXT PRIMARY KEY,active INTEGER,credential_epoch INTEGER,role TEXT)').run();
    await db.prepare('INSERT INTO students VALUES(?,1,1,?)').bind(nativeID(app),'student').run();
   }
   const input=inputs[app];
   await db.batch([db.prepare('INSERT INTO jwt_v110_accounts VALUES(?,1,1,1)').bind(input.sub),db.prepare('INSERT INTO jwt_v110_browser_heads VALUES(?,1)').bind(input.bsid),db.prepare('INSERT INTO jwt_v110_families(family_id,account_id,parent_session_id,browser_id,browser_generation,credential_epoch,permission_version,refresh_fp,original_signed_in_at_s,original_expires_at_s,last_fg_refresh_s,rotated_at_s) VALUES(?,?,?,?,1,1,1,?,?,?,?,?)').bind(input.sid,input.sub,input.psid,input.bsid,await fingerprint(app,randomRefresh()),input.s_iat,input.s_exp,now-1,now-1)]);
  }
  return {mf,dbs,now,tokens,expiredTokens,inputs,engines,async close(){await mf.dispose();}};
 }catch(error){await mf.dispose();throw error;}
}
const request=(s,app,{cookie=s.tokens[app],name=cookieNames[app].access,method='GET',origin,query=''}={})=>s.mf.dispatchFetch(origins[app]+'/auth/v110/context'+query,{method,headers:{Cookie:name+'='+cookie,...(origin?{Origin:origin}:{})}});
async function check(response,status,{statements}={}){
 assert.equal(response.status,status,'Unexpected sanitized context status.');
 assert.match(response.headers.get('Cache-Control')||'',/no-store/);assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
 assert.equal(response.headers.getSetCookie().length,0);
 assert.equal(Number(response.headers.get('X-Lab-Context-Rows-Written')),0);
 if(statements!==undefined)assert.equal(Number(response.headers.get('X-Lab-Context-Statements')),statements);
 const body=await response.json();assert.ok(!JSON.stringify(body).includes('synthetic-non-credential-marker'));
 return body;
}
test('real native context routes verify intended cookies and current local/native bindings with no writes or Academy hop',async t=>{
 shared=await fixture();
 for(const app of apps){
  const response=await request(shared,app),body=await check(response,200,{statements:1});
  assert.deepEqual(Object.keys(body).sort(),['initialViews','session']);assert.deepEqual(body.initialViews,[]);
  assert.equal(body.session.app,app);assert.equal(body.session.accountId,nativeID(app));assert.equal(body.session.parentId,'master-family');
  assert.equal(body.session.originalExpiresAtMs,shared.inputs[app].s_exp*1000);assert.equal(body.session.lastForegroundRefreshMs,(shared.now-1)*1000);
  assert.equal(Number(response.headers.get('X-Lab-Context-Primary')),1);
  evidence.cases.push({app,status:200,statements:1,rowsRead:Number(response.headers.get('X-Lab-Context-Rows-Read')),rowsWritten:0,remoteMasterCalls:0});
 }
});
test('all three context entrypoints reject absent/wrong-purpose/foreign/expired credentials and cross-origin/method/config misuse before SQL',async()=>{
 const s=shared;
 for(const app of apps){
  const cases=[
   {cookie:'not-a-jwt',status:401},
   {cookie:randomRefresh(),status:401},
   {cookie:s.tokens[app]+'; '+cookieNames[app].access+'='+s.tokens[app],status:401},
   {cookie:s.expiredTokens[app],status:401},
   {name:cookieNames[app].refresh,cookie:'x'.repeat(43),status:401},
   {cookie:s.tokens[apps.find(x=>x!==app)],status:401},
   {origin:'https://hostile.invalid',status:403},
   {method:'POST',status:405},
   {query:'?lab=off',status:404},
   {query:'?lab=keys-missing',status:503}
  ];
  for(const item of cases){const {status,...options}=item;await check(await request(s,app,options),status,{statements:0});}
 }
});
test('current native deactivation/credential changes and local family/browser/version/tombstone fences deny the unchanged JWT',async()=>{
 const s=shared;
 for(const app of apps){
  const db=s.dbs[app],id=nativeID(app),table=app==='hifz'?'students':'accounts',column=app==='hifz'?'id':'account_id';
  await db.prepare('UPDATE '+table+' SET active=0 WHERE '+column+'=?').bind(id).run();await check(await request(s,app),401,{statements:1});
  await db.prepare('UPDATE '+table+' SET active=1 WHERE '+column+'=?').bind(id).run();
  const credentialTable=app==='academy'?'account_credentials':table,credentialColumn=app==='studio'?'epoch':'credential_epoch';
  await db.prepare('UPDATE '+credentialTable+' SET '+credentialColumn+'=2').run();await check(await request(s,app),401,{statements:1});
  await db.prepare('UPDATE '+credentialTable+' SET '+credentialColumn+'=1').run();
  for(const [sql,undo]of [
   ['UPDATE jwt_v110_families SET revoked=1','UPDATE jwt_v110_families SET revoked=0'],
   ['UPDATE jwt_v110_browser_heads SET generation=2','UPDATE jwt_v110_browser_heads SET generation=1'],
   ['UPDATE jwt_v110_accounts SET permission_version=2','UPDATE jwt_v110_accounts SET permission_version=1'],
   ["INSERT INTO jwt_v110_parent_tombstones VALUES('master-family',9999999999)","DELETE FROM jwt_v110_parent_tombstones"]
  ]){await db.prepare(sql).run();await check(await request(s,app),401,{statements:1});await db.prepare(undo).run();}
 }
});
test('context reads do not advance foreground clocks or rotate secrets; idle/future clocks and original native Master cancellation fail closed',async()=>{
 const s=shared;
 for(const app of apps){
  const db=s.dbs[app],before=await db.prepare('SELECT refresh_fp,previous_fp,refresh_generation,last_fg_refresh_s,original_expires_at_s FROM jwt_v110_families').first();
  await check(await request(s,app),200,{statements:1});
  const after=await db.prepare('SELECT refresh_fp,previous_fp,refresh_generation,last_fg_refresh_s,original_expires_at_s FROM jwt_v110_families').first();assert.deepEqual(after,before);
  assert.equal((await db.prepare('SELECT count(*) n FROM jwt_v110_security_audit').first()).n,0);
  await db.prepare('UPDATE jwt_v110_families SET last_fg_refresh_s=?').bind(s.now-5400).run();const idle=await check(await request(s,app),401,{statements:1});assert.equal(idle.code,'PIN_REQUIRED');
  await db.prepare('UPDATE jwt_v110_families SET last_fg_refresh_s=?').bind(s.now+600).run();await check(await request(s,app),503,{statements:1});
  await db.prepare('UPDATE jwt_v110_families SET last_fg_refresh_s=?').bind(before.last_fg_refresh_s).run();
 }
 await s.dbs.academy.prepare('UPDATE account_sessions SET revoked_at=?').bind(new Date().toISOString()).run();await check(await request(s,'academy'),401,{statements:1});
});
test('record scoped read-only producer evidence without claiming complete native JWT cutover',async t=>{
 await mkdir('.build/jwt-v110-browser-integration',{recursive:true});await writeFile('.build/jwt-v110-browser-integration/context.json',JSON.stringify(evidence,null,2)+'\n');
 t.diagnostic('V110_NATIVE_CONTEXT='+JSON.stringify(evidence));
});
