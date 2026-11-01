import {academyAuthority} from './access.mjs';
import {signedInput,receive} from './integration.mjs';
import {fail,id,integer,sha256,boundedAge} from './protocol.mjs';
import {change} from './admin.mjs';
import {coursePolicy} from './course-policy.mjs';
import {beginProvision,resumeProvision} from './enrolment.mjs';
import {playlistTable,playlistCorrection,savePlaylist,playlistPublication,playlistAddRecording} from './mou-playlists.mjs';
import {monthlyGrid,saveMonthlyGrid,accessTable,saveAccessTable} from './access-tables.mjs';

// Read views retain scoped Admin authority but use the ordinary verification age.
export const readAccessAction=action=>['read','monthly-grid','access-table','mou-playlists'].includes(action);
const revisionSQL='COALESCE((SELECT revision FROM access_revisions WHERE offering_id=?),0)=?';
const revision=async(store,offer)=>(await store.first('SELECT revision FROM access_revisions WHERE offering_id=?',[offer]))?.revision||0;

// Called only by the signed Academy server proxy. No browser actor/role is accepted.
export async function studioAccess(request,env,store,fetcher){
 const input=await signedInput(request,env),proof=input.proof,now=Date.now();
 if(!proof||proof.verifiedAt<now-60_000||proof.verifiedAt>now+1000||proof.expiresAt<=now||proof.expiresAt>now+60_000)throw fail('Refresh your Academy Admin session.',401,'ADMIN_STATUS_EXPIRED');
 if(!Array.isArray(input.deliveries)||input.deliveries.length>40)throw fail('Invalid Admin confirmation.');
 const acknowledge=[];try{
 for(const item of input.deliveries){await receive(new Request(env.WEBSITE_ORIGIN+'/internal/academy/events',{method:'POST',headers:{'X-Maktab-Signature':item.signature},body:JSON.stringify(item.delivery)}),env,store);acknowledge.push(item.delivery.operationId);}
 if(input.more)return {acknowledge,pending:true};
 const tokenHash=await sha256('academy-admin:'+id(proof.sourceRef)),accountId=id(proof.accountId);
 // Reusing the same source session never resurrects a received revocation.
 await store.run('INSERT INTO sessions VALUES(?,?,?,?,0,?) ON CONFLICT(token_hash) DO UPDATE SET expires_at=excluded.expires_at WHERE sessions.revoked=0 AND sessions.epoch=excluded.epoch',[tokenHash,accountId,integer(proof.epoch),proof.expiresAt,proof.sourceRef]);
 const actor=await store.actor(tokenHash);if(actor.account_id!==accountId||actor.epoch!==proof.epoch||actor.source_ref!==proof.sourceRef)throw fail('Your administrator account changed.',401);
 const offer=id(input.offeringId),command=input.command||{};if(!command.action?.startsWith('handover-'))await store.scope(actor,offer,{admin:true,readOnly:readAccessAction(command.action)});let result;
 if(command.action==='read')result=await readAccess(store,actor,offer,command);
 else if(command.action==='mou-playlists')result=await playlistTable(store,actor,offer,command);
 else if(command.action==='mou-playlist-correction')result=await playlistCorrection(store,actor,offer,command);
 else if(command.action==='mou-playlist-save')result=await savePlaylist(env,store,actor,offer,command);
 else if(command.action==='mou-playlist-publication')result=await playlistPublication(store,actor,offer,command);
 else if(command.action==='mou-playlist-add')result=await playlistAddRecording(store,actor,offer,command);
 else if(command.action==='monthly-grid')result=await monthlyGrid(store,actor,offer,command);
 else if(command.action==='monthly-grid-save')result=await saveMonthlyGrid(env,store,actor,offer,command);
 else if(command.action==='access-table')result=await accessTable(store,actor,offer);
 else if(command.action==='access-table-save')result=await saveAccessTable(env,store,actor,offer,command);
 else if(command.action==='save'){
  if(!['access-batch','participant','paid-months','website-months','surah-grant','staff','mou-subject','course-policy'].includes(command.change?.action))throw fail('Choose a supported access change.');
  const expected=integer(command.revision),options={expectedSQL:revisionSQL,expectedArgs:[offer,expected]};
  // Native Save preserves exact operation receipts, scope checks and mutation guards.
  result=await change(env,store,actor,offer,command.change,options);
  if(command.change.action==='course-policy')result={...result,coursePolicy:await coursePolicy(store,offer)};
 }else if(command.action==='provision')result=await beginProvision(store,actor,offer,command.input||{});
 else if(command.action==='resume')result=await resumeProvision(env,store,actor,offer,command.input||{},fetcher);
 else if(command.action?.startsWith('handover-'))result=await handover(store,actor,offer,command);
 else throw fail('Unknown access action.');
 return {...result,acknowledge};
 }catch(error){error.acknowledge=acknowledge;throw error;}
}

export async function readAccess(store,actor,offer,input){
 const scope=await store.scope(actor,offer,{admin:true,readOnly:true});const current=await revision(store,offer),after=input.after?id(input.after):'',accountId=input.accountId?id(input.accountId):null;
 const ownership=await store.first('SELECT s.authority,h.phase FROM source_access_scopes s LEFT JOIN access_handovers h USING(offering_id) WHERE s.offering_id=?',[offer]);
 const policy=scope.kind==='COURSE'?await coursePolicy(store,offer):null;
 if(input.known?.revision===current&&input.known?.after===after&&input.known?.accountId===accountId)return {notModified:true,revision:current,ownership,coursePolicy:policy};
 const participants=await store.all(`SELECT m.account_id,a.display_name,a.active,a.admitted,COALESCE(p.enrolled,0) enrolled,COALESCE(p.live,0) live,COALESCE(p.purchased,0) purchased,COALESCE(p.cohort,'') cohort,s.role,s.can_create_account FROM access_members m JOIN accounts a USING(account_id) LEFT JOIN participation p ON p.account_id=m.account_id AND p.offering_id=m.offering_id LEFT JOIN staff s ON s.account_id=m.account_id AND s.offering_id=m.offering_id WHERE m.offering_id=? AND m.account_id>? ORDER BY m.account_id LIMIT 26`,[offer,after]);
 const websites=await store.all('SELECT website_id,title,completion_month,enabled FROM websites WHERE offering_id=? ORDER BY website_id LIMIT 129',[offer]);if(websites.length>128)throw fail('This offering needs a narrower website selector.',409);
 let person=null;
 if(accountId){const account=await store.first('SELECT a.account_id,a.display_name,a.active,a.admitted,p.enrolled,p.live,p.purchased,p.cohort,s.role,s.can_create_account FROM accounts a LEFT JOIN participation p ON p.account_id=a.account_id AND p.offering_id=? LEFT JOIN staff s ON s.account_id=a.account_id AND s.offering_id=? WHERE a.account_id=?',[offer,offer,accountId]);if(!account)throw fail('Link the Academy account before managing its learning access.',404);
  const months=await store.all('SELECT month,cohort FROM paid_months WHERE account_id=? AND offering_id=? ORDER BY month,cohort LIMIT 513',[accountId,offer]),grants=await store.all('SELECT g.website_id FROM websites w CROSS JOIN surah_grants g WHERE w.offering_id=? AND g.website_id=w.website_id AND g.account_id=? ORDER BY g.website_id LIMIT 129',[offer,accountId]);if(months.length>512||grants.length>128)throw fail('This account needs a narrower access view.',409);
  const websiteMonths=await store.all('SELECT month FROM website_months WHERE account_id=? AND offering_id=? ORDER BY month LIMIT 241',[accountId,offer]);if(websiteMonths.length>240)throw fail('This account needs a narrower month view.',409);
  person={...account,months,websiteMonths:websiteMonths.map(m=>m.month),grants,liveFacts:await store.first('SELECT windows_json,has_allocation,course,verified_at,ready FROM source_access_people WHERE account_id=? AND offering_id=?',[accountId,offer])};
 }
 const pendingJobs=await store.all("SELECT operation_id,state,account_id FROM provisioning INDEXED BY provisioning_pending_actor WHERE offering_id=? AND actor_id=? AND state<>'COMPLETE' ORDER BY operation_id LIMIT 11",[offer,actor.account_id]);
 return {revision:current,ownership,kind:scope.kind,coursePolicy:policy,pendingJobs,canLinkAccount:Boolean(actor.global_admin),canChangeStaff:Boolean(actor.global_admin&&!academyAuthority(store.env)),participants:participants.slice(0,25),more:participants.length>25,next:participants.length>25?participants[24].account_id:null,websites,person};
}

export async function handover(store,actor,offer,input){
 if(!actor.global_admin)throw fail('Only Global Admin can hand over an offering.',403);if(actor.verified_at<Date.now()-boundedAge(store.env,true))throw fail('Refresh current Academy Global Admin authority.',401,'ADMIN_STATUS_EXPIRED');
 return handoverSteps(store,offer,input,{actorId:actor.account_id,mutate:(...args)=>store.mutate(actor,...args)});
}

// Shared checkpoint algorithm; callers supply their own narrow authorization.
export async function handoverSteps(store,offer,input,execution){
 const transfer=id(input.transferId),row=await store.first('SELECT * FROM access_handovers WHERE offering_id=?',[offer]),source=await store.first('SELECT * FROM source_access_scopes WHERE offering_id=?',[offer]);
 if(input.action==='handover-status')return {handover:row};
 const canonical={...input,operationId:id(input.operationId)},current=await revision(store,offer);
 const cancellation=await store.first('SELECT offering_id FROM access_handover_cancellations WHERE transfer_id=?',[transfer]);
 if(cancellation&&cancellation.offering_id!==offer)throw fail('This transfer belongs to another offering.',409,'HANDOVER_CONFLICT');
 if(input.action==='handover-abort'){
  if(source?.authority==='WEBSITE'||row?.phase==='COMMITTED')throw fail('Studio already owns this offering. Keep Academy locked.',409,'HANDOVER_COMMITTED');
  if(cancellation)return {phase:'ABORTED',cancelled:true,replayed:true};
  // Cancel even before a checkpoint exists. A durable transfer tombstone fences
  // an in-flight begin after Academy has safely unlocked its own controls.
  return execution.mutate(offer,canonical,[store.statement('INSERT INTO access_handover_cancellations VALUES(?,?,?)',[transfer,offer,Date.now()]),store.statement("UPDATE access_handovers SET phase='ABORTED' WHERE offering_id=? AND transfer_id=? AND phase='PREPARING'",[offer,transfer])],{phase:'ABORTED',cancelled:true},{global:true,masterGlobal:true,allowInactive:true,expectedSQL:"EXISTS(SELECT 1 FROM source_access_scopes WHERE offering_id=? AND authority='ACADEMY') AND NOT EXISTS(SELECT 1 FROM access_handovers WHERE offering_id=? AND phase='COMMITTED') AND NOT EXISTS(SELECT 1 FROM access_handover_cancellations WHERE transfer_id=?)",expectedArgs:[offer,offer,transfer]});
 }
 if(cancellation)throw fail('This handover was cancelled. Start a new transfer.',409,'HANDOVER_CANCELLED');
 const previous=await store.replay(execution.actorId,canonical.operationId,await store.requestHash(offer,canonical));if(previous)return previous;
 if(input.action==='handover-begin'){
  if(source?.authority!=='ACADEMY'||!source.enabled||row&&row.phase!=='ABORTED')throw fail('This offering already has a handover. Resume or recover it.',409,'HANDOVER_CONFLICT');
  if(source.generation!==input.generation||source.version!==input.sourceVersion)throw fail('Reconcile the current Academy scope first.',409);
  return execution.mutate(offer,canonical,[store.statement("INSERT INTO access_handovers VALUES(?,?,'PREPARING',?,?,?,'',0,?) ON CONFLICT(offering_id) DO UPDATE SET transfer_id=excluded.transfer_id,phase=excluded.phase,generation=excluded.generation,source_version=excluded.source_version,revision=excluded.revision,cursor='',checked=0,created_at=excluded.created_at",[offer,transfer,source.generation,source.version,current,Date.now()])],{phase:'PREPARING'},{global:true,masterGlobal:true,expectedSQL:revisionSQL+" AND EXISTS(SELECT 1 FROM source_access_scopes WHERE offering_id=? AND authority='ACADEMY' AND generation=? AND version=?) AND NOT EXISTS(SELECT 1 FROM access_handovers WHERE offering_id=? AND phase<>'ABORTED') AND NOT EXISTS(SELECT 1 FROM access_handover_cancellations WHERE transfer_id=?)",expectedArgs:[offer,current,offer,source.generation,source.version,offer,transfer]});
 }
 const old=await store.replay(execution.actorId,canonical.operationId,await store.requestHash(offer,canonical));if(old)return old;
 if(!row||row.transfer_id!==transfer||row.phase!=='PREPARING')throw fail('This handover cannot accept another step.',409,'HANDOVER_CONFLICT');
 const expectedSQL="EXISTS(SELECT 1 FROM access_handovers h JOIN source_access_scopes s USING(offering_id) WHERE h.offering_id=? AND h.transfer_id=? AND h.phase='PREPARING' AND h.cursor=? AND h.revision=COALESCE((SELECT revision FROM access_revisions r WHERE r.offering_id=h.offering_id),0) AND s.authority='ACADEMY' AND s.generation=h.generation AND s.version=h.source_version) AND NOT EXISTS(SELECT 1 FROM access_handover_cancellations WHERE transfer_id=?)",expectedArgs=[offer,transfer,row.cursor,transfer];
 if(input.action==='handover-page'){
  if(input.after!==row.cursor||!Array.isArray(input.people)||input.people.length>25)throw fail('Resume the exact next handover page.',409);
  const expected=await store.all('SELECT account_id FROM access_members WHERE offering_id=? AND account_id>? ORDER BY account_id LIMIT 25',[offer,row.cursor]);if(JSON.stringify(expected.map(p=>p.account_id))!==JSON.stringify(input.people.map(p=>p.accountId)))throw fail('The complete target participant page must match the final source checkpoint.',409,'HANDOVER_PARTICIPANTS');
  let cursor=row.cursor;const checks=[];
  for(const person of input.people){const account=id(person.accountId);if(account<=cursor)throw fail('Handover accounts must be unique and ordered.');cursor=account;
   const stream='access:'+await sha256(JSON.stringify([offer,account.toLowerCase()]));checks.push({account,stream,version:integer(person.version,1)});
  }
  const matches=await store.first(`SELECT count(*) n FROM json_each(?) j JOIN source_access_people p ON p.account_id=json_extract(j.value,'$.account') AND p.offering_id=? JOIN stream_heads h ON h.stream=json_extract(j.value,'$.stream') WHERE p.ready=1 AND p.generation=? AND p.version=json_extract(j.value,'$.version') AND h.version=p.version`,[JSON.stringify(checks),offer,row.generation]);if(matches.n!==checks.length)throw fail('Reconcile the final Academy access page before handover.',409,'HANDOVER_PENDING');
  return execution.mutate(offer,canonical,[store.statement('UPDATE access_handovers SET cursor=?,checked=checked+? WHERE offering_id=?',[cursor,checks.length,offer])],{phase:'PREPARING',cursor,checked:row.checked+checks.length},{global:true,masterGlobal:true,expectedSQL,expectedArgs});
 }
 if(input.action==='handover-commit'){
  if(await store.first('SELECT 1 FROM access_members WHERE offering_id=? AND account_id>? LIMIT 1',[offer,row.cursor]))throw fail('Check every target participant before handing over.',409,'HANDOVER_PARTICIPANTS');
  if(input.after!==row.cursor||input.count!==row.checked||input.final!==true)throw fail('Confirm the complete current Academy checkpoint.',409);
  return execution.mutate(offer,canonical,[store.statement("UPDATE access_handovers SET phase='COMMITTED' WHERE offering_id=?",[offer]),store.statement("UPDATE source_access_scopes SET authority='WEBSITE' WHERE offering_id=?",[offer])],{phase:'COMMITTED',authority:'WEBSITE'},{global:true,masterGlobal:true,expectedSQL,expectedArgs});
 }
 throw fail('Unknown handover step.');
}
