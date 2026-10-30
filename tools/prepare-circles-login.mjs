// Compose the current public design with the existing native backend frontend.
// Writes only a new local review directory. No hosting, content/access imports.
import {cp,readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {contentHash} from './reconciled-content.mjs';
import {connectedCourseSource,connectedPodcastView,connectedCoursePage} from './circles-ui-adaptation.mjs';
import {legacyStudioDestination} from '../public/shared/circles-routes.mjs';

const [designArg,destinationArg]=process.argv.slice(2);
if(!designArg||!destinationArg)throw Error('Usage: node tools/prepare-circles-login.mjs <design-checkout> <new-local-directory>');
const design=resolve(designArg),destination=resolve(destinationArg),publicRoot=join(destination,'public');
try{await stat(destination);throw Error('Choose a new destination directory.');}catch(error){if(error.code!=='ENOENT')throw error;}
if(execFileSync('git',['status','--porcelain'],{cwd:design,encoding:'utf8'}).trim())throw Error('Checkpoint the design before preparing its login integration.');
const designCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:design,encoding:'utf8'}).trim();
const designIndex=await readFile(join(design,'dist/index.html'),'utf8');
await mkdir(destination,{recursive:true,mode:0o700});await cp(resolve('public'),publicRoot,{recursive:true});
const studio=join(publicRoot,'studio');await mkdir(studio,{mode:0o700});
const nativeIndex=await readFile(join(publicRoot,'index.html'),'utf8');
await writeFile(join(studio,'index.html'),nativeIndex.replace('<html lang="en">','<html lang="en" data-circles-homepage="1">'));
const circles=join(publicRoot,'circles');await mkdir(circles,{mode:0o700});
const files=['index.html','app.js','style.css','circle-mobile.css','academy-brand.css','academy-branches.css','public-circle-hero.css','mothers-library.css','mothers-library.js','mothers-timetable.js','free-learning-art.css','free-learning-catalogue.js','free-learning.js','free-learning-model.mjs','free-learning-view.css','free-learning-view.mjs','free-learning.html','memorisation-catalogue.js','memorisation.js','memorisation.css','prospectus-2027.html','prospectus-2027.js','prospectus.css','assets','free-learning'];
const declared=[...designIndex.matchAll(/(?:src|href)="([^"?]+)(?:\?[^\"]*)?"/g)].map(m=>m[1]).filter(file=>/^[-A-Za-z0-9_]+\.(?:css|m?js)$/.test(file)&&!['text-editor.js','text-editor.css','layout-editor.js','layout-editor.css'].includes(file));
for(const file of new Set([...files,...declared]))await cp(join(design,'dist',file),join(circles,file),{recursive:true});
// New shared podcast modules are copied as UI only, never their private bundles.
let podcastUI=false;
try{await stat(join(design,'dist/course-source.mjs'));podcastUI=true;}catch(error){if(error.code!=='ENOENT')throw error;}
if(podcastUI){
 for(const file of ['course-source.mjs','podcast-view.mjs','mothers-subject-source.mjs','mothers-podcast-context.js','academy'])await cp(join(design,'dist',file),join(circles,file),{recursive:true});
 const read=file=>readFile(join(circles,file),'utf8');
 await writeFile(join(circles,'course-source.mjs'),connectedCourseSource(await read('course-source.mjs')));
 await writeFile(join(circles,'podcast-view.mjs'),connectedPodcastView(await read('podcast-view.mjs')));
 for(const file of ['free-learning.html','academy/mothers/surah-al-baqarah/index.html'])await writeFile(join(circles,file),connectedCoursePage(await read(file)));
 const context=await read('mothers-podcast-context.js');
 await writeFile(join(circles,'mothers-podcast-context.js'),context.replace("homeHref:'../../../?concept=circle&view=mothers&branch=academy&embed=1#mothers-subjects'","homeHref:'/studio/?classroom=mothers'"));
 const subject=await read('academy/mothers/surah-al-baqarah/index.html');
 await writeFile(join(circles,'academy/mothers/surah-al-baqarah/index.html'),subject.replace('href="../../../?concept=circle&view=mothers&branch=academy&embed=1"','href="/studio/?classroom=mothers"'));
}

// Even before the connection module loads, no member link may leave for the old
// membership service. The original design checkout remains unchanged.
const designApp=await readFile(join(circles,'app.js'),'utf8'),legacyMemberLinks=(designApp.match(/https:\/\/ummabbadacademy\.com\/my-account\//g)||[]).length;
if(!legacyMemberLinks)throw Error('Review the current design login contract before preparing.');
await writeFile(join(circles,'app.js'),designApp.replaceAll('https://ummabbadacademy.com/my-account/','/?login=1').replaceAll('href="/?login=1" target="_blank" rel="noopener noreferrer"','href="/?login=1"'));
const original=await readFile(join(circles,'index.html'),'utf8');
const entry=`<script>const circlesEntryParams=new URLSearchParams(location.search);window.AcademyCirclesEntry={login:circlesEntryParams.get('login')==='1',area:circlesEntryParams.get('area')};circlesEntryParams.set('concept','circle');circlesEntryParams.set('view','website');circlesEntryParams.delete('role');circlesEntryParams.delete('collection');history.replaceState(null,'',location.pathname+'?'+circlesEntryParams);</script>`;
const legacy=`<script>{const destination=(${legacyStudioDestination.toString()})(new URL(location.href));window.AcademyCirclesRedirecting=Boolean(destination);if(destination)location.replace(destination);}</script>`;
const hostedDesign=original.replace(/\s*<script[^>]+src="layout-editor\.js[^"]*"[^>]*><\/script>/g,'').replace(/\s*<link[^>]+href="(?:layout-editor|text-editor)\.css[^"]*"[^>]*>/g,'');
const connected=hostedDesign.replace('<head>','<head><base href="/circles/">'+legacy).replace('</head>','<link rel="stylesheet" href="/circles-login.css"></head>').replace('<script src="app.js',entry+'<script src="app.js').replace(/\s*<script src="text-editor\.js[^\"]*"><\/script>/,'').replace('</body>','<script type="module">if(!window.AcademyCirclesRedirecting)await import("/circles-login.mjs");</script></body>');
if(connected===original||!connected.includes('/circles-login.mjs'))throw Error('Circles entry preparation failed.');
await writeFile(join(circles,'index.html'),connected);
await writeFile(join(publicRoot,'index.html'),connected);
const report={format:'CIRCLES_LOGIN_LOCAL_BUILD_V1',localOnly:true,designCommit,designIndexSha256:contentHash(Buffer.from(original)),connectedIndexSha256:contentHash(Buffer.from(connected)),legacyMemberLinksReplaced:legacyMemberLinks,route:'/',homepageAlias:'/circles/',backend:'Existing AcademyStudio auth/login, auth/exchange, api/me and auth/academy',nativeStudio:'/studio/?manage=1',nativeLearning:'/studio/?view=collections',tafseer:'/studio/?view=collections&collection=tafseer',legacyReaderBookmarksPreserved:true,authority:'ACADEMY',publicRoot,designOwnerCheckoutUnchanged:true,hostedCalls:0,deployed:false,prototypeRoleSelectionDisabled:true,prototypeTextEditorOmitted:true,podcastUI,privateCourseBundlesIncluded:false,newMediaLinked:false,mothersSubjectOwner:'ACADEMY',sourcePreviewPlaybackEnabled:false};
await writeFile(join(destination,'build.json'),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report));
