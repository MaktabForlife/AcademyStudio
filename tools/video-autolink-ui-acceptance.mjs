import assert from 'node:assert/strict';
import https from 'node:https';import {readFileSync,mkdirSync,writeFileSync,appendFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {resolve,extname} from 'node:path';import {pathToFileURL} from 'node:url';
import {setup,response} from '../tests/video-autolink-job-fixture.mjs';import {runProcessingJob} from '../src/video-autolink/jobs.mjs';import {handle} from '../src/worker.mjs';import {defaultCard} from '../src/playlist-cards.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Run this disposable host fixture only in GitHub Actions.');appendFileSync('/etc/hosts','\n127.0.0.1 website.test\n');
const output=process.env.VIDEO_UI_EVIDENCE;if(!output)throw Error('Set a runner-only evidence directory.');mkdirSync(output,{recursive:true});
const tools=process.env.VIDEO_PLAYWRIGHT_ROOT;if(!tools)throw Error('Use the pinned runner browser package.');
const {chromium,webkit}=await import(pathToFileURL(resolve(tools,'node_modules/playwright/index.mjs')));
const browserName=process.env.VIDEO_BROWSER||'chromium',engine={chromium,webkit}[browserName];if(!engine)throw Error('Choose a pinned test browser.');
const tls=resolve(process.env.RUNNER_TEMP||'/tmp','video-ui-tls-'+browserName);mkdirSync(tls,{recursive:true});execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',tls+'/key.pem','-out',tls+'/cert.pem','-days','1','-subj','/CN=website.test'],{stdio:'ignore'});
let providerCalls=0,loseAuthorise=true,origin,server,browser,context,secondContext,mainPage,f,requestCount=0,holdCandidate=false,releaseCandidate=null,candidateWaiting=null;const authorisations=[],statuses=[],errors=[],pageErrors=[];const originalPublished=[];
try{
 f=await setup();
 const env={...f.env,VIDEO_AUTOLINK_HTTP_ENABLED:'1',VIDEO_UPLOAD_MAX_BYTES:String(10*1024*1024),VIDEO_AI_WORKFLOW_RETENTION_HOURS:'1'};
 const provider=async()=>{providerCalls++;return response();};
 env.VIDEO_PROCESSING_WORKFLOW={create:async({params})=>{await runProcessingJob(env,params.jobId,{fetcher:provider});return {id:params.jobId};}};
 const teachers=async(url,options)=>{
  const input=JSON.parse(options.body);
  if(new URL(url).pathname==='/internal/website/course-playlist-placements'){const place={activityKey:'COURSE:course',offeringId:'course',classId:'',title:'Synthetic Course',className:''};return Response.json({schema:'COURSE_PLAYLIST_PLACEMENTS_V1',offeringId:input.offeringId,ownerActivityKey:'COURSE:course',locations:[{...place,name:place.title}],placements:(input.selected||[]).map(()=>place),classes:[],checkedAt:Date.now()});}
  if(new URL(url).pathname!=='/internal/website/media-teachers')throw Error('No external Source call allowed in this local browser test.');
  return Response.json({schema:'NATIVE_MEDIA_TEACHERS_V1',offeringId:input.offeringId,teachers:[{id:'outsider',name:'Registered synthetic Teacher'}],classes:[],checkedAt:Date.now()});
 };
 const cookie=(await f.login('admin')).cookie;
 // Use the exact session that carries the independently seeded native Source proof.
 const existingSession=await f.db.prepare('SELECT token_hash FROM sessions WHERE source_ref=? LIMIT 1').bind(f.actor.source_ref).first();assert(existingSession);
 // The fixture actor's original random raw session is not persisted. A new
 // synthetic exchange is explicitly linked to the same native Source prerequisite.
 const hash=await (await import('../src/protocol.mjs')).sha256(cookie.split('=')[1]);await f.run('UPDATE sessions SET source_ref=? WHERE token_hash=?',f.actor.source_ref,hash);
 const localRequest=async(path,body)=>{
  const r=await handle(new Request(origin+path,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{Origin:origin,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),env,{},teachers),value=await r.json();assert.equal(r.status,200,JSON.stringify(value));return value;
 };
 const publicRoot=resolve('public');
 server=https.createServer({key:readFileSync(tls+'/key.pem'),cert:readFileSync(tls+'/cert.pem')},async(req,res)=>{
  try{
   const url=new URL(req.url,origin);
   if(url.pathname==='/test'){
    res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'private, no-store','Set-Cookie':cookie+'; Path=/; Secure; HttpOnly; SameSite=Lax'});
    res.end('<!doctype html><meta charset="utf-8"><title>Synthetic Course Media component</title><main id="course"></main><script type="module">import {mountNativeCourseMedia} from "/course-media.mjs";import {identity,changed} from "/api.mjs";window.privateWrites=0;const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){window.privateWrites++;return set.call(this,k,v);};window.currentAccount=true;window.component=mountNativeCourseMedia(document.getElementById("course"),{offeringId:"course",courseName:"Synthetic Course",current:()=>window.currentAccount});window.switchAccount=()=>{window.currentAccount=false;changed(null);window.dispatchEvent(new Event("storage"));};</script>');return;
   }
   if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/')){
    requestCount++;let length=0;const chunks=[];for await(const chunk of req){length+=chunk.length;if(length>9*1024*1024)throw Error('Local request limit');chunks.push(chunk);}const bytes=Buffer.concat(chunks),headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(','):v);
    const request=new Request(url,{method:req.method,headers,...(bytes.length?{body:bytes}:{})});const reply=await handle(request,env,{},teachers);
    let action;try{action=JSON.parse(bytes.toString()).action;}catch{}
    if(action==='video-processing-authorise'){const value=JSON.parse(bytes.toString());authorisations.push(value.operationId);if(loseAuthorise){loseAuthorise=false;statuses.push({path:url.pathname,action,status:503,simulatedLostAcknowledgement:true});res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end('{"error":"Synthetic lost authorisation acknowledgement","code":"PROCESSING_UNAVAILABLE"}');return;}}
    if(action==='video-processing-candidate'&&holdCandidate){holdCandidate=false;candidateWaiting?.();await new Promise(resolve=>{releaseCandidate=resolve;});}
    let publicError=null;if(reply.status>=400){try{const e=await reply.clone().json();publicError={code:e.code,error:e.error};}catch{}}statuses.push({path:url.pathname,action:action||null,status:reply.status,...(publicError?{publicError}:{})});res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(Buffer.from(await reply.arrayBuffer()));return;
   }
   const file=resolve(publicRoot,'.'+url.pathname);if(!file.startsWith(publicRoot+'/')||!['.mjs','.css','.svg','.png'].includes(extname(file))){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':extname(file)==='.mjs'?'text/javascript':extname(file)==='.css'?'text/css':'image/svg+xml','Cache-Control':'no-store'});res.end(readFileSync(file));
  }catch{res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end('{"error":"Synthetic local boundary unavailable","code":"LOCAL_UNAVAILABLE"}');}
 });
 await new Promise(done=>server.listen(443,'127.0.0.1',done));origin='https://website.test';env.WEBSITE_ORIGIN=origin;
 const table=await localRequest('/api/admin/course/course-playlists?action=course-playlists'),playlistId=crypto.randomUUID();await localRequest('/api/admin/course',{action:'course-playlist-save',operationId:crypto.randomUUID(),playlistId,name:'Actual private processing destination',description:'',revision:table.revision,playlistRevision:0,websiteRevision:0,contentRevision:0,card:defaultCard(),teacherIds:[],placements:[{activityKey:'COURSE:course',classId:''}]});
 for(const row of (await f.db.prepare('SELECT attachment_id,published FROM attachments ORDER BY attachment_id').all()).results)originalPublished.push(row);
 browser=await engine.launch();context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1280,height:1000}});const page=await context.newPage();mainPage=page;page.on('pageerror',e=>pageErrors.push(e.message));page.on('dialog',d=>d.accept());page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('503'))errors.push(m.text());});
 await page.goto(origin+'/test');await page.locator('[data-cmw="open"][data-id="'+playlistId+'"]').click();await page.locator('[data-cmw="process-video"]').click();await page.locator('[data-vp="new"]').click();
 await page.locator('[data-media-attach]').waitFor();assert.equal(await page.locator('[name=summary]').count(),0);assert.equal(await page.locator('[name=topics]').count(),0);
 await page.locator('[name=title]').fill('Browser synthetic source');await page.locator('[name=teacherIds][value=outsider]').check();await page.locator('[name=sourceURL]').fill('https://www.youtube.com/watch?v=ABCdef12345');await page.locator('[data-media-attach] button[type=submit]').click();
 await page.locator('[data-vp-transcript]').waitFor();assert.equal(providerCalls,0);
 await page.locator('[name=transcript]').fill('WEBVTT\n\n00:00.000 --> 00:02.000\nSynthetic evidence: read the assigned page.\n\n00:02.000 --> 00:04.000\nA source-grounded second point.');await page.locator('[name=durationSeconds]').fill('4');await page.locator('[data-vp-transcript] button[type=submit]').click();
 await page.locator('[data-vp-authorise]').waitFor();assert.equal(providerCalls,0);await page.locator('[name=authorise]').check();await page.locator('[data-vp-authorise] button[type=submit]').click();
 await page.locator('[data-vp="retry"]').waitFor();assert.equal(providerCalls,1);await page.locator('[data-vp="retry"]').click();await page.locator('[data-vp="candidate"]').waitFor();assert.equal(providerCalls,1);assert.equal(new Set(authorisations).size,1);assert.equal(authorisations.length,2);
 const noPolling=requestCount;await page.waitForTimeout(250);assert.equal(requestCount,noPolling);
 await page.locator('[data-vp="candidate"]').click();await page.locator('[data-vp-review]').waitFor();assert((await page.locator('body').textContent()).includes('PRIVATE uncertain book'));
 await page.locator('[name=summary]').fill('- Explicit Admin-reviewed browser summary.');await page.locator('[name=reviewed]').check();await page.locator('[data-vp-review] button[type=submit]').click();
 await page.locator('[data-vp="add-course-draft"]').waitFor();const accepted=await f.db.prepare("SELECT x.attachment_id,x.published,c.draft_key,c.published_key FROM attachments x JOIN recording_companions c USING(attachment_id) WHERE x.title='Browser synthetic source'").first();assert(accepted);assert.equal(accepted.published,0);assert.equal(accepted.published_key,null);const draft=JSON.parse(await (await f.content.get(accepted.draft_key)).text());assert.equal(draft.summary,'- Explicit Admin-reviewed browser summary.');assert(!JSON.stringify(draft).includes('PRIVATE'));assert(!('privateEvidence' in draft));
 await page.screenshot({path:resolve(output,'private-reviewed-draft.png'),fullPage:true});
 await page.locator('[data-vp="add-course-draft"]').click();await page.getByText('This lesson is in the current playlist draft.',{exact:false}).waitFor();
 assert.equal((await f.db.prepare('SELECT published FROM attachments WHERE attachment_id=?').bind(accepted.attachment_id).first()).published,0);
 await page.locator('[data-vp="close"]').click();await page.locator('[data-cmw="publish-content"]').click();await page.getByText('Content published with summaries and follow-along.',{exact:true}).waitFor();assert.equal((await f.db.prepare('SELECT published FROM attachments WHERE attachment_id=?').bind(accepted.attachment_id).first()).published,1);
 assert.equal((await f.db.prepare("SELECT reference_id FROM course_playlist_content WHERE playlist_id=? AND stage='PUBLISHED' AND kind='RECORDING'").bind(playlistId).first()).reference_id,accepted.attachment_id);

 for(const row of originalPublished)assert.equal((await f.db.prepare('SELECT published FROM attachments WHERE attachment_id=?').bind(row.attachment_id).first()).published,row.published);
 assert.equal(providerCalls,1);assert.equal(await page.evaluate(()=>window.privateWrites),0);assert.deepEqual(pageErrors,[]);
 // A second isolated browser context exercises an actual delayed candidate body.
 // It changes only its own client context; no remote cancellation is claimed.
 secondContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1100,height:900}});const second=await secondContext.newPage();second.on('dialog',d=>d.accept());await second.goto(origin+'/test');await second.locator('[data-cmw="open"][data-id="'+playlistId+'"]').click();await second.locator('[data-cmw="process-video"]').click();await second.locator('[data-vp="existing"]').click();await second.locator('[data-vp="select"][data-id="'+accepted.attachment_id+'"]').click();await second.locator('[data-vp="history-job"]').first().click();
 const waiting=new Promise(resolve=>{candidateWaiting=resolve;});holdCandidate=true;await second.locator('[data-vp="candidate"]').click();await waiting;
 await second.evaluate(()=>window.switchAccount());assert(!(await second.locator('body').textContent()).includes('PRIVATE uncertain book'));releaseCandidate();await second.waitForTimeout(200);assert(!(await second.locator('body').textContent()).includes('PRIVATE uncertain book'));assert.equal(await second.locator('[data-vp-review]').count(),0);
 writeFileSync(resolve(output,'result.json'),JSON.stringify({browser:browserName,version:browser.version(),passed:true,providerMockCalls:providerCalls,paidAuthorisationSameOperationRetries:authorisations.length,uniqueAuthorisations:new Set(authorisations).size,automaticProgressPollingObserved:false,privateStorageWrites:0,pageErrors,statuses,scope:'actual native Course Media component/API with local D1/R2, synthetic pre-established native session/Source proof, mocked Teacher bridge/provider/Workflow; loopback TLS ignores only its disposable certificate; not real PIN, production-date Workflow, Academy browser proxy, real hosting, video/audio completeness or billed usage'},null,2));console.log(JSON.stringify({browser:browserName,passed:true,providerMockCalls:providerCalls,apiRequests:requestCount,pageErrors:pageErrors.length}));
}catch(error){
 const failure={failed:true,error:{name:error.name,message:String(error.message).slice(0,2000)},pageErrors,statuses,body:mainPage?await mainPage.locator('body').textContent().catch(()=>''):'before browser'};
 writeFileSync(resolve(output,'failure.json'),JSON.stringify(failure,null,2));if(mainPage)await mainPage.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});console.error(JSON.stringify(failure));throw error;
}finally{await secondContext?.close();await context?.close();await browser?.close();if(server)await new Promise(done=>server.close(done));await f?.close();}
