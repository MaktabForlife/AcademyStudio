// Local next-release review only. Preserve the exact reviewed V109.2 tree;
// never serve raw public/ or copy author packages into a release composition.
import {cp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(new URL('..',import.meta.url).pathname);
const baseline=resolve(root,'../AcademyStudio-release-1092/local-content/release-1092/public');
const target=resolve(root,'local-content/unified-pages/public');
async function manifest(dir){
 const files={};
 async function visit(folder){for(const item of await readdir(folder,{withFileTypes:true})){
  if(item.isSymbolicLink())throw Error('No public symlinks.');
  const path=resolve(folder,item.name);if(item.isDirectory())await visit(path);else files[relative(dir,path)]=createHash('sha256').update(await readFile(path)).digest('hex');
 }}
 await visit(dir);return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)));
}
const before=await manifest(baseline),expected=JSON.parse(await readFile(resolve(baseline,'../asset-manifest.json'),'utf8'));
if(expected.version!=='109.2'||Object.keys(before).length!==166||JSON.stringify(before)!==JSON.stringify(expected.manifest))throw Error('Review the changed V109.2 baseline.');
await mkdir(target,{recursive:true});await cp(baseline,target,{recursive:true});
const overlays=['app.mjs','circles-login.mjs','shared/header-dates.mjs','shared/mou-classroom.mjs','shared/programme-shell.mjs','shared/programme-shell.css'];
for(const file of overlays)await cp(resolve(root,'public',file),resolve(target,file));
const template=resolve(target,'studio/index.html');let html=await readFile(template,'utf8');
html=html.replace('</head>','<link rel="stylesheet" href="/shared/programme-shell.css"></head>').replace('<body class="','<body class="circles-programme-page ');
await writeFile(template,html);
const after=await manifest(target),allowed=[...overlays,'studio/index.html'],changed=Object.keys(after).filter(file=>after[file]!==before[file]);
if(Object.keys(after).length!==168||Object.keys(before).some(file=>!after[file])||changed.some(file=>!allowed.includes(file)))throw Error('Unreviewed public asset change.');
const report={status:'LOCAL_REVIEW_ONLY',basedOn:'109.2',files:168,changed,unchanged:Object.keys(before).filter(file=>before[file]===after[file]).length,privatePayloadsAdded:0,previewAdaptersAdded:0,manifest:after};
await writeFile(resolve(target,'../asset-manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,manifest:undefined}));
