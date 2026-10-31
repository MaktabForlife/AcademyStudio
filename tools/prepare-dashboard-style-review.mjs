// Local-only style review. Never alter a frozen deployed composition.
import {cp,mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(new URL('..',import.meta.url).pathname),base=resolve(root,'local-content/homepage-dashboard-review/public'),target=resolve(root,'local-content/dashboard-style-review/public');
const previous=JSON.parse(await readFile(resolve(base,'../asset-manifest.json'),'utf8'));
if(!previous.localOnly||previous.files!==163)throw Error('Prepare the reviewed course/programme delta first.');
await mkdir(target,{recursive:true});await cp(base,target,{recursive:true});
for(const file of ['shared/circles-workspaces.css','shared/circles-dashboard-view.mjs','shared/circles-course-row.mjs','circles-dashboard.mjs'])await cp(resolve(root,'public',file),resolve(target,file));
const files={};async function visit(dir){for(const item of await readdir(dir,{withFileTypes:true})){if(item.isSymbolicLink())throw Error('No public symlinks.');const file=resolve(dir,item.name);if(item.isDirectory())await visit(file);else files[relative(target,file)]=createHash('sha256').update(await readFile(file)).digest('hex');}}await visit(target);
const changed=Object.keys(files).filter(file=>files[file]!==previous.manifest[file]);
if(Object.keys(files).length!==163||changed.some(file=>!['shared/circles-workspaces.css','shared/circles-dashboard-view.mjs','shared/circles-course-row.mjs','circles-dashboard.mjs'].includes(file)))throw Error('Unexpected style review asset.');
const deployed=JSON.parse(await readFile(resolve(root,'local-content/release-10911/asset-manifest.json'),'utf8')).manifest,changedFromDeployed=Object.keys(files).filter(file=>files[file]!==deployed[file]);
await writeFile(resolve(target,'../asset-manifest.json'),JSON.stringify({localOnly:true,deployed:false,basedOn:'109.1.1',files:163,changedFromCourseReview:changed,changedFromDeployed,unchangedDeployedFiles:Object.keys(deployed).filter(file=>files[file]===deployed[file]).length,privatePayloadsAdded:0,previewAdaptersAdded:0,manifest:files},null,2)+'\n');
console.log(JSON.stringify({localOnly:true,deployed:false,publicRoot:target,files:163,changedFromCourseReview:changed}));
