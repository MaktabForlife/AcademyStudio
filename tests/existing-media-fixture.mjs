import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fixture} from './fixture.mjs';
import {accessFixture,signIn} from './access-fixture.mjs';
import {pdf,checksum,seedInventory} from './media-inventory-fixture.mjs';
import {openMediaInventory} from '../../Academy-website-studio/backend/tools/website-media-inventory.mjs';
import {planMediaPage} from '../tools/media-import-plan.mjs';
import {contentHash} from '../tools/reconciled-content.mjs';
import {stageMediaTransfer} from '../tools/stage-media-transfer.mjs';
import {Store} from '../src/database.mjs';
import {sha256} from '../src/protocol.mjs';
import {existingMediaMigration} from '../tools/migrate-existing-media.mjs';

function metered(db){
 const metrics={queries:0,rowsRead:0,rowsWritten:0};return {metrics,prepare(sql){let args=[];const statement={bind(...values){args=values;return statement;},async all(){const r=await db.prepare(sql).bind(...args).all();metrics.queries++;metrics.rowsRead+=r.meta.rows_read;metrics.rowsWritten+=r.meta.rows_written;return r;},async first(column){const row=(await statement.all()).results[0];return column?row?.[column]??null:row||null;}};return statement;}};
}
export async function existingMediaFixture({offeringOnlyVideo=false}={}){
 const f=await fixture({academy:true,authorityMode:'ACADEMY'}),directory=await mkdtemp(join(tmpdir(),'existing-media-migration-'));
 try{
  const x=await accessFixture(f);await seedInventory(x.db,x.programA);
  const inventory=await openMediaInventory(x.db,{activityKey:x.programA,objectNamespace:'local/'}),page=await inventory.page();
  const native=planMediaPage(page,{associations:page.lessons[0].assets.map(a=>({sourceLessonId:'a-published',sourceAssetId:a.sourceAssetId,...(offeringOnlyVideo&&a.kind==='YOUTUBE'?{offeringOnly:true}:{websiteId:'site-surah'})}))});
  const published=await f.content.get('websites/site-surah/versions/seed.json'),bytes=Buffer.from(await published.arrayBuffer()),version=contentHash(bytes),key='websites/site-surah/versions/'+version+'.json';
  await f.content.put(key,bytes);await f.run("UPDATE websites SET published_key=? WHERE website_id='site-surah'",key);
  const sourceRoot=join(directory,'source'),staged=join(directory,'staged');await mkdir(join(sourceRoot,'objects'),{recursive:true,mode:0o700});
  const file={file:'objects/'+checksum+'.pdf',sha256:checksum,bytes:pdf.length};await writeFile(join(sourceRoot,file.file),pdf,{mode:0o600});
  const payload={format:'CIRCLES_MEDIA_TRANSFER_PLAN_V1',localOnly:true,sources:[native.source],objects:native.objects.map(object=>({object,localFile:object.kind==='PDF'?file:null})),attachments:native.attachments,
   editions:[{websiteId:'site-surah',published:version,existingDraft:'seed',reviewDraft:'private-candidate'}],readyToAdmit:false,readyToPublish:false};
  const plan={...payload,planSha256:contentHash(payload)},receipt=await stageMediaTransfer(plan,{sourceRoot,destination:staged});
  const admin=await signIn(f,'global'),learner=await signIn(f),grant=await signIn(f,'studentB'),env={...f.env,DB:f.db,MEDIA:f.media,CONTENT:f.content};
  const actor=await new Store(env).actor(await sha256(admin.slice(admin.indexOf('=')+1))),source=metered(x.db);
  const options={env,actor,plan,receipt,stagedDirectory:staged,openInventory:async()=>openMediaInventory(source,{activityKey:x.programA,objectNamespace:'local/'})};
  return {f,x,admin,learner,grant,options,source,plan,receipt,migration:existingMediaMigration(options),async close(){await f.close();await rm(directory,{recursive:true,force:true});}};
 }catch(error){await f.close();await rm(directory,{recursive:true,force:true});throw error;}
}
