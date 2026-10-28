import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {fixture} from '../tests/fixture.mjs';
import {seedReviewedWebsites} from './seed-reviewed-websites.mjs';
import {stableContentIds} from '../src/website-package.mjs';
const args=process.argv.slice(2),option=key=>args[args.indexOf(key)+1];
if(!args.includes('--content')||!args.includes('--report'))throw Error('Choose local --content and --report paths.');
const root=resolve(option('--content')),reportPath=resolve(option('--report')),index=JSON.parse(await readFile(join(root,'private/import-index.json'),'utf8'));
const f=await fixture(),result={localOnly:true,hostedCalls:0,nativeRuntime:true,websites:[],mediaBindings:'Original Academy attachment inventory remains pending. No PDFs or recordings copied.'};
const ok=response=>{assert.equal(response.status,200,JSON.stringify(response.body));return response.body;};
try{
 result.seed=await seedReviewedWebsites(f,root);const cookie=(await f.login('admin')).cookie,learner=(await f.login('learner')).cookie;
 for(const website of index.websites){
  const url='/api/websites/'+encodeURIComponent(website.websiteId),source=JSON.parse(await readFile(join(root,'objects',website.draft.key),'utf8')),published=JSON.parse(await readFile(join(root,'objects',website.published.key),'utf8'));
  const opened=await f.request(url+'/edit',{cookie});assert.deepEqual(ok(opened).document,source);assert.deepEqual(stableContentIds(opened.body.document),website.draft.ids);
  if(website.enabled)assert.deepEqual(ok(await f.request(url,{cookie})).document,published);
  let readerRows=null,mediaRangeRows=null;
  if(website.enabled&&!website.migrationLocationPending){
   if(website.key==='kahf')await f.run('INSERT OR IGNORE INTO participation VALUES(?,?,0,0,1,?)','learner',website.offeringId,'');
   else await f.run('INSERT OR IGNORE INTO surah_grants VALUES(?,?,?)','learner',website.websiteId,'Synthetic content rehearsal only');
   const read=await f.request(url,{cookie:learner});assert.deepEqual(ok(read).document,published);readerRows=read.reads;
   const asset=website.published.media[0];if(asset){const range=await f.request('/api/media/review-'+website.websiteId+'-'+asset.assetId,{cookie:learner,headers:{Range:'bytes=0-31'}});assert.equal(range.status,206);assert.equal(range.body.byteLength,32);mediaRangeRows=range.reads;}
  }
  const peers=await f.db.prepare('SELECT * FROM websites WHERE website_id<>? ORDER BY website_id').bind(website.websiteId).all();
  const edited=structuredClone(source);edited.home.description+='\nLocal storage rehearsal.';
  const saved=await f.request(url+'/edit',{cookie,method:'POST',body:{operationId:crypto.randomUUID(),revision:1,action:'save',document:edited}});ok(saved);
  assert.deepEqual(ok(await f.request(url+'/edit',{cookie})).document,edited);
  if(website.enabled)assert.deepEqual(ok(await f.request(url,{cookie})).document,published);
  const released=await f.request(url+'/edit',{cookie,method:'POST',body:{operationId:crypto.randomUUID(),revision:2,action:'publish'}});ok(released);
  assert.deepEqual(ok(await f.request(url,{cookie})).document,edited);
  const savedPublicationReader=readerRows;
  if(website.enabled&&!website.migrationLocationPending){const read=await f.request(url,{cookie:learner});assert.deepEqual(ok(read).document,edited);readerRows=read.reads;const asset=website.draft.media[0];if(asset){const range=await f.request('/api/media/review-'+website.websiteId+'-'+asset.assetId,{cookie:learner,headers:{Range:'bytes=0-31'}});assert.equal(range.status,206);assert.equal(range.body.byteLength,32);mediaRangeRows=range.reads;}}
  const after=await f.db.prepare('SELECT * FROM websites WHERE website_id<>? ORDER BY website_id').bind(website.websiteId).all();assert.deepEqual(after.results,peers.results);
  const restored=await f.request(url+'/edit',{cookie,method:'POST',body:{operationId:crypto.randomUUID(),revision:3,action:'restore',historyRevision:1}});ok(restored);
  assert.deepEqual(ok(await f.request(url+'/edit',{cookie})).document,source);assert.deepEqual(ok(await f.request(url,{cookie})).document,edited);
  result.websites.push({key:website.key,lessons:source.lessons.length,exactDraftAndPublishedPreserved:true,stableIdsPreserved:true,peersUntouched:true,privateSave:true,explicitPublication:true,previousDraftRecoverable:true,rowsRead:{savedPublicationReader,learnerReader:readerRows,artworkRange:mediaRangeRows,editor:opened.reads,save:saved.reads,publish:released.reads,restore:restored.reads}});
 }
 result.totalLessons=result.websites.reduce((sum,row)=>sum+row.lessons,0);await mkdir(resolve(reportPath,'..'),{recursive:true});await writeFile(reportPath,JSON.stringify(result,null,2));console.log(JSON.stringify({report:reportPath,websites:result.websites.length,lessons:result.totalLessons,checks:'passed',localOnly:true}));
}finally{await f.close();}
