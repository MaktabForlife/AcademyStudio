import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './fixture.mjs';
test('Tafseer feed starts from paid months and website filtering uses explicit identities',async t=>{
 const f=await fixture();try{const cookie=(await f.login('former')).cookie,grant=(await f.login('grant-only')).cookie;
  await f.run("INSERT INTO objects VALUES('note','retained/note','application/pdf','Note.pdf',20,'test',NULL)");await f.run("INSERT INTO attachments VALUES('paid-note','tafseer','site-surah','note','original-session','2024-01-12','historic-cohort','Original PDF','RECORDING',1)");
  const before=await f.request('/api/offerings/tafseer/media?website=site-surah',{cookie});assert.equal(before.status,200);assert.equal(before.body.media[0].website_id,'site-surah');assert.equal(before.body.media[0].lesson_id,'original-session');assert.equal(before.body.media[0].asset_id,'note');
  const rows=JSON.stringify(Array.from({length:4000},(_,i)=>'unpaid-'+i));await f.run("INSERT INTO attachments SELECT value,'tafseer',NULL,'note','another-session','2024-02-12','historic-cohort','Not purchased','RECORDING',1 FROM json_each(?)",rows);
  const after=await f.request('/api/offerings/tafseer/media?website=site-surah',{cookie});assert.equal(after.status,200);assert.equal(after.body.media.length,1);assert(after.reads<=before.reads+4,`${before.reads} -> ${after.reads}`);assert(after.reads<40);
  const unfiltered=await f.request('/api/offerings/tafseer/media',{cookie});assert.equal(unfiltered.body.media.length,1);assert(unfiltered.reads<30,'Unfiltered read count: '+unfiltered.reads);
  t.diagnostic(JSON.stringify({filteredBefore:before.reads,filteredAfter:after.reads,unfilteredAfter:unfiltered.reads,unpaidRecordings:4000}));
  assert.equal((await f.request('/api/offerings/tafseer/media?website=site-surah',{cookie:grant})).body.media.length,0);
  assert.equal((await f.request('/api/offerings/course/media?website=site-surah',{cookie})).status,400);
 }finally{await f.close();}
});
