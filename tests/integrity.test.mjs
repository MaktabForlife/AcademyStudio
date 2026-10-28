import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './fixture.mjs';import {Store} from '../src/database.mjs';import {sha256} from '../src/protocol.mjs';
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
test('the transaction rejects administrator revocation after planning and rolls every write back',async()=>{
 const f=await fixture();try{const c=await f.login('admin'),store=new Store({...f.env,DB:f.db}),actor=await store.actor(await sha256(c.cookie.slice(c.cookie.indexOf('=')+1)));await store.scope(actor,'course',{admin:true});await f.run("UPDATE accounts SET global_admin=0 WHERE account_id='admin'");
  await assert.rejects(store.mutate(actor,'course',{operationId:crypto.randomUUID(),action:'card'},[store.statement("INSERT INTO cards VALUES('course','Forbidden','','',1,0)")],{saved:true}),e=>e.status===409);assert.equal(await f.db.prepare("SELECT count(*) n FROM cards WHERE title='Forbidden'").first('n'),0);assert.equal(await f.db.prepare('SELECT count(*) n FROM guards').first('n'),0);
 }finally{await f.close();}
});
test('draft files stay private until referenced by a published website, and withdrawal blocks old URLs',async()=>{
 const f=await fixture();try{const admin=(await f.login('admin')).cookie,learner=(await f.login()).cookie;
  const upload=ok(await f.request('/api/admin/course/files?'+new URLSearchParams({assetId:'new-pdf',operationId:crypto.randomUUID(),filename:'Course.pdf'}),{cookie:admin,method:'PUT',body:new TextEncoder().encode('%PDF-1.7 synthetic')}));assert.equal(upload.assetId,'new-pdf');
  const attachment={operationId:crypto.randomUUID(),action:'attachment',attachmentId:'new-attachment',assetId:'new-pdf',websiteId:'site-course',lessonId:'lesson',lessonDate:'2026-10-28',title:'Private PDF',cohort:'',audience:'WEBSITE',published:false};ok(await f.request('/api/admin/course',{cookie:admin,method:'POST',body:attachment}));assert.equal((await f.request('/api/media/new-attachment',{cookie:learner})).status,404);
  const draft=ok(await f.request('/api/websites/site-course/edit',{cookie:admin}));draft.document.materials.files.push({id:crypto.randomUUID(),assetId:'new-pdf',title:'Course PDF',description:''});ok(await f.request('/api/websites/site-course/edit',{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'save',revision:0,document:draft.document}}));assert.equal((await f.request('/api/media/new-attachment',{cookie:learner})).status,404);
  ok(await f.request('/api/websites/site-course/edit',{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'publish',revision:1}}));assert.equal((await f.request('/api/media/new-attachment',{cookie:learner})).status,200);
  ok(await f.request('/api/websites/site-course/edit',{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),action:'withdraw',revision:2}}));assert.equal((await f.request('/api/media/new-attachment',{cookie:learner})).status,404);
 }finally{await f.close();}
});
test('conflicting concurrent saves and operation reuse across offerings cannot overwrite each other',async()=>{
 const f=await fixture();try{const cookie=(await f.login('admin')).cookie,draft=ok(await f.request('/api/websites/site-course/edit',{cookie}));const input={action:'save',revision:0,document:draft.document};const pair=await Promise.all([f.request('/api/websites/site-course/edit',{cookie,method:'POST',body:{...input,operationId:crypto.randomUUID()}}),f.request('/api/websites/site-course/edit',{cookie,method:'POST',body:{...input,operationId:crypto.randomUUID()}})]);assert.deepEqual(pair.map(r=>r.status).sort(),[200,409]);
  const card={operationId:crypto.randomUUID(),action:'card',title:'Card',visible:true};ok(await f.request('/api/admin/course',{cookie,method:'POST',body:card}));assert.equal((await f.request('/api/admin/tafseer',{cookie,method:'POST',body:card})).status,409);
 }finally{await f.close();}
});
test('homepage publication contains no private meeting data and remains zero-read for visitors',async()=>{
 const f=await fixture();try{const cookie=(await f.login('admin')).cookie;ok(await f.request('/api/admin/course',{cookie,method:'POST',body:{operationId:crypto.randomUUID(),action:'card',title:'Published Course',description:'Welcome',displayLabel:'Evening lessons',visible:true}}));const op={operationId:crypto.randomUUID()};ok(await f.request('/api/admin/home/publish',{cookie,method:'POST',body:op}));const home=await f.request('/api/public/home');assert.equal(home.reads,0);assert(!JSON.stringify(home.body).includes('zoom'));assert.equal(home.body.cards[0].title,'Published Course');assert.equal(ok(await f.request('/api/admin/home/publish',{cookie,method:'POST',body:op})).replayed,true);
 }finally{await f.close();}
});
test('month removals retain the reason and failed bulk changes do not partially revoke rights',async()=>{
 const f=await fixture();try{const cookie=(await f.login('admin')).cookie,input={operationId:crypto.randomUUID(),action:'paid-months',changes:[{accountId:'former',month:'2024-01',cohort:'historic-cohort',paid:false,reason:'Verified opening-register correction'}]};ok(await f.request('/api/admin/tafseer',{cookie,method:'POST',body:input}));const row=await f.db.prepare("SELECT details_json FROM audit WHERE action='paid-months'").first();assert(JSON.parse(row.details_json).changes[0].reason.includes('correction'));
  const bad=await f.request('/api/admin/tafseer',{cookie,method:'POST',body:{operationId:crypto.randomUUID(),action:'paid-months',changes:[{accountId:'former',month:'2024-02',cohort:'historic-cohort',paid:true},{accountId:'missing-account',month:'2024-03',cohort:'historic-cohort',paid:true}]}});assert.equal(bad.status,409);assert.equal(await f.db.prepare("SELECT count(*) n FROM paid_months WHERE month='2024-02'").first('n'),0);
 }finally{await f.close();}
});
