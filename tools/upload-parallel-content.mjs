import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const output=resolve(process.argv[2]||'');if(!process.argv[2])throw Error('Choose the prepared private preview output directory.');
const plan=JSON.parse(await readFile(join(output,'content-plan.json'),'utf8')),config=JSON.parse(await readFile('wrangler.parallel.jsonc','utf8'));
if(plan.format!=='ACADEMYSTUDIO_PARALLEL_CONTENT_V1'||plan.accountId!=='2b01ca929611669e032703ff19f7098f'||config.account_id!==plan.accountId||config.name!=='academy-studio-parallel'||config.d1_databases[0].database_id!==plan.databaseId)throw Error('Wrong real parallel target.');
const buckets={CONTENT:'academy-studio-parallel-content',MEDIA:'academy-studio-parallel-media'},completedFile=join(output,'content-uploaded.json');let completed={};try{completed=JSON.parse(await readFile(completedFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
let count=0;
for(const object of plan.objects){
 const identity=object.bucket+':'+object.key;if(completed[identity]===object.sha256){count++;continue;}
 const bytes=await readFile(object.file);if(createHash('sha256').update(bytes).digest('hex')!==object.sha256)throw Error('Staged object checksum changed.');
 if(!buckets[object.bucket]||object.key.split('/').some(p=>p==='..'||p===''))throw Error('Invalid upload target.');
 const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','r2','object','put',buckets[object.bucket]+'/'+object.key,'--remote','--file',object.file,'--content-type',object.contentType,'--config','wrangler.parallel.jsonc','--profile','academy-studio'],{env:{...process.env,CLOUDFLARE_ACCOUNT_ID:plan.accountId,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:'/private/tmp/academy-studio-parallel-upload.log'},encoding:'utf8'});
 if(r.status!==0)throw Error('Parallel object upload failed: '+(r.stderr||r.stdout).slice(-1000));
 completed[identity]=object.sha256;await writeFile(completedFile,JSON.stringify(completed,null,2));count++;if(count%10===0||count===plan.objects.length)console.log(JSON.stringify({uploaded:count,total:plan.objects.length}));
}
console.log(JSON.stringify({objectsReady:count,accountId:plan.accountId,privateBuckets:true,academyRequests:0}));
