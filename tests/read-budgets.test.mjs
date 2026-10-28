import test from 'node:test';import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';import {fixture} from './fixture.mjs';

test('native D1 workflow budgets stay bounded when unrelated records grow',async()=>{
 const f=await fixture(),evidence={engine:'Native local D1 metadata; 2026-09-28 compatibility',scope:'Target database only. Source authentication, coordinator, export/recovery and aggregate traffic budgets still require separate measurement.',unrelatedRecords:4000,measurements:[]};
 try{
  const learner=(await f.login()).cookie,admin=(await f.login('admin')).cookie;
  const data=new TextEncoder().encode('%PDF-1.7 synthetic');await f.media.put('retained/budget',data);await f.run("INSERT INTO objects VALUES('budget-file','retained/budget','application/pdf','Test.pdf',?,'budget',NULL)",data.length);await f.run("INSERT INTO attachments VALUES('budget-attachment','course',NULL,'budget-file','lesson','2026-10-28','','Retained PDF','RECORDING',1)");
  const samples=async stage=>{
   const get=(path,cookie)=>f.request(path,{cookie}),post=(path,cookie,body)=>f.request(path,{cookie,method:'POST',body});
   const measure=async(name,budget,run)=>{const r=await run();assert.equal(r.status,200,JSON.stringify(r.body));assert(r.reads<=budget,`${stage} ${name}: ${r.reads} > ${budget}`);evidence.measurements.push({stage,name,rowsRead:r.reads,queries:r.queries,budget});};
   await measure('Public homepage',0,()=>get('/api/public/home'));
   await measure('Account gate',4,()=>get('/api/me',learner));
   await measure('My websites',35,()=>get('/api/websites',learner));
   await measure('Published website',35,()=>get('/api/websites/site-course',learner));
   await measure('Private editor',40,()=>get('/api/websites/site-course/edit',admin));
   await measure('Published timetable',20,()=>get('/api/offerings/course/sessions',learner));
   await measure('Join current lesson',20,()=>post('/api/offerings/course/join',learner,{sessionId:'course-session'}));
   await measure('Recording list',25,()=>get('/api/offerings/course/media',learner));
   await measure('Protected PDF range',25,()=>f.request('/api/media/budget-attachment',{cookie:learner,headers:{Range:'bytes=0-4'}}).then(r=>({...r,status:r.status===206?200:r.status})));
   await measure('Scoped administration',65,()=>get('/api/admin/course',admin));
   const card={operationId:crypto.randomUUID(),action:'card',title:'Read budget example',visible:true};
   await measure('Scoped card mutation including atomic guard and audit',55,()=>post('/api/admin/course',admin,card));
   await measure('Exact mutation retry',20,()=>post('/api/admin/course',admin,card));
   await measure('Public snapshot preparation',65,()=>post('/api/admin/home/publish',admin,{operationId:crypto.randomUUID()}));
   const revision=await f.db.prepare("SELECT revision FROM websites WHERE website_id='site-course'").first('revision');
   await measure('Save immutable draft with guard and receipt',60,()=>post('/api/websites/site-course/edit',admin,{operationId:crypto.randomUUID(),action:'save',revision,document:f.doc}));
  };
  await samples('baseline');
  const rows=JSON.stringify(Array.from({length:evidence.unrelatedRecords},(_,i)=>'unrelated-'+String(i).padStart(5,'0')));
  await f.run("INSERT INTO accounts SELECT value,value,1,1,1,?,0 FROM json_each(?)",Date.now(),rows);
  await f.run("INSERT INTO offerings SELECT value,'COURSE',value,1,0 FROM json_each(?)",rows);
  await f.run("INSERT INTO participation SELECT value,value,1,1,1,'' FROM json_each(?)",rows);
  await f.run("INSERT INTO websites SELECT value,value,value,NULL,NULL,NULL,0,0,NULL FROM json_each(?)",rows);
  await f.run("INSERT INTO cards SELECT value,value,'','',0,0 FROM json_each(?)",rows);
  await f.run("INSERT INTO announcements SELECT value,value,0 FROM json_each(?)",rows);
  await f.run("INSERT INTO timetable SELECT value,value,value,1,2,NULL,1,1 FROM json_each(?)",rows);
  await f.run("INSERT INTO attachments SELECT value,value,NULL,'budget-file','old-lesson','2024-01-01','',value,'RECORDING',1 FROM json_each(?)",rows);
  await samples('4000 unrelated records per table');
  for(const first of evidence.measurements.filter(x=>x.stage==='baseline')){const later=evidence.measurements.find(x=>x.name===first.name&&x.stage!==first.stage);assert(later.rowsRead<=first.rowsRead+4,`${first.name} scans unrelated records: ${first.rowsRead} -> ${later.rowsRead}`);}
  mkdirSync('outputs',{recursive:true});writeFileSync('outputs/read-budgets.json',JSON.stringify(evidence,null,2)+'\n');
 }finally{await f.close();}
});
