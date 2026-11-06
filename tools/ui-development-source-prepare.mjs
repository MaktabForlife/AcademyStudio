// Source/empty-schema preparation only, on a fixed unprotected GitHub branch.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,cpSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const branch='validation/ui-development-composition-20261106',repo=process.env.GITHUB_REPOSITORY,side=repo?.split('/')[1];
assert.equal(process.env.GITHUB_ACTIONS,'true');assert(['MaktabForlife/Academy','MaktabForlife/AcademyStudio'].includes(repo));
assert.equal(process.env.GITHUB_REF,'refs/heads/'+branch);assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
const root=process.cwd(),out=resolve(process.env.RUNNER_TEMP,'ui-development-source-evidence');mkdirSync(out,{recursive:true});
const hash=x=>createHash('sha256').update(x).digest('hex'),read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const plan=read('deployment/ui-development-proposal.json'),selected=plan.sourceInputs[side],version=plan.candidateVersion;
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024});
const github=p=>JSON.parse(execFileSync('gh',['api','repos/'+repo+'/'+p],{encoding:'utf8',env:{...process.env,GH_TOKEN:process.env.GITHUB_TOKEN}}));
const evidence={schema:1,state:'SOURCE_PREPARATION_STARTED',repository:repo,logicalTarget:'development',candidateVersion:version,base:selected.canonical,inputs:selected.components,hostedCalls:0,databaseCalls:0,providerCalls:0,resourceMutations:0,deployable:false};
const retain=()=>save(resolve(out,'source-preparation.json'),evidence);retain();
try{
 assert.equal(git('rev-parse','HEAD').trim(),process.env.GITHUB_SHA);
 assert.equal(github('git/ref/heads/studio_dev').object.sha,selected.canonical,'CANONICAL_CHANGED');
 assert.equal(plan.activationAllowed,false);assert.equal(plan.routineDatabaseChanges,false);assert.equal(plan.existingStoresChanged,false);
 assert.equal(plan.provider.selected,false);assert.equal(plan.credentialDestination.created,false);
 for(const c of selected.components){
  for(const sha of new Set([c.base,c.head]))git('fetch','--no-tags','--depth=2','origin',sha);
  const paths=git('diff','--name-only','--no-renames',c.base,c.head).split('\n').filter(Boolean).filter(p=>!p.startsWith('.github/')&&!p.startsWith('deployment/')&&!p.startsWith('release/'));
  assert(paths.length&&paths.every(p=>!p.startsWith('/')&&!p.split('/').includes('..')));
  assert(!paths.some(p=>/(^|\/)migrations\/.*\.sql$/.test(p)),'NUMBERED_MIGRATION_CHANGE');
  const patch=execFileSync('git',['diff','--binary',c.base,c.head,'--',...paths],{maxBuffer:32*1024*1024});
  execFileSync('git',['apply','--3way','--index','--whitespace=nowarn'],{input:patch,stdio:['pipe','pipe','pipe']});
 }
 save('deployment/release-plan.json',{schema:1,request:'ui-development-source-composition-20261106',kind:'component',target:'development',contains_jwt:false,database_changes:false,version});
 if(side==='Academy'){
  save('config/hosting.json',{schema:1,...plan.hosting});save('version.json',{version});save('js/version.json',{version});
  for(const [p,needle,replacement]of [
   ['backend/tools/academy-site.mjs',"siteVersion='109.25'","siteVersion='"+version+"'"],
   ['backend/src/academy/d1/worker.js',"version:'109.25'","version:'"+version+"'"]
  ]){const s=readFileSync(p,'utf8');assert.equal(s.split(needle).length,2,'EXACT_VERSION_LOCATION');writeFileSync(p,s.replace(needle,replacement));}
 }
 assert.equal(git('diff','--name-only','--','release/v109.25').trim(),'','OLD_RELEASE_CHANGED');
 git('add','--all');git('-c','user.name=GitHub Actions','-c','user.email=actions@users.noreply.github.com','commit','-m','Compose reviewed UI source for isolated Development preparation');
 evidence.composedSource=git('rev-parse','HEAD').trim();
 if(side==='Academy'){
  const {buildDevelopmentPages}=await import('../backend/tools/academy-pages-build.mjs');
  const {versionPublicAssets}=await import('./version-public-assets.mjs');
  const built=buildDevelopmentPages(root,{branch:'ui-development'});
  const target=resolve('release/v'+version+'/public');mkdirSync(target,{recursive:true});cpSync(built.directory,target,{recursive:true});
  const assets=await versionPublicAssets(target);
  const manifest={version,repository:repo,profile:'UI_DEVELOPMENT_PROPOSAL',sourceVersionCommit:evidence.composedSource,publicFiles:assets.files,prefix:assets.prefix,manifest:assets.manifest,verificationSeconds:[43200,43200,60],manualMediaAttachment:true,manualMediaPublication:true};
  save('release/v'+version+'/manifest.json',manifest);save('release/current.json',{version,manifest:'release/v'+version+'/manifest.json'});
  evidence.bundle={files:assets.files,prefix:assets.prefix,manifestSHA256:hash(readFileSync('release/v'+version+'/manifest.json'))};
  const config=readFileSync(resolve(target,'js/m4l-config.js'),'utf8');
  assert(config.includes(plan.hosting.academyApiOrigin)&&config.includes(plan.hosting.academyPortalOrigin),'ISOLATED_CLIENT_HOSTS_REQUIRED');
 }else{
  const {buildStudioPackage}=await import('./build-studio-package.mjs');
  const built=await buildStudioPackage({root,version}),manifest={...built.manifest,profile:'UI_DEVELOPMENT_PROPOSAL'};
  save('release/v'+version+'/manifest.json',manifest);save('release/manifest.json',manifest);save('release/current.json',{version,manifest:'release/manifest.json'});
  evidence.bundle={files:built.files,prefix:built.prefix,manifestSHA256:hash(readFileSync('release/v'+version+'/manifest.json'))};
  const native=readdirSync('migrations').filter(n=>/^\d{4}_.*\.sql$/.test(n)).sort(),db=new DatabaseSync(':memory:');
  try{
   for(const name of native)db.exec(readFileSync('migrations/'+name,'utf8'));
   db.exec(readFileSync('tests/fixtures/video-autolink-proposed.sql','utf8'));
   const rows=db.prepare("SELECT type,name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid").all(),ddl=rows.map(x=>x.sql+';').join('\n')+'\n',empty=new DatabaseSync(':memory:');
   try{
    empty.exec('PRAGMA foreign_keys=ON');empty.exec(ddl);
    const tables=rows.filter(x=>x.type==='table'),userRows=tables.reduce((n,t)=>n+empty.prepare('SELECT count(*) n FROM "'+t.name.replaceAll('"','""')+'"').get().n,0);
    assert.equal(userRows,0);assert.equal(empty.prepare('PRAGMA foreign_key_check').all().length,0);assert.equal(Object.values(empty.prepare('PRAGMA quick_check').get())[0],'ok');
    assert(plan.schema.newTables.every(n=>tables.some(t=>t.name===n)));
    writeFileSync('tests/fixtures/studio-ui-development-empty.sql',ddl);
    evidence.schemaBlueprint={nativeMigrations:native,objects:rows.length,tables:tables.length,userRows:0,foreignKeyErrors:0,quickCheck:'ok',ddlBytes:Buffer.byteLength(ddl),ddlSHA256:hash(ddl),runtime:'Node24 SQLite only; current-workerd import remains required; no hosted installation'};
   }finally{empty.close();}
  }finally{db.close();}
 }
 assert.equal(git('diff','--name-only','--','release/v109.25').trim(),'','OLD_RELEASE_CHANGED');
 evidence.state='SOURCE_AND_BUNDLE_PREPARED_NOT_DEPLOYABLE';save('deployment/ui-development-prepared.json',evidence);
 git('add','release','deployment/ui-development-prepared.json',...(side==='AcademyStudio'?['tests/fixtures/studio-ui-development-empty.sql']:[]));
 git('-c','user.name=GitHub Actions','-c','user.email=actions@users.noreply.github.com','commit','-m','Retain new isolated Development V109.26 assets and empty schema proposal');
 const final=git('rev-parse','HEAD').trim();
 assert.equal(github('git/ref/heads/studio_dev').object.sha,selected.canonical,'CANONICAL_CHANGED_BEFORE_SOURCE_PUSH');
 assert.equal(github('git/ref/heads/'+branch).object.sha,process.env.GITHUB_SHA,'CANDIDATE_BRANCH_CHANGED');
 const auth='AUTHORIZATION: basic '+Buffer.from('x-access-token:'+process.env.GITHUB_TOKEN).toString('base64');
 try{git('-c','http.https://github.com/.extraheader='+auth,'push','origin','HEAD:refs/heads/'+branch);}catch{throw Error('SOURCE_PUSH_FAILED');}
 evidence.publishedSource=final;retain();console.log(JSON.stringify(evidence));
}catch{
 evidence.state='SOURCE_PREPARATION_STOPPED_NO_HOSTED_ACTION';
 try{evidence.unmergedPaths=git('diff','--name-only','--diff-filter=U').trim().split('\n').filter(Boolean);}catch{}
 retain();console.error('SOURCE_PREPARATION_STOPPED; inspect safe evidence, no automatic retry');process.exitCode=1;
}
