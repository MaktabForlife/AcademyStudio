import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
const ok=result=>{assert.equal(result.status,200,JSON.stringify(result.body));return result.body;};

test('website file selection stays scoped and indexed without loading participants or recordings',async t=>{
 const f=await fixture();try{
  const admin=(await f.login('admin')).cookie,learner=(await f.login()).cookie;
  await f.run("INSERT INTO objects VALUES('picker-pdf','shared/picker-pdf','application/pdf','Shared.pdf',10,'hash',NULL)");
  await f.run("INSERT INTO asset_owners VALUES('picker-pdf','course')");
  await f.run("INSERT INTO attachments VALUES('z-website-file','course','site-course','picker-pdf','stable-lesson','2026-10-28','','Reusable PDF','WEBSITE',1)");
  const path='/api/admin/course/files',before=await f.request(path,{cookie:admin});
  assert.deepEqual(ok(before).assets.map(row=>row.asset_id),['picker-pdf']);
  const history=JSON.stringify(Array.from({length:4000},(_,i)=>'a-recording-'+String(i).padStart(5,'0')));
  await f.run("INSERT INTO attachments SELECT value,'course','site-course','picker-pdf','old-lesson','2024-01-01','',value,'RECORDING',1 FROM json_each(?)",history);
  const after=await f.request(path,{cookie:admin});assert.deepEqual(ok(after).assets.map(row=>row.asset_id),['picker-pdf']);
  assert(after.reads<=before.reads+6,`${before.reads} -> ${after.reads}`);
  for(const field of ['participants','requests','months','media'])assert.equal(after.body[field],undefined);
  const exact=await f.request(path+'?assetId=picker-pdf',{cookie:admin});assert.equal(ok(exact).assets[0].attachment_id,'z-website-file');assert(exact.reads<20);
  assert.deepEqual(ok(await f.request('/api/admin/tafseer/files?assetId=picker-pdf',{cookie:admin})).assets,[]);
  assert.equal((await f.request(path,{cookie:learner})).status,403);
  const teacher=(await f.login('teacher')).cookie;assert.equal((await f.request(path,{cookie:teacher})).status,403);
  await f.run("UPDATE staff SET role='ADMIN' WHERE account_id='teacher' AND offering_id='course'");
  assert.equal((await f.request(path,{cookie:teacher})).status,200);
  assert.equal((await f.request('/api/admin/tafseer/files',{cookie:teacher})).status,403);
  await f.run("DELETE FROM staff WHERE account_id='teacher'");assert.equal((await f.request(path,{cookie:teacher})).status,403);
  const pages=JSON.stringify(Array.from({length:65},(_,i)=>'w-file-'+String(i).padStart(3,'0')));
  await f.run("INSERT INTO attachments SELECT value,'course','site-course','picker-pdf','stable-lesson','2026-10-28','',value,'WEBSITE',0 FROM json_each(?)",pages);
  const first=ok(await f.request(path,{cookie:admin}));assert.equal(first.assets.length,50);assert.equal(first.more,true);assert.equal(first.nextCursor,first.assets.at(-1).attachment_id);
  const next=ok(await f.request(path+'?after='+first.nextCursor,{cookie:admin}));assert.equal(next.assets.length,16);assert.equal(next.more,false);assert(next.assets.every(row=>row.attachment_id>first.nextCursor));
  assert.equal(await f.db.prepare("SELECT published FROM attachments WHERE attachment_id='z-website-file'").first('published'),1);
  t.diagnostic(JSON.stringify({websitePickerBefore:before.reads,websitePickerAfter4000Recordings:after.reads,exactWebsiteFile:exact.reads}));
 }finally{await f.close();}
});
