import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {seedReviewedWebsites} from './seed-reviewed-websites.mjs';

// Prepare only the reviewed website bodies/artwork. Never seed any identities,
// participation, purchases, staff, months, grants, sessions or preview invitations.
export async function prepareParallelContent(directory,output){
 const root=resolve(directory),out=resolve(output),index=JSON.parse(await readFile(join(root,'private/import-index.json'),'utf8'));
 await mkdir(join(out,'content-objects'),{recursive:true,mode:0o700});
 const objects=new Map(),statements=[],digest=b=>createHash('sha256').update(b).digest('hex');
 const put=bucket=>async(key,value,options)=>{
  if(key.startsWith('/')||key.split('/').some(p=>p==='..'||p===''))throw Error('Invalid object key.');
  const data=Buffer.from(value),sha256=digest(data),identity=bucket+':'+key,file=join(out,'content-objects',sha256);
  if(objects.has(identity)&&objects.get(identity).sha256!==sha256)throw Error('Conflicting immutable object.');
  await writeFile(file,data,{mode:0o600});objects.set(identity,{bucket,key,file,sha256,size:data.length,contentType:options?.httpMetadata?.contentType||'application/octet-stream'});
 };
 const allowed=new Set(['offerings','objects','asset_owners','websites','website_history','attachments','published_assets']);
 const run=async(sql,...args)=>{const table=sql.match(/^INSERT(?: OR IGNORE)? INTO ([a-z_]+)/)?.[1];if(!allowed.has(table))throw Error('Content preparation cannot create or alter access authority.');statements.push({sql:sql.replace(/^INSERT INTO /,'INSERT OR IGNORE INTO '),args});};
 const summary=await seedReviewedWebsites({run,content:{put:put('CONTENT')},media:{put:put('MEDIA')},source:{f:{actors:{global:'ACADEMY_CONTENT_MIGRATION'}}}},root);
 const operationId='parallel-nine-websites-content-v1',payloadHash=digest(JSON.stringify(index.websites.map(w=>[w.websiteId,w.published.sha256,w.draft.sha256])));
 statements.unshift({sql:'INSERT OR REPLACE INTO guards VALUES(?,NOT EXISTS(SELECT 1 FROM operations WHERE operation_id=?))',args:[operationId,operationId]});
 statements.push({sql:'INSERT INTO operations VALUES(?,?,?,?,?)',args:[operationId,'CONTENT_MIGRATION',payloadHash,JSON.stringify({imported:true,websites:index.websites.length,accessSeeded:false}),Date.now()]},{sql:'DELETE FROM guards WHERE guard_id=?',args:[operationId]});
 const plan={format:'ACADEMYSTUDIO_PARALLEL_CONTENT_V1',accountId:'2b01ca929611669e032703ff19f7098f',databaseId:'c261eb73-7145-4f73-940c-5816db287612',summary,objects:[...objects.values()],statements,websites:index.websites.map(w=>({key:w.key,id:w.websiteId,offeringId:w.offeringId,published:w.published,draft:w.draft,migrationLocationPending:w.migrationLocationPending}))};
 await writeFile(join(out,'content-plan.json'),JSON.stringify(plan,null,2)+'\n',{mode:0o600});return plan;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const args=process.argv.slice(2);if(args.length!==2)throw Error('Choose the reviewed content root and private output folder.');const plan=await prepareParallelContent(...args);console.log(JSON.stringify({websites:plan.websites.length,objects:plan.objects.length,statements:plan.statements.length,accessSeeded:false}));}
