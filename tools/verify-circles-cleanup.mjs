import {readFile,readdir,lstat} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
const target=resolve(process.argv[2]),report=JSON.parse(await readFile(resolve(target,'../asset-manifest.json'),'utf8'));
const files=[];async function visit(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isSymbolicLink())throw Error('Public symlink');if(entry.isDirectory())await visit(path);else files.push(relative(target,path));}}await visit(target);
if(files.length!==report.files||files.some(path=>!report.manifest[path]))throw Error('Unexpected production file');
let dependencies=0,syntax=0;
for(const path of files){
 const buffer=await readFile(resolve(target,path));if(createHash('sha256').update(buffer).digest('hex')!==report.manifest[path])throw Error('Changed frozen file '+path);
 if(!/\.(mjs|js|html)$/.test(path))continue;const text=buffer.toString();
 const refs=path.endsWith('.html')?[...text.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)=["']([^"']+)["']/g)].map(match=>match[1]):[...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(|\bimport\s*)["']([^"']+)["']/g)].map(match=>match[1]);
 const base=path.endsWith('.html')?text.match(/<base\b[^>]*href=["']([^"']+)["']/)?.[1]:null;
 for(const ref of refs){if(!/^(?:\.?\.?\/)/.test(ref))continue;const name=ref.split(/[?#]/)[0];if(!name)continue;const file=resolve(name.startsWith('/')?target:base?resolve(target,'.'+base):dirname(resolve(target,path)),name.startsWith('/')?'.'+name:name);if(!file.startsWith(target+'/'))throw Error('Outside production dependency');if(!(await lstat(file)).isFile())throw Error('Missing dependency '+path+': '+ref);dependencies++;}
 if(/\.(mjs|js)$/.test(path))syntax++;
}
console.log(JSON.stringify({passed:true,files:files.length,dependencies,scriptFiles:syntax,htmlEntries:report.htmlEntries,baseline:report.baselineCommit}));
