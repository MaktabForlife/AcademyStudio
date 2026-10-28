import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createWebsitePackage,stableContentIds} from '../src/website-package.mjs';
import {referencedAssets} from '../public/shared/model.mjs';

const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
if(!args.includes('--project-root')||!args.includes('--output'))throw Error('Specify local --project-root and --output directories.');
const root=resolve(option('--project-root')),out=resolve(option('--output'));
if(out===root||out.startsWith(join(root,'sources')+'/'))throw Error('Choose a separate generated output directory.');
const names=['kahf','saffat','yaseen','sajdah','ankabut','luqman','muzammil','qasas','foundations'];
const selected=args.includes('--only')?option('--only').split(','):names;
if(selected.some(key=>!names.includes(key)))throw Error('Choose a known course key.');
const titleKey={'Surah Al Kahf':'kahf','Surah As-Saffat':'saffat','Surah Yaseen':'yaseen','Surah As-Sajdah':'sajdah','Surah Al-Ankabut':'ankabut','Surah Luqman':'luqman','Surah Al-Muzzammil':'muzammil','Surah Al-Qasas':'qasas','Foundations of Tafseer':'foundations'};
const hash=value=>createHash('sha256').update(value).digest('hex');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const audit=await json(join(root,'outputs/tafseer-source-edition/final-accepted-audit.json'));
const accepted=audit.flatMap(value=>value.results||[]),catalog=[];
const identities=new Map(),bytes=new Map(),report={localOnly:true,hostedChanges:false,publishedSource:'Saved published snapshots; a fresh authorised source check is required before any eventual live migration.',websites:[]};
await mkdir(join(out,'private'),{recursive:true});

for(const name of selected){
 const scope=accepted.find(row=>titleKey[row.name]===name);if(!scope)throw Error('Missing saved identity for '+name);
 const websiteId=scope.surah_id||scope.activity_key.slice(7);
 const publishedSource=name==='foundations'?'outputs/foundations-editorial-review/foundations-release.json':`outputs/course-editorial-review/${name}-before.json`;
 const draftSource=name==='foundations'?publishedSource:`outputs/course-editorial-review/${name}-reviewed.json`;
 const publishedBundle=await json(join(root,publishedSource)),draftBundle=await json(join(root,draftSource));
 const allAssets=new Map([...publishedBundle.assets,...draftBundle.assets].map(asset=>[asset.id,asset]));
 const edition=async(bundle,source,kind)=>{
  const original=JSON.stringify(bundle.course),doc=structuredClone(bundle.course),refs=referencedAssets(doc),media=[];
  for(const assetId of refs){
   const asset=bundle.assets.find(row=>row.id===assetId)||allAssets.get(assetId);if(!asset?.data)throw Error(`${name}: byte source for stable asset ${assetId} is unavailable. Obtain an explicit mapping; do not guess by filename.`);
   const data=Buffer.from(asset.data,'base64'),sha256=hash(data);
   if(asset.size!==undefined&&asset.size!==data.length)throw Error('Asset size mismatch: '+assetId);
   if(identities.has(assetId)&&identities.get(assetId)!==sha256)throw Error('Stable asset ID has conflicting bytes; obtain an explicit migration mapping: '+assetId);identities.set(assetId,sha256);
   const byteKey='media-bytes/'+sha256;bytes.set(sha256,data);
   media.push({assetId,kind:asset.type.startsWith('image/')?'IMAGE':asset.type==='application/pdf'?'PDF':'VIDEO',mimeType:asset.type,size:data.length,sha256,byteKey});
  }
  const packageValue=createWebsitePackage({websiteId,document:doc,media});
  assert.equal(JSON.stringify(packageValue.document),original,'Content must not change during conversion.');
  assert.deepEqual(stableContentIds(packageValue.document),stableContentIds(bundle.course));
  const body=JSON.stringify(doc),sha256=hash(body),key=`websites/${websiteId}/versions/${sha256}.json`,path=join(out,'objects',key);
  await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,body);
  await writeFile(join(out,'private',`${name}-${kind}-package.json`),JSON.stringify(packageValue));
  return {kind,key,sha256,bytes:Buffer.byteLength(body),source,sourceSha256:hash(await readFile(join(root,source))),ids:stableContentIds(doc),media};
 };
 const published=await edition(publishedBundle,publishedSource,'published'),draft=await edition(draftBundle,draftSource,'draft');
 const record={key:name,websiteId,offeringId:scope.activity_key.split(':').slice(1).join(':'),title:draftBundle.course.name,address:'/?website='+encodeURIComponent(websiteId),legacyAddress:scope.surah_id?'/academy/course-websites/view/?program='+encodeURIComponent(scope.activity_key.slice(8))+'&surah='+websiteId:'/academy/course-websites/view/?course='+encodeURIComponent(websiteId),published,draft,enabled:Boolean(scope.enabled),public:name==='foundations',migrationLocationPending:name==='foundations',nativeMediaBinding:'Requires authorised stable media-reference inventory; do not copy or infer PDFs/recordings.'};
 catalog.push(record);
 report.websites.push({key:name,websiteId,exactContentPreserved:true,exactIdsPreserved:true,draftDiffers:published.sha256!==draft.sha256,publishedBytes:published.bytes,draftBytes:draft.bytes,lessonCount:draft.ids.lessons.length,reflectionCount:draft.ids.reflections.length,referencedAssets:draft.media.length,foundationsLocationPending:record.migrationLocationPending});
}
for(const [sha256,data]of bytes){const path=join(out,'objects/media-bytes',sha256);await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,data);}
await writeFile(join(out,'private/import-index.json'),JSON.stringify({format:'LOCAL_WEBSITE_MIGRATION_V1',websites:catalog},null,2));
report.totalLessons=report.websites.reduce((sum,site)=>sum+site.lessonCount,0);report.distinctMediaBytes=[...bytes.values()].reduce((sum,data)=>sum+data.length,0);report.distinctMediaObjects=bytes.size;
await writeFile(join(out,'preservation-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({localOnly:true,output:relative(root,out),websites:report.websites.length,lessons:report.totalLessons,exactContentPreserved:true,distinctMediaObjects:bytes.size}));
