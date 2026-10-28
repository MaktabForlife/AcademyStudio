import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {validatePackage} from '../src/content-package.mjs';

// Only the disposable preview harness calls this. No production importer,
// credentials, users, entitlements or hosted bindings are created here.
export async function seedReviewedWebsites(f,directory) {
 const root=resolve(directory),index=JSON.parse(await readFile(join(root,'private/import-index.json'),'utf8'));
 if(index.format!=='LOCAL_WEBSITE_MIGRATION_V1')throw Error('Choose the prepared local content inventory.');
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const learner=f.source?.f.actors.studentA,actor=f.source?.f.actors.global||'admin';
 const mediaBytes=new Set();
 for(const website of index.websites){
  const kind=website.key==='kahf'?'COURSE':'TAFSEER';
  await f.run('INSERT OR IGNORE INTO offerings(offering_id,kind,title,active) VALUES(?,?,?,1)',website.offeringId,kind,kind==='COURSE'?website.title:'Tafseer · local content review');
  for(const edition of [website.published,website.draft]){
   const bytes=await readFile(join(root,'objects',edition.key));if(hash(bytes)!==edition.sha256)throw Error('Content checksum mismatch.');const document=JSON.parse(bytes);const errors=validatePackage(document);if(errors.length)throw Error(errors.join(' '));
   await f.content.put(edition.key,bytes,{httpMetadata:{contentType:'application/json'}});
   for(const media of edition.media){
    if(!mediaBytes.has(media.sha256)){const bytes=await readFile(join(root,'objects',media.byteKey));if(hash(bytes)!==media.sha256)throw Error('Media checksum mismatch.');await f.media.put(media.byteKey,bytes,{httpMetadata:{contentType:media.mimeType}});mediaBytes.add(media.sha256);}
    await f.run('INSERT OR IGNORE INTO objects(asset_id,object_key,mime_type,filename,byte_size,sha256) VALUES(?,?,?,?,?,?)',media.assetId,media.byteKey,media.mimeType,'Course artwork',media.size,media.sha256);
    await f.run('INSERT OR IGNORE INTO asset_owners VALUES(?,?)',media.assetId,website.offeringId);
   }
  }
  await f.run('INSERT INTO websites(website_id,offering_id,title,draft_key,published_key,revision,enabled) VALUES(?,?,?,?,?,1,?)',website.websiteId,website.offeringId,website.title,website.draft.key,website.published.key,Number(website.enabled));
  await f.run('INSERT INTO website_history VALUES(?,0,?,?,?,?)',website.websiteId,'saved-published',website.published.key,Date.now(),actor);
  await f.run('INSERT INTO website_history VALUES(?,1,?,?,?,?)',website.websiteId,'reviewed-private-draft',website.draft.key,Date.now(),actor);
  const media=new Map([...website.published.media,...website.draft.media].map(ref=>[ref.assetId,ref]));
  for(const ref of media.values()){
   const published=website.published.media.some(item=>item.assetId===ref.assetId),attachmentId='review-'+website.websiteId+'-'+ref.assetId;
   await f.run('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,?)',attachmentId,website.offeringId,website.websiteId,ref.assetId,'website-artwork','2026-10-28','','Course artwork','WEBSITE',Number(published));
   if(published)await f.run('INSERT INTO published_assets VALUES(?,?)',website.websiteId,ref.assetId);
  }
  // Explicitly synthetic review rights; no real learner/payments are imported.
  if(learner&&kind==='COURSE')await f.run('INSERT OR IGNORE INTO participation VALUES(?,?,1,0,1,?)',learner,website.offeringId,'');
  if(learner&&kind==='TAFSEER'&&!website.migrationLocationPending)await f.run('INSERT OR IGNORE INTO surah_grants VALUES(?,?,?)',learner,website.websiteId,'Synthetic local review only; no recording rights');
 }
 return {websites:index.websites.length,mediaObjects:mediaBytes.size,foundations:'Migration location pending; existing Academy public access unchanged',nativeMedia:'Reference inventory still required before a real migration'};
}
