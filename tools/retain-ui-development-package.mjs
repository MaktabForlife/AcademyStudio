// Retain exact already-frozen public bytes; GitHub candidate source only.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {buildStudioPackage} from './build-studio-package.mjs';
const branch='validation/ui-development-composition-20261106-r2',repo='MaktabForlife/AcademyStudio';
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REPOSITORY,repo);assert.equal(process.env.GITHUB_REF,'refs/heads/'+branch);
const hash=x=>createHash('sha256').update(x).digest('hex');
assert.equal(hash(readFileSync('release/manifest.json')),'f38a265033d983d1b9069a0a8a9de74ca2e97c399af781fc1098f5674ae477d4');
if(!existsSync('release/v109.27/manifest.json')){
 await buildStudioPackage({version:'109.27'});
 assert.equal(hash(readFileSync('release/v109.27/manifest.json')),'f38a265033d983d1b9069a0a8a9de74ca2e97c399af781fc1098f5674ae477d4');
 const git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:8*1024*1024});
 const api=p=>JSON.parse(execFileSync('gh',['api','repos/'+repo+'/'+p],{encoding:'utf8',env:{...process.env,GH_TOKEN:process.env.GITHUB_TOKEN}}));
 assert.equal(api('git/ref/heads/studio_dev').object.sha,'9a8c117e9279a2b67e62eb044be4da989db4a096');
 assert.equal(api('git/ref/heads/'+branch).object.sha,process.env.GITHUB_SHA);
 assert.equal(git('diff','--name-only','9a8c117e9279a2b67e62eb044be4da989db4a096..HEAD','--','release/v109.25').trim(),'');
 git('add','--force','--','release/v109.27');
 git('-c','user.name=GitHub Actions','-c','user.email=actions@users.noreply.github.com','commit','-m','Retain exact frozen Studio V109.27 public package');
 const auth='AUTHORIZATION: basic '+Buffer.from('x-access-token:'+process.env.GITHUB_TOKEN).toString('base64');
 try{git('-c','http.https://github.com/.extraheader='+auth,'push','origin','HEAD:refs/heads/'+branch);}catch{throw Error('CANDIDATE_SOURCE_PUSH_FAILED');}
 console.log(JSON.stringify({state:'EXACT_FROZEN_SOURCE_RETAINED',candidateHead:git('rev-parse','HEAD').trim(),manifestSHA256:hash(readFileSync('release/v109.27/manifest.json')),hostedOperations:0}));
}else console.log(JSON.stringify({state:'EXACT_FROZEN_SOURCE_ALREADY_RETAINED',hostedOperations:0}));
