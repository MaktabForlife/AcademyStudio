import './preserve-local-files.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MEDIA_REVIEW_URL;if(!/^http:\/\/127\.0\.0\.1:\d+\/$/.test(base||''))throw Error('Use the loopback review server.');
const out=resolve(process.env.MEDIA_REVIEW_OUTPUT);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-gpu']});
const report={localOnly:true,widths:[],coursesChecked:0,errors:[],externalRequestsBlocked:0};
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}});await context.route('**/*',r=>{if(new URL(r.request().url()).origin!==new URL(base).origin){report.externalRequestsBlocked++;return r.abort();}return r.continue();});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base);await page.locator('[data-cmw=open-existing]').waitFor();await page.screenshot({path:out+'/'+width+'-course-collections.png',fullPage:true});
  await page.locator('[data-cmw=open-existing]').click();await page.locator('.existing-media-recording').first().waitFor();assert.equal(await page.locator('.existing-media-recording').count(),2);assert(await page.getByRole('link',{name:'Read website',exact:true}).count());assert.equal(await page.locator('.existing-media-materials a[href*="/api/media/"]').count(),1);
  await page.screenshot({path:out+'/'+width+'-kahf-material.png',fullPage:true});
  await page.locator('#pick').selectOption({label:'MOU'});await page.locator('.monthly-existing tbody tr').first().waitFor();assert.equal(await page.locator('.monthly-existing tbody tr').count(),2);await page.screenshot({path:out+'/'+width+'-mou-collections.png',fullPage:true});
  const privateRow=page.locator('.monthly-existing tbody tr').filter({hasText:'Kitabul Adhkar'});await privateRow.getByRole('button',{name:'Open',exact:true}).click();await page.locator('.monthly-recording').first().waitFor();assert.match(await page.locator('[data-monthly-content]').innerText(),/Private draft/);assert.equal(await page.getByRole('link',{name:'Read website',exact:true}).count(),0);await page.screenshot({path:out+'/'+width+'-private-mou.png',fullPage:true});
  await page.locator('#pick').selectOption({label:'Tafseer'});await page.locator('.monthly-existing tbody tr').first().waitFor();assert.equal(await page.locator('.monthly-existing tbody tr').count(),8);assert.match(await page.locator('.monthly-unassigned').innerText(),/6 recordings/);await page.screenshot({path:out+'/'+width+'-tafseer-collections.png',fullPage:true});
  await page.locator('[data-monthly=unassigned]').click();await page.locator('.monthly-recording').first().waitFor();assert.equal(await page.locator('.monthly-recording').count(),6);assert.equal(await page.locator('[data-monthly=settings]').count(),0);assert.equal(await page.getByRole('link',{name:'Edit website',exact:true}).count(),0);await page.screenshot({path:out+'/'+width+'-unassigned.png',fullPage:true});
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));report.widths.push(width);
  if(width===1440){const config=await (await context.request.get(base+'review/config')).json();for(const offer of config.offers.filter(o=>o.kind==='COURSE')){await page.locator('#pick').selectOption(offer.id);await page.locator('[data-cmw=open-existing]').waitFor();const count=await page.locator('tbody tr').count();assert.equal(count,1);assert(!await page.locator('#media').innerText().then(t=>t.includes('No playlists')));report.coursesChecked++;}const projectLinks=Object.values(config.projects).flat();assert(projectLinks.length>=5);for(const file of projectLinks){const r=await context.request.get(base.slice(0,-1)+file.href);assert(r.ok());assert.equal(r.headers()['content-type'],'application/pdf');assert((await r.body()).subarray(0,4).toString()==='%PDF');}report.projectPdfsOpened=projectLinks.length;}
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;await writeFile(out+'/browser-evidence.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
