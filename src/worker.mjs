import {accountView,privateViewTag,privateUnchanged,privateNotModified,privateReply,checkedViewReply} from './read-cache.mjs';
import {coursePlaylistRead,coursePlaylistSave,coursePlaylistContentSave,coursePlaylistPublish,publishedCourseContent,coursePlaylistFile,coursePublishedExtras} from './course-playlist-workflow.mjs';
import {existingCollection,referenceCollectionPDF} from './existing-collection.mjs';
import {reviewPlaylistReferences,savePlaylistReferences} from './private-playlist-reference.mjs';
import {publishedAnnouncements} from './announcements.mjs';
import {COVER_LIMIT,cardOptions,uploadCover,previewCover} from './playlist-cards.mjs';
import {publishedPlaylistDescriptors} from './playlist-catalogue.mjs';
import {mediaOptions,attributionChange,attachMedia,addPublishedAttribution,mediaCompanionSave,mediaDetail,addSupportingFiles} from './media-attribution.mjs';
import {playlistRecordingAccess,playlistTable,playlistCorrection,savePlaylist,playlistPublication,playlistAddRecording,learnerPlaylists,playlistWebsiteCandidates,savePlaylistOrder} from './mou-playlists.mjs';
import {permittedCompanionIndexes,readCompanion,recordingAttachmentPreflight} from './recording-companions.mjs';
import {mouClassroom} from './mou-classroom.mjs';
import {coursePublication} from './course-publication.mjs';
import {dashboardSnapshot} from './dashboard.mjs';
import {circlesNativeJoin} from './circles-native-join.mjs';
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
async function route(request,env,store,fetcher,checkedActor=null){
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if((path==='/api/public/academy-announcements'||path.startsWith('/api/public/academy-announcements/'))&&['GET','HEAD'].includes(method))return publishedAnnouncements(request,env,fetcher);
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
 if(path==='/internal/studio/playlist-cover'&&method==='POST')return json(await studioAccess(request,env,store,fetcher,{coverOnly:true}));
 if(path==='/internal/studio/access'&&method==='POST')return json(await studioAccess(request,env,store,fetcher));
 if(path==='/api/config'&&method==='GET')return json({academyOrigin:env.ACADEMY_ORIGIN,localPreview:env.ENVIRONMENT==='local',authorityMode:env.AUTHORITY_MODE||'WEBSITE'});
 if(method==='POST'||method==='PUT'||method==='DELETE')originCheck(request,env);
 if(path==='/auth/login'&&method==='POST')return forwardSignIn(request,env,store,await bodyJSON(request.body,4096),fetcher);
 if(path==='/auth/exchange'&&method==='POST'){const previous=parseCookie(request),result=await exchange(await bodyJSON(request.body,4096),env,store);if(previous)await store.run('UPDATE sessions SET revoked=1 WHERE token_hash=?',[await sha256(previous)]);return json({signedIn:true,accountId:result.accountId},200,{'Set-Cookie':result.cookie});}
 const token=parseCookie(request);if(!token)throw fail('Sign in to Academy to continue.',401,'SIGN_IN_REQUIRED');const actor=checkedActor||await store.actor(await sha256(token),Date.now(),{allowExpiredStatus:path==='/auth/refresh'||path==='/auth/access'||path==='/auth/logout'});
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
 if(path==='/api/me'&&method==='GET')return json(await accountView(actor,store));
 if(path==='/api/circles/reader-bootstrap'&&method==='GET'){
  const q=url.searchParams,website=q.get('website'),mothers=q.get('classroom')==='mothers';
  if([...q.keys()].some(k=>!['website','edition','classroom','media'].includes(k))||Boolean(website)===mothers||q.has('classroom')&&!mothers||q.has('edition')&&(!website||q.get('edition')!=='published')||q.has('media')&&(!website||q.get('media')!=='1'))throw fail('Choose one existing reader or classroom.');
  const account=await accountView(actor,store),configuration={academyOrigin:env.ACADEMY_ORIGIN,localPreview:env.ENVIRONMENT==='local',authorityMode:env.AUTHORITY_MODE||'WEBSITE'},kind=website?'website':'classroom';
  const read=async(path,{conditional=true}={})=>{const headers=new Headers(request.headers);if(!conditional)headers.delete('If-None-Match');return route(new Request(new URL(path,url.origin),{headers}),env,store,fetcher,actor);};
  try{
   const reply=await read(website?'/api/websites/'+encodeURIComponent(id(website))+'?'+new URLSearchParams({reader:q.has('media')?'recordings-v1':'reader-v1',...(q.has('edition')?{edition:'published'}:{})}):'/api/circles/classrooms/mothers?reader=1');
   if(reply.status===304){const current=await store.actor(actor.token_hash);if(current.epoch!==actor.epoch||current.global_admin!==actor.global_admin)throw fail('Your account changed. Reopen this page.',409,'ACCESS_REFRESH_REQUIRED');return reply;}
   const value=await reply.json();if(!reply.ok)throw Object.assign(fail(value.error||'This page could not be opened.',reply.status,value.code),{offeringId:value.offeringId});
   if(website&&q.has('media')){const feed=await read('/api/offerings/'+encodeURIComponent(value.offeringId)+'/media?'+new URLSearchParams({website:value.websiteId}),{conditional:false}),data=await feed.json();if(!feed.ok)throw Object.assign(fail(data.error||'The recording list could not be checked.',feed.status,data.code),{offeringId:data.offeringId});value.initialMedia=data;}
   const current=await store.actor(actor.token_hash);if(current.epoch!==actor.epoch||current.global_admin!==actor.global_admin)throw fail('Your account changed. Reopen this page.',409,'ACCESS_REFRESH_REQUIRED');
   const result={configuration,account,[kind]:value,errors:{}};return reply.headers.get('ETag')?privateReply(result,reply.headers.get('ETag')):json(result);
  }catch(error){if(error.status===401||error.code==='ACCESS_REFRESH_REQUIRED')throw error;const current=await store.actor(actor.token_hash);if(current.epoch!==actor.epoch||current.global_admin!==actor.global_admin)throw fail('Your account changed. Reopen this page.',409,'ACCESS_REFRESH_REQUIRED');return json({configuration,account,[kind]:null,errors:{[kind]:{status:error.status||503,code:error.code||'UNAVAILABLE',message:error.status?error.message:'This page could not be loaded.'}}});}
 }

 if(path==='/api/circles/bootstrap'&&method==='GET'){
  const q=url.searchParams;if([...q.keys()].some(k=>!['mode','date','preferredAccount','preferredMode'].includes(k)))throw fail('Choose a valid dashboard.');
  const preferred=q.get('preferredAccount')===actor.account_id?q.get('preferredMode'):null,mode=q.get('mode')||preferred,input={...(mode?{mode}:{}),...(q.get('date')?{date:q.get('date')}:{})};
  const account=await accountView(actor,store),parts=await Promise.allSettled([circlesNavigation(env,store,actor),dashboardSnapshot(env,store,actor,input,fetcher)]),errors={};
  for(const [index,name] of ['navigation','dashboard'].entries())if(parts[index].status==='rejected'){const error=parts[index].reason;if(error.status===401||error.code==='ACCESS_REFRESH_REQUIRED')throw error;errors[name]={status:error.status||503,code:error.code||'UNAVAILABLE',message:error.status?error.message:'This view could not be loaded.'};}
  const current=await store.actor(actor.token_hash);if(current.epoch!==actor.epoch||current.global_admin!==actor.global_admin)throw fail('Your account changed. Reopen your dashboard.',409,'ACCESS_REFRESH_REQUIRED');
  const result={configuration:{academyOrigin:env.ACADEMY_ORIGIN,localPreview:env.ENVIRONMENT==='local',authorityMode:env.AUTHORITY_MODE||'WEBSITE'},account,navigation:parts[0].status==='fulfilled'?parts[0].value:null,dashboard:parts[1].status==='fulfilled'?parts[1].value:null,errors};return Object.keys(errors).length?json(result):checkedViewReply(request,result,env.RELEASE_VERSION);
 }
 if(path==='/api/circles/dashboard'&&method==='GET'){
  const q=url.searchParams;if([...q.keys()].some(k=>!['mode','date','refresh'].includes(k))||q.has('refresh')&&q.get('refresh')!=='1')throw fail('Choose a valid dashboard.');
  return checkedViewReply(request,await dashboardSnapshot(env,store,actor,{...(q.get('mode')?{mode:q.get('mode')}:{}),...(q.get('date')?{date:q.get('date')}:{}),...(q.has('refresh')?{refresh:true}:{})},fetcher),env.RELEASE_VERSION);
 }
 if(path==='/api/circles/dashboard'&&method==='POST')return json(await dashboardSnapshot(env,store,actor,await bodyJSON(request.body,4096),fetcher));
 if(path==='/api/circles/lesson-join'&&method==='POST')return json(await circlesNativeJoin(env,store,actor,await bodyJSON(request.body,4096),fetcher));
 if(path==='/api/circles/navigation'&&method==='GET')return json(await circlesNavigation(env,store,actor));
 if(path==='/api/circles/classrooms/mothers'&&method==='GET'){const value=await mouClassroom(store,actor,{request});return value instanceof Response?value:json(value);}
 if(path==='/api/circles/access'&&method==='GET')return json(await catalogueAccess(store,actor,url.searchParams.getAll('website')));
 if(path==='/api/websites'&&method==='GET'){
  if(url.searchParams.has('published')&&url.searchParams.get('published')!=='1')throw fail('Choose a published website catalogue.');
  const placement=url.searchParams.get('placement'),placementOffering=url.searchParams.get('placementOffering'),classId=url.searchParams.get('class')||'';if(placement&&(!/^(?:COURSE|PROGRAM):[-A-Za-z0-9_:]{1,160}$/.test(placement))||placement&&placementOffering||classId&&!placement&&!placementOffering)throw fail('Choose a valid playlist location.');if(placementOffering)id(placementOffering);if(classId)id(classId);const placementFilter=placement||placementOffering?" AND EXISTS(SELECT 1 FROM course_playlist_placements pl WHERE pl.playlist_id=(SELECT playlist_id FROM mou_playlists WHERE website_id=w.website_id) AND pl.stage='PUBLISHED' AND "+(placement?'pl.activity_key=?':'pl.offering_id=?')+" AND (?='' OR pl.class_id='' OR pl.class_id=?))":'',placementArgs=placement||placementOffering?[placement||placementOffering,classId,classId]:[];
  const publishedOnly=url.searchParams.get('published')==='1',publicationFilter=publishedOnly?' AND w.enabled=1 AND w.published_key IS NOT NULL':'',websiteProjection='w.website_id,COALESCE((SELECT c.published_title FROM mou_playlists p JOIN playlist_card_designs c USING(playlist_id) WHERE p.website_id=w.website_id),w.title) title,w.offering_id,w.completion_month,w.enabled'+(publishedOnly?',o.kind,o.title offeringTitle,(SELECT programme_key FROM programme_offerings mp WHERE mp.offering_id=w.offering_id) programmeKey':'');
  // Start with this account's indexed rights, rather than scanning all sites for an OR condition.
  if(academyAuthority(env)){const stale=await store.first("SELECT p.offering_id FROM source_access_people p JOIN source_access_scopes s USING(offering_id) WHERE p.account_id=? AND s.authority='ACADEMY' AND s.enabled=1 AND (p.ready=0 OR p.generation<>s.generation OR p.verified_at<?) LIMIT 1",[actor.account_id,Date.now()-boundedAge(env)]);if(stale)throw Object.assign(fail('Academy access needs to be confirmed.',409,'ACCESS_REFRESH_REQUIRED'),{offeringId:stale.offering_id});}
  const after=url.searchParams.get('after')||'',playlistIds=actor.global_admin?[]:await playlistWebsiteCandidates(store,actor,after),parallel=academyAuthority(env),sourceFilter=parallel?` AND EXISTS(SELECT 1 FROM source_access_scopes x WHERE x.offering_id=w.offering_id AND (x.authority='WEBSITE' OR x.enabled=1 AND EXISTS(SELECT 1 FROM source_access_people ap WHERE ap.offering_id=x.offering_id AND ap.account_id=? AND ap.ready=1 AND ap.generation=x.generation AND ap.verified_at>=?) AND (o.kind<>'TAFSEER' OR EXISTS(SELECT 1 FROM source_access_websites sw WHERE sw.website_id=w.website_id AND sw.enabled=1))))`:'',sourceArgs=parallel?[actor.account_id,Date.now()-boundedAge(env)]:[],rows=actor.global_admin?
   await store.all(`SELECT ${websiteProjection} FROM websites w JOIN offerings o USING(offering_id) WHERE w.website_id>? AND o.active=1${publicationFilter}${sourceFilter}${placementFilter} ORDER BY w.website_id LIMIT 51`,[after,...sourceArgs,...placementArgs]):
   await store.all(`WITH mine AS (
    SELECT w.website_id FROM (SELECT p.offering_id FROM participation p WHERE p.account_id=? AND p.purchased=1 AND COALESCE((SELECT access_model FROM course_access_models m WHERE m.offering_id=p.offering_id),'PAID')='PAID' UNION SELECT offering_id FROM course_access_models WHERE access_model='FREE') c JOIN websites w USING(offering_id) JOIN offerings o USING(offering_id) WHERE o.kind='COURSE'
    UNION SELECT w.website_id FROM paid_months p JOIN offerings o USING(offering_id) JOIN websites w ON w.offering_id=p.offering_id AND w.completion_month=p.month WHERE p.account_id=? AND o.kind='TAFSEER'
    UNION SELECT w.website_id FROM website_months m JOIN websites w ON w.offering_id=m.offering_id AND w.completion_month=m.month WHERE m.account_id=?
    UNION SELECT w.website_id FROM staff s JOIN websites w USING(offering_id) WHERE s.account_id=?
    UNION SELECT website_id FROM (SELECT website_id FROM surah_grants WHERE account_id=? UNION SELECT value website_id FROM json_each(?))
   ) SELECT ${websiteProjection} FROM mine JOIN websites w USING(website_id) JOIN offerings o USING(offering_id) WHERE w.website_id>? AND o.active=1 AND (w.enabled=1 AND w.published_key IS NOT NULL OR EXISTS(SELECT 1 FROM staff s WHERE s.account_id=? AND s.offering_id=w.offering_id AND s.role='ADMIN'))${publicationFilter}${sourceFilter}${placementFilter} ORDER BY w.website_id LIMIT 51`,[actor.account_id,actor.account_id,actor.account_id,actor.account_id,actor.account_id,JSON.stringify(playlistIds),after,actor.account_id,...sourceArgs,...placementArgs]);const page=rows.slice(0,50);return json({websites:page,more:rows.length>50,...(publishedOnly?{playlists:await publishedPlaylistDescriptors(store,actor,page)}:{})});
 }
 let match=path.match(/^\/api\/websites\/([-A-Za-z0-9_:]+)(?:\/(edit|export|history|assets))?$/);
 if(match){const websiteId=id(match[1]),action=match[2];if(method==='POST'&&action==='edit')return json(await editWebsite(env,store,actor,websiteId,await bodyJSON(request.body)));
  if(method!=='GET')throw fail('Use GET to read website content.',405);
  if(action==='history'){await websiteAccess(store,actor,websiteId,{admin:true,readOnly:true});return json({history:await store.all('SELECT revision,action,created_at,actor_id FROM website_history WHERE website_id=? AND revision<? ORDER BY revision DESC LIMIT 51',[websiteId,Number(url.searchParams.get('before'))||Number.MAX_SAFE_INTEGER])});}
  if(action==='assets'){const website=await websiteAccess(store,actor,websiteId,{admin:true,readOnly:true});return json({websiteId,offeringId:website.offering_id,...await attachedWebsiteAssets(store,websiteId,{assetId:url.searchParams.get('assetId'),after:url.searchParams.get('after')||''})});}
  const website=await websiteAccess(store,actor,websiteId,{admin:Boolean(action),readOnly:true}),key=action?website.draft_key:website.published_key;
  const presentation=await websitePresentation(env,website),tag=!action?await privateViewTag(request,store,actor,website.offering_id,{website,presentation}):null;
  if(tag&&privateUnchanged(request,tag))return privateNotModified(tag);
  const savedDocument=key?await objectJSON(env.CONTENT,key):null,rawDocument=savedDocument&&website.playlist_id?{...savedDocument,name:website.title,home:{...savedDocument.home,headline:website.title}}:savedDocument,{document,contentAccess}=rawDocument&&!action?await recordingScopedDocument(env,store,actor,website,rawDocument):{document:rawDocument,contentAccess:{mode:'FULL_TEXT'}};
  const assets=await editionAssets(store,websiteId,document,{draft:Boolean(action)});
  const value={courseWorkflow:Boolean(website.playlist_id&&website.kind==='COURSE'&&await store.first('SELECT 1 FROM course_playlist_workflows WHERE playlist_id=?',[website.playlist_id])),playlistResources:action?[]:await coursePublishedExtras(store,website),websiteId,playlistId:website.playlist_id||null,offeringId:website.offering_id,kind:website.kind,programmeKey:website.programme_key||null,coursePolicy:website.kind==='COURSE'?await coursePolicy(store,website.offering_id):null,presentation,revision:website.revision,document,contentAccess,assets,enabled:Boolean(website.enabled),canEdit:Boolean(actor.global_admin||website.role==='ADMIN'),draftVersion:contentVersion(website.draft_key),publishedVersion:contentVersion(website.published_key),capabilities:{assessments:false,journal:false,liveSessions:!website.completed_course}};return tag?privateReply(value,tag):json(value);
 }
 match=path.match(/^\/api\/media\/([-A-Za-z0-9_:]+)\/companion$/);if(match&&method==='GET')return json(await readCompanion(env,store,actor,match[1]));
 match=path.match(/^\/api\/media\/([-A-Za-z0-9_:]+)$/);if(match&&['GET','HEAD'].includes(method)){const row=await mediaGate(store,actor,match[1],{admin:url.searchParams.get('draft')==='1'});return streamMedia(env,row,request);}
 match=path.match(/^\/api\/offerings\/([-A-Za-z0-9_:]+)\/(sessions|media|playlists|join|enrol|provision|resume)$/);
 if(match){const offeringId=id(match[1]),action=match[2],scope=await store.scope(actor,offeringId);
  if(action==='playlists'&&method==='GET')return json({playlists:await learnerPlaylists(store,actor,offeringId,{staff:Boolean(actor.global_admin||scope.role),canEdit:Boolean(actor.global_admin||scope.role==='ADMIN')})});
  if(action==='sessions'&&method==='GET'){if(scope.completed_course)return json({sessions:[],serverTime:Date.now()});if(!actor.global_admin&&!scope.live&&!scope.role)throw fail('Live-session access is required.',403);return json({sessions:await store.all('SELECT session_id,title,starts_at,ends_at,cancelled FROM timetable INDEXED BY timetable_public_offering WHERE offering_id=? AND cancelled=0 AND starts_at>=? ORDER BY starts_at,session_id LIMIT 200',[offeringId,Date.now()-86400_000]),serverTime:Date.now()});}
  if(action==='media'&&method==='GET'){
   const after=url.searchParams.get('after')||'',websiteId=url.searchParams.get('website');
   let mediaWebsite=null;if(websiteId){const site=await websiteAccess(store,actor,id(websiteId));if(site.offering_id!==offeringId)throw fail('Choose a website in this offering.',400);mediaWebsite=site;}
   const tag=await privateViewTag(request,store,actor,offeringId,{scope,mediaWebsite});if(privateUnchanged(request,tag))return privateNotModified(tag);
   const filter=websiteId?' AND x.website_id=?':'',tail=websiteId?[websiteId]:[],select='SELECT x.attachment_id,x.asset_id,x.website_id,x.title,x.lesson_id,x.lesson_date,x.cohort,x.audience,o.mime_type type',staff=actor.global_admin||scope.role;
   let rows=[];
   const playlist=websiteId?await store.first('SELECT p.playlist_id,p.revision,COALESCE(c.published_title,w.title) title FROM mou_playlists p JOIN websites w USING(website_id) LEFT JOIN playlist_card_designs c USING(playlist_id) WHERE p.offering_id=? AND p.website_id=?',[offeringId,websiteId]):null;
   if(playlist){
    if(url.searchParams.has('playlistRevision')&&Number(url.searchParams.get('playlistRevision'))!==playlist.revision)throw fail('This playlist changed. Reopen it.',409,'CHANGE_CONFLICT');
    const cursor=after?await store.first('SELECT position FROM recording_playlist_positions WHERE playlist_id=? AND attachment_id=?',[playlist.playlist_id,id(after)]):{position:0};if(!cursor)throw fail('Reopen the saved playlist order.',409,'CHANGE_CONFLICT');
    if(staff||await playlistRecordingAccess(store,actor,playlist.playlist_id,offeringId))rows=await store.all(`${select},r.position playlistPosition FROM recording_playlist_positions r CROSS JOIN mou_playlist_items i ON i.playlist_id=r.playlist_id AND i.attachment_id=r.attachment_id CROSS JOIN attachments x ON x.attachment_id=i.attachment_id JOIN objects o USING(asset_id) WHERE r.playlist_id=? AND (r.position,r.attachment_id)>(?,?) AND x.offering_id=? AND x.audience='RECORDING' AND x.published=1 ORDER BY r.position,r.attachment_id LIMIT 51`,[playlist.playlist_id,cursor.position,after,offeringId]);
   }
   else if(staff||scope.kind==='COURSE'&&(scope.purchased||scope.access_model==='FREE'))rows=await store.all(`${select} FROM attachments x JOIN objects o USING(asset_id) WHERE x.offering_id=? AND x.audience='RECORDING' AND x.published=1 AND (NOT EXISTS(SELECT 1 FROM mou_playlist_only_media pm WHERE pm.attachment_id=x.attachment_id) OR EXISTS(SELECT 1 FROM mou_playlist_items i JOIN mou_playlists p USING(playlist_id) JOIN websites w ON w.website_id=p.website_id WHERE i.attachment_id=x.attachment_id AND p.offering_id=x.offering_id AND w.enabled=1 AND w.published_key IS NOT NULL)) AND x.attachment_id>?${filter} ORDER BY x.attachment_id LIMIT 51`,[offeringId,after,...tail]);
   // Unary + preserves the month value while removing column affinity: SQLite can
   // then use the substr expression index for each paid month, not scan the offer.
   else if(scope.kind==='TAFSEER')rows=await store.all(`${select} FROM paid_months m CROSS JOIN attachments x INDEXED BY attachments_month JOIN objects o USING(asset_id) WHERE m.account_id=? AND m.offering_id=? AND x.offering_id=m.offering_id AND substr(x.lesson_date,1,7)=+m.month AND x.cohort=m.cohort AND x.audience='RECORDING' AND x.published=1 AND NOT EXISTS(SELECT 1 FROM mou_playlist_only_media pm WHERE pm.attachment_id=x.attachment_id) AND x.attachment_id>?${filter} ORDER BY x.attachment_id LIMIT 51`,[actor.account_id,offeringId,after,...tail]);
   const media=await addSupportingFiles(store,await addPublishedAttribution(store,rows.slice(0,50)));return privateReply({media,more:rows.length>50,...(playlist?{playlist:{id:playlist.playlist_id,name:playlist.title,revision:playlist.revision}}:{}),companions:await permittedCompanionIndexes(store,media),mediaBindings:mediaWebsite?await permittedGuideBindings(env,mediaWebsite,media,store):[]},tag);
  }
  if(method!=='POST')throw fail('This action needs a POST request.',405);const input=await bodyJSON(request.body,16384);
  if(action==='join'){if(scope.completed_course)throw fail('This completed Course has no live sessions.',403,'JOIN_CLOSED');await accessGate(store,actor,offeringId,{live:true});if(!actor.global_admin&&!scope.live&&!scope.role)throw fail('Current live-session access is required.',403);const session=await store.first('SELECT session_id,starts_at,ends_at,zoom_url,cancelled FROM timetable WHERE session_id=? AND offering_id=?',[id(input.sessionId),offeringId]),now=Date.now();if(!session||session.cancelled||now<session.starts_at-300_000||now>=session.ends_at||!session.zoom_url)throw fail('Joining is available from five minutes before the lesson until it ends.',403,'JOIN_CLOSED');await joinAudience(store,actor,offeringId,session,scope);return json({destination:session.zoom_url});}
  if(action==='enrol')return json(await requestEnrolment(store,actor,offeringId,input));
  if(action==='provision')return json(await beginProvision(store,actor,offeringId,input));
  if(action==='resume')return json(await resumeProvision(env,store,actor,offeringId,input,fetcher));
 }
 let courseMatch=path.match(/^\/api\/course-playlists\/([^/]+)(?:\/files\/([^/]+))?$/);
 if(courseMatch&&(method==='GET'||courseMatch[2]&&method==='HEAD'))return courseMatch[2]?coursePlaylistFile(env,store,actor,decodeURIComponent(courseMatch[1]),decodeURIComponent(courseMatch[2]),request):json(await publishedCourseContent(store,actor,decodeURIComponent(courseMatch[1])));
 if(path==='/api/admin/offerings'&&method==='GET'){
  const offerings=actor.global_admin?await store.all("SELECT o.offering_id,o.title,o.kind,p.programme_key FROM offerings o LEFT JOIN programme_offerings p USING(offering_id) WHERE o.kind IN('COURSE','TAFSEER') ORDER BY o.offering_id LIMIT 200"):await store.all("SELECT o.offering_id,o.title,o.kind,p.programme_key FROM staff s JOIN offerings o USING(offering_id) LEFT JOIN programme_offerings p USING(offering_id) WHERE s.account_id=? AND s.role='ADMIN' AND o.kind IN('COURSE','TAFSEER') ORDER BY o.offering_id LIMIT 200",[actor.account_id]);return json({offerings});
 }
 match=path.match(/^\/api\/admin\/([-A-Za-z0-9_:]+)(?:\/(files|recording|recording-attachments|prepared-recordings|media-options|media-review|media-detail|existing-collection|playlists|playlist-cover|playlist-card-options|course-playlists))?$/);
 if(match){const offeringId=id(match[1]),sub=match[2],adminScope=await store.scope(actor,offeringId,{admin:true,readOnly:method==='GET'});
  if(sub==='course-playlists'&&method==='GET')return json(await coursePlaylistRead(env,store,actor,offeringId,{...Object.fromEntries(url.searchParams),action:url.searchParams.get('action')||'course-playlists'},fetcher));
  if(sub==='playlists'){if(method!=='GET')throw fail('Use GET for the playlist table.',405);return json(await playlistTable(store,actor,offeringId,{attachmentId:url.searchParams.get('attachment'),playlistId:url.searchParams.get('playlist')}));}
  if(sub==='existing-collection'&&method==='GET')return json(url.searchParams.get('reference')==='1'?await reviewPlaylistReferences(env,store,actor,offeringId,{websiteId:url.searchParams.get('website')}):await existingCollection(env,store,actor,offeringId,url.searchParams.get('website')));
  if(sub==='media-detail'){if(method!=='GET')throw fail('Use GET to review saved recording content.',405);return json(await mediaDetail(env,store,actor,offeringId,url.searchParams.get('attachment')));}
  if(sub==='media-review'){
   if(method!=='GET')throw fail('Use GET for the saved media review.',405);
   if(url.searchParams.get('participants')==='1')return json({canManageContent:!academyAuthority(env)||Boolean(adminScope.studioAuthority),participants:[],media:[],websites:[],requests:[],months:[],card:null});
   const website=url.searchParams.get('website'),unassigned=url.searchParams.get('unassigned')==='1',after=url.searchParams.get('after')||'';
   if(website&&!await store.first('SELECT 1 FROM websites WHERE website_id=? AND offering_id=?',[id(website),offeringId]))throw fail('Choose a website in this offering.',403);
   if(website&&unassigned)throw fail('Choose one media collection.');
   const filter=website?' AND x.website_id=?':unassigned?' AND x.website_id IS NULL AND NOT EXISTS(SELECT 1 FROM mou_playlist_items i WHERE i.attachment_id=x.attachment_id)':'';
   const rows=await store.all('SELECT x.*,o.filename,o.mime_type,t.revision attribution_revision,t.draft_json attribution_draft,t.published_json attribution_published,c.index_json companion_index FROM attachments x JOIN objects o USING(asset_id) LEFT JOIN media_attributions t USING(attachment_id) LEFT JOIN recording_companions c USING(attachment_id) WHERE x.offering_id=? AND x.attachment_id>?'+filter+' ORDER BY x.attachment_id LIMIT 51',[offeringId,after,...(website?[website]:[])]);
   return json({canManageContent:!academyAuthority(env)||Boolean(adminScope.studioAuthority),mediaRevision:(await store.first('SELECT revision FROM access_revisions WHERE offering_id=?',[offeringId]))?.revision||0,websites:await store.all('SELECT website_id,title,completion_month,revision,enabled FROM websites WHERE offering_id=? ORDER BY website_id LIMIT 100',[offeringId]),media:rows.map(row=>({...row,summary:row.companion_index?JSON.parse(row.companion_index).summary:null,companion_index:undefined}))});
  }
  if(sub==='playlist-card-options'&&method==='GET')return json(await cardOptions(env,store,actor,offeringId,fetcher));
  if(sub==='playlist-cover'&&method==='PUT')return json(await uploadCover(env,store,actor,offeringId,{...Object.fromEntries(url.searchParams),type:request.headers.get('Content-Type'),revision:Number(url.searchParams.get('revision'))},await bytes(request.body,COVER_LIMIT)));
  if(sub==='playlist-cover'&&method==='GET')return previewCover(env,store,actor,offeringId,Object.fromEntries(url.searchParams));
  if(sub==='media-options'){if(method!=='GET')throw fail('Use GET for checked media choices.',405);return json(await mediaOptions(env,store,actor,offeringId,fetcher));}
  if(sub==='prepared-recordings'){if(method!=='GET')throw fail('Use the separate native Attach and Publish actions.',405);return json(await preparedRecordings(env,store,actor,offeringId));}
  if(method==='GET'&&sub==='recording-attachments'){if(!adminScope.studioAuthority&&academyAuthority(env))throw fail('Studio ownership is required.',409);return json(await recordingAttachmentPreflight(store,offeringId,url.searchParams.getAll('source')));}
  if(method==='GET'&&sub==='files')return json({offeringId,...await offeringWebsiteAssets(store,offeringId,{assetId:url.searchParams.get('assetId'),after:url.searchParams.get('after')||''})});
  if(method==='PUT'&&sub==='files')return json(await upload(env,store,actor,offeringId,request));
  if(sub==='recording'&&method==='PUT')return json(await recording(env,store,actor,offeringId,{action:'part',assetId:url.searchParams.get('assetId'),partNumber:Number(url.searchParams.get('partNumber'))},request));
  if(sub==='recording'&&method==='POST')return json(await recording(env,store,actor,offeringId,await bodyJSON(request.body,1_000_000),request));
  if(method==='POST'){const input=await bodyJSON(request.body);if(input.action==='existing-playlist-save')return json(await savePlaylistReferences(env,store,actor,offeringId,input));if(input.action==='course-playlist-save')return json(await coursePlaylistSave(env,store,actor,offeringId,input,fetcher));if(input.action==='course-playlist-content-save')return json(await coursePlaylistContentSave(store,actor,offeringId,input));if(['course-playlist-publish-card','course-playlist-publish-content'].includes(input.action))return json(await coursePlaylistPublish(env,store,actor,offeringId,input,fetcher));if(input.action==='mou-playlist-pdf-reference')return json(await referenceCollectionPDF(env,store,actor,offeringId,input));if(input.action==='mou-playlist-save')return json(await savePlaylist(env,store,actor,offeringId,input,fetcher));if(input.action==='mou-playlist-correction')return json(await playlistCorrection(store,actor,offeringId,input));if(input.action==='mou-playlist-publication')return json(await playlistPublication(env,store,actor,offeringId,input));if(input.action==='mou-playlist-order')return json(await savePlaylistOrder(store,actor,offeringId,input));if(input.action==='mou-playlist-add')return json(await playlistAddRecording(store,actor,offeringId,input));if(['media-companion-save','media-text-save'].includes(input.action))return json(await mediaCompanionSave(env,store,actor,offeringId,input,fetcher));if(input.action==='media-attach')return json(await attachMedia(env,store,actor,offeringId,input,fetcher,change));if(['media-attribution-save','media-publication'].includes(input.action))return json(await attributionChange(env,store,actor,offeringId,input,fetcher));return json(await change(env,store,actor,offeringId,input));}
  if(method==='GET'){const after=url.searchParams.get('after')||'';return json({coursePolicy:await coursePolicy(store,offeringId),
   canManageContent:!academyAuthority(env)||Boolean(adminScope.studioAuthority),
   participants:await store.all('SELECT p.*,a.display_name FROM participation p JOIN accounts a USING(account_id) WHERE p.offering_id=? AND p.account_id>? ORDER BY p.account_id LIMIT 51',[offeringId,after]),
   websites:await store.all('SELECT website_id,title,completion_month,revision,enabled FROM websites WHERE offering_id=? ORDER BY website_id LIMIT 100',[offeringId]),
   card:await store.first('SELECT * FROM cards WHERE offering_id=?',[offeringId]),
   media:await store.all('SELECT x.*,o.filename,o.mime_type,t.revision attribution_revision,t.draft_json attribution_draft,t.published_json attribution_published FROM attachments x JOIN objects o USING(asset_id) LEFT JOIN media_attributions t USING(attachment_id) WHERE x.offering_id=? AND x.attachment_id>? ORDER BY x.attachment_id LIMIT 51',[offeringId,after]),
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
