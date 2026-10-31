// Finalise the reviewed164-file UI base with explicit native recording/controller overlays.
import {readFile,writeFile,readdir,cp,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(new URL('..',import.meta.url).pathname),publicRoot=resolve(root,'local-content/release-1092/public');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function manifest(dir){const files={};async function visit(folder){for(const item of await readdir(folder,{withFileTypes:true})){if(item.isSymbolicLink())throw Error('Public assets must not contain symlinks.');const file=resolve(folder,item.name);if(item.isDirectory())await visit(file);else files[relative(dir,file)]=digest(await readFile(file));}}await visit(dir);return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)));}
const base=JSON.parse(await readFile(resolve(publicRoot,'../ui-base-manifest.json'),'utf8'));
if(base.files!==164||JSON.stringify(await manifest(publicRoot))!==JSON.stringify(Object.fromEntries(Object.entries(base.manifest).sort(([a],[b])=>a.localeCompare(b)))))throw Error('Review the frozen UI starting tree before composition.');
const overlays=['app.mjs','shared/mou-classroom.mjs','shared/recording-website.mjs','shared/recording-website.css','shared/learner-companion.mjs','shared/native-mou-import.mjs','import/import.mjs','import/index.html','circles-dashboard.mjs'];
for(const file of overlays){await mkdir(resolve(publicRoot,file,'..'),{recursive:true});await cp(resolve(root,'public',file),resolve(publicRoot,file));}
for(const file of ['index.html','circles/index.html']){const path=resolve(publicRoot,file),before=await readFile(path,'utf8');if(!before.includes('content="109.1.1"'))throw Error('The expected homepage version is missing.');await writeFile(path,before.replace('content="109.1.1"','content="109.2"').replaceAll('?v=109.1.1','?v=109.2'));}
const files=await manifest(publicRoot),allowed=new Set([...overlays,'index.html','circles/index.html']),changedFromUI=Object.keys(files).filter(file=>files[file]!==base.manifest[file]);
if(Object.keys(files).length!==166||changedFromUI.some(file=>!allowed.has(file))||Object.keys(base.manifest).some(file=>!files[file]))throw Error('Unexpected release asset delta.');
if(Object.keys(files).some(file=>/(^|\/)(?:node_modules|local-content|tests|tools|private-review|recording-attachments)(\/|\.)/.test(file)))throw Error('Private/local asset found.');
const deployed=JSON.parse(await readFile(resolve(root,'../AcademyStudio-ui-1091/local-content/release-10911/asset-manifest.json'),'utf8')).manifest;
const report={version:'109.2',basedOn:'109.1.1',uiCommit:'3549d68ba2e15c7472e02c3df259d3e46e5f97e4',files:Object.keys(files).length,changedFromUI,changedFromDeployed:Object.keys(files).filter(file=>files[file]!==deployed[file]),unchangedDeployedFiles:Object.keys(deployed).filter(file=>files[file]===deployed[file]).length,privatePayloadsAdded:0,previewAdaptersAdded:0,manifest:files};
await writeFile(resolve(publicRoot,'../asset-manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,manifest:undefined}));
