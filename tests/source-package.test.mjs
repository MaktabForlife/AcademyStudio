import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,mkdir,cp,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {buildStudioPackage} from '../tools/build-studio-package.mjs';
test('complete public source reproduces the reviewed website without a previous package',{skip:process.env.GITHUB_ACTIONS!=='true'},async()=>{
 const root=resolve(import.meta.dirname,'..'),expected=JSON.parse(await readFile(resolve(root,'release/manifest.json'),'utf8'));
 const output=resolve(await mkdtemp(resolve(tmpdir(),'studio-source-package-')),'public');
 const built=await buildStudioPackage({root,version:expected.version,output});
 assert.equal(built.exactReviewedBytes,true);
 assert.deepEqual(built.manifest.manifest,expected.manifest);
 const sourceFiles=[];
 async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){assert(!e.isSymbolicLink());const p=resolve(dir,e.name);if(e.isDirectory())await walk(p);else sourceFiles.push(relative(resolve(root,'public'),p));}}
 await walk(resolve(root,'public'));
 assert.deepEqual(sourceFiles.sort(),Object.keys(expected.manifest).filter(p=>!p.startsWith('_assets/')).sort());
 const config=JSON.parse(await readFile(resolve(root,'wrangler.production.jsonc'),'utf8'));
 assert.equal(config.vars.ACCOUNT_MAX_AGE_SECONDS,'43200');assert.equal(config.vars.LIVE_ACCESS_MAX_AGE_SECONDS,'43200');assert.equal(config.vars.ADMIN_MAX_AGE_SECONDS,'60');
});

test('future releases reuse unchanged assets and invalidate changed assets without overwriting reviewed metadata',{skip:process.env.GITHUB_ACTIONS!=='true'},async()=>{
 const root=resolve(import.meta.dirname,'..'),manifestPath=resolve(root,'release/manifest.json'),sourcePath=resolve(root,'public/index.html');
 const beforeManifest=await readFile(manifestPath,'utf8'),beforeSource=await readFile(sourcePath,'utf8'),current=JSON.parse(beforeManifest);
 const [major,minor]=current.version.split('.').map(Number),version=major+'.'+(minor+1);
 const output=resolve(await mkdtemp(resolve(tmpdir(),'studio-next-package-')),'public');
 const built=await buildStudioPackage({root,version,output});
 assert.equal(built.exactReviewedBytes,false);assert.equal(built.version,version);
 assert.equal(built.prefix,current.prefix,'Unchanged asset bytes retain their cache address.');
 assert.equal(built.files,Object.keys(current.manifest).length);
 assert.deepEqual(built.manifest.verificationSeconds,[43200,43200,60]);
 assert.equal(built.manifest.manualMediaAttachment,true);assert.equal(built.manifest.manualMediaPublication,true);
 const homepage=await readFile(resolve(output,'index.html'),'utf8');assert(homepage.includes(version));
 await mkdir(resolve(root,'.build'),{recursive:true});
 const fixture=await mkdtemp(resolve(root,'.build/source-fixture-'));
 await cp(resolve(root,'public'),resolve(fixture,'public'),{recursive:true});
 await mkdir(resolve(fixture,'release'),{recursive:true});
 for(const name of ['current.json','manifest.json','source.json'])await cp(resolve(root,'release',name),resolve(fixture,'release',name));
 const css=resolve(fixture,'public/app.css');await writeFile(css,(await readFile(css,'utf8'))+'\n/* source-build cache check */\n');
 const changed=await buildStudioPackage({root:fixture,version,output:resolve(await mkdtemp(resolve(tmpdir(),'studio-changed-package-')),'public')});
 assert.notEqual(changed.prefix,built.prefix,'Changed asset bytes require a new cache address.');
 assert.equal(await readFile(manifestPath,'utf8'),beforeManifest);
 assert.equal(await readFile(sourcePath,'utf8'),beforeSource);
});
