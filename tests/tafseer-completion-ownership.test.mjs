import test from 'node:test';import assert from 'node:assert/strict';
import {studioFixture} from './studio-access-fixture.mjs';import {sha256} from '../src/protocol.mjs';
async function deliverScope(f,event){const stream='access:'+await sha256(JSON.stringify([event.offering.id,''])),version=(await f.db.prepare('SELECT version FROM stream_heads WHERE stream=?').bind(stream).first('version'))+1;const result=await f.deliver(event,{stream,version});assert.equal(result.response.status,200,JSON.stringify(result.body));}
test('Academy owns Tafseer website metadata before handover; Studio owns it after handover',async t=>{
 const {f,x,handover}=await studioFixture();t.after(()=>f.close());const event=JSON.parse(await x.db.prepare("SELECT event_json FROM website_platform_outbox WHERE access_scope=? AND access_account='' ORDER BY version DESC LIMIT 1").bind(x.programA).first('event_json'));
 event.websites[0].completion_date='2024-02-20';await deliverScope(f,event);assert.equal(await f.db.prepare("SELECT completion_date FROM websites WHERE website_id='site-surah'").first('completion_date'),'2024-02-20');
 // Reset synthetic stream state consistently before the actual native handover.
 const stream='access:'+await sha256(JSON.stringify(['tafseer',''])),version=await f.db.prepare('SELECT version FROM stream_heads WHERE stream=?').bind(stream).first('version');await x.run('UPDATE website_platform_streams SET version=? WHERE stream=?',version,stream);await x.run("UPDATE program_surahs SET completion_date='2024-02-20' WHERE surah_id='source-surah'");await x.recover(8);await handover(x.programA);
 await f.run("UPDATE websites SET completion_date='2025-03-14',completion_month='2025-03' WHERE website_id='site-surah'");await f.run("UPDATE source_access_websites SET enabled=0 WHERE website_id='site-surah'");event.websites[0].completion_date='2024-01-23';event.websites[0].active=true;await deliverScope(f,event);
 assert.deepEqual(await f.db.prepare("SELECT completion_date,completion_month FROM websites WHERE website_id='site-surah'").first(),{completion_date:'2025-03-14',completion_month:'2025-03'});assert.equal(await f.db.prepare("SELECT enabled FROM source_access_websites WHERE website_id='site-surah'").first('enabled'),0);
});
test('Tafseer ownership fence leaves the existing MOU metadata delivery unchanged',async t=>{
 const {f,x,handover,nativeLogin}=await studioFixture({mou:true,navigation:{mothers:'programB'}});t.after(()=>f.close());const token=await nativeLogin();const response=await f.runtime.dispatchFetch('https://academy.test/api/admin/platform/programme-studio/register',{method:'POST',headers:{Origin:'https://academy.test','Content-Type':'application/json',Authorization:'Bearer '+token,'X-Academy-Workspace':'ADMIN'},body:JSON.stringify({programmeKey:'mothers',accessModel:'MONTHLY',noMediaMigration:true,operationId:crypto.randomUUID()})});assert.equal(response.status,200,await response.text());await x.recover(8);await handover(f.source.f.scopes.programB);
 const scope=await f.db.prepare("SELECT s.* FROM programme_offerings p JOIN source_access_scopes s USING(offering_id) WHERE programme_key='mothers'").first();
 await f.run('INSERT INTO websites VALUES(?,?,?,?,?,NULL,0,0,?)','mou-date-exclusion',scope.offering_id,'Existing MOU subject','2024-01','private-fixture','2024-01-23');
 await deliverScope(f,{type:'access-scope',offering:{id:scope.offering_id,kind:'TAFSEER',title:'Mothers of the Ummah'},generation:scope.generation,enabled:true,liveEnabled:true,timezone:'UTC',classes:[],websites:[{website_id:'mou-date-exclusion',completion_date:'2024-02-21',active:true}],programmeKey:'mothers',accessModel:'MONTHLY'});
 assert.equal(await f.db.prepare("SELECT completion_date FROM websites WHERE website_id='mou-date-exclusion'").first('completion_date'),'2024-02-21');assert.equal(await f.db.prepare("SELECT enabled FROM source_access_websites WHERE website_id='mou-date-exclusion'").first('enabled'),1);
});

test('Tafseer ownership fence preserves Course metadata delivery after handover',async t=>{
 const {f,x,handover}=await studioFixture();t.after(()=>f.close());await handover();
 const event=JSON.parse(await x.db.prepare("SELECT event_json FROM website_platform_outbox WHERE access_scope=? AND access_account='' ORDER BY version DESC LIMIT 1").bind(x.courseA).first('event_json'));
 event.websites=[{website_id:'site-course',completion_date:'2024-04-12',active:true}];await deliverScope(f,event);
 assert.equal(await f.db.prepare("SELECT completion_date FROM websites WHERE website_id='site-course'").first('completion_date'),'2024-04-12');assert.equal(await f.db.prepare("SELECT enabled FROM source_access_websites WHERE website_id='site-course'").first('enabled'),1);
});
