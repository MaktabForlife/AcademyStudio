import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {existsSync} from 'node:fs';import {prepareParallelContent} from '../tools/prepare-parallel-content.mjs';import {previewFixture,loadPreparedPreview} from './preview-fixture.mjs';
const source=resolve(process.env.REVIEWED_CONTENT_ROOT||'../../outputs/independent-websites-20261028');
test('real parallel content bootstrap creates no synthetic or real authority and cannot reset later content',{skip:!existsSync(join(source,'private/import-index.json'))},async()=>{
 const out=await mkdtemp(join(tmpdir(),'academy-parallel-content-')),f=await previewFixture();try{
  const plan=await prepareParallelContent(source,out);await loadPreparedPreview(f,plan);
  assert.equal(plan.websites.length,9);assert.equal(plan.objects.length,55);
  for(const table of ['accounts','participation','staff','paid_months','surah_grants','sessions','handoffs','timetable'])assert.equal(await f.db.prepare('SELECT count(*) AS n FROM '+table).first('n'),0,table);
  let lessons=0;for(const site of plan.websites){const row=await f.db.prepare('SELECT draft_key,published_key FROM websites WHERE website_id=?').bind(site.id).first();for(const key of [row.draft_key,row.published_key]){const actual=await f.content.get(key),expected=plan.objects.find(o=>o.key===key&&o.bucket==='CONTENT');assert.deepEqual(Buffer.from(await actual.arrayBuffer()),await readFile(expected.file));}const object=await f.content.get(row.draft_key);lessons+=JSON.parse(await object.text()).lessons.length;}
  assert.equal(lessons,91);await f.run('UPDATE websites SET revision=9 WHERE website_id=?',plan.websites[0].id);
  await assert.rejects(()=>f.run(plan.statements[0].sql,...plan.statements[0].args));assert.equal(await f.db.prepare('SELECT revision FROM websites WHERE website_id=?').bind(plan.websites[0].id).first('revision'),9);
 }finally{await f.close();await rm(out,{recursive:true,force:true});}
});
