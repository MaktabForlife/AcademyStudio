import {Store} from './database.mjs';
import {fail,failure,json,bodyJSON,parseCookie,sha256,originCheck,cookie,id,text,integer,bytes,signedHeaders,safeToken,boundedAge} from './protocol.mjs';
import {receive,exchange} from './integration.mjs';
import {websiteAccess,objectJSON,editWebsite,publishHome,flushPublic} from './content.mjs';
import {change,upload,recording,announcements} from './admin.mjs';
import {mediaGate,streamMedia} from './media.mjs';
import {requestEnrolment,beginProvision,resumeProvision} from './enrolment.mjs';
import {academyCommand} from './academy-client.mjs';
import {publishSchedule} from './public-schedule.mjs';

async function forwardSignIn(request,env,store,input,fetcher){
 if(!safeToken(input.challenge)||!safeToken(input.state))throw fail('Reopen sign-in from the homepage.');
 // Only the current credential request travels to Academy. No PIN or credential hash is stored here.
 const result=await academyCommand(env,store,'/internal/website/sign-in',{uniqueid:text(input.uniqueid,160),pin:text(input.pin,4),challenge:input.challenge,state:input.state,...(input.setup===true?{setup:true,pinConfirmation:text(input.pinConfirmation,4)}:{})},fetcher);
 if(!safeToken(result.code))throw fail('Academy returned an invalid sign-in handoff.',503);return json({code:result.code});
}
async function route(request,env,store,fetcher){
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(path==='/api/public/home'&&method==='GET'){
  const object=await env.CONTENT.get('public/home.json');if(!object)return json({title:'Umm Abbad Academy',cards:[],sessions:[],announcements:[]});
  const home=await bodyJSON(object.body),schedule=await env.CONTENT.get('public/schedule.json');if(schedule){const facts=await bodyJSON(schedule.body),visible=new Set(home.cards.map(c=>c.offering_id));home.sessions=Object.entries(facts.offerings).filter(([key])=>visible.has(key)).flatMap(([,value])=>value.sessions).filter(s=>!s.cancelled&&s.ends_at>Date.now()).sort((a,b)=>a.starts_at-b.starts_at).slice(0,300);}
  return json(home,200,{'Cache-Control':'public, max-age=60'});
 }
 if(path==='/internal/academy/events'&&method==='POST'){const result=await receive(request,env,store);if(result.changedOffering)await publishSchedule(env,store,result.changedOffering);return json(result);}
 if(path==='/api/config'&&method==='GET')return json({academyOrigin:env.ACADEMY_ORIGIN,localPreview:env.ENVIRONMENT==='local'});
 if(method==='POST'||method==='PUT'||method==='DELETE')originCheck(request,env);
 if(path==='/auth/login'&&method==='POST')return forwardSignIn(request,env,store,await bodyJSON(request.body,4096),fetcher);
 if(path==='/auth/exchange'&&method==='POST'){const result=await exchange(await bodyJSON(request.body,4096),env,store);return json({signedIn:true,accountId:result.accountId},200,{'Set-Cookie':result.cookie});}
 const token=parseCookie(request);if(!token)throw fail('Sign in to Academy to continue.',401,'SIGN_IN_REQUIRED');const actor=await store.actor(await sha256(token),Date.now(),{allowExpiredStatus:path==='/auth/refresh'||path==='/auth/logout'});
 if(path==='/auth/refresh'&&method==='POST'){
  if(!actor.source_ref)throw fail('Sign in to Academy to refresh this session.',401);if(actor.verified_at>=Date.now()-boundedAge(env,true))return json({verifiedAt:actor.verified_at});
  const claimId=crypto.randomUUID(),claimed=await store.all('INSERT INTO refresh_claims VALUES(?,?,?) ON CONFLICT(account_id) DO UPDATE SET claim_id=excluded.claim_id,expires_at=excluded.expires_at WHERE refresh_claims.expires_at<? RETURNING claim_id',[actor.account_id,claimId,Date.now()+30_000,Date.now()]);
  if(!claimed.length)throw fail('Your account refresh is already in progress. Retry the action shortly.',409,'REFRESH_PENDING');
  try{await academyCommand(env,store,'/internal/website/status',{sourceRef:actor.source_ref},fetcher);const current=await store.actor(actor.token_hash);return json({verifiedAt:current.verified_at});}finally{await store.run('DELETE FROM refresh_claims WHERE account_id=? AND claim_id=?',[actor.account_id,claimId]);}
 }
 if(path==='/auth/academy'&&method==='POST'){const input=await bodyJSON(request.body,4096);if(!actor.source_ref||!safeToken(input.challenge)||!safeToken(input.state))throw fail('Reopen Academy from the website.',401);const result=await academyCommand(env,store,'/internal/website/open-academy',{sourceRef:actor.source_ref,challenge:input.challenge,state:input.state},fetcher);if(!safeToken(result.code))throw fail('Academy could not prepare the handoff.',503);return json({code:result.code});}
 if(path==='/auth/logout'&&method==='POST'){await store.run('UPDATE sessions SET revoked=1 WHERE token_hash=?',[actor.token_hash]);return json({signedOut:true},200,{'Set-Cookie':cookie('',0)});}
 if(path==='/api/me'&&method==='GET')return json({accountId:actor.account_id,displayName:actor.display_name,globalAdmin:Boolean(actor.global_admin),verifiedAt:actor.verified_at});
 if(path==='/api/websites'&&method==='GET'){
  // Start with this account's indexed rights, rather than scanning all sites for an OR condition.
  const rows=await store.all(`WITH mine AS (
   SELECT offering_id FROM participation WHERE account_id=? AND purchased=1
   UNION SELECT offering_id FROM paid_months WHERE account_id=?
   UNION SELECT offering_id FROM staff WHERE account_id=?
   UNION SELECT w.offering_id FROM surah_grants g JOIN websites w USING(website_id) WHERE g.account_id=?
  ) SELECT w.website_id,w.title,w.offering_id,w.completion_month,w.enabled FROM mine JOIN websites w USING(offering_id) WHERE w.website_id>? ORDER BY w.website_id LIMIT 51`,[actor.account_id,actor.account_id,actor.account_id,actor.account_id,url.searchParams.get('after')||'']);return json({websites:rows.slice(0,50),more:rows.length>50});
 }
 let match=path.match(/^\/api\/websites\/([-A-Za-z0-9_:]+)(?:\/(edit|export|history))?$/);
 if(match){const websiteId=id(match[1]),action=match[2];if(method==='POST'&&action==='edit')return json(await editWebsite(env,store,actor,websiteId,await bodyJSON(request.body)));
  if(method!=='GET')throw fail('Use GET to read website content.',405);
  if(action==='history'){await websiteAccess(store,actor,websiteId,{admin:true});return json({history:await store.all('SELECT revision,action,created_at,actor_id FROM website_history WHERE website_id=? AND revision<? ORDER BY revision DESC LIMIT 51',[websiteId,Number(url.searchParams.get('before'))||Number.MAX_SAFE_INTEGER])});}
  const website=await websiteAccess(store,actor,websiteId,{admin:Boolean(action)}),key=action?website.draft_key:website.published_key,document=key?await objectJSON(env.CONTENT,key):null;
  const assets=await store.all('SELECT x.attachment_id,x.asset_id,x.lesson_id,o.filename name,o.mime_type type,o.byte_size size,x.title FROM attachments x JOIN objects o USING(asset_id) WHERE x.website_id=? AND (?=1 OR (x.published=1 AND EXISTS(SELECT 1 FROM published_assets p WHERE p.website_id=x.website_id AND p.asset_id=x.asset_id))) ORDER BY x.attachment_id LIMIT 100',[websiteId,Number(Boolean(action))]);
  return json({websiteId,offeringId:website.offering_id,revision:website.revision,document,assets:assets.map(a=>({...a,url:'/api/media/'+a.attachment_id})),enabled:Boolean(website.enabled)});
 }
 match=path.match(/^\/api\/media\/([-A-Za-z0-9_:]+)$/);if(match&&['GET','HEAD'].includes(method)){const row=await mediaGate(store,actor,match[1],{admin:url.searchParams.get('draft')==='1'});return streamMedia(env,row,request);}
 match=path.match(/^\/api\/offerings\/([-A-Za-z0-9_:]+)\/(sessions|media|join|enrol|provision|resume)$/);
 if(match){const offeringId=id(match[1]),action=match[2],scope=await store.scope(actor,offeringId);
  if(action==='sessions'&&method==='GET'){if(!actor.global_admin&&!scope.live&&!scope.role)throw fail('Live-session access is required.',403);return json({sessions:await store.all('SELECT session_id,title,starts_at,ends_at,cancelled FROM timetable WHERE offering_id=? AND starts_at>=? ORDER BY starts_at LIMIT 100',[offeringId,Date.now()-31*86400_000]),serverTime:Date.now()});}
  if(action==='media'&&method==='GET'){const after=url.searchParams.get('after')||'',rows=await store.all(`SELECT x.attachment_id,x.title,x.lesson_id,x.lesson_date,x.audience,o.mime_type type FROM attachments x JOIN objects o USING(asset_id) WHERE x.offering_id=? AND x.published=1 AND x.attachment_id>? AND (x.audience='RECORDING' AND (?=1 OR ?=1 OR ? IS NOT NULL OR EXISTS(SELECT 1 FROM paid_months m WHERE m.account_id=? AND m.offering_id=x.offering_id AND m.month=substr(x.lesson_date,1,7) AND m.cohort=x.cohort))) ORDER BY x.attachment_id LIMIT 51`,[offeringId,after,actor.global_admin,Number(Boolean(scope.purchased)),scope.role,actor.account_id]);return json({media:rows.slice(0,50),more:rows.length>50});}
  if(method!=='POST')throw fail('This action needs a POST request.',405);const input=await bodyJSON(request.body,16384);
  if(action==='join'){if(!actor.global_admin&&!scope.live&&!scope.role)throw fail('Current live-session access is required.',403);const session=await store.first('SELECT starts_at,ends_at,zoom_url,cancelled FROM timetable WHERE session_id=? AND offering_id=?',[id(input.sessionId),offeringId]),now=Date.now();if(!session||session.cancelled||now<session.starts_at-300_000||now>=session.ends_at||!session.zoom_url)throw fail('Joining is available from five minutes before the lesson until it ends.',403,'JOIN_CLOSED');return json({destination:session.zoom_url});}
  if(action==='enrol')return json(await requestEnrolment(store,actor,offeringId,input));
  if(action==='provision')return json(await beginProvision(store,actor,offeringId,input));
  if(action==='resume')return json(await resumeProvision(env,store,actor,offeringId,input,fetcher));
 }
 if(path==='/api/admin/offerings'&&method==='GET'){
  const offerings=actor.global_admin?await store.all('SELECT offering_id,title,kind FROM offerings ORDER BY offering_id LIMIT 200'):await store.all("SELECT o.offering_id,o.title,o.kind FROM staff s JOIN offerings o USING(offering_id) WHERE s.account_id=? AND s.role='ADMIN' ORDER BY o.offering_id LIMIT 200",[actor.account_id]);return json({offerings});
 }
 match=path.match(/^\/api\/admin\/([-A-Za-z0-9_:]+)(?:\/(files|recording))?$/);
 if(match){const offeringId=id(match[1]),sub=match[2];await store.scope(actor,offeringId,{admin:true});
  if(method==='PUT'&&sub==='files')return json(await upload(env,store,actor,offeringId,request));
  if(sub==='recording'&&method==='PUT')return json(await recording(env,store,actor,offeringId,{action:'part',assetId:url.searchParams.get('assetId'),partNumber:Number(url.searchParams.get('partNumber'))},request));
  if(sub==='recording'&&method==='POST')return json(await recording(env,store,actor,offeringId,await bodyJSON(request.body,1_000_000),request));
  if(method==='POST')return json(await change(env,store,actor,offeringId,await bodyJSON(request.body)));
  if(method==='GET'){const after=url.searchParams.get('after')||'';return json({
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
 if(path==='/api/library-return'&&method==='GET'){
  const website=await websiteAccess(store,actor,id(url.searchParams.get('website'))),lesson=url.searchParams.get('lesson');if(lesson)id(lesson);
  return json({destination:env.ACADEMY_ORIGIN+'/academy/library/?'+new URLSearchParams({websiteReturn:env.WEBSITE_ORIGIN+'/?website='+encodeURIComponent(website.website_id)+(lesson?'&lesson='+encodeURIComponent(lesson):'')})});
 }
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
