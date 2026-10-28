import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PREVIEW_ORIGIN||'http://localhost:8871',allowed=new Set([new URL(base).origin,'http://localhost:'+(Number(new URL(base).port)+1)]);
const output='outputs/integration-browser';mkdirSync(output,{recursive:true});
const result={checks:[],errors:[],blocked:[],requests:[],localOnly:true};
const browser=await chromium.launch({headless:true,args:['--disable-gpu'],...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
async function context(){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});ctx.setDefaultTimeout(10000);
 await ctx.route('**/*',route=>{const url=route.request().url();if(url.startsWith('https://www.youtube-nocookie.com/embed/'))return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic protected video</title>'});if(allowed.has(new URL(url).origin)||url.startsWith('blob:')||url.startsWith('data:'))return route.continue();result.blocked.push(url);return route.abort();});
 ctx.on('page',page=>{page.on('pageerror',error=>result.errors.push(error.message));page.on('response',response=>{const url=new URL(response.url());if(url.origin===base&&url.pathname.startsWith('/api/'))result.requests.push({path:url.pathname+url.search,method:response.request().method(),status:response.status(),rows:Number(response.headers()['x-local-d1-rows-read']||0)});});});return ctx;
}
async function login(page,user){await page.goto(base);await page.locator('#sign-in-button').click();await page.locator('[name=uniqueid]').fill(user);await page.locator('[name=pin]').fill('1234');await page.locator('#sign-in-form button[type=submit]').click();await page.locator('#my-learning:not([hidden])').waitFor();}
async function json(ctx,path,body){const response=await ctx.request[body?'post':'get'](base+path,{headers:{Origin:base},...(body?{data:body}:{})});const value=await response.json();assert.equal(response.status(),200,JSON.stringify(value));return value;}
try{
 const admin=await context(),editor=await admin.newPage();await login(editor,'separation-global');
 const original=await json(admin,'/api/websites/site-course/edit'),pdf=new TextEncoder().encode('%PDF-1.7 reusable fixture');
 const uploaded=await admin.request.put(base+'/api/admin/course/files?'+new URLSearchParams({assetId:'integration-pdf',operationId:crypto.randomUUID(),filename:'Reusable.pdf'}),{headers:{Origin:base,'Content-Type':'application/pdf'},data:Buffer.from(pdf)});assert.equal(uploaded.status(),200,await uploaded.text());
 await json(admin,'/api/admin/course',{action:'attachment',operationId:crypto.randomUUID(),attachmentId:'website-site-course-integration-pdf',assetId:'integration-pdf',websiteId:'site-course',lessonId:original.document.lessons[0].id,lessonDate:'2026-10-28',cohort:'',title:'Reusable PDF',audience:'WEBSITE',published:false});
 const published=structuredClone(original.document);published.materials.files.push({id:'integration-material',assetId:'integration-pdf',title:'Reusable PDF',description:''});
 await json(admin,'/api/websites/site-course/edit',{action:'save',operationId:crypto.randomUUID(),revision:original.revision,document:published});
 await json(admin,'/api/websites/site-course/edit',{action:'publish',operationId:crypto.randomUUID(),revision:original.revision+1});
 await json(admin,'/api/websites/site-course/edit',{action:'save',operationId:crypto.randomUUID(),revision:original.revision+2,document:original.document});
 await json(admin,'/api/admin/course',{action:'youtube',operationId:crypto.randomUUID(),assetId:'integration-video',videoId:'abcdefghijk',title:'Synthetic recording'});
 await json(admin,'/api/admin/course',{action:'attachment',operationId:crypto.randomUUID(),attachmentId:'integration-video-attachment',assetId:'integration-video',websiteId:'site-course',lessonId:original.document.lessons[0].id,lessonDate:'2026-10-28',cohort:'',title:'Synthetic recording',audience:'RECORDING',published:true});

 const learner=await context(),reader=await learner.newPage();await login(reader,'separation-studentA');
 assert.equal((await learner.request.get(base+'/api/media/website-site-course-integration-pdf')).status(),200);
 await editor.goto(base+'/builder/?website=site-course');await editor.locator('#student-preview h1').first().waitFor();
 const beforeGets=result.requests.filter(row=>row.method==='GET'&&row.path==='/api/websites/site-course/edit').length;
 await editor.locator('[data-path="home.description"]').fill('Unsaved work must survive file selection.');
 await editor.locator('[data-action="upload-image"][data-path="home.imageId"]').click();
 await editor.locator('#asset-upload').setInputFiles({name:'New-cover.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')});
 await editor.locator('#editor-content .image-picker p').filter({hasText:'New-cover.png'}).waitFor();
 await editor.locator('[data-action="page"][data-page="materials"]').click();await editor.locator('[data-action="attach-native"]').click();await editor.locator('[data-attach="integration-pdf"]').click();
 await editor.locator('#studio-dialog').waitFor({state:'hidden'});
 await editor.locator('#editor-content').getByText('Reusable.pdf',{exact:true}).first().waitFor();
 assert.equal((await learner.request.get(base+'/api/media/website-site-course-integration-pdf')).status(),200,'Reusing a file must not withdraw the published attachment');
 assert.equal(result.requests.filter(row=>row.method==='GET'&&row.path==='/api/websites/site-course/edit').length,beforeGets,'File selection must not reload the whole private draft');
 assert.equal(result.requests.some(row=>row.method==='GET'&&row.path==='/api/admin/course'),false,'File picker must not load the participant/payment register');
 await editor.locator('[data-action="save-draft"]').click();await editor.locator('#save-status').filter({hasText:/Draft saved/}).waitFor();
 const saved=await json(admin,'/api/websites/site-course/edit');assert.equal(saved.document.home.description,'Unsaved work must survive file selection.');assert(saved.document.home.imageId);assert(saved.document.materials.files.some(file=>file.assetId==='integration-pdf'));assert(saved.assets.some(asset=>asset.asset_id===saved.document.home.imageId));
 const stillPublished=await json(learner,'/api/websites/site-course');assert.deepEqual(stillPublished.document,published);assert(!stillPublished.assets.some(asset=>asset.asset_id===saved.document.home.imageId));
 result.checks.push('Upload and reuse preserve unsaved work, discover exact metadata, retain the live PDF and avoid full-draft/register reloads');
 await editor.screenshot({path:output+'/builder-files.png',fullPage:true});

 const inline=await admin.newPage();await inline.goto(base+'/?website=site-course');await inline.locator('[data-inline-action="start"]:visible').first().click();
 const headline=inline.locator('[data-inline-path="home.headline"]').first();await headline.waitFor();await headline.fill('Both editors share the same website draft.');
 await inline.locator('[data-inline-action="save"]').click();await inline.locator('.sp-inline-state').filter({hasText:'Draft saved'}).waitFor();
 const inlineSaved=await json(admin,'/api/websites/site-course/edit');assert.equal(inlineSaved.document.home.headline,'Both editors share the same website draft.');assert.equal(inlineSaved.document.home.imageId,saved.document.home.imageId);assert.equal((await json(learner,'/api/websites/site-course')).document.home.headline,published.home.headline);
 await inline.locator('[data-inline-action="review"]').click();await inline.locator('[data-inline-action="publish"]').click();await inline.locator('[data-inline-action="start"]:visible').first().waitFor();
 assert.equal((await json(learner,'/api/websites/site-course')).document.home.headline,'Both editors share the same website draft.');
 await editor.reload();await editor.locator('[data-path="home.headline"]').waitFor();assert.equal(await editor.locator('[data-path="home.headline"]').inputValue(),'Both editors share the same website draft.');
 result.checks.push('Full-builder assets survive on-page editing; both modes share private Save and explicit publication');
 await inline.screenshot({path:output+'/shared-editor-publication.png',fullPage:true});

 let coverRequests=0,releaseCover;const coverReady=new Promise(resolve=>releaseCover=resolve),cover='/api/media/website-image-'+saved.document.home.imageId;
 await reader.route('**'+cover,async route=>{coverRequests++;await coverReady;await route.continue();});
 await reader.locator('[data-website="site-course"]').click();await reader.locator('[data-join^="ws-"]').first().waitFor({state:'attached'});assert.equal(coverRequests,1,'Timetable redraws must share the in-flight image request');const coverResponse=reader.waitForResponse(response=>new URL(response.url()).pathname===cover);releaseCover();await coverResponse;await reader.unroute('**'+cover);
 result.checks.push('Concurrent timetable redraws share one protected image request');
 await reader.locator('[data-sp="lesson"]').first().click();await reader.locator('[data-material="integration-video-attachment"]').click();await reader.locator('#media-dialog[open] iframe').waitFor();
 const second=await learner.newPage();await second.goto(base);await second.locator('#sign-out-button').waitFor();await second.locator('#sign-out-button').click();await reader.locator('#media-dialog').waitFor({state:'hidden'});assert.equal(await reader.locator('#media-body iframe,#media-body video,#media-body img').count(),0);
 result.checks.push('Cross-tab sign-out closes protected playback and removes its private media view');

 await login(reader,'separation-studentA');await reader.locator('[data-website="site-course"]').click();await reader.locator('[data-sp="lesson"]').first().click();await reader.locator('[data-material="integration-video-attachment"]').click();await reader.locator('#media-dialog[open] iframe').waitFor();
 await reader.route('**/api/me',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({success:false,error:'Synthetic session ended',code:'SIGN_IN_REQUIRED'})}));
 await reader.evaluate(async()=>{try{await (await import('/api.mjs')).api('/api/me');}catch{}});
 await reader.locator('#media-dialog').waitFor({state:'hidden'});assert.equal(await reader.evaluate(async()=>(await import('/api.mjs')).identity.account),null);
 assert.equal(await reader.locator('#media-body').textContent(),'');result.checks.push('Server session expiry invalidates client identity and closes protected playback');
 await reader.screenshot({path:output+'/session-ended.png',fullPage:true});
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.blocked,[]);
}finally{writeFileSync(output+'/result.json',JSON.stringify(result,null,2)+'\n');await browser.close();console.log(JSON.stringify({checks:result.checks,errors:result.errors,blocked:result.blocked,localOnly:true}));}
