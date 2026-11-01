// Local next-release review only. Preserve the exact reviewed V109.3 tree;
// never serve raw public/ or copy author packages into a release composition.
import {cp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(new URL('..',import.meta.url).pathname);
const baseline=resolve(root,'../AcademyStudio-workspace-separation/local-content/release-1093/public');
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
if(expected.version!=='109.3'||Object.keys(before).length!==166||Object.keys(expected.manifest).length!==166||Object.keys(before).some(file=>before[file]!==expected.manifest[file]))throw Error('Review the changed V109.3 baseline.');
await mkdir(target,{recursive:true});await cp(baseline,target,{recursive:true});
const overlays=['builder/admin.mjs','shared/public-page-history.mjs','shared/page-history.mjs','shared/page-history.css','shared/assets/tawakkul-mindset-approved.png','shared/recording-website.css','shared/access-badge.mjs','shared/circles-catalogue.mjs','circles-review.css','shared/circles-block-navigation.mjs','shared/public-home.mjs','shared/public-home.css','shared/dashboard-join.mjs','shared/learning-circle.mjs','shared/learning-circle.css','shared/circles-course-row.mjs','shared/mou-historical-panel.mjs','shared/mou-historical-review.mjs','import/index.html','import/import.mjs','shared/native-mou-import.mjs','admin.mjs','shared/media-admin-panel.mjs','shared/media-attachment.css','shared/media-workflow.mjs','shared/mou-prepared-panel.mjs','shared/mou-prepared-review.mjs','shared/recording-companion.mjs','shared/recording-website.mjs','circles-dashboard.mjs','app.mjs','circles-login.mjs','circles-entry.js','shared/dashboard-home.mjs','shared/header-dates.mjs','shared/mou-classroom.mjs','shared/programme-shell.mjs','shared/programme-shell.css','shared/circles-dashboard-view.mjs'];
for(const file of overlays)await cp(resolve(root,'public',file),resolve(target,file));
for(const file of ['index.html','circles/index.html']){const homeTemplate=resolve(target,file);let homeHtml=await readFile(homeTemplate,'utf8');if(!homeHtml.includes('src="/circles-entry.js"'))homeHtml=homeHtml.replace('<meta charset="UTF-8">','<script src="/circles-entry.js"></script><meta charset="UTF-8">');if(!homeHtml.includes('href="/shared/page-history.css"'))homeHtml=homeHtml.replace('</head>','<link rel="stylesheet" href="/shared/page-history.css"></head>');if(!homeHtml.includes('href="/shared/public-home.css"'))homeHtml=homeHtml.replace('</head>','<link rel="stylesheet" href="/shared/public-home.css"></head>');if(!homeHtml.includes('href="/shared/learning-circle.css"'))homeHtml=homeHtml.replace('</head>','<link rel="stylesheet" href="/shared/learning-circle.css"></head>');await writeFile(homeTemplate,homeHtml);}
for(const page of ['builder/index.html','import/index.html','circles/prospectus-2027.html']){const file=resolve(target,page);let text=await readFile(file,'utf8');text=text.replace('</head>','<link rel="stylesheet" href="/shared/page-history.css"></head>');if(page.includes('prospectus'))text=text.replace('</body>','<script type="module" src="/shared/public-page-history.mjs"></script></body>');await writeFile(file,text);}
const template=resolve(target,'studio/index.html');let html=await readFile(template,'utf8');
html=html.replace('</head>','<link rel="stylesheet" href="/shared/page-history.css"><link rel="stylesheet" href="/shared/programme-shell.css"><link rel="stylesheet" href="/shared/media-attachment.css"></head>').replace('<body class="','<body class="circles-programme-page ');
await writeFile(template,html);
const after=await manifest(target),allowed=[...overlays,'index.html','circles/index.html','studio/index.html','builder/index.html','circles/prospectus-2027.html'],changed=Object.keys(after).filter(file=>after[file]!==before[file]);
if(Object.keys(after).length!==Object.keys(before).length+overlays.filter(file=>!before[file]).length||Object.keys(before).some(file=>!after[file])||changed.some(file=>!allowed.includes(file)))throw Error('Unreviewed public asset change.');
const report={status:'LOCAL_REVIEW_ONLY',basedOn:'109.3',files:Object.keys(after).length,changed,unchanged:Object.keys(before).filter(file=>before[file]===after[file]).length,privatePayloadsAdded:0,previewAdaptersAdded:0,manifest:after};
await writeFile(resolve(target,'../asset-manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,manifest:undefined}));
