// Execute only on GitHub's disposable runner; never creates a Mac workspace.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,rename,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
assert.equal(process.env.GITHUB_ACTIONS,'true');
const root=process.cwd(),repo=process.env.GITHUB_REPOSITORY;
assert(['MaktabForlife/Academy','MaktabForlife/AcademyStudio'].includes(repo));
const studio=repo.endsWith('/AcademyStudio'),sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
assert.equal(git('status','--porcelain'),'');
const initial=git('rev-parse','HEAD'),current=JSON.parse(await readFile('release/current.json'));
const version=process.argv[2]||current.version,baseline=process.argv[3]||current.version,dryRun=process.argv[4]!=='false';
assert(/^\d+\.\d+$/.test(version)&&/^\d+\.\d+$/.test(baseline));
const out=resolve(process.env.RUNNER_TEMP,'package-evidence');await mkdir(out,{recursive:true});
let expected;
if(dryRun){assert.equal(version,current.version);expected=JSON.parse(await readFile('release/v'+version+'/manifest.json'));await rename(resolve('release/v'+version),resolve(out,'retained-public-package'));}
// During a comparison build, use the baseline already recorded by Studio's packager.
const base=studio?(dryRun?expected.baselineVersion:baseline):null;
execFileSync(process.execPath,['tools/package-public-release.mjs',version,...(studio?[base]:[])],{cwd:root,stdio:'inherit'});
const m=JSON.parse(await readFile('release/v'+version+'/manifest.json'));assert.equal(m.version,version);
const actual={},assets=resolve('release/v'+version+'/public');
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){assert(!e.isSymbolicLink());const f=resolve(dir,e.name);if(e.isDirectory())await walk(f);else actual[relative(assets,f)]=sha(await readFile(f));}}
await walk(assets);assert.deepEqual(Object.fromEntries(Object.entries(actual).sort()),Object.fromEntries(Object.entries(m.manifest).sort()));
if(dryRun){assert.deepEqual(m.manifest,expected.manifest,'Cloud rebuild must reproduce every frozen public byte');await writeFile(resolve(out,'package-check.json'),JSON.stringify({passed:true,repository:repo,version,files:Object.keys(actual).length,exactPublicBytes:true,cloudBuild:true,macWrites:0,cloudflareRequests:0,gitPush:false},null,2)+'\n');console.log('Cloud package matches all verified public bytes');process.exit(0);}
const names=['release/current.json','release/v'+version,...(studio?['wrangler.github-'+version.replaceAll('.','')+'.jsonc']:[])];
git('add','--',...names);
git('-c','user.name=github-actions[bot]','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com','commit','--quiet','-m','[CF-Pages-Skip] Freeze cloud-built V'+version+' package for review');
const scan=spawnSync(process.env.GITLEAKS_BIN,['git','--log-opts='+initial+'..HEAD','--no-banner','--redact','--report-format','json','--report-path',resolve(out,'scan.json'),'--log-level','error'],{cwd:root,encoding:'utf8'});assert([0,1].includes(scan.status));
const findings=JSON.parse(await readFile(resolve(out,'scan.json')));
for(const f of findings){
 const line=git('show',f.Commit+':'+f.File).split('\n')[f.StartLine-1]||'',p=line.match(/^\s*"([^"]+)": "([a-f0-9]{64})",?$/);
 let safe=f.File==='release/v'+version+'/manifest.json'&&p&&sha(await readFile(resolve(assets,p[1])))===p[2];
 if(/(?:^|\/)m4l-academy-(?:history|progress)\.js$/.test(f.File)&&['da4b73c0e4887323a7bac1b1b9ffbf00bf63649ab24b5f3362f624d0628be0b7','fda1b2bf2e8787fd53d53d29a9e7670ff83a6a9cc8b22ca7f63d64acd18a0754'].includes(sha(line.trim())))safe=true;
 assert(safe,'Package credential review required: '+f.File+':'+f.StartLine);
}
assert.equal(git('ls-remote','origin','refs/heads/'+process.env.GITHUB_REF_NAME).split(/\s+/)[0],initial,'Branch changed during build');
git('push','origin','HEAD:refs/heads/'+process.env.GITHUB_REF_NAME);
await writeFile(resolve(out,'package-check.json'),JSON.stringify({passed:true,repository:repo,version,commit:git('rev-parse','HEAD'),files:Object.keys(actual).length,cloudBuild:true,macWrites:0,cloudflareRequests:0,gitPush:true,pairedTestsAndApprovalStillRequired:true},null,2)+'\n');
