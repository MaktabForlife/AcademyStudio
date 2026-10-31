// Review an explicit UI overlay on the deployed frozen V109 composition.
// Never publish raw public/, author payloads or the local workspace adapters.
import {cp,mkdir,readFile,readdir,writeFile,stat} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(new URL('..',import.meta.url).pathname);
const baseline=resolve(root,'../AcademyStudio-launch-109/local-content/release-109/public'),target=resolve(root,'local-content/release-1091/public');
const receipt=JSON.parse(await readFile(resolve(root,'../../outputs/academy-release-109-20261031/release-verification.json'),'utf8'));
if(receipt.status!=='DEPLOYED_AND_VERIFIED'||receipt.version!=='109')throw Error('Verify V109 before composing.');
async function manifest(dir){
 const files={};
 async function visit(folder){
  for(const item of await readdir(folder,{withFileTypes:true})){
   const file=resolve(folder,item.name);
   if(item.isSymbolicLink())throw Error('No public symlinks.');
   if(item.isDirectory())await visit(file);
   else files[relative(dir,file)]=createHash('sha256').update(await readFile(file)).digest('hex');
  }
 }
 await visit(dir);return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)));
}
const before=await manifest(baseline);
if(Object.keys(before).length!==161||before['circles/free-learning/imratun-muminah.json'])throw Error('The frozen baseline changed.');
try{await stat(target);throw Error('Do not overwrite an existing reviewed composition.');}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(resolve(target,'..'),{recursive:true});await cp(baseline,target,{recursive:true});
const overlays=['shared/circles-block-navigation.mjs','shared/circles-workspaces.css'];
for(const file of overlays)await cp(resolve(root,'public',file),resolve(target,file));
const loginFile=resolve(target,'circles-login.mjs'),login=await readFile(loginFile,'utf8');
if(!login.includes("from './shared/circles-block-navigation.mjs'"))throw Error('Review the changed controller imports.');
await writeFile(loginFile,login.replace("from './shared/circles-block-navigation.mjs'","from './shared/circles-block-navigation.mjs?v=109.1'"));
for(const file of Object.keys(before).filter(file=>file.endsWith('.html'))){
 let html=await readFile(resolve(target,file),'utf8');
 const styles='<link rel="stylesheet" href="/shared/circles-workspaces.css?v=109.1">';
 html=html.replace('</head>',(!html.includes('/shared/assets/fonts.css')?'<link rel="stylesheet" href="/shared/assets/fonts.css"><link rel="stylesheet" href="/shared/assets/arabic-font.css">':'')+styles+'</head>');
 if(!['index.html','circles/index.html'].includes(file)&&!file.startsWith('circles/'))html=html.replace(/<body([^>]*)>/,(_all,attrs)=>/\bclass="/.test(attrs)?'<body'+attrs.replace(/class="/,'class="circles-ui-workspace ')+'>':'<body class="circles-ui-workspace"'+attrs+'>');
 html=html.replace('import("/circles-login.mjs")','import("/circles-login.mjs?v=109.1")');
 await writeFile(resolve(target,file),html);
}
const after=await manifest(target),changed=Object.keys(after).filter(key=>after[key]!==before[key]);
if(Object.keys(before).some(key=>!after[key])||Object.keys(after).some(key=>/(?:__preview|workspace-ui-preview|home-editor|imratun-muminah\.json|(?:^|\/)(?:local-content|imports|prepared)\/)/.test(key)))throw Error('The composition contains an excluded asset.');
const allowed=new Set([...overlays,'circles-login.mjs',...Object.keys(before).filter(file=>file.endsWith('.html'))]);
if(changed.some(file=>!allowed.has(file)))throw Error('Unreviewed asset change.');
const report={version:'109.1',basedOn:'109',source:baseline,publicRoot:target,files:Object.keys(after).length,changed,unchanged:Object.keys(before).filter(key=>before[key]===after[key]).length,privatePayloadsAdded:0,previewAdaptersAdded:0,manifest:after};
await writeFile(resolve(target,'../asset-manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,manifest:undefined}));
