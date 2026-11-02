// Only these reviewed edits may overlay the exact deployed V109.11 asset tree.
import {cp,mkdir,readdir,readFile,writeFile,lstat,rm} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import {createHash} from 'node:crypto';
export const overlays=Object.freeze(['index.html','studio/index.html','app.mjs','admin.mjs','builder/index.html','builder/admin.mjs','circles-entry.js','circles-home-entry.mjs','circles/app.js','circles/index.html','circles/course-source.mjs','circles/mothers-subject-source.mjs','circles/podcast-view.mjs','circles/free-learning.html','circles/academy/mothers/surah-al-baqarah/index.html','prospectus-2027.html','shared/canonical-circles.mjs','shared/circles-routes.mjs','shared/builder-shell.css','shared/native-course-links.mjs']);
export const retired=Object.freeze(['preview','import','circles/mothers-library.js','circles/mothers-timetable.js','circles/mothers-library.css','circles/prospectus-2027.html','shared/circles-home.mjs','shared/circles-home.css','shared/circles-navigation.mjs','shared/reviewed-website-import.mjs']);
const htmlEntries=['index.html','studio/index.html','builder/index.html','circles/index.html','circles/free-learning.html','circles/academy/mothers/surah-al-baqarah/index.html','prospectus-2027.html'];
async function manifest(dir){const files={};async function visit(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const path=resolve(folder,entry.name);if(entry.isSymbolicLink())throw Error('Public symlink rejected');if(entry.isDirectory())await visit(path);else files[relative(dir,path)]=createHash('sha256').update(await readFile(path)).digest('hex');}}await visit(dir);return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)));}
export async function prepare({root=resolve(import.meta.dirname,'..'),target,baseline=resolve(root,'../AcademyStudio-media-dashboard-release-10911/local-content/release-10911/public'),receipt=resolve(root,'../../outputs/academy-media-dashboard-release-10911-20261102/studio-assets.json')}={}){
 if(!target)throw Error('Choose a fresh output directory');target=resolve(target);
 const before=await manifest(baseline),recorded=JSON.parse(await readFile(receipt,'utf8'));
 if(recorded.version!=='109.11'||Object.keys(before).length!==205||JSON.stringify(before)!==JSON.stringify(Object.fromEntries(Object.entries(recorded.manifest).sort(([a],[b])=>a.localeCompare(b)))))throw Error('The verified V109.11 baseline changed');
 try{await lstat(target);throw Error('Choose a fresh output directory');}catch(error){if(error.code!=='ENOENT')throw error;}
 await mkdir(dirname(target),{recursive:true});await cp(baseline,target,{recursive:true});
 for(const path of retired)await rm(resolve(target,path),{force:true,recursive:true});
 for(const path of overlays){await mkdir(dirname(resolve(target,path)),{recursive:true});await cp(resolve(root,'public',path),resolve(target,path));}
 const after=await manifest(target),removed=Object.keys(before).filter(path=>!after[path]),changed=Object.keys(after).filter(path=>before[path]!==after[path]);
 if(changed.some(path=>!overlays.includes(path))||removed.some(path=>!retired.some(item=>path===item||path.startsWith(item+'/'))))throw Error('Unexpected public delta');
 const entries=Object.keys(after).filter(path=>path.endsWith('.html')).sort();if(JSON.stringify(entries)!==JSON.stringify([...htmlEntries].sort()))throw Error('Unapproved HTML entry');
 for(const path of Object.keys(after)){
  if(/^(preview|import)\//.test(path)||/private|local-content|__local/.test(path))throw Error('Non-production public asset');
  if(!/\.(html|js|mjs)$/.test(path))continue;
  const text=await readFile(resolve(target,path),'utf8');
  if(/concept=|view=website|branch=studio|\?branch=|\/(?:preview|import)\//.test(text))throw Error('Retired navigation in '+path);
  if(path==='circles/app.js'&&/communityDashboard|journalWebsite|courtyardWebsite|Sample learner|Sample session|Demo assignments|Preview another role|Compare designs/.test(text))throw Error('Prototype renderer in homepage');
 }
 const report={basedOn:'109.11',baselineCommit:'a8ca4f18f70837eef30b0b6fc161e5e798b37c09',versionStampOwner:'paired release Root',files:Object.keys(after).length,htmlEntries:entries,changed,removed,unchanged:Object.keys(after).length-changed.length,privatePayloadsAdded:0,manifest:after};
 await writeFile(resolve(target,'../asset-manifest.json'),JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){const target=process.argv[2];const report=await prepare({target});console.log(JSON.stringify({...report,manifest:undefined,publicRoot:resolve(target)}));}
