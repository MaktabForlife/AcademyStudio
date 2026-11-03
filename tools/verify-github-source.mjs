// Read-only pre-release check. This script never builds, deploys or changes Git refs.
import {readFile,readdir,lstat} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const run=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}}).trim();
const branch=run(['branch','--show-current']),head=run(['rev-parse','HEAD']);
assert(branch,'Use a named, reviewed branch');
assert.equal(run(['status','--porcelain=v1']),'','Commit all intended changes first');
const current=JSON.parse(await readFile(resolve(root,'release/current.json'),'utf8'));
assert(/^\d+\.\d+$/.test(current.version)&&current.manifest==='release/v'+current.version+'/manifest.json');
const manifest=JSON.parse(await readFile(resolve(root,current.manifest),'utf8'));
const remoteBranch=process.argv.find(a=>a.startsWith('--remote-branch='))?.slice('--remote-branch='.length)||branch;
assert(/^[-A-Za-z0-9_./]+$/.test(remoteBranch),'Choose a valid reviewed GitHub branch');
assert.equal(run(['remote','get-url','origin']),'https://github.com/'+manifest.repository+'.git','Wrong canonical GitHub repository');
const remote=run(['ls-remote','--exit-code','origin','refs/heads/'+remoteBranch]).split(/\s+/)[0];
assert.equal(remote,head,'This exact commit must be on GitHub before release');
const assets=resolve(root,'release/v'+current.version+'/public'),actual={};
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);assert(!entry.isSymbolicLink(),'No release asset symlinks');if(entry.isDirectory())await walk(path);else{assert((await lstat(path)).isFile());actual[relative(assets,path)]=createHash('sha256').update(await readFile(path)).digest('hex');}}}
await walk(assets);
assert.deepEqual(Object.fromEntries(Object.entries(actual).sort()),Object.fromEntries(Object.entries(manifest.manifest).sort()),'Frozen public package changed');
console.log(JSON.stringify({repository:manifest.repository,branch,commit:head,publicFiles:Object.keys(actual).length,githubVerified:true,remoteBranch,releaseVersion:current.version,deploymentPerformed:false}));
