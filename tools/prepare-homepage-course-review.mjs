// Local-only review of the five-card activation on the verified V109.1.1 tree.
import {cp,mkdir,readdir,readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {activateHomepageFreeCourseCards} from './circles-ui-adaptation.mjs';
const root=resolve(new URL('..',import.meta.url).pathname);
const baseline=resolve(root,'../AcademyStudio-ui-1091/local-content/release-10911/public');
const target=resolve(root,'local-content/homepage-course-review/public');
const release=JSON.parse(await readFile(resolve(root,'../../outputs/academy-release-10911-20261031/release-verification.json'),'utf8'));
if(release.status!=='DEPLOYED_AND_VERIFIED'||release.version!=='109.1.1')throw Error('Verify the current homepage release first.');
async function manifest(dir){
 const files={};async function visit(folder){for(const item of await readdir(folder,{withFileTypes:true})){const file=resolve(folder,item.name);if(item.isSymbolicLink())throw Error('No public symlinks.');if(item.isDirectory())await visit(file);else files[relative(dir,file)]=createHash('sha256').update(await readFile(file)).digest('hex');}}
 await visit(dir);return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)));
}
const before=await manifest(baseline);if(Object.keys(before).length!==162||before['circles/free-learning/imratun-muminah.json'])throw Error('The baseline needs review.');
try{await stat(target);throw Error('Do not overwrite a review build.');}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(resolve(target,'..'),{recursive:true});await cp(baseline,target,{recursive:true});
for(const path of ['shared/circles-course-row.mjs','shared/homepage-free-courses.mjs'])await cp(resolve(root,'public',path),resolve(target,path));
const app=resolve(target,'circles/app.js');await writeFile(app,activateHomepageFreeCourseCards(await readFile(app,'utf8')));
const after=await manifest(target),changed=Object.keys(after).filter(key=>before[key]!==after[key]);
const allowed=new Set(['circles/app.js','shared/circles-course-row.mjs','shared/homepage-free-courses.mjs']);
if(Object.keys(before).some(key=>!after[key])||changed.some(key=>!allowed.has(key))||Object.keys(after).some(key=>/imratun-muminah\.json|__preview|home-editor/.test(key)))throw Error('Unexpected review asset.');
const report={localOnly:true,deployed:false,basedOn:'109.1.1',publicRoot:target,files:Object.keys(after).length,changed,unchanged:Object.keys(before).filter(key=>before[key]===after[key]).length,privatePayloadsAdded:0,manifest:after};
await writeFile(resolve(target,'../asset-manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,manifest:undefined}));
