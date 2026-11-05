import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {createAccessEngine,accessCookie,refreshCookie,cookieSizeReport,parseUniqueCookie,SESSION_SECONDS} from '../src/auth/v110/claims.mjs';
import {createPrototypeStore,randomRefresh,fingerprint} from '../src/auth/v110/store.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true','Run this prototype only on a disposable GitHub runner.');
const NOW=1793818800;
const origins={academy:'https://ummabbadacademy.app',studio:'https://worshipuponbaseera.ummabbadacademy.app',hifz:'https://mahadarwa-hifz.ummabbadacademy.app'};
const validRights=r=>Boolean(r&&r.v===1&&Array.isArray(r.g));
const scopeId=i=>'COURSE:CRS-'+i.toString(16).padStart(8,'0')+'-a111-4b22-8c33-d444eeeeffff';
// Complete synthetic tuple: scope, role bits, purchase, cohort, month window,
// website, playlist, recording grants. No native production adapter is claimed.
const rights=n=>({v:1,g:Array.from({length:n},(_,i)=>[scopeId(i),8,1,'2026','2026-09','2026-11','site-'+i,'playlist-'+i,[]])});
const input=(app='studio',expiry=NOW+SESSION_SECONDS)=>({
 sub:'account-aaaaaaaa-1111-4222-8333-bbbbbbbbbbbb',sid:app==='academy'?'parent-1111':'family-'+app,
 psid:'parent-1111',bsid:'browser-1111',bv:1,ce:1,pv:1,ue:0,s_iat:NOW,s_exp:expiry,...(app==='hifz'?{}:{r:rights(1)})
});
const claimAt=(now,pv=1,ue=0)=>({...input(),iat:now,exp:Math.min(now+900,NOW+SESSION_SECONDS),pv,ue});
async function engine(app='studio',extra={}){
 const pair=await generateKeyPair('ES256'),pub={...await exportJWK(pair.publicKey),kid:'current'};
 return {pair,pub,api:await createAccessEngine({app,issuer:origins[app],publicKeys:[pub],signingKey:pair.privateKey,signingKid:'current',validateRights:validRights,...extra})};
}
async function rejected(promise,code){
 let error;try{await promise;}catch(e){error=e;}
 assert.ok(error,'Expected rejection; no credential is printed.');
 if(code)assert.ok(error.code===code,'Unexpected sanitized error code.');
}
async function fixture({last=NOW,expiry=NOW+SESSION_SECONDS}={}){
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'jwt-stage2',modules:true,script:'export default {fetch(){return new Response("synthetic")}}',compatibilityDate:'2026-10-28',d1Databases:{DB:'jwt-stage2-synthetic'}}]}));
 try{
 const db=await mf.getD1Database('DB','jwt-stage2');
 const schema=await readFile(new URL('../src/auth/v110/schema.sql',import.meta.url),'utf8');
 for(const sql of schema.split(';').map(x=>x.trim()).filter(Boolean))await db.prepare(sql).run();
 const raw=randomRefresh(),fp=await fingerprint('studio',raw);
 await db.batch([
  db.prepare('INSERT INTO jwt_v110_accounts VALUES(?,1,1,1)').bind(input().sub),
  db.prepare('INSERT INTO jwt_v110_browser_heads VALUES(?,1)').bind(input().bsid),
  db.prepare('INSERT INTO jwt_v110_families(family_id,account_id,parent_session_id,browser_id,browser_generation,credential_epoch,permission_version,refresh_fp,original_signed_in_at_s,original_expires_at_s,last_fg_refresh_s,rotated_at_s) VALUES(?,?,?,?,1,1,1,?,?,?,?,?)').bind(input().sid,input().sub,input().psid,input().bsid,fp,NOW,expiry,last,last)
 ]);
 return {mf,db,raw,store:()=>createPrototypeStore(db,{app:'studio'})};
 }catch(error){await mf.dispose();throw error;}
}
const measured={source:'isolated synthetic workerd/D1',productionRequests:0,macBuilds:0};
test('ES256 intended app, exact expiry and fixed parent deadline',async()=>{
 const a=await engine(),h=await engine('hifz'),issued=await a.api.issue(input(),NOW);
 assert.deepEqual((await a.api.verify(issued.token,NOW+899)).r,input().r);
 await rejected(a.api.verify(issued.token,NOW+900),'INVALID_TOKEN');
 await rejected(h.api.verify(issued.token,NOW),'INVALID_TOKEN');
 const short=await a.api.issue(input('studio',NOW+30),NOW);assert.equal(short.claims.exp,NOW+30);
 await rejected(a.api.verify(short.token,NOW+30),'INVALID_TOKEN');
 await rejected(a.api.issue(input('studio',NOW),NOW));
});
test('strict integers, times, issuer, audience, purpose, algorithm and pinned key source',async()=>{
 const a=await engine(),base=(await a.api.issue(input(),NOW)).claims;
 for(const p of [
  {...base,exp:NOW},{...base,s_exp:NOW},{...base,exp:base.s_exp+1},{...base,exp:NOW+901},
  {...base,s_iat:NOW+1},{...base,s_iat:NOW-SESSION_SECONDS-1},{...base,iat:NOW+0.5},{...base,ce:1.5},{...base,pv:-1},{...base,exp:String(NOW+100)},
  {...base,iat:NOW+1},{...base,aud:[base.aud,'other']},{...base,iss:origins.academy},
  {...base,aud:'urn:ummabbadacademy:hifz:api'},{...base,unrecognised:true}
 ]){
  const token=await new SignJWT(p).setProtectedHeader({alg:'ES256',kid:'current',typ:'uaa-access+jwt'}).sign(a.pair.privateKey);
  await rejected(a.api.verify(token,NOW),'INVALID_TOKEN');
 }
 for(const header of [
  {alg:'ES256',kid:'unknown',typ:'uaa-access+jwt'},{alg:'ES256',kid:'current',typ:'uaa-handover+jwt'},
  {alg:'ES256',kid:'current',typ:'uaa-access+jwt',jku:'https://untrusted.invalid/keys'},
  {alg:'ES256',kid:'current',typ:'uaa-access+jwt',x5u:'https://untrusted.invalid/key'}
 ]){
  const token=await new SignJWT(base).setProtectedHeader(header).sign(a.pair.privateKey);
  await rejected(a.api.verify(token,NOW),'INVALID_TOKEN');
 }
 const forged=await new SignJWT(base).setProtectedHeader({alg:'HS256',kid:'current',typ:'uaa-access+jwt'}).sign(crypto.getRandomValues(new Uint8Array(32)));
 await rejected(a.api.verify(forged,NOW),'INVALID_TOKEN');
});
test('preprovisioned rollover keys work without request-time lookups',async()=>{
 const a=await engine(),next=await generateKeyPair('ES256'),pubNext={...await exportJWK(next.publicKey),kid:'next'};
 const verify=await createAccessEngine({app:'studio',issuer:origins.studio,publicKeys:[a.pub,pubNext],validateRights:validRights});
 const signer=await createAccessEngine({app:'studio',issuer:origins.studio,publicKeys:[pubNext],signingKey:next.privateKey,signingKid:'next',validateRights:validRights});
 const current=await a.api.issue(input(),NOW),future=await signer.issue(input(),NOW);
 await verify.verify(current.token,NOW);await verify.verify(future.token,NOW);
 await rejected(a.api.verify(future.token,NOW),'INVALID_TOKEN');
});
test('cookie scopes, duplicate rejection and absolute cookie expiry',async()=>{
 for(const app of ['academy','studio','hifz']){
  const e=await engine(app),x=await e.api.issue(input(app),NOW),c=accessCookie(app,x.token,x.claims.exp,NOW);
  assert.ok(c.includes('Secure; HttpOnly; SameSite=Lax'));assert.equal(c.includes('Domain='),app==='academy');
 }
 const raw=randomRefresh(),c=refreshCookie('studio',raw,NOW+100,NOW);
 assert.ok(c.endsWith('Max-Age=100'));assert.ok(!c.includes('Domain='));
 await rejected(Promise.resolve().then(()=>refreshCookie('studio',raw,NOW+SESSION_SECONDS+1,NOW)));
 assert.ok(parseUniqueCookie('__Host-uas_r='+raw,'__Host-uas_r')===raw);
 await rejected(Promise.resolve().then(()=>parseUniqueCookie('__Host-uas_r='+raw+'; __Host-uas_r='+raw,'__Host-uas_r')));
});
test('early full synthetic claims/header capacity; over-capacity projection is held rather than truncated',async t=>{
 const es={};for(const app of ['academy','studio','hifz'])es[app]=await engine(app,{maxTokenBytes:100000});
 const report=[];
 function measuredCookie(app,x){
  try{return accessCookie(app,x.token,x.claims.exp,NOW);}
  catch{return (app==='academy'?'__Secure-uaa_a':app==='studio'?'__Host-uas_a':'__Host-uah_a')+'='+x.token+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=900'+(app==='academy'?'; Domain=ummabbadacademy.app':'');}
 }
 for(const scopes of [1,16,64,256]){
  const a=await es.academy.api.issue({...input('academy'),r:rights(scopes)},NOW),s=await es.studio.api.issue({...input(),r:rights(scopes)},NOW),h=await es.hifz.api.issue(input('hifz'),NOW);
  assert.deepEqual((await es.studio.api.verify(s.token,NOW)).r,rights(scopes));
  const master=measuredCookie('academy',a),local=measuredCookie('studio',s),localH=measuredCookie('hifz',h);
  const reserved=['__Host-uas_csrf='+'x'.repeat(43),'__Secure-uaa_browser_reserved='+'x'.repeat(768),'__Host-maktab_web='+'x'.repeat(43)];
  report.push({scopeCount:scopes,accessTokenBytes:{academy:a.token.length,studio:s.token.length,hifz:h.token.length},
   studio:cookieSizeReport([master,local,refreshCookie('studio',randomRefresh(),NOW+SESSION_SECONDS,NOW)],reserved),
   hifz:cookieSizeReport([master,localH,refreshCookie('hifz',randomRefresh(),NOW+SESSION_SECONDS,NOW)],reserved.slice(0,2)),
   qualification:'complete synthetic tuples; not native-account maximum; browser/CSRF bytes reserved pending design'});
 }
 assert.ok(report[0].studio.fits);assert.ok(!report.at(-1).studio.fits);
 await rejected((await engine()).api.issue({...input(),r:rights(256)},NOW),'CLAIMS_TOO_LARGE');
 measured.capacity=report;t.diagnostic('capacity='+JSON.stringify(report));
});
test('one indexed local gate, no normal read write, locally known revocation wins',async t=>{
 const f=await fixture();t.after(()=>f.mf.dispose());const st=f.store();
 await st.authorize(claimAt(NOW),NOW);assert.equal(st.metrics.statements,1);assert.equal(st.metrics.rowsWritten,0);
 measured.normalRead={...st.metrics};
 await f.db.prepare('INSERT INTO jwt_v110_parent_tombstones VALUES(?,?)').bind(input().psid,NOW+SESSION_SECONDS).run();
 await rejected(f.store().authorize(claimAt(NOW),NOW),'SESSION_ENDED');
 await rejected(f.store().refresh(f.raw,{now:NOW+1,foreground:true}),'SESSION_ENDED');
});
test('credential/browser/unlock floors and inactive accounts deny old access',async()=>{
 for(const sql of ['UPDATE jwt_v110_accounts SET credential_epoch=2','UPDATE jwt_v110_accounts SET active=0','UPDATE jwt_v110_browser_heads SET generation=2','UPDATE jwt_v110_families SET unlock_generation=1','UPDATE jwt_v110_families SET revoked=1']){
  const f=await fixture();try{await f.db.prepare(sql).run();await rejected(f.store().authorize(claimAt(NOW),NOW),'SESSION_ENDED');}finally{await f.mf.dispose();}
 }
});
test('90-minute equality blocks even foreground renewal; background cannot keep session unlocked',async t=>{
 const f=await fixture();t.after(()=>f.mf.dispose());
 await f.store().authorize(claimAt(NOW+5399),NOW+5399);
 await rejected(f.store().authorize(claimAt(NOW+5400),NOW+5400),'PIN_REQUIRED');
 const bg=f.store(),r=await bg.refresh(f.raw,{now:NOW+900,foreground:false});assert.equal(r.kind,'rotated');
 assert.equal((await f.db.prepare('SELECT last_fg_refresh_s FROM jwt_v110_families WHERE family_id=?').bind(input().sid).first()).last_fg_refresh_s,NOW);
 await rejected(f.store().refresh(r.rawSuccessor,{now:NOW+5400,foreground:true}),'PIN_REQUIRED');
 measured.backgroundRefresh={...bg.metrics};
});
test('foreground refresh updates only its clock; late admission never creates another seven days',async t=>{
 const f=await fixture();t.after(()=>f.mf.dispose());const st=f.store(),r=await st.refresh(f.raw,{now:NOW+5399,foreground:true});
 assert.equal(r.kind,'rotated');assert.equal(r.originalExpiry,NOW+SESSION_SECONDS);
 await rejected(f.store().refresh(r.rawSuccessor,{now:NOW+10799,foreground:true}),'PIN_REQUIRED');
 measured.foregroundRefresh={...st.metrics};
 const late=await fixture({last:NOW+6*86400});
 try{const x=await late.store().refresh(late.raw,{now:NOW+6*86400+1,foreground:true});assert.equal(x.originalExpiry,NOW+SESSION_SECONDS);assert.ok(refreshCookie('studio',x.rawSuccessor,x.originalExpiry,NOW+6*86400+1).endsWith('Max-Age=86399'));}finally{await late.mf.dispose();}
});
test('permission update replaces locally without claiming foreground activity',async t=>{
 const f=await fixture();t.after(()=>f.mf.dispose());await f.db.prepare('UPDATE jwt_v110_accounts SET permission_version=2').run();
 await rejected(f.store().authorize(claimAt(NOW),NOW),'TOKEN_UPDATE_REQUIRED');
 const r=await f.store().refresh(f.raw,{now:NOW+10,foreground:false});assert.equal(r.kind,'rotated');assert.equal(r.permissionVersion,2);
 await f.store().authorize(claimAt(NOW+10,2),NOW+10);
 assert.equal((await f.db.prepare('SELECT last_fg_refresh_s FROM jwt_v110_families WHERE family_id=?').bind(input().sid).first()).last_fg_refresh_s,NOW);
});
test('cross-tab CAS has exactly one successor/audit; valid independent reads continue',async t=>{
 const f=await fixture();t.after(()=>f.mf.dispose());const ss=Array.from({length:6},()=>f.store());
 const rs=await Promise.all(ss.map(s=>s.refresh(f.raw,{now:NOW+1,foreground:true})));
 assert.equal(rs.filter(r=>r.kind==='rotated').length,1);assert.equal(rs.filter(r=>r.kind==='in_progress').length,5);
 await f.store().authorize(claimAt(NOW),NOW+2);
 assert.equal((await f.db.prepare('SELECT count(*) n FROM jwt_v110_security_audit').first()).n,1);
 const row=await f.db.prepare('SELECT refresh_generation,revoked,refresh_fp,previous_fp FROM jwt_v110_families WHERE family_id=?').bind(input().sid).first();
 assert.equal(row.refresh_generation,1);assert.equal(row.revoked,0);assert.ok(row.refresh_fp!==f.raw&&row.previous_fp!==f.raw);
 measured.race=ss.map(s=>({...s.metrics}));
});
test('lost whole response needs bounded recovery; duplicates issue nothing and write nothing',async t=>{
 const f=await fixture();t.after(()=>f.mf.dispose());const r=await f.store().refresh(f.raw,{now:NOW+1,foreground:true});assert.equal(r.kind,'rotated');
 const st=f.store(),early=await st.refresh(f.raw,{now:NOW+2,foreground:true}),late=await st.refresh(f.raw,{now:NOW+32,foreground:true});
 assert.equal(early.kind,'in_progress');assert.equal(late.kind,'readmit_required');
 assert.ok(!Object.hasOwn(early,'rawSuccessor')&&!Object.hasOwn(late,'rawSuccessor'));assert.equal(st.metrics.rowsWritten,0);
 assert.equal((await f.db.prepare('SELECT count(*) n FROM jwt_v110_security_audit').first()).n,1);
});
test('absolute deadline equality blocks; native viewer recovery remains an integration gate',async t=>{
 const end=NOW+SESSION_SECONDS,f=await fixture({last:end-1,expiry:end});t.after(()=>f.mf.dispose());
 await rejected(f.store().refresh(f.raw,{now:end,foreground:true}),'SESSION_ENDED');
 const e=await engine(),x=await e.api.issue(input(),NOW);await rejected(e.api.verify(x.token,NOW+900),'INVALID_TOKEN');
 measured.nativeViewerRecovery='NOT PROVEN by this cryptographic boundary test';
});
test('indexed auth cost stays bounded with 4000 unrelated synthetic families',async t=>{
 const f=await fixture();t.after(()=>f.mf.dispose());const before=f.store();await before.authorize(claimAt(NOW),NOW);
 const beforeRotation=f.store(),rotated=await beforeRotation.refresh(f.raw,{now:NOW+1,foreground:true});assert.equal(rotated.kind,'rotated');
 const ids=JSON.stringify(Array.from({length:4000},(_,i)=>'unrelated-'+i));
 await f.db.prepare("INSERT INTO jwt_v110_families(family_id,account_id,parent_session_id,browser_id,browser_generation,credential_epoch,permission_version,refresh_fp,original_signed_in_at_s,original_expires_at_s,last_fg_refresh_s,rotated_at_s) SELECT value,?,value,?,1,1,1,value,?,?,?,? FROM json_each(?)").bind(input().sub,input().bsid,NOW,NOW+SESSION_SECONDS,NOW,NOW,ids).run();
 const after=f.store();await after.authorize(claimAt(NOW),NOW);
 assert.ok(after.metrics.rowsRead<=before.metrics.rowsRead+4,'Unrelated families cannot grow auth scan.');assert.equal(after.metrics.rowsWritten,0);
 const afterRotation=f.store(),next=await afterRotation.refresh(rotated.rawSuccessor,{now:NOW+2,foreground:true});assert.equal(next.kind,'rotated');
 assert.ok(afterRotation.metrics.rowsRead<=beforeRotation.metrics.rowsRead+8,'Unrelated families cannot grow refresh scan.');
 measured.indexedGrowth={before:{...before.metrics},after:{...after.metrics},refreshBefore:{...beforeRotation.metrics},refreshAfter:{...afterRotation.metrics}};
});
test('non-credential synthetic evidence summary',t=>t.diagnostic('V110_STAGE2_EVIDENCE='+JSON.stringify(measured)));
