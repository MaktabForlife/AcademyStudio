import {test} from 'node:test';
import assert from 'node:assert/strict';
import {studioFixture} from './studio-access-fixture.mjs';
async function setup(t){
 const x=await studioFixture({mou:true,navigation:{mothers:'programB'}});t.after(()=>x.f.close());
 const db=await x.f.runtime.getD1Database('ACADEMY_DB','academy');
 const request=async(command={},who='global',extra={})=>{
  const token=await x.nativeLogin(who),response=await x.f.runtime.dispatchFetch('https://academy.test/api/admin/platform/studio-access',{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json',Authorization:'Bearer '+token,'X-Academy-Workspace':'ADMIN',...extra},body:JSON.stringify({command:{action:'catalogue',...command}})});
  return {status:response.status,body:await response.json()};
 };
 const good=async(...args)=>{const result=await request(...args);assert.equal(result.status,200,JSON.stringify(result.body));return result.body;};
 const register=async()=>{const token=await x.nativeLogin(),response=await x.f.runtime.dispatchFetch('https://academy.test/api/admin/platform/programme-studio/register',{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json',Authorization:'Bearer '+token,'X-Academy-Workspace':'ADMIN'},body:JSON.stringify({programmeKey:'mothers',accessModel:'MONTHLY',noMediaMigration:true,operationId:crypto.randomUUID()})});assert.equal(response.status,200,await response.text());};
 return {...x,db,request,good,register};
}
test('native access catalogue keeps exact Global/scoped Admin authority, area identities and ownership flags',async t=>{
 const {f,x,db,request,good,register}=await setup(t);
 let result=await good();assert.equal(result.schema,'STUDIO_ACCESS_CATALOGUE_V1');assert(result.items.some(row=>row.activityKey===x.programA&&row.area==='tafseer'));assert(result.items.some(row=>row.activityKey===x.courseA&&row.area==='courses'));assert(result.items.every(row=>row.ownership==='ACADEMY'));
 await register();
 const mou=f.source.f.scopes.programB;result=await good({area:'mothers'});assert.deepEqual(result.items.map(row=>row.activityKey),[mou]);assert.equal(result.items[0].kind,'TAFSEER');
 const scoped=await good({},'adminA');assert(scoped.items.length);assert(scoped.items.every(row=>[x.programA,x.courseA].includes(row.activityKey)));assert.deepEqual((await good({},'adminB')).items.map(row=>row.activityKey),[mou]);
 for(const who of ['studentA','teacherA'])assert.equal((await request({},who)).status,403);
 assert.equal((await request({},'global',{'X-Academy-Workspace':'LEARN'})).status,403);assert.equal((await request({},'global',{Origin:'https://wrong.test'})).status,403);
 await db.prepare('UPDATE website_platform_access_scopes SET enabled=0 WHERE activity_key=?').bind(x.courseA).run();await db.prepare("INSERT INTO website_platform_access_ownership(activity_key,state,cursor,checked,updated_at) VALUES(?,'FROZEN','',0,?) ON CONFLICT(activity_key) DO UPDATE SET state='FROZEN'").bind(x.courseA.toLowerCase(),Date.now()).run();
 const disabled=(await good({area:'courses'})).items.find(row=>row.activityKey===x.courseA);assert.equal(disabled.enabled,false);assert.equal(disabled.ownership,'FROZEN');assert.equal((await request({area:'invalid'})).status,400);assert.equal((await request({limit:51})).status,400);
});
test('native catalogue rejects current role removal, changed credential epoch and revoked sessions',async t=>{
 const {db,f,good,request}=await setup(t);await good({},'adminA');
 await db.prepare("UPDATE role_assignments SET active=0 WHERE account_id=? AND role='PROGRAM_ADMIN'").bind(f.source.f.actors.adminA).run();assert([401,403].includes((await request({},'adminA')).status));
 await good();await db.prepare('UPDATE account_credentials SET credential_epoch=credential_epoch+1 WHERE account_id=?').bind(f.source.f.actors.global).run();assert([401,403].includes((await request()).status));
 await good({},'adminB');await db.prepare('UPDATE account_sessions SET revoked_at=? WHERE account_id=?').bind(new Date().toISOString(),f.source.f.actors.adminB).run();assert([401,403].includes((await request({},'adminB')).status));
});
test('catalogue keyset pages are bounded and unrelated participant/role growth does not affect the list',async t=>{
 const {db,f,x,good,register}=await setup(t);await register();await good();f.source.resetMetrics();const before=await good(),baseline={...f.source.metrics};
 const activity=x.programA,account=f.source.f.actors.studentA;
 await db.exec(`INSERT INTO role_assignments(assignment_id,account_id,activity_key,role,active,review_state) WITH RECURSIVE n(x) AS(SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<4000) SELECT 'unrelated-history-'||x,'${account}','${activity}','STUDENT',0,'CONFIRMED' FROM n`);
 f.source.resetMetrics();const after=await good(),invalidation={...f.source.metrics};assert.deepEqual(after,before);f.source.resetMetrics();await good();const growth={...f.source.metrics};assert(growth.rowsRead<=baseline.rowsRead+8);assert(invalidation.rowsRead<baseline.rowsRead+200);t.diagnostic(JSON.stringify({baseline,invalidation,growth,rows:4000,scope:'Disposable native whole catalogue request; changed-source invalidation and then reuse; unrelated inactive participant role history'}));
 const statements=[];for(let i=0;i<54;i++){
  const key='COURSE:catalogue-'+String(i).padStart(3,'0');
  statements.push(db.prepare("INSERT INTO activities(activity_key,activity_id,kind,name,active,lifecycle) VALUES(?,?,'COURSE',?,1,'ACTIVE')").bind(key,key.slice(7),'Catalogue course '+i),db.prepare("INSERT INTO website_platform_timetable_scopes(activity_key,offering_id,kind) VALUES(?,?,'COURSE')").bind(key,key.slice(7)),db.prepare('INSERT INTO website_platform_access_scopes(activity_key,enabled) VALUES(?,1)').bind(key));
 }
 await db.batch(statements);const first=await good({area:'courses'});assert.equal(first.items.length,50);assert.equal(first.more,true);assert(first.nextCursor);const next=await good({area:'courses',cursor:first.nextCursor});assert.equal(next.more,false);assert.equal(new Set([...first.items,...next.items].map(row=>row.activityKey)).size,55);assert.equal(next.nextCursor,null);
 const measure=async area=>{await good({area});f.source.resetMetrics();const data=await good({area});return {data,metrics:{...f.source.metrics},catalogueReads:f.source.statements.filter(row=>row.sql.startsWith('WITH c AS MATERIALIZED')).reduce((sum,row)=>sum+row.rowsRead,0)};};
 const initial={tafseer:await measure('tafseer'),mothers:await measure('mothers')};
 const sequence="WITH RECURSIVE n(x) AS(SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<4000) ";
 await db.exec("INSERT INTO activities(activity_key,activity_id,kind,name,active,lifecycle) "+sequence+"SELECT 'COURSE:other-area-'||x,'other-area-'||x,'COURSE','Other area '||x,1,'ACTIVE' FROM n");
 await db.exec("INSERT INTO website_platform_timetable_scopes(activity_key,offering_id,kind) "+sequence+"SELECT 'COURSE:other-area-'||x,'other-area-'||x,'COURSE' FROM n");
 await db.exec("INSERT INTO website_platform_access_scopes(activity_key,enabled) "+sequence+"SELECT 'COURSE:other-area-'||x,0 FROM n");
 await db.exec("INSERT INTO website_platform_access_ownership(activity_key,state,cursor,checked,updated_at) "+sequence+"SELECT 'course:other-area-'||x,'ACADEMY','',0,1 FROM n");
 const grown={tafseer:await measure('tafseer'),mothers:await measure('mothers')};for(const area of ['tafseer','mothers']){assert.deepEqual(grown[area].data,initial[area].data);assert(grown[area].metrics.rowsRead<=initial[area].metrics.rowsRead+5);assert.equal(grown[area].catalogueReads,initial[area].catalogueReads);}
 t.diagnostic(JSON.stringify({mappedOtherAreaGrowth:4000,initial,grown,scope:'Actual local D1 catalogue request, populated mixed-case ownership index; no billing claim'}));
});
