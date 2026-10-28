import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './fixture.mjs';
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};

test('public timetable keeps upcoming sessions when historical and cancelled sessions grow',async t=>{
 const f=await fixture();try{
  const now=Date.now(),event={type:'timetable',mode:'delta',offering:{id:'course',kind:'COURSE',title:'Course',active:true},sessions:[{id:'new-session',title:'Upcoming lesson',startsAt:now+120_000,endsAt:now+3600_000,cancelled:false},{id:'later-session',title:'Later lesson',startsAt:now+60*86400_000,endsAt:now+60*86400_000+3600_000,cancelled:false}]};
  const before=await f.deliver(event);assert.equal(before.response.status,200);const base=Number(before.response.headers.get('X-Local-D1-Rows-Read'));
  const records=JSON.stringify(Array.from({length:4000},(_,i)=>({id:'history-'+i,starts:now-400*86400_000+i*1000})));
  await f.run("INSERT INTO timetable SELECT json_extract(value,'$.id'),'course','Historical lesson',json_extract(value,'$.starts'),json_extract(value,'$.starts')+1000,NULL,0,1 FROM json_each(?)",records);
  const cancelled=JSON.stringify(Array.from({length:4000},(_,i)=>({id:'cancelled-'+i,starts:now+1000+i*10})));
  await f.run("INSERT INTO timetable SELECT json_extract(value,'$.id'),'course','Cancelled lesson',json_extract(value,'$.starts'),json_extract(value,'$.starts')+1000,NULL,1,1 FROM json_each(?)",cancelled);
  const sql='SELECT session_id,offering_id,title,starts_at,ends_at,cancelled FROM timetable INDEXED BY timetable_public_offering WHERE offering_id=? AND cancelled=0 AND starts_at>=? ORDER BY starts_at LIMIT 200';
  const query=await f.db.prepare(sql).bind('course',now-86400_000).all(),plan=await f.db.prepare('EXPLAIN QUERY PLAN '+sql).bind('course',now-86400_000).all();
  t.diagnostic(JSON.stringify({scheduleRows:query.meta.rows_read,schedulePlan:plan.results}));
  const after=await f.deliver(event);assert.equal(after.response.status,200);const grown=Number(after.response.headers.get('X-Local-D1-Rows-Read'));
  const home=await f.request('/api/public/home');assert(ok(home).sessions.some(row=>row.session_id==='new-session'));assert(home.body.sessions.some(row=>row.session_id==='later-session'));assert(home.body.sessions.every(row=>row.offering_id==='course'&&!row.cancelled&&row.ends_at>now));assert.equal(home.reads,0);
  assert(grown<=base+10,`Public timetable update scanned history: ${base} -> ${grown}`);
  t.diagnostic(JSON.stringify({historicalSessions:4000,cancelledSessions:4000,publicationBefore:base,publicationAfter:grown,publicView:home.reads}));
 }finally{await f.close();}
});

test('public timetable fallback excludes invisible offerings without database reads',async()=>{
 const f=await fixture();try{
  const now=Date.now();await f.content.delete('public/schedule.json');await f.content.put('public/home.json',JSON.stringify({title:'Public home',cards:[{offering_id:'course'}],announcements:[],sessions:[{session_id:'public',offering_id:'course',starts_at:now,ends_at:now+1000},{session_id:'private',offering_id:'tafseer',title:'Private offering',starts_at:now,ends_at:now+1000},{session_id:'ended',offering_id:'course',starts_at:now-2000,ends_at:now-1000}]}));
  const home=await f.request('/api/public/home');assert.deepEqual(ok(home).sessions.map(row=>row.session_id),['public']);assert.equal(home.reads,0);
 }finally{await f.close();}
});
