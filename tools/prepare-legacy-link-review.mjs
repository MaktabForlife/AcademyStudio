// Frozen local review assets only. Root owns final paired composition/deploy.
import {cp,mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
import {createHash} from 'node:crypto';
const repo=resolve(new URL('..',import.meta.url).pathname),baseline=resolve(process.env.LEGACY_LINK_BASE||resolve(repo,'../AcademyStudio-complete-1094/local-content/release-1094/public')),target=resolve(repo,'local-content/legacy-link-review/public');
const pages=['index.html','circles/index.html','circles/free-learning.html','circles/academy/mothers/surah-al-baqarah/index.html','circles/prospectus-2027.html','studio/index.html','builder/index.html','import/index.html'];
const legacy=value=>{try{const u=new URL(value,'https://maktab4life.org');return ['http:','https:'].includes(u.protocol)&&['ummabbadacademy.com','ummeabbadacademy.com'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}};
await mkdir(target,{recursive:true});await cp(baseline,target,{recursive:true});
const changed=[];let removedHref=0;
for(const page of pages){const path=resolve(target,page),before=await readFile(path,'utf8');let text=before.replace(/\bhref\s*=\s*(["'])([^"']*)\1/gi,(whole,quote,url)=>{if(!legacy(url))return whole;removedHref++;return 'data-legacy-source-href='+quote+url+quote;});
 if(!text.includes('/shared/legacy-site-links.js'))text=text.replace(/<head(?:\s[^>]*)?>/i,tag=>tag+'<script src="/shared/legacy-site-links.js"></script>');if(text!==before){await writeFile(path,text);changed.push(page);}}
await cp(resolve(repo,'public/shared/legacy-site-links.js'),resolve(target,'shared/legacy-site-links.js'));
async function manifest(folder){const files={};async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,item.name);if(item.isSymbolicLink())throw Error('Unexpected public symlink');if(item.isDirectory())await walk(path);else files[relative(folder,path)]=createHash('sha256').update(await readFile(path)).digest('hex');}}await walk(folder);return files;}
const before=await manifest(baseline),after=await manifest(target),allowed=new Set([...pages,'shared/legacy-site-links.js']);for(const file of Object.keys(after))if(before[file]!==after[file]&&!allowed.has(file))throw Error('Unreviewed asset '+file);if(Object.keys(before).some(file=>!after[file]))throw Error('An original asset was removed');
const report={status:'LOCAL_ONLY',baseline,files:Object.keys(after).length,changed:[...changed,'shared/legacy-site-links.js'],unchanged:Object.keys(before).filter(f=>before[f]===after[f]).length,staticLegacyHrefRemoved:removedHref,originalArtworkAndMediaBytesUnchanged:true,privatePayloadsAdded:0,previewAdaptersAdded:0,excludedProtocolPages:['preview/index.html','preview/websites/index.html'],manifest:after};
await writeFile(resolve(target,'../review.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,manifest:undefined}));
