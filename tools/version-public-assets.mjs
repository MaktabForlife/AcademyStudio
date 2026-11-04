import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';import {resolve,relative,posix} from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const digest=value=>createHash('sha256').update(value).digest('hex');
const eligible=file=>/^[-A-Za-z0-9_./]+$/.test(file)&&!file.split('/').some(p=>p.startsWith('.'))&&/\.(?:js|mjs|css|png|jpe?g|svg|webp|gif|ico|woff2?|ttf|otf|bcmap|pfb|wasm|json|webmanifest|map|ftl|txt|md|pdf|properties|bin)$/.test(file)&&!/(?:^|\/)(?:(?:_worker|sw|service-worker)\.js|version\.json|_routes\.json)$/.test(file);
// Called once on the complete, already-sanitised release artifact, after all
// version markers and reviewed overlays. This never reads source/private trees.
export async function versionPublicAssets(directory){
 const root=resolve(directory),files=new Map();async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){assert(!e.isSymbolicLink());const full=resolve(dir,e.name),file=relative(root,full);assert(!file.startsWith('_assets/'),'Use a fresh frozen release artifact');if(e.isDirectory())await walk(full);else files.set(file,await readFile(full));}}await walk(root);
 const assets=new Set([...files.keys()].filter(eligible)),signature=digest(JSON.stringify([...assets].sort().map(file=>[file,digest(files.get(file))]))),prefix='/_assets/'+signature+'/';
 const absolute=value=>{if(!value.startsWith('/')||value.startsWith('//'))return value;const path=value.split(/[?#]/)[0].slice(1);return assets.has(path)?prefix+value.slice(1):value;};
 const transform=(file,bytes)=>{if(/(?:^|\/)(?:_worker|sw|service-worker)\.js$/.test(file)||!/\.(?:html|fragment|js|mjs|css)$/.test(file))return bytes;let text=bytes.toString();
  text=text.replace(/(["'`])(\/[^"'`\s<>${}]+)\1/g,(_,quote,value)=>quote+absolute(value)+quote);
  text=text.replace(/(["'`])(\.\.?\/[^"'`\s<>${}]+)\1/g,(whole,q,value)=>{const path=posix.normalize(posix.join(posix.dirname(file),value.split(/[?#]/)[0]));return files.has(path)&&!assets.has(path)?q+'/'+path+value.slice(value.split(/[?#]/)[0].length)+q:whole;});
  text=text.replace(/url\((\/?[^)'"\s]+)\)/g,(_,value)=>'url('+absolute(value)+')');
  if(/\.(?:html|fragment)$/.test(file))text=text.replace(/\b(src|href)=(['"])([^'"<>\s]+)\2/g,(whole,attr,q,value)=>{if(value.startsWith('/')||value.startsWith('#')||/^[a-z]+:/i.test(value))return whole;const path=posix.normalize(posix.join(posix.dirname(file),value.split(/[?#]/)[0]));return assets.has(path)?attr+'='+q+prefix+path+value.slice(value.split(/[?#]/)[0].length)+q:whole;});
  return Buffer.from(text);
 };
 const manifest={};for(const [file,bytes] of files){const changed=transform(file,bytes);if(!changed.equals(bytes))await writeFile(resolve(root,file),changed);manifest[file]=digest(changed);if(assets.has(file)){const versioned='_assets/'+signature+'/'+file,full=resolve(root,versioned);await mkdir(posix.dirname(full),{recursive:true});await writeFile(full,changed);manifest[versioned]=digest(changed);}}
 return {signature,prefix,versionedAssets:assets.size,files:Object.keys(manifest).length,manifest};
}
