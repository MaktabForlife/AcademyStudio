// This prepares an artifact on a disposable GitHub runner; it cannot deploy.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,cp,readdir,stat} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {buildStudioPackage} from './build-studio-package.mjs';
import {exactOrigin,hostingOrigins} from '../src/deployment-origins.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function prepareStudioSaas({root=resolve(import.meta.dirname,'..'),output=resolve(root,'.build/studio-saas')}={}){
 assert.equal(process.env.GITHUB_ACTIONS,'true','Prepare in GitHub; no Mac writes are authorised.');
 assert(relative(root,output).startsWith('.build/'),'Use an ignored GitHub output directory.');
 try{await stat(output);throw Error('Use a fresh preparation directory.');}catch(error){if(error.code!=='ENOENT')throw error;}
 const config=JSON.parse(await readFile(resolve(root,'config/studio-saas.json'),'utf8'));
 const production=JSON.parse(await readFile(resolve(root,config.workerConfig),'utf8'));
 assert.equal(config.schema,1);assert.equal(config.state,'prepared-not-active');assert.equal(config.failOpen,false);
 assert.equal(config.accountId,production.account_id);assert.equal(config.productionBranch,'studio_dev');
 for(const key of ['websiteOrigin','providerOrigin','academyPortalOrigin','hifzPublicOrigin','assetOrigin'])exactOrigin(config[key],key);
 assert(new URL(config.websiteOrigin).hostname.endsWith('.'+new URL(config.academyPortalOrigin).hostname));
 assert(new URL(config.providerOrigin).hostname.endsWith('.'+config.providerZone));
 assert.equal(production.vars.ACCOUNT_MAX_AGE_SECONDS,'43200');assert.equal(production.vars.LIVE_ACCESS_MAX_AGE_SECONDS,'43200');assert.equal(production.vars.ADMIN_MAX_AGE_SECONDS,'60');
 const source=await buildStudioPackage({root,output:resolve(output,'reviewed/public')});
 const pages=resolve(output,'pages');await cp(source.target,pages,{recursive:true,errorOnExist:true,force:false});
 const overlays=['_headers','404.html'];for(const path of overlays)assert(!Object.hasOwn(source.manifest.manifest,path));
 await writeFile(resolve(pages,'_headers'),'/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n  X-Content-Type-Options: nosniff\n/_assets/*\n  Cache-Control: public, max-age=31536000, immutable\n');
 await writeFile(resolve(pages,'404.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Page unavailable</title></head><body><h1>This page is unavailable.</h1></body></html>\n');
 let publicFiles=0;for(const [path,digest]of Object.entries(source.manifest.manifest)){assert.equal(hash(await readFile(resolve(pages,path))),digest,path);publicFiles++;}
 async function walk(dir,out=[]){for(const e of await readdir(dir,{withFileTypes:true})){assert(!e.isSymbolicLink());const path=resolve(dir,e.name);if(e.isDirectory())await walk(path,out);else out.push(relative(pages,path));}return out;}
 const actual=await walk(pages);assert.equal(actual.length,publicFiles+overlays.length);
 for(const path of actual)assert(Object.hasOwn(source.manifest.manifest,path)||overlays.includes(path));
 assert(!actual.some(path=>/(?:^|\/)(?:_worker\.js|_routes\.json)$/.test(path)),'Pages must remain purely static.');
 const candidate=structuredClone(production);
 candidate.main='../../hosting/saas/worker.mjs';candidate.compatibility_date=config.compatibilityDate;
 candidate.assets.directory='./reviewed/public';
 candidate.vars={...candidate.vars,PUBLIC_ASSET_SOURCE:'pages',WEBSITE_ORIGIN:config.websiteOrigin,WEBSITE_ALIAS_ORIGINS:'[]',STUDIO_BACKEND_ORIGIN:hostingOrigins(production.vars).studioBackend,ACADEMY_PORTAL_ORIGIN:config.academyPortalOrigin,STUDIO_PROVIDER_ORIGIN:config.providerOrigin,PUBLIC_ASSET_ORIGIN:config.assetOrigin,STUDIO_REDIRECT_ORIGINS:JSON.stringify(config.redirectOrigins)};
 assert(!candidate.routes,'Routes must be separately reviewed, not deployed by this preparation.');
 await writeFile(resolve(output,'worker.jsonc'),JSON.stringify(candidate,null,2)+'\n');
 const transition=structuredClone(candidate),current=hostingOrigins(production.vars);
 transition.vars={...transition.vars,PUBLIC_ASSET_SOURCE:'worker',WEBSITE_ORIGIN:current.website,WEBSITE_ALIAS_ORIGINS:'[]',STUDIO_REDIRECT_ORIGINS:JSON.stringify(current.aliases)};
 delete transition.vars.PUBLIC_ASSET_ORIGIN;
 transition.compatibility_date=production.compatibility_date;
 await writeFile(resolve(output,'transition-worker.jsonc'),JSON.stringify(transition,null,2)+'\n');
 const bundle=await build({entryPoints:[resolve(root,'hosting/saas/worker.mjs')],bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers'],metafile:true,target:'es2022'});
 await writeFile(resolve(output,'candidate-worker.mjs'),bundle.outputFiles[0].contents);await writeFile(resolve(output,'bundle-meta.json'),JSON.stringify(bundle.metafile,null,2)+'\n');
 const publicHost=new URL(config.websiteOrigin).hostname,providerHost=new URL(config.providerOrigin).hostname;
 const plan={schema:1,active:false,accountId:config.accountId,providerZone:config.providerZone,providerZoneId:config.providerZoneId,providerHost,publicHost,pagesProject:config.projectName,pagesOrigin:config.assetOrigin,providerRecord:{type:'AAAA',name:providerHost,content:'100::',proxied:true},fallbackOrigin:providerHost,customHostname:{hostname:publicHost,ssl:{method:'txt',type:'dv',settings:{min_tls_version:'1.2'}}},workerRoutes:[publicHost+'/*',providerHost+'/*',...config.redirectOrigins.map(value=>new URL(value).hostname+'/*')],customerRecord:{type:'CNAME',name:publicHost,content:providerHost,proxied:true},requiredReadyStates:['provider zone active in Studio account','fallback origin active','custom hostname active','custom hostname ssl active','matching customer CNAME','exact Academy origin/connection settings staged','Hifz DNS preserved','tested paired release'],warnings:['Do not create or change these records until transfer and activation are authorised.','No wildcard trust or broad worker route is required.','SaaS does not itself reduce D1 reads.','The existing Studio Worker may execute for static requests too.']};
 await writeFile(resolve(output,'activation-plan.json'),JSON.stringify(plan,null,2)+'\n');
 const receipt={schema:1,prepared:true,activated:false,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),version:source.version,publicFilesVerified:publicFiles,exactReviewedPublicBytes:source.exactReviewedBytes,pagesFunctions:0,newDatabaseBindings:0,newStorageBindings:0,identityServiceAdded:false,verificationSeconds:[43200,43200,60],manualMediaAttachment:true,manualMediaPublication:true,liveRequests:0,hostedSQL:0,macWrites:0,publicOrigin:config.websiteOrigin,providerOrigin:config.providerOrigin,assetOrigin:config.assetOrigin,activationRequiresDomainTransfer:true};
 await writeFile(resolve(output,'preparation.json'),JSON.stringify(receipt,null,2)+'\n');return receipt;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await prepareStudioSaas()));
