// Homepage version-label overlay on the verified V109.1 public composition.
import {cp,mkdir,readFile,readdir,writeFile,stat} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(new URL('..',import.meta.url).pathname),baseline=resolve(root,'local-content/release-1091/public'),target=resolve(root,'local-content/release-10911/public');
const receipt=JSON.parse(await readFile(resolve(root,'../../outputs/academy-release-1091-20261031/release-verification.json'),'utf8'));
if(receipt.status!=='DEPLOYED_AND_VERIFIED'||receipt.version!=='109.1')throw Error('Verify V109.1 before composing.');
async function manifest(dir){const files={};async function visit(folder){for(const item of await readdir(folder,{withFileTypes:true})){if(item.isSymbolicLink())throw Error('No public symlinks.');const file=resolve(folder,item.name);if(item.isDirectory())await visit(file);else files[relative(dir,file)]=createHash('sha256').update(await readFile(file)).digest('hex');}}await visit(dir);return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)));}
const before=await manifest(baseline),verified=JSON.parse(await readFile(resolve(root,'local-content/release-1091/asset-manifest.json'),'utf8')).manifest;
if(JSON.stringify(before)!==JSON.stringify(verified))throw Error('The frozen V109.1 composition changed.');
try{await stat(target);throw Error('Do not overwrite a reviewed composition.');}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(resolve(target,'..'),{recursive:true});await cp(baseline,target,{recursive:true});
await cp(resolve(root,'public/circles-login.mjs'),resolve(target,'circles-login.mjs'));
await cp(resolve(root,'public/shared/circles-workspaces.css'),resolve(target,'shared/circles-workspaces.css'));
for(const file of ['index.html','circles/index.html']){let html=await readFile(resolve(target,file),'utf8');html=html.replace('</head>','<meta name="academy-release-version" content="109.1.1"></head>').replaceAll('/shared/circles-workspaces.css?v=109.1"','/shared/circles-workspaces.css?v=109.1.1"').replaceAll('/circles-login.mjs?v=109.1"','/circles-login.mjs?v=109.1.1"');await writeFile(resolve(target,file),html);}
const after=await manifest(target),allowed=['index.html','circles/index.html','circles-login.mjs','shared/circles-workspaces.css'],changed=Object.keys(after).filter(file=>after[file]!==before[file]);
if(Object.keys(before).length!==162||Object.keys(after).length!==162||Object.keys(before).some(file=>!after[file])||changed.some(file=>!allowed.includes(file)))throw Error('Unreviewed public asset change.');
const report={version:'109.1.1',basedOn:'109.1',files:162,changed,unchanged:162-changed.length,privatePayloadsAdded:0,previewAdaptersAdded:0,manifest:after};
await writeFile(resolve(target,'../asset-manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,manifest:undefined}));
