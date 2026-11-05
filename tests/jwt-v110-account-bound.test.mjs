import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {applyTargetSchema} from './target-schema.mjs';
import {Miniflare,convertV4MiniflareOptions,compatibilityDate,runtimeEvidence} from './jwt-v110-runtime.mjs';
import {generateKeyPair,exportJWK} from 'jose';
import {fixture} from './fixture.mjs';
import {createAccountBoundStudioRefresh} from '../src/auth/v110/account-bound-issuer.mjs';
import {createNativeAccessEngine} from '../src/auth/v110/native-rights.mjs';
import {createPrototypeStore,randomRefresh,fingerprint} from '../src/auth/v110/store.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true','Disposable GitHub runners only.');
const issuer='https://worshipuponbaseera.ummabbadacademy.app';
const evidence={source:'isolated account-bound native issuance',productionRoutes:0,hostedSQL:0,nativeBusinessWrites:'synthetic failure injection only',completeIntegration:false};
async function rejection(p,code){let e;try{await p;}catch(error){e=error;}assert.ok(Boolean(e),'Expected sanitized rejection.');if(code)assert.ok(e.code===code,'Unexpected sanitized error code.');}
async function setup(){
 const f=await fixture();
 try{
  const sql=await readFile(new URL('../src/auth/v110/schema.sql',import.meta.url),'utf8');let statement='';
  for(const part of sql.replace(/--[^\n]*/g,'').split(';')){statement+=part+';';if(/CREATE TRIGGER/i.test(statement)&&!/\sEND;\s*$/.test(statement))continue;if(statement.trim()!==';')await f.db.prepare(statement).run();statement='';}
  const now=Math.floor(Date.now()/1000),raws={};
  for(const account of ['learner','admin']){
   const raw=randomRefresh(),fp=await fingerprint('studio',raw);raws[account]=raw;
   await f.db.batch([
    f.db.prepare('INSERT INTO jwt_v110_accounts VALUES(?,1,1,1)').bind(account),
    f.db.prepare('INSERT INTO jwt_v110_browser_heads VALUES(?,1)').bind('browser-'+account),
    f.db.prepare('INSERT INTO jwt_v110_families(family_id,account_id,parent_session_id,browser_id,browser_generation,credential_epoch,permission_version,refresh_fp,original_signed_in_at_s,original_expires_at_s,last_fg_refresh_s,rotated_at_s) VALUES(?,?,?,?,1,1,1,?,?,?,?,?)').bind('family-'+account,account,'parent-'+account,'browser-'+account,fp,now,now+604800,now,now)
   ]);
  }
  const pair=await generateKeyPair('ES256'),pub={...await exportJWK(pair.publicKey),kid:'current'},keys={app:'studio',issuer,publicKeys:[pub],signingKey:pair.privateKey,signingKid:'current'};
  return {f,now,raws,keys,verifier:await createNativeAccessEngine({app:'studio',issuer,publicKeys:[pub]})};
 }catch(error){await f.close();throw error;}
}
function interposeSnapshot(binding,alter){
 return {withSession(mode){
  const session=binding.withSession(mode),sqlByStatement=new WeakMap();
  return {prepare(sql){const p=session.prepare(sql);return {bind(...args){const s=p.bind(...args);sqlByStatement.set(s,sql);return s;}};},
   async batch(statements){const rs=await session.batch(statements);if(statements.length===7&&(sqlByStatement.get(statements[0])||'').includes('native_account_id'))return alter(rs);return rs;}
  };
 }};
}
function accessToken(result){
 const cookie=result.setCookies.find(x=>x.startsWith('__Host-uas_a='));
 assert.ok(Boolean(cookie),'Expected a bounded access cookie.');
 return cookie.slice(cookie.indexOf('=')+1).split(';',1)[0];
}
function refreshValue(result){
 const cookie=result.setCookies.find(x=>x.startsWith('__Host-uas_r='));
 assert.ok(Boolean(cookie),'Expected a host-only refresh cookie.');
 return cookie.slice(cookie.indexOf('=')+1).split(';',1)[0];
}
test('refresh derives subject, version and all native rights from the committed local family',async t=>{
 const s=await setup();t.after(()=>s.f.close());
 const api=await createAccountBoundStudioRefresh({binding:s.f.db,clock:()=>s.now,...s.keys});
 const a=await api.refreshAndIssue(s.raws.learner,{foreground:true}),b=await api.refreshAndIssue(s.raws.admin,{foreground:false});
 assert.equal(a.kind,'rotated');assert.equal(b.kind,'rotated');
 const left=await s.verifier.verify(accessToken(a),s.now),right=await s.verifier.verify(accessToken(b),s.now);
 assert.equal(left.claims.sub,'learner');assert.equal(left.rights.globalAdmin,false);
 assert.equal(left.rights.participation.find(x=>x[0]==='course')[3],1);
 assert.equal(right.claims.sub,'admin');assert.equal(right.rights.globalAdmin,true);
 assert.equal(left.claims.s_exp,s.now+604800);assert.equal(right.claims.s_exp,s.now+604800);
 await createPrototypeStore(s.f.db,{app:'studio'}).authorize(left.claims,s.now);
 evidence.baseline={learner:a.metrics,admin:b.metrics,subjectsAndCurrentVersionsBound:true};
});
test('caller cannot submit another account, permission version or rights object to renewal',async t=>{
 const s=await setup();t.after(()=>s.f.close());const api=await createAccountBoundStudioRefresh({binding:s.f.db,clock:()=>s.now,...s.keys});
 for(const options of [{sub:'admin'},{pv:99},{rights:{globalAdmin:true}},{foreground:true,claims:{sub:'admin'}}])await rejection(api.refreshAndIssue(s.raws.learner,options),'INVALID_REFRESH_MODE');
 assert.equal((await s.f.db.prepare("SELECT refresh_generation FROM jwt_v110_families WHERE family_id='family-learner'").first()).refresh_generation,0);
 await rejection(createAccountBoundStudioRefresh({binding:s.f.db,clock:()=>s.now,...s.keys,app:'hifz'}),'INVALID_CONFIG');
});
test('a miswired native snapshot for another account is rejected before any access cookie is returned',async t=>{
 const s=await setup();t.after(()=>s.f.close());
 const db=interposeSnapshot(s.f.db,async rs=>{rs[2].results=[{account_id:'admin',offering_id:'course',role:'ADMIN',can_create_account:1}];return rs;});
 const api=await createAccountBoundStudioRefresh({binding:db,clock:()=>s.now,...s.keys});
 await rejection(api.refreshAndIssue(s.raws.learner,{foreground:true}),'NATIVE_SUBJECT_MISMATCH');
 evidence.crossAccountMismatch={rejected:true,accessCookieReturned:false};
});
test('permission downgrade after read retries with the new exact snapshot/version without another refresh rotation',async t=>{
 const s=await setup();t.after(()=>s.f.close());let changed=false;
 const db=interposeSnapshot(s.f.db,async rs=>{
  if(!changed){changed=true;await s.f.db.batch([
   s.f.db.prepare("UPDATE participation SET purchased=0 WHERE account_id='learner' AND offering_id='course'"),
   s.f.db.prepare("UPDATE jwt_v110_accounts SET permission_version=2 WHERE account_id='learner'")
  ]);}
  return rs;
 });
 const api=await createAccountBoundStudioRefresh({binding:db,clock:()=>s.now,...s.keys}),issued=await api.refreshAndIssue(s.raws.learner,{foreground:false});
 assert.equal(issued.kind,'rotated');const verified=await s.verifier.verify(accessToken(issued),s.now);
 assert.equal(verified.claims.sub,'learner');assert.equal(verified.claims.pv,2);
 assert.equal(verified.rights.participation.find(x=>x[0]==='course')[3],0);
 await createPrototypeStore(s.f.db,{app:'studio'}).authorize(verified.claims,s.now);
 const row=await s.f.db.prepare("SELECT refresh_generation,last_fg_refresh_s FROM jwt_v110_families WHERE family_id='family-learner'").first();
 assert.equal(row.refresh_generation,1);assert.equal(row.last_fg_refresh_s,s.now);
 evidence.downgrade={oldSnapshotNotReturned:true,currentVersion:2,refreshRotations:1,metrics:issued.metrics};
});
test('credential cancellation between native read and signing returns no access cookie and old secret stays invalid',async t=>{
 const s=await setup();t.after(()=>s.f.close());let changed=false;
 const db=interposeSnapshot(s.f.db,async rs=>{if(!changed){changed=true;await s.f.db.prepare("UPDATE jwt_v110_accounts SET credential_epoch=2 WHERE account_id='learner'").run();}return rs;});
 const api=await createAccountBoundStudioRefresh({binding:db,clock:()=>s.now,...s.keys});
 await rejection(api.refreshAndIssue(s.raws.learner,{foreground:true}),'SESSION_ENDED');
 await rejection(createPrototypeStore(s.f.db,{app:'studio'}).refresh(s.raws.learner,{now:s.now,foreground:true}),'SESSION_ENDED');
 evidence.cancelDuringSigning={accessCookieReturned:false,oldSecretStillInvalid:true};
});
test('repeated permission churn returns only the committed refresh cookie for a bounded local retry',async t=>{
 const s=await setup();t.after(()=>s.f.close());let changes=0;
 const db=interposeSnapshot(s.f.db,async rs=>{changes++;await s.f.db.prepare("UPDATE jwt_v110_accounts SET permission_version=permission_version+1 WHERE account_id='learner'").run();return rs;});
 const api=await createAccountBoundStudioRefresh({binding:db,clock:()=>s.now,...s.keys}),first=await api.refreshAndIssue(s.raws.learner,{foreground:false});
 assert.equal(first.kind,'retry_required');assert.equal(changes,2);
 assert.equal(first.setCookies.length,1);assert.ok(first.setCookies[0].startsWith('__Host-uas_r='));
 assert.ok(!Object.hasOwn(first,'claims')&&!Object.hasOwn(first,'rawSuccessor'));
 const stable=await createAccountBoundStudioRefresh({binding:s.f.db,clock:()=>s.now,...s.keys}),second=await stable.refreshAndIssue(refreshValue(first),{foreground:false});
 assert.equal(second.kind,'rotated');assert.equal((await s.verifier.verify(accessToken(second),s.now)).claims.pv,3);
 evidence.boundedChurn={snapshotAttempts:2,firstAccessCookieReturned:false,localRetrySucceeds:true,originalDeadlineExtended:false};
});

test('account-bound snapshot reads stay indexed with 4000 unrelated native entitlement rows',async t=>{
 const s=await setup();t.after(()=>s.f.close());const api=await createAccountBoundStudioRefresh({binding:s.f.db,clock:()=>s.now,...s.keys});
 const before=await api.refreshAndIssue(s.raws.learner,{foreground:false});
 const values=JSON.stringify(Array.from({length:4000},(_,i)=>i));
 await s.f.db.batch([
  s.f.db.prepare("INSERT INTO websites(website_id,offering_id,title,revision,enabled) SELECT 'unrelated-site-'||value,'tafseer','Synthetic',0,0 FROM json_each(?)").bind(values),
  s.f.db.prepare("INSERT INTO mou_playlists(playlist_id,offering_id,website_id,created_at) SELECT 'unrelated-playlist-'||value,'tafseer','unrelated-site-'||value,? FROM json_each(?)").bind(s.now*1000,values),
  s.f.db.prepare("INSERT INTO paid_months(account_id,offering_id,month,cohort) SELECT 'outsider','tafseer','2024-01','unrelated-cohort-'||value FROM json_each(?)").bind(values),
  s.f.db.prepare("INSERT INTO mou_playlist_retained SELECT 'unrelated-playlist-'||value,'tafseer','outsider','2024-01','PAID' FROM json_each(?)").bind(values)
 ]);
 const after=await api.refreshAndIssue(refreshValue(before),{foreground:false});
 assert.equal(after.kind,'rotated');
 assert.ok(after.metrics.nativeSnapshotAndFinalGate.rowsRead<=before.metrics.nativeSnapshotAndFinalGate.rowsRead+16,'Unrelated grants cannot grow the snapshot scan.');
 assert.equal(after.metrics.nativeSnapshotAndFinalGate.rowsWritten,0);
 evidence.unrelatedGrowth={unrelatedNativeRetainedRows:4000,before:before.metrics,after:after.metrics,newProductionIndex:false};
});
test('the account-bound refresh/sign pipeline runs inside the selected Worker and native D1 schema',async t=>{
 const now=Math.floor(Date.now()/1000),pair=await generateKeyPair('ES256',{extractable:true}),pub={...await exportJWK(pair.publicKey),kid:'current'},privateJWK=await exportJWK(pair.privateKey),raw=randomRefresh();
 const source=new URL('../src/auth/v110/account-bound-issuer.mjs',import.meta.url).pathname,nativeSource=new URL('../src/auth/v110/native-rights.mjs',import.meta.url).pathname;
 const worker='import {createAccountBoundStudioRefresh} from '+JSON.stringify(source)+';import {createNativeAccessEngine} from '+JSON.stringify(nativeSource)+';import {importJWK} from "jose";export default {async fetch(request,env){const keys={app:"studio",issuer:'+JSON.stringify(issuer)+',publicKeys:[env.PUBLIC_JWK],signingKey:await importJWK(env.PRIVATE_JWK,"ES256"),signingKid:"current"};const api=await createAccountBoundStudioRefresh({binding:env.DB,clock:()=>env.TEST_NOW,...keys});const result=await api.refreshAndIssue(request.headers.get("X-Synthetic-Refresh"),{foreground:true});const cookie=result.setCookies.find(x=>x.startsWith("__Host-uas_a="));const token=cookie.slice(cookie.indexOf("=")+1).split(";",1)[0];const verify=await createNativeAccessEngine({app:"studio",issuer:'+JSON.stringify(issuer)+',publicKeys:[env.PUBLIC_JWK]});const checked=await verify.verify(token,env.TEST_NOW);return Response.json({kind:result.kind,subject:checked.claims.sub,permissionVersion:checked.claims.pv,globalAdmin:checked.rights.globalAdmin,purchased:checked.rights.participation[0][3],originalExpiry:checked.claims.s_exp,metrics:result.metrics});}};';
 const bundled=await build({stdin:{contents:worker,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'bound-issuer',modules:true,script:bundled.outputFiles[0].text,compatibilityDate,compatibilityFlags:['nodejs_compat'],bindings:{PUBLIC_JWK:pub,PRIVATE_JWK:privateJWK,TEST_NOW:now},d1Databases:{DB:'bound-native-synthetic'}}]}));t.after(()=>mf.dispose());
 const db=await mf.getD1Database('DB','bound-issuer');await applyTargetSchema(db);
 const sql=await readFile(new URL('../src/auth/v110/schema.sql',import.meta.url),'utf8');let statement='';
 for(const part of sql.replace(/--[^\n]*/g,'').split(';')){statement+=part+';';if(/CREATE TRIGGER/i.test(statement)&&!/\sEND;\s*$/.test(statement))continue;if(statement.trim()!==';')await db.prepare(statement).run();statement='';}
 await db.batch([
  db.prepare("INSERT INTO accounts VALUES('bundle-user','Synthetic',1,1,1,?,0)").bind(now*1000),
  db.prepare("INSERT INTO offerings VALUES('bundle-course','COURSE','Synthetic',1,0)"),
  db.prepare("INSERT INTO participation VALUES('bundle-user','bundle-course',1,1,1,'')"),
  db.prepare("INSERT INTO jwt_v110_accounts VALUES('bundle-user',1,1,1)"),
  db.prepare("INSERT INTO jwt_v110_browser_heads VALUES('bundle-browser',1)"),
  db.prepare("INSERT INTO jwt_v110_families(family_id,account_id,parent_session_id,browser_id,browser_generation,credential_epoch,permission_version,refresh_fp,original_signed_in_at_s,original_expires_at_s,last_fg_refresh_s,rotated_at_s) VALUES('bundle-family','bundle-user','bundle-parent','bundle-browser',1,1,1,?,?,?,?,?)").bind(await fingerprint('studio',raw),now,now+604800,now,now)
 ]);
 const response=await mf.dispatchFetch('https://synthetic.invalid/refresh',{method:'POST',headers:{'X-Synthetic-Refresh':raw}});assert.equal(response.status,200);
 const value=await response.json();assert.equal(value.kind,'rotated');assert.equal(value.subject,'bundle-user');assert.equal(value.permissionVersion,1);assert.equal(value.globalAdmin,false);assert.equal(value.purchased,1);assert.equal(value.originalExpiry,now+604800);
 evidence.worker={...runtimeEvidence,fullyExecutedLocalPipeline:true,topLevelSyntheticWorkerRequests:1,academyCalls:0,privateKeysOrTokensReturned:false,metrics:value.metrics,completeApplicationParity:false};
});

test('account-bound issuance evidence',t=>t.diagnostic('V110_BOUND_ISSUER_EVIDENCE='+JSON.stringify(evidence)));
