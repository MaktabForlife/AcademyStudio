import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from '/Users/hbnaidu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {publicCirclesRoute} from '../src/public-circles-routes.mjs';
const root=resolve(import.meta.dirname,'..'),candidate=resolve(process.argv[2]||resolve(root,'local-content/circles-cleanup-3/public')),out=resolve(process.argv[3]||resolve(root,'../../outputs/circles-only-studio-cleanup-20261102/browser'));
await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.pdf':'application/pdf'};
const missing=[],requests=[],errors=[],checks=[];
async function server(folder,compat){const s=createServer(async(req,res)=>{const u=new URL(req.url,'http://'+req.headers.host);try{
 if(compat){const response=publicCirclesRoute(new Request(u,{method:req.method}));if(response){res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;}}
 if(u.pathname.startsWith('/api/')||u.pathname.startsWith('/auth/')){
  const account=req.headers['x-fixture-account'];requests.push({path:u.pathname,account:account||null});let status=200,value={success:true};
  if(u.pathname==='/api/me'){if(account)value={accountId:account,displayName:account==='admin'?'Sample Admin':'Sample Learner',globalAdmin:account==='admin'};else {status=401;value={error:'Sign in to continue'};}}
  else if(u.pathname==='/api/config')value={academyOrigin:'https://academy.test',authorityMode:'ACADEMY'};
  else if(u.pathname==='/api/circles/navigation')value={academia:[],mothers:false,hifz:false,tafseer:'/studio/?view=collections&collection=tafseer',purchasedCourses:[],adminCourses:[]};
  else if(u.pathname==='/api/circles/dashboard'){let body='';for await(const data of req)body+=data;const mode=JSON.parse(body||'{}').mode||'learn';if(account!=='admin'&&mode!=='learn'){status=403;value={error:'Not permitted'};}else value={mode,checkedAt:Date.now(),timezone:'Africa/Johannesburg',availableModes:account==='admin'?['learn','teach','admin']:['learn'],adminBadge:account==='admin'?'Global Admin':null,activities:[],programmeNavigation:[],timetable:[],dueNotes:[],messages:{counts:{unread:0,toAcknowledge:0}},assessments:[],warnings:[]};}
  else if(u.pathname==='/api/public/academy-announcements'){status=404;value={code:'ANNOUNCEMENTS_NOT_ACTIVATED',error:'Not activated'};}
  else if(u.pathname==='/api/public/circles')value={items:[{kind:'COURSE',key:'imratun-muminah',websiteId:'exact-imratun',title:'Imra’tun Mu’minah'}]};
  else if(u.pathname==='/api/websites')value={websites:[],playlists:[],more:false};
  else if(u.pathname.startsWith('/api/websites/')){status=403;value={error:'This website is unavailable for this account'};}
  else if(u.pathname==='/auth/logout')value={success:true};
  else {status=403;value={error:'Not permitted'};}
  res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));return;
 }
 let path=u.pathname;if(path.endsWith('/'))path+='index.html';const file=resolve(folder,'.'+path);if(!file.startsWith(folder+'/'))throw Error('Outside fixture');res.setHeader('content-type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch(error){missing.push(u.pathname);res.writeHead(404);res.end();}});await new Promise(r=>s.listen(0,'127.0.0.1',r));return {server:s,url:'http://127.0.0.1:'+s.address().port};}
const current=await server(candidate,true),old=await server(resolve(root,'../AcademyStudio-media-dashboard-release-10911/local-content/release-10911/public'),false);
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
async function page(account){const context=await browser.newContext({reducedMotion:'reduce',extraHTTPHeaders:account?{'X-Fixture-Account':account}:{}});await context.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'||['data:','blob:'].includes(u.protocol)?route.continue():route.abort();});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));return {context,page:p};}
const boxes=async p=>p.evaluate(()=>Object.fromEntries(['.hub-orb','[data-home-area=hifz]','[data-home-area=tafseer]','[data-home-area=academy]','[data-home-area=arabic-adventures]'].map(sel=>{const r=document.querySelector('#animated-hub '+sel).getBoundingClientRect();return [sel,{x:r.x,y:r.y,w:r.width,h:r.height}];})));
try{
 const a=await page(),b=await page();
 for(const width of [1440,1024,390]){
  await Promise.all([a.page.setViewportSize({width,height:1000}),b.page.setViewportSize({width,height:1000})]);
  await Promise.all([a.page.goto(current.url+'/?public=1'),b.page.goto(old.url+'/?public=1')]);
  for(const p of [a.page,b.page]){await p.locator('.public-combined-worship').waitFor();await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(200);}
  const [after,before]=await Promise.all([boxes(a.page),boxes(b.page)]);for(const [sel,box]of Object.entries(after))for(const key of ['x','y','w','h'])assert(Math.abs(box[key]-before[sel][key])<2,JSON.stringify({width,sel,key,after:box,before:before[sel]}));
  assert.equal(await a.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(new URL(a.page.url()).search,'?public=1');checks.push({width,approvedHeroParity:true,noOverflow:true});await a.page.screenshot({path:resolve(out,'home-'+width+'.png'),fullPage:true});
 }
 await a.page.goto(current.url+'/circles/?concept=journal&view=website&branch=academy&public=1#academy-story');await a.page.locator('.public-combined-worship').waitFor();assert.equal(new URL(a.page.url()).pathname,'/');assert.equal(new URL(a.page.url()).search,'?public=1');assert.equal(new URL(a.page.url()).hash,'#academy-story');
 await a.page.goto(current.url+'/#login');await a.page.locator('#circles-sign-in[open]').waitFor();assert.equal(await a.page.locator('[name=pin]').getAttribute('readonly'),'');await a.page.getByRole('button',{name:'Close sign-in'}).click();
 await a.page.goto(current.url+'/?public=1#contact');await a.page.locator('#detail[open]').waitFor();assert.equal(await a.page.locator('#detail a[href="mailto:admin@ummabbadacademy.com"]').count(),1);await a.page.keyboard.press('Escape');
 await a.page.goto(current.url+'/circles/prospectus-2027.html#arabic-adventures');assert.equal(new URL(a.page.url()).pathname,'/prospectus-2027.html');assert.equal(new URL(a.page.url()).hash,'#arabic-adventures');assert.equal(await a.page.locator('header a').first().getAttribute('href'),'/?public=1');
 await a.page.goto(current.url+'/circles/free-learning.html?course=ulumul-quran&view=read&id=exact');assert.equal(new URL(a.page.url()).search,'?course=ulumul-quran&view=read&id=exact');assert.equal(await a.page.locator('.free-learning-brand').getAttribute('href'),'/?public=1');
 await a.page.goto(current.url+'/circles/free-learning.html?course=imratun-muminah&view=read&id=original-part#original-anchor');await a.page.getByText('Your saved lesson',{exact:true}).waitFor();assert.equal(new URL(a.page.url()).search,'?course=imratun-muminah&view=read&id=original-part');assert.equal(new URL(a.page.url()).hash,'#original-anchor');assert.equal(await a.page.getByRole('link',{name:'Open course',exact:true}).getAttribute('href'),'/studio/?website=exact-imratun');
 checks.push({oldAliasesAndPublicRecovery:true,exactHistoricalArguments:true,noGuessedLessonMapping:true});
 for(const mode of ['learn','teach','admin']){
  const signed=await page('admin');await signed.page.setViewportSize({width:1440,height:1050});await signed.page.goto(current.url+'/?workspace='+mode);await signed.page.locator('#circles-dashboard .circles-dash-layout').waitFor();await signed.page.waitForFunction(()=>!document.documentElement.hasAttribute('data-circles-home-state'));
  assert.equal(await signed.page.locator('body').getAttribute('data-circles-dashboard-mode'),mode);assert.equal(await signed.page.locator('#academy-news').isVisible(),false);assert.equal(await signed.page.locator('#programmes h2').innerText(),'My courses');assert.equal(await signed.page.locator('.circles-show-all-courses').getAttribute('href'),'/studio/?view=collections&collection=courses');
  await signed.page.screenshot({path:resolve(out,'dashboard-'+mode+'.png'),fullPage:true});checks.push({checkedAccountMode:mode,currentDashboard:true,myCoursesPreserved:true});await signed.context.close();
 }
 const denied=await page('student');await denied.page.goto(current.url+'/?workspace=admin');await denied.page.locator('#circles-dashboard [data-circles-dashboard-refresh]').waitFor();assert.equal(await denied.page.locator('.circles-manage').count(),0);await denied.context.close();checks.push({forgedModeDenied:true});
 const studio=await page();await studio.page.goto(current.url+'/studio/?website=exact-native#view=lesson&id=original');await studio.page.locator('.programme-page-actions').waitFor();await studio.page.locator('#main:not([hidden])').waitFor();assert.equal(await studio.page.locator('#homepage').count(),0);assert.equal(new URL(studio.page.url()).hash,'#view=lesson&id=original');await studio.page.locator('#close-sign-in').click();await studio.page.locator('#header-home-button').click();await studio.page.waitForURL(current.url+'/');await studio.page.locator('.public-combined-worship').waitFor();await studio.context.close();checks.push({deniedReaderKeepsExactBookmarkAndHome:true});
 const builder=await page('admin');await builder.page.goto(current.url+'/builder/?website=exact-native');await builder.page.getByText('Return to Studio to continue',{exact:true}).waitFor();assert.equal(await builder.page.locator('[data-builder-account]').innerText(),'Sample Admin');assert.equal(await builder.page.locator('[data-builder-home]').getAttribute('href'),'/?dashboard=1');await builder.page.screenshot({path:resolve(out,'builder-recovery.png'),fullPage:true});await builder.context.close();checks.push({builderCheckedHeaderAndExactRecovery:true});
 await a.context.close();await b.context.close();assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);await writeFile(resolve(out,'acceptance.json'),JSON.stringify({passed:true,checks,errors,missing,requests},null,2)+'\n');console.log(JSON.stringify({passed:true,checks}));
}finally{await browser.close();current.server.close();old.server.close();}
