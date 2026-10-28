import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {fixture} from './fixture.mjs';import {random,challenge,signedHeaders} from '../src/protocol.mjs';
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
test('Course Admin can create only in current source scope; linking and late admission/role loss remain guarded',async()=>{
 const f=await fixture({academy:true});try{
  const verifier=random(),state=random(),login=ok(await f.request('/auth/login',{method:'POST',body:{uniqueid:'separation-adminA',pin:'1234',challenge:await challenge(verifier),state}}));
  const exchanged=await f.request('/auth/exchange',{method:'POST',body:{code:login.code,verifier,state}});ok(exchanged);const cookie=exchanged.response.headers.get('Set-Cookie').split(';')[0],actor=f.source.f.actors.adminA,{courseA,courseB}=f.source.f.scopes;
  for(const offering of [courseA,courseB]){const event=await f.deliver({type:'timetable',offering:{id:offering,kind:'COURSE',title:'Synthetic '+offering,active:true},sessions:[]});assert.equal(event.response.status,200);await f.run('INSERT INTO staff VALUES(?,?,?,1)',actor,offering,'ADMIN');}
  const post=(offering,action,body)=>f.request('/api/offerings/'+offering+'/'+action,{cookie,method:'POST',body});
  const create=async(offering,name)=>{const operationId=crypto.randomUUID();ok(await post(offering,'provision',{operationId,displayName:name}));return {operationId,result:await post(offering,'resume',{jobId:operationId})};};
  const made=await create(courseA,'Synthetic scoped learner');assert.equal(ok(made.result).state,'COMPLETE');assert.equal(await f.db.prepare('SELECT purchased FROM participation WHERE account_id=? AND offering_id=?').bind(made.result.body.accountId,courseA).first('purchased'),0);
  f.source.resetMetrics();const linked=await post(courseA,'provision',{operationId:crypto.randomUUID(),accountId:f.source.f.actors.studentB});assert.equal(linked.status,403);assert.equal(f.source.metrics.queries,0);
  const denied=await create(courseB,'Wrong source scope');assert.equal(denied.result.status,403,JSON.stringify(denied.result.body));const db=await f.runtime.getD1Database('ACADEMY_DB','academy');assert.equal(await db.prepare('SELECT count(*) n FROM accounts WHERE display_name=?').bind('Wrong source scope').first('n'),0);
  const operationId=crypto.randomUUID();ok(await post(courseA,'provision',{operationId,displayName:'Revoked scoped admin'}));await db.prepare("UPDATE role_assignments SET active=0 WHERE account_id=? AND activity_key=? AND role='PROGRAM_ADMIN'").bind(actor,courseA).run();assert.equal((await post(courseA,'resume',{jobId:operationId})).status,403);assert.equal(await db.prepare('SELECT count(*) n FROM accounts WHERE display_name=?').bind('Revoked scoped admin').first('n'),0);
  await db.prepare("UPDATE role_assignments SET active=1 WHERE account_id=? AND activity_key=? AND role='PROGRAM_ADMIN'").bind(actor,courseA).run();
  const sourceRef=await f.db.prepare('SELECT source_ref FROM sessions WHERE account_id=?').bind(actor).first('source_ref'),path='/internal/website/identity';
  const signed=await signedHeaders(f.env.WEBSITE_TO_ACADEMY_SECRET,path,{operationId:crypto.randomUUID(),offeringId:courseA,actorId:actor,actorEpoch:1,sourceRef,create:true,displayName:'Late admission loss',issuedAt:Date.now()});
  const {bridge}=await import(pathToFileURL(f.source.root+'/backend/src/academy/d1/web-platform/bridge.mjs')),session=db.withSession('first-primary');
  const env={...f.source.workers[0].bindings,ACADEMY_DB:{withSession(){return {prepare:sql=>session.prepare(sql),async batch(statements){
   // Revoke admission after the source preflight, immediately before its write.
   await db.prepare('INSERT INTO website_platform_admissions VALUES(?,0) ON CONFLICT(account_id) DO UPDATE SET active=0').bind(actor).run();return session.batch(statements);
  }};}}};
  await assert.rejects(bridge(new Request('https://academy.test'+path,{method:'POST',headers:signed.headers,body:signed.payload}),env,{login(){throw Error('No login expected');},mint(){throw Error('No mint expected');}}));
  assert.equal(await db.prepare('SELECT count(*) n FROM accounts WHERE display_name=?').bind('Late admission loss').first('n'),0);assert.equal(await db.prepare('SELECT count(*) n FROM website_platform_guards').first('n'),0);
 }finally{await f.close();}
});
