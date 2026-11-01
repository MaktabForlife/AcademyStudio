import {permittedCompanionIndexes,readCompanion,recordingAttachmentPreflight} from './recording-companions.mjs';
import {mouClassroom} from './mou-classroom.mjs';
import {coursePublication} from './course-publication.mjs';
import {dashboardSnapshot} from './dashboard.mjs';
import {publicHeaderDate} from './header-date.mjs';
import {circlesNavigation,programmeSnapshot} from './navigation.mjs';
import {publicCatalogue,catalogueAccess,permittedGuideBindings,websitePresentation} from './circles.mjs';
import {academyAuthority,accessGate,joinAudience} from './access.mjs';
import {recordingScopedDocument} from './recorded-support.mjs';
import {coursePolicy,coursePolicyEpoch} from './course-policy.mjs';
import {Store} from './database.mjs';
import {fail,failure,json,bodyJSON,parseCookie,sha256,originCheck,cookie,id,text,integer,bytes,signedHeaders,safeToken,boundedAge} from './protocol.mjs';
import {receive,exchange} from './integration.mjs';
import {websiteAccess,objectJSON,editWebsite,publishHome,flushPublic} from './content.mjs';
import {change,upload,recording,announcements} from './admin.mjs';
import {mediaGate,streamMedia} from './media.mjs';
import {requestEnrolment,beginProvision,resumeProvision} from './enrolment.mjs';
import {academyCommand} from './academy-client.mjs';
import {publishSchedule} from './public-schedule.mjs';
import {contentVersion} from './content-package.mjs';
import {editionAssets,attachedWebsiteAssets,offeringWebsiteAssets} from './website-assets.mjs';
import {studioAccess} from './studio-access.mjs';
import {preparedRecordings} from './prepared-recordings.mjs';

async function forwardSignIn(request,env,store,input,fetcher){
 if(!safeToken(input.challenge)||!safeToken(input.state))throw fail('Reopen sign-in from the homepage.');
 // Only the current credential request travels to Academy. No PIN or credential hash is stored here.
 const result=await academyCommand(env,store,'/internal/website/sign-in',{uniqueid:text(input.uniqueid,160),pin:text(input.pin,4),challenge:input.challenge,state:input.state,...(input.setup===true?{setup:true,pinConfirmation:text(input.pinConfirmation,4)}:{})},fetcher);
 if(!safeToken(result.code))throw fail('Academy returned an invalid sign-in handoff.',503);return json({code:result.code});
}
async function route(request,env,store,fetcher){
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(path==='/api/public/header-date'&&method==='GET')return publicHeaderDate(request,env,fetcher);
 if(path==='/api/public/circles'&&method==='GET')return json(await publicCatalogue(env),200,{'Cache-Control':'public, max-age=60'});
 const publicCover=path.match(/^\/api\/public\/circles\/covers\/([a-f0-9]{64})$/);
 if(publicCover&&['GET','HEAD'].includes(method)){const object=await env.CONTENT.get('public/circles/covers/'+publicCover[1]);if(!object||!['image/png','image/jpeg','image/webp'].includes(object.httpMetadata?.contentType))throw fail('This cover is unavailable.',404);return new Response(method==='HEAD'?null:object.body,{headers:{'Content-Type':object.httpMetadata.contentType,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});}
 if(path==='/api/public/home'&&method==='GET'){
  const object=await env.CONTENT.get('public/home.json');if(!object)return json({title:'Umm Abbad Academy',cards:[],sessions:[],announcements:[]});
  const home=await bodyJSON(object.body),schedule=await env.CONTENT.get('public/schedule.json'),visible=new Set(home.cards.map(c=>c.offering_id));
  const facts=schedule?await bodyJSON(schedule.body):null,sessions=facts?Object.entries(facts.offerings).filter(([key])=>visible.has(key)).flatMap(([,value])=>value.sessions):home.sessions||[];
  home.sessions=sessions.filter(s=>visible.has(s.offering_id)&&!s.cancelled&&s.ends_at>Date.now()).sort((a,b)=>a.starts_at-b.starts_at).slice(0,300);
  return json(home,200,{'Cache-Control':'public, max-age=60'});
 }
 if(path==='/internal/academy/events'&&method==='POST'){const result=await receive(request,env,store);if(result.changedOffering)await publishSchedule(env,store,result.changedOffering);return json(result);}
 if(path==='/internal/studio/course-publication'&&method==='POST')return json(await coursePublication(request,env,store));
 if(path==='/internal/studio/access'&&method==='POST')return json(await studioAccess(request,env,store,fetcher));
 if(path==='/api/config'&&method==='GET')return json({academyOrigin:env.ACADEMY_ORIGIN,localPreview:env.ENVIRONMENT==='local',authorityMode:env.AUTHORITY_MODE||'WEBSITE'});
 if(method==='POST'||method==='PUT'||method==='DELETE')originCheck(request,env);
 if(path==='/auth/login'&&method==='POST')return forwardSignIn(request,env,store,await bodyJSON(request.body,4096),fetcher);
 if(path==='/auth/exchange'&&method==='POST'){const previous=parseCookie(request),result=await exchange(await bodyJSON(request.body,4096),env,store);if(previous)await store.run('UPDATE sessions SET revoked=1 WHERE token_hash=?',[await sha256(previous)]);return json({signedIn:true,accountId:result.accountId},200,{'Set-Cookie':result.cookie});}
 const token=parseCookie(request);if(!token)throw fail('Sign in to Academy to continue.',401,'SIGN_IN_REQUIRED');const actor=await store.actor(await sha256(token),Date.now(),{allowExpiredStatus:path==='/auth/refresh'||path==='/auth/access'||path==='/auth/logout'});
 if((path==='/auth/refresh'||path==='/auth/access')&&method==='POST'){
  const input=await bodyJSON(request.body,4096),offeringId=input.offeringId?id(input.offeringId):undefined;
  if(!actor.source_ref)throw fail('Sign in to Academy to refresh this session.',401);if(path==='/auth/refresh'&&actor.verified_at>=Date.now()-boundedAge(env,true))return json({verifiedAt:actor.verified_at});
  const claimId=crypto.randomUUID(),claimed=await store.all('INSERT INTO refresh_claims VALUES(?,?,?) ON CONFLICT(account_id) DO UPDATE SET claim_id=excluded.claim_id,expires_at=excluded.expires_at WHERE refresh_claims.expires_at<? RETURNING claim_id',[actor.account_id,claimId,Date.now()+30_000,Date.now()]);
  if(!claimed.length)throw fail('Your account refresh is already in progress. Retry the action shortly.',409,'REFRESH_PENDING');
  try{await academyCommand(env,store,'/internal/website/status',{sourceRef:actor.source_ref,...(offeringId?{offeringId}:{})},fetcher);const current=await store.actor(actor.token_hash);return json({verifiedAt:current.verified_at});}finally{await store.run('DELETE FROM refresh_claims WHERE account_id=? AND claim_id=?',[actor.account_id,claimId]);}
 }
 if(path==='/auth/academy'&&method==='POST'){const input=await bodyJSON(request.body,4096);if(!actor.source_ref||!safeToken(input.challenge)||!safeToken(input.state))throw fail('Reopen Academy from the website.',401);let library;
  if(input.navigation&&!['alimiyah','reboot','arabic-intensive','hifz'].includes(input.navigation))throw fail('Choose an authorised programme.',403);if([input.navigation,input.library,input.dashboard].filter(Boolean).length>1)throw fail('Choose one destination.');
  if(input.library){const website=await websiteAccess(store,actor,id(input.library.websiteId)),lessonId=input.library.lessonId?id(input.library.lessonId):null;if(lessonId){const document=website.published_key?await objectJSON(env.CONTENT,website.published_key):null;if(!document?.lessons.some(l=>l.id===lessonId))throw fail('Choose a published lesson for the Library return.',404);}library={websiteId:website.website_id,lessonId};}
  const result=await academyCommand(env,store,'/internal/website/open-academy',{sourceRef:actor.source_ref,challenge:input.challenge,state:input.state,...(library?{library}:{}),...(input.navigation?{navigation:input.navigation}:{}),...(input.dashboard?{dashboard:input.dashboard}:{})},fetcher);if(!safeToken(result.code))throw fail('Academy could not prepare the handoff.',503);return json({code:result.code});}
 if(path==='/auth/logout'&&method==='POST'){await store.run('UPDATE sessions SET revoked=1 WHERE token_hash=?',[actor.token_hash]);return json({signedOut:true},200,{'Set-Cookie':cookie('',0)});}
 if(path==='/api/me'&&method==='GET')return json({accountId:actor.account_id,displayName:actor.display_name,globalAdmin:Boolean(actor.global_admin),verifiedAt:actor.verified_at,coursePolicyEpoch:await coursePolicyEpoch(store)});
 if(path==='/api/circles/dashboard'&&method==='POST')return json(await dashboardSnapshot(env,store,actor,await bodyJSON(request.body,4096),fetcher));
 if(path==='/api/circles/navigation'&&method==='GET')return json(await circlesNavigation(env,store,actor));
 if(path==='/api/circles/classrooms/mothers'&&method==='GET'){return json(await mouClassroom(store,actor));}
 if(path==='/api/circles/access'&&method==='GET')return json(await catalogueAccess(store,actor,url.searchParams.getAll('website')));
 if(path==='/api/websites'&&method==='GET'){
  // Start with this account's indexed rights, rather than scanning all sites for an OR condition.
  if(academyAuthority(env)){const stale=await store.first("SELECT p.offering_id FROM source_access_people p JOIN source_access_scopes s USING(offering_id) WHERE p.account_id=? AND s.authority='ACADEMY' AND s.enabled=1 AND (p.ready=0 OR p.generation<>s.generation OR p.verified_at<CASE WHEN ?=1 OR EXISTS(SELECT 1 FROM staff sf WHERE sf.account_id=p.account_id AND sf.offering_id=p.offering_id) THEN ? ELSE ? END) LIMIT 1",[actor.account_id,Number(actor.global_admin),Date.now()-boundedAge(env,true),Date.now()-boundedAge(env)]);if(stale)throw Object.assign(fail('Academy access needs to be confirmed.',409,'ACCESS_REFRESH_REQUIRED'),{offeringId:stale.offering_id});}
  const after=url.searchParams.get('after')||'',parallel=academyAuthority(env),sourceFilter=parallel?` AND EXISTS(SELECT 1 FROM source_access_scopes x WHERE x.offering_id=w.offering_id AND (x.authority='WEBSITE' OR x.enabled=1 AND EXISTS(SELECT 1 FROM source_access_people ap WHERE ap.offering_id=x.offering_id AND ap.account_id=? AND ap.ready=1 AND ap.generation=x.generation AND ap.verified_at>=CASE WHEN ?=1 OR EXISTS(SELECT 1 FROM staff sf WHERE sf.account_id=ap.account_id AND sf.offering_id=ap.offering_id) THEN ? ELSE ? END) AND (o.kind<>'TAFSEER' OR EXISTS(SELECT 1 FROM source_access_websites sw WHERE sw.website_id=w.website_id AND sw.enabled=1))))`:'',sourceArgs=parallel?[actor.account_id,Number(actor.global_admin),Date.now()-boundedAge(env,true),Date.now()-boundedAge(env)]:[],rows=actor.global_admin?
   await store.all(`SELECT w.website_id,w.title,w.offering_id,w.completion_month,w.enabled FROM websites w JOIN offerings o USING(offering_id) WHERE w.website_id>? AND o.active=1${sourceFilter} ORDER BY w.website_id LIMIT 51`,[after,...sourceArgs]):
   await store.all(`WITH mine AS (
    SELECT w.website_id FROM participation p JOIN offerings o USING(offering_id) JOIN websites w USING(offering_id) WHERE p.account_id=? AND p.purchased=1 AND o.kind='COURSE' AND COALESCE((SELECT access_model FROM course_access_models m WHERE m.offering_id=p.offering_id),'PAID')='PAID'
    UNION SELECT w.website_id FROM paid_months p JOIN offerings o USING(offering_id) JOIN websites w ON w.offering_id=p.offering_id AND w.completion_month=p.month WHERE p.account_id=? AND o.kind='TAFSEER'
    UNION SELECT w.website_id FROM website_months m JOIN websites w ON w.offering_id=m.offering_id AND w.completion_month=m.month WHERE m.account_id=?
    UNION SELECT w.website_id FROM staff s JOIN websites w USING(offering_id) WHERE s.account_id=?
    UNION SELECT website_id FROM surah_grants WHERE account_id=?
   ) SELECT w.website_id,w.title,w.offering_id,w.completion_month,w.enabled FROM mine JOIN websites w USING(website_id) JOIN offerings o USING(offering_id) WHERE w.website_id>? AND o.active=1 AND (w.enabled=1 AND w.published_key IS NOT NULL OR EXISTS(SELECT 1 FROM staff s WHERE s.account_id=? AND s.offering_id=w.offering_id AND s.role='ADMIN'))${sourceFilter} ORDER BY w.website_id LIMIT 51`,[actor.account_id,actor.account_id,actor.account_id,actor.account_id,actor.account_id,after,actor.account_id,...sourceArgs]);return json({websites:rows.slice(0,50),more:rows.length>50});
 }
 let match=path.match(/^\/api\/websites\/([-A-Za-z0-9_:]+)(?:\/(edit|export|history|assets))?$/);
 if(match){const websiteId=id(match[1]),action=match[2];if(method==='POST'&&action==='edit')return json(await editWebsite(env,store,actor,websiteId,await bodyJSON(request.body)));
  if(method!=='GET')throw fail('Use GET to read website content.',405);
  if(action==='history'){await websiteAccess(store,actor,websiteId,{admin:true});return json({history:await store.all('SELECT revision,action,created_at,actor_id FROM website_history WHERE website_id=? AND revision<? ORDER BY revision DESC LIMIT 51',[websiteId,Number(url.searchParams.get('before'))||Number.MAX_SAFE_INTEGER])});}
  if(action==='assets'){const website=await websiteAccess(store,actor,websiteId,{admin:true});return json({websiteId,offeringId:website.offering_id,...await attachedWebsiteAssets(store,websiteId,{assetId:url.searchParams.get('assetId'),after:url.searchParams.get('after')||''})});}
  const website=await websiteAccess(store,actor,websiteId,{admin:Boolean(action)}),key=action?website.draft_key:website.published_key;
  const rawDocument=key?await objectJSON(env.CONTENT,key):null,{document,contentAccess}=rawDocument&&!action?await recordingScopedDocument(env,store,actor,website,rawDocument):{document:rawDocument,contentAccess:{mode:'FULL_TEXT'}};
  const assets=await editionAssets(store,websiteId,document,{draft:Boolean(action)});
  return json({websiteId,offeringId:website.offering_id,kind:website.kind,programmeKey:website.programme_key||null,coursePolicy:website.kind==='COURSE'?await coursePolicy(store,website.offering_id):null,presentation:await websitePresentation(env,website),revision:website.revision,document,contentAccess,assets,enabled:Boolean(website.enabled),canEdit:Boolean(actor.global_admin||website.role==='ADMIN'),draftVersion:contentVersion(website.draft_key),publishedVersion:contentVersion(website.published_key),capabilities:{assessments:false,journal:false,liveSessions:!website.completed_course}});
 }
 match=path.match(/^\/api\/media\/([-A-Za-z0-9_:]+)\/companion$/);if(match&&method==='GET')return json(await readCompanion(env,store,actor,match[1]));
 match=path.match(/^\/api\/media\/([-A-Za-z0-9_:]+)$/);if(match&&['GET','HEAD'].includes(method)){const row=await mediaGate(store,actor,match[1],{admin:url.searchParams.get('draft')==='1'});return streamMedia(env,row,request);}
 match=path.match(/^\/api\/offerings\/([-A-Za-z0-9_:]+)\/(sessions|media|join|enrol|provision|resume)$/);
 if(match){const offeringId=id(match[1]),action=match[2],scope=await store.scope(actor,offeringId);
  if(action==='sessions'&&method==='GET'){if(scope.completed_course)return json({sessions:[],serverTime:Date.now()});if(!actor.global_admin&&!scope.live&&!scope.role)throw fail('Live-session access is required.',403);return json({sessions:await store.all('SELECT session_id,title,starts_at,ends_at,cancelled FROM timetable INDEXED BY timetable_public_offering WHERE offering_id=? AND cancelled=0 AND starts_at>=? ORDER BY starts_at,session_id LIMIT 200',[offeringId,Date.now()-86400_000]),serverTime:Date.now()});}
  if(action==='media'&&method==='GET'){
   const after=url.searchParams.get('after')||'',websiteId=url.searchParams.get('website');
   let mediaWebsite=null;if(websiteId){const site=await websiteAccess(store,actor,id(websiteId));if(site.offering_id!==offeringId)throw fail('Choose a website in this offering.',400);mediaWebsite=site;}
   const filter=websiteId?' AND x.website_id=?':'',tail=websiteId?[websiteId]:[],select='SELECT x.attachment_id,x.asset_id,x.website_id,x.title,x.lesson_id,x.lesson_date,x.cohort,x.audience,o.mime_type type',staff=actor.global_admin||scope.role;
   let rows=[];
   if(staff||scope.kind==='COURSE'&&(scope.purchased||scope.access_model==='FREE'))rows=await store.all(`${select} FROM attachments x JOIN objects o USING(asset_id) WHERE x.offering_id=? AND x.audience='RECORDING' AND x.published=1 AND x.attachment_id>?${filter} ORDER BY x.attachment_id LIMIT 51`,[offeringId,after,...tail]);
   // Unary + preserves the month value while removing column affinity: SQLite can
   // then use the substr expression index for each paid month, not scan the offer.
   else if(scope.kind==='TAFSEER')rows=await store.all(`${select} FROM paid_months m CROSS JOIN attachments x INDEXED BY attachments_month JOIN objects o USING(asset_id) WHERE m.account_id=? AND m.offering_id=? AND x.offering_id=m.offering_id AND substr(x.lesson_date,1,7)=+m.month AND x.cohort=m.cohort AND x.audience='RECORDING' AND x.published=1 AND x.attachment_id>?${filter} ORDER BY x.attachment_id LIMIT 51`,[actor.account_id,offeringId,after,...tail]);
   const media=rows.slice(0,50);return json({media,more:rows.length>50,companions:await permittedCompanionIndexes(store,media),mediaBindings:mediaWebsite?await permittedGuideBindings(env,mediaWebsite,media,store):[]});
  }
  if(method!=='POST')throw fail('This action needs a POST request.',405);const input=await bodyJSON(request.body,16384);
  if(action==='join'){if(scope.completed_course)throw fail('This completed Course has no live sessions.',403,'JOIN_CLOSED');await accessGate(store,actor,offeringId,{live:true});if(!actor.global_admin&&!scope.live&&!scope.role)throw fail('Current live-session access is required.',403);const session=await store.first('SELECT session_id,starts_at,ends_at,zoom_url,cancelled FROM timetable WHERE session_id=? AND offering_id=?',[id(input.sessionId),offeringId]),now=Date.now();if(!session||session.cancelled||now<session.starts_at-300_000||now>=session.ends_at||!session.zoom_url)throw fail('Joining is available from five minutes before the lesson until it ends.',403,'JOIN_CLOSED');await joinAudience(store,actor,offeringId,session,scope);return json({destination:session.zoom_url});}
  if(action==='enrol')return json(await requestEnrolment(store,actor,offeringId,input));
  if(action==='provision')return json(await beginProvision(store,actor,offeringId,input));
  if(action==='resume')return json(await resumeProvision(env,store,actor,offeringId,input,fetcher));
 }
 if(path==='/api/admin/offerings'&&method==='GET'){
  const offerings=actor.global_admin?await store.all("SELECT o.offering_id,o.title,o.kind,p.programme_key FROM offerings o LEFT JOIN programme_offerings p USING(offering_id) WHERE o.kind IN('COURSE','TAFSEER') ORDER BY o.offering_id LIMIT 200"):await store.all("SELECT o.offering_id,o.title,o.kind,p.programme_key FROM staff s JOIN offerings o USING(offering_id) LEFT JOIN programme_offerings p USING(offering_id) WHERE s.account_id=? AND s.role='ADMIN' AND o.kind IN('COURSE','TAFSEER') ORDER BY o.offering_id LIMIT 200",[actor.account_id]);return json({offerings});
 }
 match=path.match(/^\/api\/admin\/([-A-Za-z0-9_:]+)(?:\/(files|recording|recording-attachments|prepared-recordings))?$/);
 if(match){const offeringId=id(match[1]),sub=match[2],adminScope=await store.scope(actor,offeringId,{admin:true});
  if(sub==='prepared-recordings'){if(method!=='GET')throw fail('Use the separate native Attach and Publish actions.',405);return json(await preparedRecordings(env,store,actor,offeringId));}
  if(method==='GET'&&sub==='recording-attachments'){if(!adminScope.studioAuthority&&academyAuthority(env))throw fail('Studio ownership is required.',409);return json(await recordingAttachmentPreflight(store,offeringId,url.searchParams.getAll('source')));}
  if(method==='GET'&&sub==='files')return json({offeringId,...await offeringWebsiteAssets(store,offeringId,{assetId:url.searchParams.get('assetId'),after:url.searchParams.get('after')||''})});
  if(method==='PUT'&&sub==='files')return json(await upload(env,store,actor,offeringId,request));
  if(sub==='recording'&&method==='PUT')return json(await recording(env,store,actor,offeringId,{action:'part',assetId:url.searchParams.get('assetId'),partNumber:Number(url.searchParams.get('partNumber'))},request));
  if(sub==='recording'&&method==='POST')return json(await recording(env,store,actor,offeringId,await bodyJSON(request.body,1_000_000),request));
  if(method==='POST')return json(await change(env,store,actor,offeringId,await bodyJSON(request.body)));
  if(method==='GET'){const after=url.searchParams.get('after')||'';return json({coursePolicy:await coursePolicy(store,offeringId),
   canManageContent:!academyAuthority(env)||Boolean(adminScope.studioAuthority),
   participants:await store.all('SELECT p.*,a.display_name FROM participation p JOIN accounts a USING(account_id) WHERE p.offering_id=? AND p.account_id>? ORDER BY p.account_id LIMIT 51',[offeringId,after]),
   websites:await store.all('SELECT website_id,title,completion_month,revision,enabled FROM websites WHERE offering_id=? ORDER BY website_id LIMIT 100',[offeringId]),
   card:await store.first('SELECT * FROM cards WHERE offering_id=?',[offeringId]),
   media:await store.all('SELECT x.*,o.filename,o.mime_type FROM attachments x JOIN objects o USING(asset_id) WHERE x.offering_id=? AND x.attachment_id>? ORDER BY x.attachment_id LIMIT 51',[offeringId,after]),
   requests:await store.all('SELECT * FROM enrolment_requests WHERE offering_id=? AND request_id>? ORDER BY request_id LIMIT 51',[offeringId,after]),
   months:await store.all('SELECT m.* FROM participation p JOIN paid_months m USING(account_id,offering_id) WHERE p.offering_id=? AND p.account_id>? ORDER BY p.account_id,m.month,m.cohort LIMIT 600',[offeringId,after])
  });}
 }
 if(path==='/api/admin/announcements'&&method==='POST')return json(await announcements(store,actor,await bodyJSON(request.body,16384)));
 if(path==='/api/admin/home/publish'&&method==='POST')return json(await publishHome(env,store,actor,await bodyJSON(request.body,4096)));
 throw fail('This page or action was not found.',404);
}
export async function handle(request,env,ctx,fetcher=fetch){
 const path=new URL(request.url).pathname;if(!path.startsWith('/api/')&&!path.startsWith('/auth/')&&!path.startsWith('/internal/'))return env.ASSETS.fetch(request);
 if(env.PLATFORM_ENABLED!=='1')return json({success:false,error:'The website platform is not enabled.'},503);
 const store=new Store(env);let response;try{response=await route(request,env,store,fetcher);}catch(error){response=failure(error);}
 if(env.ENVIRONMENT==='local'){response=new Response(response.body,response);response.headers.set('X-Local-D1-Queries',String(store.metrics.queries));response.headers.set('X-Local-D1-Rows-Read',String(store.metrics.rowsRead));response.headers.set('X-Local-D1-Rows-Written',String(store.metrics.rowsWritten));}
 return response;
}
export default {fetch:handle};
