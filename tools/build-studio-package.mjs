// Builds the website from complete public source. No previous release is an input.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {versionPublicAssets} from './version-public-assets.mjs';
export async function buildStudioPackage({root=resolve(import.meta.dirname,'..'),version,output}={}){
 assert.equal(process.env.GITHUB_ACTIONS,'true','Build on GitHub; local writes require separate permission.');
 const current=JSON.parse(await readFile(resolve(root,'release/current.json'),'utf8'));
 version??=current.version;assert(/^\d+\.\d+$/.test(version));
 const source=JSON.parse(await readFile(resolve(root,'release/source.json'),'utf8'));
 const retained=JSON.parse(await readFile(resolve(root,'release/manifest.json'),'utf8'));
 const expected=retained.version===version?retained:null;
 const target=output||resolve(root,'release/v'+version+'/public');
 try{await readdir(target);throw Error('Use a fresh build output directory.');}catch(e){if(e.code!=='ENOENT')throw e;}
 const stamp=s=>s.replaceAll('Website V'+source.version,'Website V'+version).replaceAll('?v='+source.version,'?v='+version).replaceAll('"'+source.version+'"','"'+version+'"').replaceAll("'"+source.version+"'","'"+version+"'");
 let sourceFiles=0;
 async function copy(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
  assert(!entry.isSymbolicLink(),'Public source cannot contain links.');
  const from=resolve(dir,entry.name),path=relative(resolve(root,'public'),from);
  assert(!path.startsWith('_assets/')&&!path.startsWith('.'),'Keep generated and private files outside public source.');
  if(entry.isDirectory()){await copy(from);continue;}
  const bytes=await readFile(from),data=/\.(?:html|fragment|js|mjs|css|json|txt|md|ftl|properties)$/.test(path)?Buffer.from(stamp(bytes.toString())):bytes;
  await mkdir(dirname(resolve(target,path)),{recursive:true});await writeFile(resolve(target,path),data);sourceFiles++;
 }}
 await copy(resolve(root,'public'));
 // The deployed package retains its reviewed cache address. Every public byte is
 // checked below. New release versions receive a fresh content-derived address.
 const signature=expected?.prefix?.match(/^\/_assets\/([a-f0-9]{64})\/$/)?.[1];
 const assets=await versionPublicAssets(target,{signature});
 if(expected)assert.deepEqual(Object.fromEntries(Object.entries(assets.manifest).sort()),Object.fromEntries(Object.entries(expected.manifest).sort()),'Public source differs from the reviewed release; prepare a new release version.');
 const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const manifest=expected||{version,repository:'MaktabForlife/AcademyStudio',sourceVersionCommit:commit,canonicalSource:true,publicFiles:assets.files,prefix:assets.prefix,manifest:assets.manifest,verificationSeconds:[43200,43200,60],manualMediaAttachment:true,manualMediaPublication:true};
 await writeFile(resolve(dirname(target),'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return {version,sourceFiles,files:assets.files,prefix:assets.prefix,target,manifest,exactReviewedBytes:Boolean(expected)};
}
