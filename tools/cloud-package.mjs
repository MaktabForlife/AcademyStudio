// GitHub-only packaging. Generated website copies are never committed.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {buildStudioPackage} from './build-studio-package.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.GITHUB_REPOSITORY,'MaktabForlife/AcademyStudio');
const root=process.cwd(),git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
assert.equal(git('status','--porcelain'),'');
const initial=git('rev-parse','HEAD'),current=JSON.parse(await readFile('release/current.json','utf8'));
const version=process.argv[2]||current.version,dryRun=process.argv[4]!=='false';
assert(/^\d+\.\d+$/.test(version));
assert.equal(JSON.parse(await readFile('package.json','utf8')).version,version,'Prepare the code version first.');
const out=resolve(process.env.RUNNER_TEMP,'package-evidence');await mkdir(out,{recursive:true});
if(dryRun)assert.equal(version,current.version);
else assert.notEqual(version,current.version,'An already reviewed release must not be overwritten.');
const built=await buildStudioPackage({version,output:resolve(out,'build-'+version,'public')});
assert(!dryRun||built.exactReviewedBytes);
const scan=spawnSync(process.env.GITLEAKS_BIN,['dir',resolve(root,'public'),'--no-banner','--redact','--report-format','json','--report-path',resolve(out,'public-scan.json'),'--log-level','error'],{encoding:'utf8'});
assert.equal(scan.status,0,'Public source needs credential review; inspect the redacted GitHub evidence.');
if(!dryRun){
 await writeFile('release/manifest.json',JSON.stringify(built.manifest,null,2)+'\n');
 await writeFile('release/current.json',JSON.stringify({version,manifest:'release/manifest.json'},null,2)+'\n');
 const config=JSON.parse(await readFile('wrangler.production.jsonc','utf8'));
 config.vars.RELEASE_VERSION=version;config.assets.directory='./release/v'+version+'/public';
 await writeFile('wrangler.production.jsonc',JSON.stringify(config,null,2)+'\n');
 assert.equal(git('ls-remote','origin','refs/heads/'+process.env.GITHUB_REF_NAME).split(/\s+/)[0],initial,'Branch changed during packaging.');
 git('add','--','release/manifest.json','release/current.json','wrangler.production.jsonc');
 git('-c','user.name=github-actions[bot]','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com','commit','--quiet','-m','[CF-Pages-Skip] [skip ci] Record reviewed release '+version+' without generated copies');
 git('push','origin','HEAD:refs/heads/'+process.env.GITHUB_REF_NAME);
}
const result={passed:true,repository:process.env.GITHUB_REPOSITORY,version,files:built.files,exactPublicBytes:built.exactReviewedBytes,cloudBuild:true,macWrites:0,cloudflareRequests:0,gitPush:!dryRun,generatedFilesCommitted:0,previousPackageRequired:false,pairedTestsAndApprovalStillRequired:true};
await writeFile(resolve(out,'package-check.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
