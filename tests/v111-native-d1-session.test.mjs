import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {applyTargetSchema} from './target-schema.mjs';

test('native Studio permission capture reuses the open D1 session in workerd',async()=>{
 const adapter=fileURLToPath(new URL('../security/v2/native-adapter.mjs',import.meta.url));
 const script=(await build({
  stdin:{contents:`
   import {StudioNativeAdapter} from ${JSON.stringify(adapter)};
   export default {
    async fetch(request,env){
     const session=env.DB.withSession('first-primary');
     if(typeof session.withSession!=='undefined')throw Error('Expected the D1 session interface');
     const adapter=new StudioNativeAdapter({
      env,dependencies:[{id:'studio:test',scope:'GLOBAL',ownerEpoch:'fixture'}]
     });
     const result=await adapter.capture({sub:'learner',sourceCredentialEpoch:1,offeringIds:['tafseer']});
     return Response.json(result.rights.scopes);
    }
   };
  `,resolveDir:process.cwd()},
  bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers']
 })).outputFiles[0].text;
 const runtime=new Miniflare(convertV4MiniflareOptions({workers:[{
  name:'studio-native-d1',modules:true,script,compatibilityDate:'2026-09-28',
  compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'studio-native-d1'}
 }]}));
 try{
  const db=await runtime.getD1Database('DB','studio-native-d1');
  await applyTargetSchema(db);
  await db.batch([
   db.prepare('CREATE TABLE jwt_v2_dependencies (id TEXT, scope TEXT, owner_epoch TEXT, revision INTEGER)'),
   db.prepare("INSERT INTO jwt_v2_dependencies VALUES('studio:test','GLOBAL','fixture',1)"),
   db.prepare("INSERT INTO accounts VALUES('learner','Synthetic learner',1,1,1,1,0)"),
   db.prepare("INSERT INTO offerings VALUES('tafseer','TAFSEER','Synthetic Tafseer',1,1)"),
   db.prepare("INSERT INTO participation VALUES('learner','tafseer',1,0,0,'cohort-A')"),
   db.prepare("INSERT INTO paid_months VALUES('learner','tafseer','2026-11','cohort-A','Synthetic grant')")
  ]);
  const response=await runtime.dispatchFetch('https://studio.test/');
  assert.equal(response.status,200,await response.clone().text());
  const [scope]=await response.json();
  assert.equal(scope.offering_id,'tafseer');
  assert.equal(scope.enrolled,1);
  assert.deepEqual(scope.paidMonths,[{month:'2026-11',cohort:'cohort-A'}]);
 }finally{
  await runtime.dispose();
 }
});
