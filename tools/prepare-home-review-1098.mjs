// Build an allowlisted UI overlay on the exact verified, sanitised199-file tree.
import {cp,mkdir,readdir,readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(new URL('..',import.meta.url).pathname),baseline=resolve(root,'../AcademyStudio-recording-title/local-content/release-1097/public');
const target=resolve(process.argv[2]||resolve(root,'local-content/home-review-1098-final/public'));
const overlays=['circles-dashboard.mjs','shared/circle-days.mjs','shared/weekly-timetable.mjs','shared/circles-dashboard-view.mjs','shared/learning-circle.css','shared/public-home.css'];
async function manifest(dir){const files={};async function visit(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const path=resolve(folder,entry.name);if(entry.isSymbolicLink())throw Error('Public symlink rejected');if(entry.isDirectory())await visit(path);else files[relative(dir,path)]=createHash('sha256').update(await readFile(path)).digest('hex');}}await visit(dir);return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)));}
const recorded=JSON.parse(await readFile(resolve(baseline,'../asset-manifest.json'),'utf8')),before=await manifest(baseline);
if(recorded.version!=='109.7'||Object.keys(before).length!==199||JSON.stringify(before)!==JSON.stringify(Object.fromEntries(Object.entries(recorded.manifest).sort(([a],[b])=>a.localeCompare(b)))))throw Error('The verified109.7 baseline changed');
try{await stat(target);throw Error('Choose a fresh output directory');}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(resolve(target,'..'),{recursive:true});await cp(baseline,target,{recursive:true});for(const path of overlays)await cp(resolve(root,'public',path),resolve(target,path));
const after=await manifest(target),changed=Object.keys(after).filter(key=>before[key]!==after[key]);
if(Object.keys(after).length!==199||Object.keys(before).some(key=>!after[key])||changed.some(key=>!overlays.includes(key))||changed.length!==overlays.length)throw Error('Unexpected asset delta');
const report={basedOn:'109.7',versionStampOwner:'paired release Root',files:199,changed,unchanged:199-changed.length,privatePayloadsAdded:0,previewAdaptersAdded:0,baselineManifest:before,manifest:after};
await writeFile(resolve(target,'../asset-manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,baselineManifest:undefined,manifest:undefined,publicRoot:target}));
