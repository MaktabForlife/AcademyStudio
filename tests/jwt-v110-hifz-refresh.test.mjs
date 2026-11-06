import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {generateKeyPair,exportJWK,base64url} from 'jose';
import {createConfiguredAccessEngine} from '../src/auth/v110/claims.mjs';
import {randomRefresh,fingerprint} from '../src/auth/v110/store.mjs';
import {Miniflare,convertV4MiniflareOptions,compatibilityDate,runtimeEvidence} from './jwt-v110-runtime.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true','Disposable GitHub runners only.');
const origin='https://mahadarwa-hifz.ummabbadacademy.app',fixtures=[];
const evidence={runtime:runtimeEvidence,scope:'native Hifz refresh transport over synthetic native/auth tables; no admission/resource/browser cutover',sourceDerivedNoMasterHop:true,remoteCallsMeasured:false,hostedSQL:0,liveDBChanges:0,workerDeployed:false,cases:[]};
after(async()=>{for(const f of fixtures)await f.mf.dispose();await mkdir('.build/jwt-v110-hifz-refresh',{recursive:true});await writeFile('.build/jwt-v110-hifz-refresh/result.json',JSON.stringify(evidence,null,2)+'\n');});
async function schema(db){
 let text='';const sql=await readFile(new URL('./fixtures/jwt-v110-auth-only.sql',import.meta.url),'utf8');
 for(const part of sql.replace(/--[^\n]*/g,'').split(';')){text+=part+';';if(/CREATE TRIGGER/i.test(text)&&!/\sEND;\s*$/.test(text))continue;if(text.trim()!==';')await db.prepare(text).run();text='';}
}
let bundle;
async function fixture({account='person-a',family='hifz-family-a',age=7200,nativeEpoch=1}={}){
 bundle??=(await build({entryPoints:[new URL('./jwt-v110-hifz-refresh-worker.mjs',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers','node:*'],alias:{'@hifz':resolve(process.env.HIFZ_SOURCE)}})).outputFiles[0].text;
 const pair=await generateKeyPair('ES256',{extractable:true}),pub={...await exportJWK(pair.publicKey),kid:'hifz-ci'},privateJWK={...await exportJWK(pair.privateKey),kid:pub.kid};
 const now=Math.floor(Date.now()/1000),raw=randomRefresh(),csrfKey=base64url.encode(crypto.getRandomValues(new Uint8Array(32))),fp=await fingerprint('hifz',raw);
 const mf=new Miniflare(convertV4MiniflareOptions({name:'native-refresh-lab',modules:true,script:bundle,compatibilityDate,compatibilityFlags:['nodejs_compat'],bindings:{JWT_V110_PUBLIC_KEYS_JSON:JSON.stringify([pub]),JWT_V110_PRIVATE_KEY_JSON:JSON.stringify(privateJWK),JWT_V110_SIGNING_KID:pub.kid,JWT_V110_CSRF_SECRET:csrfKey},d1Databases:{DB:'synthetic-native-refresh'}}));
 const db=await mf.getD1Database('DB');const f={mf,db,now,raw,fp,account,family,original:now-age,expiry:now-age+604800,foreground:now-120,pub};fixtures.push(f);await schema(db);
 await db.prepare('CREATE TABLE students(id TEXT PRIMARY KEY,active INTEGER,credential_epoch INTEGER,login_id TEXT,role TEXT)').run();
 await db.batch([
  db.prepare("INSERT INTO students VALUES(?,1,?,'synthetic-alias','student')").bind(account,nativeEpoch===0?null:nativeEpoch),
  db.prepare('INSERT INTO jwt_v110_accounts VALUES(?,?,1,1)').bind(account,nativeEpoch),
  db.prepare('INSERT INTO jwt_v110_browser_heads VALUES(?,1)').bind('browser-a'),
  db.prepare('INSERT INTO jwt_v110_families(family_id,account_id,parent_session_id,browser_id,browser_generation,credential_epoch,permission_version,refresh_fp,original_signed_in_at_s,original_expires_at_s,last_fg_refresh_s,rotated_at_s) VALUES(?,?,?, ?,1,?,1,?,?,?,?,?)').bind(family,account,'master-parent','browser-a',nativeEpoch,fp,f.original,f.expiry,f.foreground,f.foreground)
 ]);
 return f;
}
function call(f,path,{method=path.endsWith('refresh')?'POST':'GET',raw=f.raw,csrf,mode,body,headers={}}={}){
 return f.mf.dispatchFetch(origin+'/auth/v110/'+path,{method,headers:{Cookie:'__Host-uah_r='+raw,Origin:origin,'Sec-Fetch-Site':'same-origin','CF-Connecting-IP':'192.0.2.10',...(method==='POST'?{'Content-Type':'application/json'}:{}),...(csrf?{'X-UAA-CSRF':csrf}:{}),...(mode?{'X-Lab-Mode':mode}:{}),...headers},...(method==='GET'||method==='HEAD'?{}:{body:body??'{}'})});
}
async function checked(response,status,{cookies=0,writes,statements}={}){
 assert.equal(response.status,status,'Unexpected native refresh status');
 assert.match(response.headers.get('Cache-Control')||'',/no-store/);assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
 assert.equal(response.headers.getSetCookie().length,cookies,'Unexpected cookie count');
 if(writes!==undefined)assert.equal(Number(response.headers.get('X-Lab-rowsWritten')),writes);
 if(statements!==undefined)assert.equal(Number(response.headers.get('X-Lab-statements')),statements);
 const body=await response.json();assert.ok(!Object.hasOwn(body,'token')&&!Object.hasOwn(body,'claims')&&!Object.hasOwn(body,'setCookies')&&!Object.hasOwn(body,'rawSuccessor'));
 return body;
}
const row=f=>f.db.prepare('SELECT * FROM jwt_v110_families WHERE family_id=?').bind(f.family).first();
async function csrf(f){const response=await call(f,'csrf'),body=await checked(response,200,{writes:0,statements:1});assert.ok(/^[A-Za-z0-9_-]{43}$/.test(body.csrf));return body.csrf;}
function cookies(response){const values=response.headers.getSetCookie();return {access:values.find(v=>v.startsWith('__Host-uah_a='))?.split(';',1)[0].slice(13),refresh:values.find(v=>v.startsWith('__Host-uah_r='))?.split(';',1)[0].slice(13),values};}
test('native CSRF bootstrap reads current own refresh identity and never advances activity or rotates credentials',async()=>{
 const f=await fixture(),before=await row(f);await csrf(f);assert.deepEqual(await row(f),before);
 evidence.cases.push({name:'csrf-bootstrap',statements:1,rowsWritten:0,foregroundAdvanced:false});
});
test('real Hifz endpoint rotates one compact app pair, retains original deadline and produces valid native display context without Academy',async()=>{
 const f=await fixture(),proof=await csrf(f),response=await call(f,'refresh',{csrf:proof}),body=await checked(response,200,{cookies:2});assert.deepEqual(body,{refreshed:true});
 const issued=cookies(response);assert.ok(issued.access&&issued.refresh&&issued.refresh!==f.raw);
 for(const value of issued.values){assert.ok(value.includes('HttpOnly')&&value.includes('Secure')&&value.includes('SameSite=Lax')&&!value.includes('Domain='));}
 const engine=await createConfiguredAccessEngine({app:'hifz',issuer:origin,publicKeys:[f.pub]}),claims=await engine.verify(issued.access,Math.floor(Date.now()/1000));
 assert.equal(claims.sub,f.account);assert.equal(claims.sid,f.family);assert.equal(claims.exp-claims.iat,900);assert.equal(claims.s_iat,f.original);assert.equal(claims.s_exp,f.expiry);assert.equal(Object.hasOwn(claims,'r'),false);
 const stored=await row(f);assert.equal(stored.refresh_generation,1);assert.equal(stored.original_expires_at_s,f.expiry);assert.equal(stored.last_fg_refresh_s,f.foreground);
 assert.equal(stored.refresh_fp,await fingerprint('hifz',issued.refresh));assert.equal(stored.previous_fp,f.fp);
 assert.ok(!JSON.stringify(stored).includes(f.raw)&&!JSON.stringify(stored).includes(issued.refresh));
 const context=await f.mf.dispatchFetch(origin+'/auth/v110/context',{headers:{Cookie:'__Host-uah_a='+issued.access}});const dto=await checked(context,200,{writes:0,statements:1});assert.equal(dto.session.accountId,f.account);assert.equal(dto.session.lastForegroundRefreshMs,f.foreground*1000);
 evidence.cases.push({name:'native-rotation',statements:Number(response.headers.get('X-Lab-statements')),rowsRead:Number(response.headers.get('X-Lab-rowsRead')),rowsWritten:Number(response.headers.get('X-Lab-rowsWritten')),sourceDerivedNoMasterHop:true,remoteCallsMeasured:false,originalDeadlineRetained:true});
});
test('only an explicitly accepted foreground refresh advances the own-app clock, never the seven-day deadline',async()=>{
 const f=await fixture(),proof=await csrf(f),response=await call(f,'refresh',{csrf:proof,body:'{"foreground":true}'});await checked(response,200,{cookies:2});
 const current=await row(f);assert.ok(current.last_fg_refresh_s>=f.now&&current.last_fg_refresh_s<=Math.floor(Date.now()/1000));assert.equal(current.original_expires_at_s,f.expiry);
});
test('request protection and disabled/config/rate gates emit no cookies or writes',async t=>{
 const f=await fixture(),proof=await csrf(f);
 const cases=[
 ['feature off',{mode:'off'},404,0],['missing limiter',{mode:'no-limiter'},503,0],['rate denied',{mode:'rate-deny'},429,0],
 ['missing signer',{mode:'no-signer'},503,0],['missing csrf secret',{mode:'no-csrf-key'},503,0],
 ['cross origin',{headers:{Origin:'https://hostile.example'}},403,0],['same site sibling',{headers:{'Sec-Fetch-Site':'same-site'}},403,0],
 ['missing Origin',{headers:{Origin:''}},403,0],['missing csrf',{},403,0],['wrong csrf',{csrf:base64url.encode(new Uint8Array(32).fill(3))},403,2],
 ['wrong body type',{csrf:proof,body:'{"foreground":"true"}'},400,0],['extra actor field',{csrf:proof,body:'{"accountId":"someone-else"}'},400,0],
 ['oversize body',{csrf:proof,body:JSON.stringify({foreground:true,padding:'x'.repeat(1100)})},400,0],
 ['wrong content type',{csrf:proof,headers:{'Content-Type':'text/plain'}},400,0],
 ['duplicate refresh cookie',{csrf:proof,headers:{Cookie:'__Host-uah_r='+f.raw+'; __Host-uah_r='+f.raw}},401,0],
 ['wrong cookie name',{csrf:proof,headers:{Cookie:'__Host-uas_r='+f.raw}},401,0],
 ['foreign refresh',{csrf:proof,raw:randomRefresh()},401,1]
 ];
 for(const [name,options,status,statements]of cases)await t.test(name,async()=>{const before=await row(f);await checked(await call(f,'refresh',options),status,{writes:0,statements});assert.deepEqual(await row(f),before);});
 await checked(await call(f,'csrf',{method:'POST'}),405,{writes:0,statements:0});
 await checked(await call(f,'refresh',{method:'GET'}),405,{writes:0,statements:0});
});
test('session-bound CSRF cannot be borrowed by another native family',async()=>{
 const f=await fixture(),proof=await csrf(f),second=randomRefresh();
 await f.db.prepare('INSERT INTO jwt_v110_families(family_id,account_id,parent_session_id,browser_id,browser_generation,credential_epoch,permission_version,refresh_fp,original_signed_in_at_s,original_expires_at_s,last_fg_refresh_s,rotated_at_s) SELECT ?,account_id,parent_session_id,browser_id,browser_generation,credential_epoch,permission_version,?,original_signed_in_at_s,original_expires_at_s,last_fg_refresh_s,rotated_at_s FROM jwt_v110_families WHERE family_id=?').bind('other-family',await fingerprint('hifz',second),f.family).run();
 await checked(await call(f,'refresh',{raw:second,csrf:proof}),403,{writes:0});
});
test('local native cancellation/clock gates deny renewal before any rotation',async t=>{
 for(const [name,sql,status]of [
 ['native disabled','UPDATE students SET active=0',401],['native epoch','UPDATE students SET credential_epoch=2',401],
 ['revoked family','UPDATE jwt_v110_families SET revoked=1',401],['browser generation','UPDATE jwt_v110_browser_heads SET generation=2',401],
 ['parent cancellation',"INSERT INTO jwt_v110_parent_tombstones VALUES('master-parent',9999999999)",401],
 ['90 minutes','UPDATE jwt_v110_families SET last_fg_refresh_s='+String(Math.floor(Date.now()/1000)-5400),401],
 ['future foreground','UPDATE jwt_v110_families SET last_fg_refresh_s=9999999999',503]
 ])await t.test(name,async()=>{const f=await fixture(),proof=await csrf(f);await f.db.prepare(sql).run();const before=await row(f);await checked(await call(f,'refresh',{csrf:proof}),status,{writes:0});assert.deepEqual(await row(f),before);});
});
test('a native epoch race loses CAS and emits no prepared cookie; policy churn re-prepares locally without extending background activity',async()=>{
 const f=await fixture(),proof=await csrf(f),before=await row(f);
 await checked(await call(f,'refresh',{csrf:proof,mode:'epoch-race'}),401,{writes:0});assert.deepEqual(await row(f),before);
 const g=await fixture(),nonce=await csrf(g),response=await call(g,'refresh',{csrf:nonce,mode:'pv-race'});await checked(response,200,{cookies:2});
 const engine=await createConfiguredAccessEngine({app:'hifz',issuer:origin,publicKeys:[g.pub]}),claims=await engine.verify(cookies(response).access,Math.floor(Date.now()/1000));assert.equal(claims.pv,2);assert.equal((await row(g)).last_fg_refresh_s,g.foreground);
});
test('audit failure rolls back rotation and leaves the old refresh usable with no leaked successor',async()=>{
 const f=await fixture(),proof=await csrf(f),before=await row(f);
 await f.db.prepare("CREATE TRIGGER reject_audit BEFORE INSERT ON jwt_v110_security_audit BEGIN SELECT RAISE(ABORT,'Synthetic audit failure'); END").run();
 await checked(await call(f,'refresh',{csrf:proof}),503);assert.deepEqual(await row(f),before);assert.equal((await f.db.prepare('SELECT count(*) n FROM jwt_v110_security_audit').first()).n,0);
 await f.db.prepare('DROP TRIGGER reject_audit').run();await checked(await call(f,'refresh',{csrf:proof}),200,{cookies:2});
});
test('concurrent HTTP refreshes have one winner, losers cannot install a cookie, and the winning successor stays local',async()=>{
 const f=await fixture(),proof=await csrf(f),responses=await Promise.all(Array.from({length:12},()=>call(f,'refresh',{csrf:proof}))),winners=responses.filter(r=>r.status===200);
 assert.equal(winners.length,1);for(const response of responses)if(response.status!==200){await checked(response,409,{writes:0});}
 const winner=winners[0],next=cookies(winner).refresh;await checked(winner,200,{cookies:2});
 assert.equal((await row(f)).refresh_generation,1);assert.equal((await f.db.prepare('SELECT count(*) n FROM jwt_v110_security_audit').first()).n,1);
 await checked(await call(f,'refresh',{raw:next,csrf:proof}),200,{cookies:2});assert.equal((await row(f)).refresh_generation,2);
});

test('access and refresh cookies clip to the original deadline and an expired original family cannot renew',async()=>{
 const f=await fixture({age:604700}),proof=await csrf(f),response=await call(f,'refresh',{csrf:proof});await checked(response,200,{cookies:2});
 const pair=cookies(response),engine=await createConfiguredAccessEngine({app:'hifz',issuer:origin,publicKeys:[f.pub]}),claims=await engine.verify(pair.access,Math.floor(Date.now()/1000));
 assert.equal(claims.exp,f.expiry);assert.ok(claims.exp-claims.iat<=100);
 for(const value of pair.values){const age=Number(value.match(/Max-Age=(\d+)/)?.[1]);assert.ok(age>0&&age<=100);}
 const expired=await fixture({age:604900});await checked(await call(expired,'csrf'),401,{writes:0});await checked(await call(expired,'refresh',{csrf:base64url.encode(new Uint8Array(32))}),401,{writes:0});
});

test('Hifz uses its permanent student id and local credential epoch, and carries no role or Academy permission claims',async()=>{
 const f=await fixture({account:'permanent-student-a'}),proof=await csrf(f);
 await f.db.prepare("UPDATE students SET login_id='a-different-alias',role='teacher' WHERE id=?").bind(f.account).run();
 const response=await call(f,'refresh',{csrf:proof});await checked(response,200,{cookies:2});
 const engine=await createConfiguredAccessEngine({app:'hifz',issuer:origin,publicKeys:[f.pub]}),claims=await engine.verify(cookies(response).access,Math.floor(Date.now()/1000));
 assert.equal(claims.sub,f.account);assert.equal(claims.ce,1);assert.equal(Object.hasOwn(claims,'r'),false);assert.equal(Object.hasOwn(claims,'role'),false);
});

test('historical null Hifz credential epochs mean local zero, and a later native reset blocks renewal',async()=>{
 const f=await fixture({nativeEpoch:0}),proof=await csrf(f),response=await call(f,'refresh',{csrf:proof});await checked(response,200,{cookies:2});
 const pair=cookies(response),engine=await createConfiguredAccessEngine({app:'hifz',issuer:origin,publicKeys:[f.pub]}),claims=await engine.verify(pair.access,Math.floor(Date.now()/1000));assert.equal(claims.ce,0);
 await f.db.prepare('UPDATE students SET credential_epoch=1').run();
 await checked(await call(f,'refresh',{raw:pair.refresh,csrf:proof}),401,{writes:0});
});
