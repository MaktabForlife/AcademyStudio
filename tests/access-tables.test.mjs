import test from 'node:test';
import assert from 'node:assert/strict';
import {studioFixture} from './studio-access-fixture.mjs';
import {signIn} from './access-fixture.mjs';

test('native monthly matrix preserves original cohorts, supports whole-year edits and rejects Course month grids',async t=>{
 const {f,x,good,proxy,handover}=await studioFixture();t.after(()=>f.close());await handover(x.programA);const opts={activity:x.programA};
 let grid=await good({action:'monthly-grid',years:[2024,2025,2026]},opts);const person=grid.students.find(r=>r.accountId===x.student);assert(person);assert.deepEqual(person.months['2024-01'].classIds,['historic-cohort']);assert(grid.classes.some(c=>c.class_id==='historic-cohort'));
 const entries=Array.from({length:12},(_,i)=>({accountId:x.student,month:'2025-'+String(i+1).padStart(2,'0'),subscribed:i!==2,classIds:['historic-cohort'],revision:0})).filter(e=>e.subscribed);
 const save={action:'monthly-grid-save',entries,policyRevision:grid.policy.revision,operationId:crypto.randomUUID()};assert.equal((await good(save,opts)).saved,true);assert.equal((await good(save,opts)).replayed,true);
 grid=await good({action:'monthly-grid',years:[2025]},opts);assert.equal(Object.keys(grid.students.find(r=>r.accountId===x.student).months).length,11);assert.equal(await f.db.prepare("SELECT count(*) n FROM paid_months WHERE offering_id='tafseer' AND account_id=? AND month='2024-01' AND cohort='historic-cohort'").bind(x.student).first('n'),1);
 const remove={action:'monthly-grid-save',entries:[{accountId:x.student,month:'2025-01',subscribed:false,classIds:['forged-cohort']}],policyRevision:grid.policy.revision,operationId:crypto.randomUUID(),removalReason:'Correcting the sample register'};await good(remove,opts);assert.equal((await good(remove,opts)).replayed,true);
 assert.equal(await f.db.prepare("SELECT count(*) n FROM paid_months WHERE offering_id='tafseer' AND account_id=? AND month='2025-01'").bind(x.student).first('n'),0);
 assert.equal((await proxy({...save,operationId:crypto.randomUUID()},opts)).status,409);
 assert.equal((await proxy({action:'monthly-grid-save',entries:[{...entries[0],month:'2026-01',classIds:['not-this-programme']}],policyRevision:0,operationId:crypto.randomUUID()},opts)).status,403);
 for(const who of ['studentA','teacherA'])assert.equal((await proxy({action:'monthly-grid',years:[2025]},{...opts,who})).status,403);
 await handover();assert.equal((await proxy({action:'monthly-grid',years:[2025]})).status,400);
});

test('Tafseer table saves names and completion dates, adds unpublished rows, keeps retries and scope guards',async t=>{
 const {f,x,good,proxy,handover}=await studioFixture();t.after(()=>f.close());await handover(x.programA);const opts={activity:x.programA};
 let table=await good({action:'access-table'},opts),row=table.surahs.find(r=>r.id==='site-surah');assert(row);assert.equal(row.completionDate,'2024-01-23');
 const nextId=crypto.randomUUID(),command={action:'access-table-save',policyRevision:table.policyRevision,operationId:crypto.randomUUID(),entries:[{...row,name:'Surah reviewed',completionDate:'2024-02-20'},{id:nextId,name:'Surah Maryam',completionDate:'2025-03-14',revision:0}]};
 await good(command,opts);assert.equal((await good(command,opts)).replayed,true);table=await good({action:'access-table'},opts);assert.equal(table.surahs.find(r=>r.id==='site-surah').completionDate,'2024-02-20');
 const fresh=await f.db.prepare('SELECT enabled,published_key,completion_month FROM websites WHERE website_id=?').bind(nextId).first();assert.deepEqual(fresh,{enabled:0,published_key:null,completion_month:'2025-03'});const cookie=await signIn(f,'global');const draft=await f.request('/api/websites/'+nextId+'/edit',{cookie});assert.equal(draft.status,200,'New Surah draft remains available to its native Admin');assert.equal(draft.body.document.name,'Surah Maryam');assert.equal(draft.body.document.lessons.length,0,'Adding a register row does not create invented lessons');
 assert.equal((await proxy({...command,operationId:crypto.randomUUID()},opts)).status,409);
 const late=JSON.parse(await x.db.prepare("SELECT event_json FROM website_platform_outbox WHERE access_scope=? AND access_account='' ORDER BY version DESC LIMIT 1").bind(x.programA).first('event_json'));
 const {sha256}=await import('../src/protocol.mjs'),stream='access:'+await sha256(JSON.stringify(['tafseer',''])),version=(await f.db.prepare('SELECT version FROM stream_heads WHERE stream=?').bind(stream).first('version'))+1;
 await x.run('UPDATE website_platform_streams SET version=? WHERE stream=?',version,stream);assert.equal((await f.deliver(late,{stream,version})).response.status,200);assert.equal(await f.db.prepare("SELECT completion_date FROM websites WHERE website_id='site-surah'").first('completion_date'),'2024-02-20','Late Academy scope cannot overwrite the authoritative Tafseer date');assert.equal(await f.db.prepare('SELECT enabled FROM source_access_websites WHERE website_id=?').bind(nextId).first('enabled'),1);

 assert.equal((await proxy({action:'access-table-save',policyRevision:table.policyRevision,operationId:crypto.randomUUID(),entries:[{id:'site-course',name:'Wrong scope',completionDate:'2024-01-01',revision:0}]},opts)).status,403);
 assert.equal((await proxy({action:'access-table'},{...opts,who:'teacherA'})).status,403);
});

test('matrix uses bounded pages beside unrelated rights; MOU uses its own monthly register',async t=>{
 const {f,x,good,handover,nativeLogin,proxy}=await studioFixture({mou:true,navigation:{mothers:'programB'}});t.after(()=>f.close());
 const token=await nativeLogin(),r=await f.runtime.dispatchFetch('https://academy.test/api/admin/platform/programme-studio/register',{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json',Authorization:'Bearer '+token,'X-Academy-Workspace':'ADMIN'},body:JSON.stringify({programmeKey:'mothers',accessModel:'MONTHLY',noMediaMigration:true,operationId:crypto.randomUUID()})});assert.equal(r.status,200,await r.text());
 const mothers=f.source.f.scopes.programB;await handover(x.programA);await handover(mothers);
 const body=await good({action:'monthly-grid',years:[2024,2025,2026]},{activity:mothers});assert(body.prepared);assert.equal((await proxy({action:'access-table'},{activity:mothers})).body.code,'MOU_TABLE_HELD');
 const opts={activity:x.programA},sample=async()=>{f.source.resetMetrics();const result=await good({action:'monthly-grid',years:[2024,2025,2026]},opts);return {result,source:{...f.source.metrics}};};await sample();const before=await sample();
 const ids=JSON.stringify(Array.from({length:4000},(_,i)=>'zz-matrix-other-'+i));await f.run('INSERT INTO accounts SELECT value,value,1,1,1,?,0 FROM json_each(?)',Date.now(),ids);const otherOffer=await f.db.prepare("SELECT offering_id FROM programme_offerings WHERE programme_key='mothers'").first('offering_id');await f.run("INSERT INTO paid_months SELECT value,?,'2024-01','unrelated','fixture' FROM json_each(?)",otherOffer,ids);
 const after=await sample();assert.deepEqual(after.result.students,before.result.students);assert(after.result.localReadBudget.targetRowsRead<=before.result.localReadBudget.targetRowsRead+8,JSON.stringify({before,after}));assert(after.source.rowsRead<=before.source.rowsRead+8);
 t.diagnostic(JSON.stringify({before:{source:before.source,target:before.result.localReadBudget},after:{source:after.source,target:after.result.localReadBudget},unrelatedRows:4000,scope:'Local D1 matrix request; no hosted or billing claim'}));
});
