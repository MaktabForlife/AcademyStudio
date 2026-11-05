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
async function state(s){
 const row=await s.f.db.prepare("SELECT refresh_fp,previous_fp,refresh_generation,last_fg_refresh_s FROM jwt_v110_families WHERE family_id='family-learner'").first();
 const audit=await s.f.db.prepare("SELECT count(*) n FROM jwt_v110_security_audit WHERE family_id='family-learner'").first();
 return {row,audits:audit.n};
}
async function assertUnrotated(s){
 const x=await state(s);assert.ok(x.row.refresh_fp===await fingerprint('studio',s.raws.learner)&&x.row.previous_fp===null,'The original secret must remain current without exposing it.');
 assert.equal(x.row.refresh_generation,0);assert.equal(x.row.last_fg_refresh_s,s.now);assert.equal(x.audits,0);
}
async function addOwnedGrants(s,count=256){
 const ids=Array.from({length:count},()=>crypto.randomUUID()),json=JSON.stringify(ids);
 await s.f.db.batch([
  s.f.db.prepare("INSERT INTO offerings SELECT value,'COURSE','Synthetic',1,0 FROM json_each(?)").bind(json),
  s.f.db.prepare("INSERT INTO participation(account_id,offering_id,enrolled,live,purchased,cohort) SELECT 'learner',value,1,1,1,'' FROM json_each(?)").bind(json)
 ]);
}
async function brokenIssuer(){
 // Exact previous issuer source is checked out immutably in GitHub. Only its
 // imports are redirected to the unchanged low-level rotation/codec APIs.
 // No credential or historical module is copied to the developer's machine.
 const path=process.env.JWT_FAILURE_BASELINE_SOURCE;assert.ok(path,'A frozen GitHub-only failure baseline is required.');
 let source=await readFile(path,'utf8');assert.ok(source.includes("const store=createPrototypeStore(binding,{app:'studio'}),committed=await store.refresh("));
 source=source.replaceAll("'./claims.mjs'",JSON.stringify(new URL('../src/auth/v110/claims.mjs',import.meta.url).href)).replaceAll("'./native-rights.mjs'",JSON.stringify(new URL('../src/auth/v110/native-rights.mjs',import.meta.url).href)).replaceAll("'./store.mjs'",JSON.stringify(new URL('../src/auth/v110/store.mjs',import.meta.url).href));
 return (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createAccountBoundStudioRefresh;
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
 await assertUnrotated(s);evidence.crossAccountMismatch={rejected:true,accessCookieReturned:false,rotationWrites:0};
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
test('repeated permission churn commits nothing and preserves the original secret for a bounded local retry',async t=>{
 const s=await setup();t.after(()=>s.f.close());let changes=0;
 const db=interposeSnapshot(s.f.db,async rs=>{changes++;await s.f.db.prepare("UPDATE jwt_v110_accounts SET permission_version=permission_version+1 WHERE account_id='learner'").run();return rs;});
 const api=await createAccountBoundStudioRefresh({binding:db,clock:()=>s.now,...s.keys}),first=await api.refreshAndIssue(s.raws.learner,{foreground:false});
 assert.equal(first.kind,'retry_required');assert.equal(changes,2);
 assert.equal(first.setCookies.length,0);await assertUnrotated(s);
 assert.ok(!Object.hasOwn(first,'claims')&&!Object.hasOwn(first,'rawSuccessor'));
 const stable=await createAccountBoundStudioRefresh({binding:s.f.db,clock:()=>s.now,...s.keys}),second=await stable.refreshAndIssue(s.raws.learner,{foreground:false});
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
 assert.ok(after.metrics.nativeSnapshot.rowsRead<=before.metrics.nativeSnapshot.rowsRead+16,'Unrelated grants cannot grow the snapshot scan.');
 assert.equal(after.metrics.nativeSnapshot.rowsWritten,0);
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


test('factories retain no database session; each lookup and snapshot starts on primary and CAS is the final primary gate',async t=>{
 const s=await setup();t.after(()=>s.f.close());const sessions=[];
 const binding={withSession(mode){sessions.push(mode);return s.f.db.withSession(mode);}};
 const api=await createAccountBoundStudioRefresh({binding,clock:()=>s.now,...s.keys});
 assert.equal(sessions.length,0,'A reusable issuer must not capture a request database session.');
 const first=await api.refreshAndIssue(s.raws.learner,{foreground:false}),count=sessions.length;
 assert.ok(count>=2,'Lookup and snapshot need fresh primary-anchored sessions; the atomic CAS is a primary write.');
 assert.ok(sessions.every(x=>x==='first-primary'));
 await api.refreshAndIssue(refreshValue(first),{foreground:false});
 assert.ok(sessions.length>=count+2,'A later request cannot reuse an old read session/bookmark.');
 evidence.primaryAnchors={noFactorySession:true,eachLookupAndSnapshotFresh:true,atomicCASFinalPrimaryGate:true,replicaStalenessNotAssumedAway:true};
});

test('frozen pre-fix issuer reproduces successor loss for a tiny budget and genuine owned-rights growth',async()=>{
 const old=await brokenIssuer(),proof=[];
 for(const actualCapacity of [false,true]){
  const s=await setup();
  try{
   if(actualCapacity)await addOwnedGrants(s);
   const api=await old({binding:s.f.db,clock:()=>s.now,...s.keys,...(!actualCapacity?{maxTokenBytes:1}:{})});
   await rejection(api.refreshAndIssue(s.raws.learner,{foreground:true}),'CLAIMS_TOO_LARGE');
   const x=await state(s);assert.equal(x.row.refresh_generation,1);assert.equal(x.audits,1);
   assert.ok(x.row.previous_fp===await fingerprint('studio',s.raws.learner)&&x.row.refresh_fp!==x.row.previous_fp);
   const store=createPrototypeStore(s.f.db,{app:'studio'}),duplicate=await store.refresh(s.raws.learner,{now:s.now,foreground:true}),late=await store.refresh(s.raws.learner,{now:s.now+31,foreground:true});
   assert.equal(duplicate.kind,'in_progress');assert.equal(late.kind,'readmit_required');assert.equal(store.metrics.rowsWritten,0);assert.equal((await state(s)).audits,1);
   proof.push({case:actualCapacity?'256 valid owner-local random Course rights':'maxTokenBytes=1 with valid small rights',previousGeneration:1,successorNotReturned:true,oldRawCannotRotate:true,auditRows:1});
  }finally{await s.f.close();}
 }
 evidence.frozenFailureReproduction={commit:'7dcf7d034b3fdd70dcb1c7c15da2cfc55f9b0e7d',issuerSourceExact:true,importsCurrentLowLevelUnpreparedAPIs:true,cases:proof};
});
test('controlled small-budget and real capacity failures leave the original refresh and audit unchanged',async()=>{
 const proof=[];
 for(const actualCapacity of [false,true]){
  const s=await setup();
  try{
   if(actualCapacity)await addOwnedGrants(s);
   const api=await createAccountBoundStudioRefresh({binding:s.f.db,clock:()=>s.now,...s.keys,...(!actualCapacity?{maxTokenBytes:1}:{})});
   await rejection(api.refreshAndIssue(s.raws.learner,{foreground:true}),'CLAIMS_TOO_LARGE');await assertUnrotated(s);
   // This checks only secret usability, not a token-capacity bypass or admission.
   const next=await createPrototypeStore(s.f.db,{app:'studio'}).refresh(s.raws.learner,{now:s.now,foreground:false});assert.equal(next.kind,'rotated');
   proof.push({case:actualCapacity?'owned rights exceed real default capacity':'tiny configured budget',rotationWrites:0,auditWrites:0,originalRawUsable:true,noAccessReturned:true});
  }finally{await s.f.close();}
 }
 evidence.controlledCapacityFailure=proof;
});
test('controlled signer, snapshot-reader and strict-projection failures preserve the old refresh',async()=>{
 const proof=[];
 for(const kind of ['signer','reader','projection']){
  const s=await setup();
  try{
   const binding=kind==='reader'?interposeSnapshot(s.f.db,async()=>{throw new Error('synthetic_reader_failure');}):kind==='projection'?interposeSnapshot(s.f.db,async rs=>{rs[2].results=[{account_id:'learner',offering_id:'course',role:'INVALID',can_create_account:1}];return rs;}):s.f.db;
   const api=await createAccountBoundStudioRefresh({binding,clock:()=>s.now,...s.keys,...(kind==='signer'?{signingKey:undefined,signingKid:undefined}:{})});
   await rejection(api.refreshAndIssue(s.raws.learner,{foreground:true}),kind==='signer'?'SIGNER_UNAVAILABLE':kind==='projection'?'INVALID_NATIVE_RIGHTS':undefined);await assertUnrotated(s);
   const stable=await createAccountBoundStudioRefresh({binding:s.f.db,clock:()=>s.now,...s.keys});assert.equal((await stable.refreshAndIssue(s.raws.learner)).kind,'rotated');
   proof.push({case:kind,rotationWrites:0,auditWrites:0,stableRetryUsingOriginalRaw:true});
  }finally{await s.f.close();}
 }
 evidence.controlledOperationalFailures=proof;
});
test('audit failure after preparation rolls back rotation without releasing prepared cookies',async t=>{
 const s=await setup();t.after(()=>s.f.close());
 await s.f.db.prepare("CREATE TRIGGER jwt_v110_test_audit_failure BEFORE INSERT ON jwt_v110_security_audit BEGIN SELECT RAISE(ABORT,'synthetic_audit_failure'); END").run();
 const api=await createAccountBoundStudioRefresh({binding:s.f.db,clock:()=>s.now,...s.keys});await rejection(api.refreshAndIssue(s.raws.learner,{foreground:true}));await assertUnrotated(s);
 await s.f.db.prepare('DROP TRIGGER jwt_v110_test_audit_failure').run();
 assert.equal((await api.refreshAndIssue(s.raws.learner,{foreground:true})).kind,'rotated');
 evidence.preparedAuditFailure={rolledBack:true,oldRawStillUsable:true,noCookiesReleasedOnFailure:true};
});
test('access expiry during signing prevents rotation and idle equality still requires the PIN',async()=>{
 const proof=[];
 for(const idle of [false,true]){
  const s=await setup();
  try{
   let calls=0;const initial=idle?s.now+5399:s.now,commit=idle?s.now+5400:s.now+900;
   const api=await createAccountBoundStudioRefresh({binding:s.f.db,clock:()=>++calls===1?initial:commit,...s.keys});
   await rejection(api.refreshAndIssue(s.raws.learner,{foreground:true}),idle?'PIN_REQUIRED':'PREPARATION_EXPIRED');await assertUnrotated(s);
   proof.push({case:idle?'90-minute boundary during preparation':'15-minute prepared access expiry',rotationWrites:0,auditWrites:0});
  }finally{await s.f.close();}
 }
 evidence.commitTimeBoundaries=proof;
});
test('a prepared loser of a concurrent refresh CAS releases no token or secret',async t=>{
 const s=await setup();t.after(()=>s.f.close());let winner,changed=false;
 const stable=await createAccountBoundStudioRefresh({binding:s.f.db,clock:()=>s.now,...s.keys});
 const db=interposeSnapshot(s.f.db,async rs=>{if(!changed){changed=true;winner=await stable.refreshAndIssue(s.raws.learner,{foreground:false});}return rs;});
 const api=await createAccountBoundStudioRefresh({binding:db,clock:()=>s.now,...s.keys}),loser=await api.refreshAndIssue(s.raws.learner,{foreground:false});
 assert.equal(winner.kind,'rotated');assert.equal(loser.kind,'in_progress');assert.equal(loser.setCookies.length,0);assert.ok(!Object.hasOwn(loser,'claims'));
 const x=await state(s);assert.equal(x.row.refresh_generation,1);assert.equal(x.audits,1);
 await createPrototypeStore(s.f.db,{app:'studio'}).authorize((await s.verifier.verify(accessToken(winner),s.now)).claims,s.now);
 evidence.preparedCASLoss={winnerRotations:1,auditRows:1,loserCookies:0,loserDoesNotReturnPreparedAccess:true};
});
test('a signed family tuple cannot be rebound across preparation retries even under an older-schema simulation',async t=>{
 const s=await setup();t.after(()=>s.f.close());await s.f.db.prepare('DROP TRIGGER jwt_v110_family_binding_immutable').run();let changed=false;
 const db=interposeSnapshot(s.f.db,async rs=>{if(!changed){changed=true;await s.f.db.prepare("UPDATE jwt_v110_families SET parent_session_id='different-parent' WHERE family_id='family-learner'").run();}return rs;});
 const api=await createAccountBoundStudioRefresh({binding:db,clock:()=>s.now,...s.keys});await rejection(api.refreshAndIssue(s.raws.learner,{foreground:true}),'SESSION_ENDED');await assertUnrotated(s);
 evidence.preparedIdentityTuple={olderSchemaFailureInjection:true,changedParentRejected:true,rotationWrites:0};
});
test('post-commit permission or credential cancellation is denied by the protected metadata gate',async()=>{
 const proof=[];
 for(const kind of ['permission','credential','browser','parent']){
  const s=await setup();
  try{
   const api=await createAccountBoundStudioRefresh({binding:s.f.db,clock:()=>s.now,...s.keys}),result=await api.refreshAndIssue(s.raws.learner,{foreground:false}),token=accessToken(result);
   const sql={permission:"UPDATE jwt_v110_accounts SET permission_version=2 WHERE account_id='learner'",credential:"UPDATE jwt_v110_accounts SET credential_epoch=2 WHERE account_id='learner'",browser:"UPDATE jwt_v110_browser_heads SET generation=2 WHERE browser_id='browser-learner'",parent:"INSERT INTO jwt_v110_parent_tombstones VALUES('parent-learner',?)"}[kind];
   const statement=s.f.db.prepare(sql);await(kind==='parent'?statement.bind(s.now+604800):statement).run();
   const checked=await s.verifier.verify(token,s.now);assert.equal(checked.claims.pv,1);
   await rejection(createPrototypeStore(s.f.db,{app:'studio'}).authorize(checked.claims,s.now),kind==='permission'?'TOKEN_UPDATE_REQUIRED':'SESSION_ENDED');
   proof.push({case:kind,signatureAloneStillValid:true,metadataGateRejects:true});
  }finally{await s.f.close();}
 }
 evidence.postCommitGate={cases:proof,actualPrivateMetadataRangeAndR2Routes:'not integrated; separate gate'};
});
test('credential-bearing result fields cannot enter an accidentally serialized JSON response',async t=>{
 const s=await setup();t.after(()=>s.f.close());const api=await createAccountBoundStudioRefresh({binding:s.f.db,clock:()=>s.now,...s.keys}),result=await api.refreshAndIssue(s.raws.learner,{foreground:false});
 const json=JSON.stringify(result);assert.ok(!json.includes(accessToken(result))&&!json.includes(refreshValue(result))&&!json.includes('setCookies')&&!json.includes('"claims"'),'JSON must contain no credential-bearing fields.');
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.setCookies));assert.ok(result.claims.sub==='learner');
 evidence.internalOnlyCookies={nonEnumerableCookiesAndClaims:true,HTTPAllowlistAndSecureHeadersStillRequired:true};
});
test('account-bound issuance evidence',t=>t.diagnostic('V110_BOUND_ISSUER_EVIDENCE='+JSON.stringify(evidence)));
