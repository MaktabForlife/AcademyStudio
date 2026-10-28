import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {seedReviewedWebsites} from './seed-reviewed-websites.mjs';
import {PREVIEW_ACCOUNTS,previewAccessCode} from '../src/preview-identity.mjs';

export function testRights(index){
 const course=index.websites.find(w=>w.key==='kahf'),surah=index.websites.find(w=>w.key==='yaseen');if(!course||!surah)throw Error('Expected the reviewed Course and Tafseer identities.');
 const statements=PREVIEW_ACCOUNTS.map(a=>({sql:'INSERT OR IGNORE INTO accounts VALUES(?,?,1,1,1,?,?)',args:[a.id,a.name,Date.now(),a.globalAdmin]}));
 const add=(sql,...args)=>statements.push({sql,args});
 add("INSERT OR IGNORE INTO staff VALUES(?,?,'ADMIN',0)",'preview-course-admin',course.offeringId);
 add("INSERT OR IGNORE INTO participation VALUES(?,?,1,0,1,'preview')",'preview-learner',course.offeringId);
 add("INSERT OR IGNORE INTO participation VALUES(?,?,0,0,0,'preview')",'preview-learner',surah.offeringId);
 add("INSERT OR IGNORE INTO paid_months VALUES(?,?,?,'preview','Synthetic preview purchase only')",'preview-learner',surah.offeringId,'2026-10');
 for(const site of index.websites.filter(w=>w.key!=='kahf'&&!w.migrationLocationPending))add('UPDATE websites SET completion_month=? WHERE website_id=? AND revision=1 AND draft_key=? AND published_key=?','2026-10',site.websiteId,site.draft.key,site.published.key);
 add("INSERT OR IGNORE INTO surah_grants VALUES(?,?,'Synthetic website-only preview grant; no recording access')",'preview-surah',surah.websiteId);
 return statements;
}
export async function preparePrivatePreview(directory,output){
 const root=resolve(directory),out=resolve(output),index=JSON.parse(await readFile(join(root,'private/import-index.json'),'utf8'));
 if(index.websites.length!==9)throw Error('Expected exactly nine reviewed website copies.');
 await mkdir(join(out,'objects'),{recursive:true,mode:0o700});
 const statements=[],objects=new Map(),put=bucket=>async(key,value,options)=>{
  if(key.split('/').some(p=>p==='..'||p==='')||key.startsWith('/'))throw Error('Invalid object key.');
  const data=Buffer.from(value),sha256=createHash('sha256').update(data).digest('hex'),file=join(out,'objects',sha256),identity=bucket+':'+key;
  if(objects.has(identity)&&objects.get(identity).sha256!==sha256)throw Error('Conflicting object.');
  await writeFile(file,data,{mode:0o600});objects.set(identity,{bucket,key,file,sha256,size:data.length,contentType:options?.httpMetadata?.contentType||'application/octet-stream'});
 };
 const run=async(sql,...args)=>{statements.push({sql:sql.replace(/^INSERT INTO /,'INSERT OR IGNORE INTO '),args});};
 const summary=await seedReviewedWebsites({run,content:{put:put('CONTENT')},media:{put:put('MEDIA')},source:{f:{actors:{global:'preview-admin'}}}},root);
 // Rights follow the existing Course purchase / Tafseer paid-month / explicit
 // website-only grant gates. They are deliberately synthetic, never imported.
 statements.push(...testRights(index));
 const importId='preview-nine-websites-bootstrap-v1',importHash=createHash('sha256').update(JSON.stringify(index.websites.map(w=>[w.websiteId,w.draft.sha256,w.published.sha256]))).digest('hex');
 // A completed import cannot reset edited drafts or re-grant revoked rights.
 // An interrupted first import can resume before private access is deployed.
 statements.unshift({sql:'INSERT OR REPLACE INTO guards VALUES(?,NOT EXISTS(SELECT 1 FROM operations WHERE operation_id=?))',args:[importId,importId]});
 statements.push({sql:'INSERT INTO operations VALUES(?,?,?,?,?)',args:[importId,'preview-bootstrap',importHash,JSON.stringify({websites:9,imported:true}),Date.now()]},{sql:'DELETE FROM guards WHERE guard_id=?',args:[importId]});
 const literal=x=>typeof x==='number'?String(x):x===null?'NULL':"'"+String(x).replaceAll("'","''")+"'";
 const sql=statements.map(s=>{let n=0;const text=s.sql.replace(/\?/g,()=>literal(s.args[n++]));if(n!==s.args.length)throw Error('SQL binding mismatch.');return text+';';}).join('\n');
 await writeFile(join(out,'seed.sql'),sql+'\n',{mode:0o600});
 const plan={format:'ACADEMYSTUDIO_PRIVATE_PREVIEW_V1',accountId:'2b01ca929611669e032703ff19f7098f',databaseId:'32b77898-0481-478f-aba7-a097e7de161d',summary,statements,objects:[...objects.values()],websites:index.websites.map(w=>({key:w.key,id:w.websiteId,offeringId:w.offeringId,title:w.title,published:w.published,draft:w.draft}))};
 await writeFile(join(out,'seed-plan.json'),JSON.stringify(plan,null,2),{mode:0o600});
 let access;try{access=JSON.parse(await readFile(join(out,'private-access.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;access={secret:randomBytes(48).toString('base64url'),deadline:Date.now()+7*86400_000};await writeFile(join(out,'private-access.json'),JSON.stringify(access),{mode:0o600});}
 await writeFile(join(out,'worker-secrets.json'),JSON.stringify({PREVIEW_INVITE_SECRET:access.secret}),{mode:0o600});
 const origin='https://academy-studio-preview.naidu-hajira.workers.dev',lines=['# Private AcademyStudio test access','','These links provide temporary access to private copies. Keep them private. They do not use Academy credentials.','','Open a link, then select **Open preview**. For each role, use a separate browser profile/private window, or sign out before switching. Account switching clears open reader/editor views.','','| Test account | Access |','| --- | --- |'];
 for(const a of PREVIEW_ACCOUNTS){const code=await previewAccessCode(access.secret,a.id,access.deadline),url=origin+'/preview/#'+new URLSearchParams({access:code,view:a.id==='preview-admin'||a.id==='preview-course-admin'?'builder':'reader'});lines.push('| '+a.name+' | [Open private preview]('+url+') |');}
 lines.push('','Administrator: all nine websites and the full builder. Course Administrator: Al Kahf only. Learner: Al Kahf purchase plus seven Tafseer websites through a synthetic paid month. Surah Grantee: Yaseen only; no recordings. Without Enrolment: no private websites. Foundations is available to the administrator for testing; its live public location/access is unchanged.','','Both editors use the same private draft. Save stays private; Publish changes only this preview. Previous editions remain recoverable. Test edits persist here.','','These copies contain 91 lessons and deduplicated artwork. Real learner information, private answers, lesson PDF/recording inventories, Zoom links and Academy Library have not been migrated. You can test new preview-only media uploads and reuse.','','Access expires '+new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',dateStyle:'full',timeStyle:'short'}).format(new Date(access.deadline))+' Riyadh time.');
 await writeFile(join(out,'ACCESS.md'),lines.join('\n')+'\n',{mode:0o600});
 return {websites:9,objects:objects.size,sqlStatements:statements.length,deadline:access.deadline,out};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];if(!args.includes('--content')||!args.includes('--output'))throw Error('Choose --content and private --output paths.');console.log(JSON.stringify(await preparePrivatePreview(value('--content'),value('--output'))));}
