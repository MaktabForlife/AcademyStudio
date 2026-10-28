import test from 'node:test';import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';import {fixture} from './fixture.mjs';
import {seedTimetables} from './timetable-fixture.mjs';
const ZOOM='https://example.zoom.us/j/123456789',DAY=86400_000;
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
const run=(db,sql,...args)=>db.prepare(sql).bind(...args).run();
const countMutation=(f,r)=>{f.source.metrics.queries++;f.source.metrics.rowsRead+=r.meta.rows_read;f.source.metrics.rowsWritten+=r.meta.rows_written;};
const recover=async f=>{const r=await f.runtime.dispatchFetch('https://academy.test/__local/recover');assert.equal(r.status,200,await r.text());};
test('source publications and current Zoom settings reach target through durable scoped delivery; cancellation closes joining without withdrawing retained rights',async t=>{
 const f=await fixture({academy:true}),evidence=[];try{
  const {db,programA,courseA,weekly,today}=await seedTimetables(f);f.source.resetMetrics();await recover(f);evidence.push({stage:'initial two-offering projection and delivery',...f.source.metrics});
  assert.equal(await db.prepare('SELECT last_error FROM website_platform_timetable_scopes WHERE activity_key=?').bind(programA).first('last_error'),null);
  const count=await f.db.prepare("SELECT count(*) FROM timetable WHERE offering_id='tafseer' AND cancelled=0").first('count(*)');assert(count>=8);
  const {cookie}=await f.login('learner'),admin=await f.login('admin');
  const list=ok(await f.request('/api/offerings/course/sessions',{cookie})),course=list.sessions.find(s=>s.title==='Source Course lesson');assert(course);assert(!JSON.stringify(list).includes('zoom.us'));assert.equal(ok(await f.request('/api/offerings/course/join',{cookie,method:'POST',body:{sessionId:course.session_id}})).destination,ZOOM);
  assert.equal((await f.request('/api/offerings/course/join',{cookie:(await f.login('former')).cookie,method:'POST',body:{sessionId:course.session_id}})).status,403);
  const firstWeekly=ok(await f.request('/api/offerings/tafseer/sessions',{cookie:admin.cookie})).sessions.find(s=>s.starts_at<=Date.now()&&s.ends_at>Date.now());assert(firstWeekly);assert.equal(ok(await f.request('/api/offerings/tafseer/join',{cookie:admin.cookie,method:'POST',body:{sessionId:firstWeekly.session_id}})).destination,ZOOM);
  f.source.resetMetrics();countMutation(f,await run(db,"INSERT INTO academy_settings(setting_key,setting_value) VALUES(?,?)",'ProgramZoom:'+programA.toUpperCase(),'https://example.zoom.us/j/987654321'));await recover(f);evidence.push({stage:'current Program Zoom correction and delivery',...f.source.metrics});
  assert.equal(ok(await f.request('/api/offerings/tafseer/join',{cookie:admin.cookie,method:'POST',body:{sessionId:firstWeekly.session_id}})).destination,'https://example.zoom.us/j/987654321');
  // Changes are coalesced once per mapped scope, regardless of history growth.
  await run(db,"INSERT INTO timetable_publications(activity_key,publication_id,scope_key,version_no,pattern,effective_from,timezone,snapshot_json,source_snapshot_sha256,conversion) SELECT ?, 'ws-history-'||value,?,value+1001,'WEEKLY','2020-01-01','UTC',?,?,'EXACT' FROM json_each(?)",programA,programA,JSON.stringify(weekly),'c'.repeat(64),JSON.stringify(Array.from({length:4000},(_,i)=>i)));
  f.source.resetMetrics();countMutation(f,await run(db,"UPDATE academy_settings SET setting_value=? WHERE setting_key=?",ZOOM,'ProgramZoom:'+programA.toUpperCase()));await recover(f);evidence.push({stage:'same correction after 4000 old publication bodies',...f.source.metrics});assert(f.source.metrics.rowsRead<evidence[1].rowsRead+30,JSON.stringify({evidence,large:f.source.statements.filter(s=>s.rowsRead>100)}));
  await run(db,"INSERT INTO lesson_lifecycle(activity_key,lifecycle_id,publication_id,source_session_id,status) VALUES(?,'ws-cancel','ws-course-publication','ws-course-lesson','CANCELLED')",courseA);await recover(f);assert.equal((await f.request('/api/offerings/course/join',{cookie,method:'POST',body:{sessionId:course.session_id}})).status,403);ok(await f.request('/api/websites/site-course',{cookie:(await f.login('former')).cookie}));
  // Published holiday overlay cancels both mapped scopes and never moves media.
  await run(db,"INSERT INTO academy_calendar_events(event_id,event_type,description,start_date,end_date,teaching_impact,active,scope_key,calendar_kind) VALUES('ws-holiday','PUBLIC_HOLIDAY','No teaching',?,?,'NO_TEACHING',1,'ACADEMY','PUBLIC_HOLIDAY')",today,today);await recover(f);assert.equal((await f.request('/api/offerings/tafseer/join',{cookie:admin.cookie,method:'POST',body:{sessionId:firstWeekly.session_id}})).status,403);
  const pub=await f.request('/api/public/home');ok(pub);assert.equal(pub.reads,0);assert(!JSON.stringify(pub.body).includes('zoom.us'));
  f.source.resetMetrics();ok(await f.request('/api/offerings/course/sessions',{cookie}));ok(await f.request('/api/websites/site-course',{cookie}));assert.equal(f.source.metrics.rowsRead,0);
  mkdirSync('outputs',{recursive:true});writeFileSync('outputs/academy-timetable-reads.json',JSON.stringify(evidence,null,2)+'\n');t.diagnostic(JSON.stringify(evidence));
 }finally{await f.close();}
});
test('dirty revisions reject a concurrent source change; lost ACK replays one exact outbox event and disabled activation catches up',async()=>{
 const f=await fixture({academy:true});try{
  const {db,programA}=await seedTimetables(f);await recover(f);const {queueTimetables}=await import('file://'+f.source.root+'/backend/src/academy/d1/web-platform/timetable.mjs');
  await run(db,"INSERT INTO academy_settings(setting_key,setting_value) VALUES(?,?)",'ProgramZoom:'+programA.toUpperCase(),ZOOM);
  const before=await db.prepare('SELECT version FROM website_platform_streams WHERE stream=?').bind('timetable:tafseer').first('version'),session=db.withSession('first-primary');let raced=false;
  await queueTimetables({prepare:sql=>session.prepare(sql),async batch(statements){if(!raced){raced=true;await run(db,'UPDATE academy_settings SET setting_value=? WHERE setting_key=?','https://example.zoom.us/j/111111111','ProgramZoom:'+programA.toUpperCase());}return session.batch(statements);}});
  assert(raced);assert.equal(await db.prepare('SELECT version FROM website_platform_streams WHERE stream=?').bind('timetable:tafseer').first('version'),before);assert.equal(await db.prepare('SELECT next_attempt FROM website_platform_timetable_scopes WHERE activity_key=?').bind(programA).first('next_attempt'),0);await recover(f);
  const latest=await db.prepare('SELECT * FROM website_platform_outbox WHERE stream=? ORDER BY version DESC LIMIT 1').bind('timetable:tafseer').first();await run(db,'UPDATE website_platform_outbox SET acknowledged=0 WHERE operation_id=?',latest.operation_id);await recover(f);assert.equal(await db.prepare('SELECT acknowledged FROM website_platform_outbox WHERE operation_id=?').bind(latest.operation_id).first('acknowledged'),1);assert.equal(await f.db.prepare('SELECT version FROM stream_heads WHERE stream=?').bind('timetable:tafseer').first('version'),latest.version);
  await run(db,'UPDATE website_platform_control SET enabled=0');await run(db,'UPDATE academy_settings SET setting_value=? WHERE setting_key=?','https://example.zoom.us/j/222222222','ProgramZoom:'+programA.toUpperCase());f.source.resetMetrics();await recover(f);assert.equal(f.source.metrics.queries,1);assert.equal(await db.prepare('SELECT version FROM website_platform_streams WHERE stream=?').bind('timetable:tafseer').first('version'),latest.version);
  await run(db,'UPDATE website_platform_control SET enabled=1');await recover(f);assert.equal(await f.db.prepare("SELECT zoom_url FROM timetable WHERE offering_id='tafseer' AND cancelled=0 LIMIT 1").first('zoom_url'),'https://example.zoom.us/j/222222222');
 }finally{await f.close();}
});
test('oversized or invalid source facts close live joining, retain content rights and leave an actionable retry state',async()=>{
 const f=await fixture({academy:true});try{
  const {db,programA,weekly,today}=await seedTimetables(f);await recover(f);
  const huge={...weekly,rules:Array.from({length:5},(_,i)=>({...weekly.rules[0],id:'RULE-big-'+i,weekdays:[0,1,2,3,4,5,6]}))};
  await run(db,"INSERT INTO timetable_publications(activity_key,publication_id,scope_key,version_no,pattern,effective_from,timezone,snapshot_json,source_snapshot_sha256,conversion) VALUES(?,'ws-overflow',?,10001,'WEEKLY',?,'UTC',?,?,'EXACT')",programA,programA,today,JSON.stringify(huge),'e'.repeat(64));await recover(f);
  assert.equal(await db.prepare('SELECT last_error FROM website_platform_timetable_scopes WHERE activity_key=?').bind(programA).first('last_error'),'TIMETABLE_WINDOW_TOO_LARGE');assert.equal(await f.db.prepare("SELECT count(*) n FROM timetable WHERE offering_id='tafseer' AND cancelled=0").first('n'),0);assert.equal(await f.db.prepare("SELECT active FROM offerings WHERE offering_id='tafseer'").first('active'),1);ok(await f.request('/api/websites/site-surah',{cookie:(await f.login('grant-only')).cookie}));
 }finally{await f.close();}
});
