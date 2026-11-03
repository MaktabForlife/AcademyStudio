import './preserve-local-files.mjs';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {versionPublicAssets} from './version-public-assets.mjs';
const root=resolve(import.meta.dirname,'..'),version=process.argv[2];
assert(/^\d+\.\d+$/.test(version||''),'Choose the reviewed release version');
const target=resolve(root,'release/v'+version+'/public');
try{await readFile(resolve(root,'release/v'+version+'/manifest.json'));throw Error('Release already exists; keep it and use a fresh retained candidate');}catch(e){if(e.code!=='ENOENT')throw e;}
const sourceVersionCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const baselineVersion=process.argv[3];assert(/^\d+\.\d+$/.test(baselineVersion||''),'Choose the verified previous package');
const baseline=JSON.parse(await readFile(resolve(root,'release/v'+baselineVersion+'/manifest.json'))),base=resolve(root,'release/v'+baselineVersion+'/public');
const oldPrefix=baseline.prefix||'/'+Object.keys(baseline.manifest).find(p=>p.startsWith('_assets/')).split('/').slice(0,2).join('/')+'/';
const stamp=s=>s.split(oldPrefix).join('/').replaceAll('Website V'+baselineVersion,'Website V'+version).replaceAll('?v='+baselineVersion,'?v='+version).replaceAll('"'+baselineVersion+'"','"'+version+'"').replaceAll("'"+baselineVersion+"'","'"+version+"'");
let baseFiles=0;for(const [path,expected]of Object.entries(baseline.manifest)){const bytes=await readFile(resolve(base,path));assert.equal(createHash('sha256').update(bytes).digest('hex'),expected);if(path.startsWith('_assets/'))continue;const value=/\.(?:html|fragment|js|mjs|css|json|txt|md|ftl|properties)$/.test(path)?Buffer.from(stamp(bytes.toString())):bytes;await mkdir(dirname(resolve(target,path)),{recursive:true});await writeFile(resolve(target,path),value);baseFiles++;}
// Overlay only Git-reviewed production changes onto the verified complete
// package. A prior raw file must exactly match its unversioned frozen copy;
// otherwise an old generated adaptation needs explicit review, not replacement.
const overlays=[];
const changes=execFileSync('git',['diff','--name-status',baseline.sourceVersionCommit+'..'+sourceVersionCommit,'--','public/'],{cwd:root,encoding:'utf8'}).trim();
for(const change of changes?changes.split('\n'):[]){
 const [status,path]=change.split('\t');assert(['A','M'].includes(status),'Review retired/renamed public files separately');
 assert(path.startsWith('public/')&&!path.includes('/../'));const file=path.slice('public/'.length);
 assert(!file.startsWith('_assets/')&&!file.startsWith('.'),'Only reviewed public source may be overlaid');
 if(status==='M'){
  const raw=execFileSync('git',['show',baseline.sourceVersionCommit+':'+path],{cwd:root});
  const frozen=await readFile(resolve(base,file));
  assert.equal(raw.toString('base64'),Buffer.from(frozen.toString().split(oldPrefix).join('/')).toString('base64'),path+' differs from its verified baseline');
 }
 const bytes=await readFile(resolve(root,path));
 const value=/\.(?:html|fragment|js|mjs|css|json|txt|md|ftl|properties)$/.test(file)?Buffer.from(stamp(bytes.toString())):bytes;
 await mkdir(dirname(resolve(target,file)),{recursive:true});await writeFile(resolve(target,file),value);overlays.push(file);
}
const assets=await versionPublicAssets(target);
const manifest={version,repository:'MaktabForlife/AcademyStudio',sourceVersionCommit,baselineVersion,overlays,publicFiles:assets.files,prefix:assets.prefix,manifest:assets.manifest,verificationSeconds:[43200,43200,60],manualMediaAttachment:true,manualMediaPublication:true};
await writeFile(resolve(root,'release/v'+version+'/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(resolve(root,'release/current.json'),JSON.stringify({version,manifest:'release/v'+version+'/manifest.json'},null,2)+'\n');
const config=JSON.parse(await readFile(resolve(root,'wrangler.github-'+baselineVersion.replaceAll('.','')+'.jsonc')));config.vars.RELEASE_VERSION=version;config.assets.directory='./release/v'+version+'/public';await writeFile(resolve(root,'wrangler.github-'+version.replaceAll('.','')+'.jsonc'),JSON.stringify(config,null,2)+'\n');
console.log(JSON.stringify({version,baseFiles,overlays,publicFiles:assets.files,prefix:assets.prefix,localFilesDeleted:0}));
