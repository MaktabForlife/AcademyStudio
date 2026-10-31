// Freeze the verified V108.8 composition, never the raw source public/ tree.
import {cp,mkdir,readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(new URL('..',import.meta.url).pathname),source=resolve(root,'../AcademyStudio-integration-1088/local-content/release-1088-final/public'),target=resolve(root,'local-content/release-109/public');
const verification=JSON.parse(await readFile(resolve(root,'../../outputs/academy-release-1088-20261031/release-verification.json'),'utf8'));
if(verification.status!=='DEPLOYED_AND_VERIFIED')throw Error('The V108.8 baseline is not verified.');
const manifest=async dir=>{const files={};async function walk(path){for(const entry of await readdir(path,{withFileTypes:true})){const file=resolve(path,entry.name);if(entry.isSymbolicLink())throw Error('Do not publish symbolic links.');if(entry.isDirectory())await walk(file);else files[relative(dir,file)]=createHash('sha256').update(await readFile(file)).digest('hex');}}await walk(dir);return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)));};
const before=await manifest(source);
if(before['circles/free-learning/imratun-muminah.json']||Object.keys(before).some(p=>/(?:^|\/)(?:local-content|imports|prepared)(?:\/|$)/.test(p)))throw Error('Review anonymous content/private author assets before composing.');
try{await stat(target);throw Error('A frozen V109 composition already exists; do not overwrite it.');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(resolve(target,'..'),{recursive:true});await cp(source,target,{recursive:true});
const after=await manifest(target);if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Copied asset hashes differ.');
const report={version:'109',basedOn:'108.8',source,publicRoot:target,files:Object.keys(after).length,allVerifiedAssetsUnchanged:true,manifest:after};
await writeFile(resolve(root,'local-content/release-109/asset-manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({version:report.version,publicRoot:target,files:report.files,allVerifiedAssetsUnchanged:true}));
