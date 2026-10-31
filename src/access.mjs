import {fail,id,integer,flag,text,month,date,boundedAge,sha256} from './protocol.mjs';
export const academyAuthority=env=>env.AUTHORITY_MODE==='ACADEMY';
export async function accessGate(store,actor,offeringId,{admin=false,live=false}={}){
 if(!academyAuthority(store.env))return null;admin=admin||Boolean(actor.global_admin);
 const row=await store.first(`SELECT s.*,p.generation person_generation,p.verified_at,p.ready,p.windows_json,p.has_allocation,p.course FROM source_access_scopes s LEFT JOIN source_access_people p ON p.offering_id=s.offering_id AND p.account_id=? WHERE s.offering_id=?`,[actor.account_id,offeringId]);
 if(row?.authority==='WEBSITE'){
  const handover=await store.first("SELECT phase FROM access_handovers WHERE offering_id=?",[offeringId]);
  if(handover?.phase!=='COMMITTED')throw fail('This offering needs a guarded access handover.',409,'HANDOVER_REQUIRED');
  if(!row.enabled)throw fail('This offering is unavailable in Academy.',403,'SOURCE_SCOPE_UNAVAILABLE');
  // Studio owns acquired rights; Academy still owns class windows/lifecycle.
  if(!live&&!admin){if(await store.first('SELECT 1 FROM source_access_master_fences WHERE account_id=? AND offering_id=?',[actor.account_id,offeringId]))throw Object.assign(fail('Confirm the current Academy master account before continuing.',409,'ACCESS_REFRESH_REQUIRED'),{offeringId});return {...row,studio:true};}
 }
 if(!actor.source_ref)throw fail('Sign in through Academy for parallel access.',401,'SIGN_IN_REQUIRED');
 const liveAge=Math.max(30,Math.min(86400,Number(store.env.LIVE_ACCESS_MAX_AGE_SECONDS)||boundedAge(store.env)/1000))*1000,maxAge=live?Math.min(liveAge,boundedAge(store.env,admin)):boundedAge(store.env,admin);
 if(row&&!row.enabled)throw fail('This offering is unavailable in Academy.',403,'SOURCE_SCOPE_UNAVAILABLE');
 if(live&&row?.live_enabled===0)throw fail('Live entry is closed for this offering.',403,'JOIN_CLOSED');
 if(!row?.ready||row.person_generation!==row.generation||row.verified_at<Date.now()-maxAge)throw Object.assign(fail('Academy access needs to be confirmed.',409,'ACCESS_REFRESH_REQUIRED'),{offeringId});return row?.authority==='WEBSITE'?{...row,studio:true}:row;
}
export async function rejectAuthorityWrite(store,offeringId){
 if(!academyAuthority(store.env))return;
 const row=await store.first('SELECT authority FROM source_access_scopes WHERE offering_id=?',[offeringId]);if(row?.authority==='WEBSITE'&&(await store.first("SELECT phase FROM access_handovers WHERE offering_id=?",[offeringId]))?.phase==='COMMITTED')return;
 throw fail('Manage enrolment and access in Academy while both systems run in parallel.',409,'ACADEMY_AUTHORITY');
}
export function liveAccess(row,scope,now=Date.now()){
 if(!row)return Boolean(scope.live);if(!row.live_enabled||!scope.live||!scope.enrolled||row.studio&&!row.ready)return false;if(row.course)return true;
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:row.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)).map(p=>[p.type,p.value])),today=parts.year+'-'+parts.month+'-'+parts.day,windows=JSON.parse(row.windows_json||'[]'),classes=new Set(JSON.parse(row.classes_json).map(c=>c.toLowerCase()));
 return windows.length?windows.some(w=>w.active&&classes.has(w.classId.toLowerCase())&&(!w.start||w.start<=today)&&(!w.end||w.end>=today)):!row.has_allocation&&classes.size===1;
}
export async function sourceWebsiteGate(store,actor,website){
 const scope=await accessGate(store,actor,website.offering_id,{admin:Boolean(website.role)});
 if(scope&&website.kind==='TAFSEER'){
  const programme=await store.first("SELECT 1 FROM programme_offerings WHERE programme_key='mothers' AND offering_id=?",[website.offering_id]);
  const mapped=programme?await store.first('SELECT enabled FROM programme_subjects WHERE offering_id=? AND website_id=?',[website.offering_id,website.website_id]):await store.first('SELECT enabled FROM source_access_websites WHERE offering_id=? AND website_id=?',[website.offering_id,website.website_id]);
  if(!mapped?.enabled)throw fail('This programme subject is unavailable.',403);
 }return scope;
}
export async function accessStatements(store,event,version,accountStatements){
 if(!academyAuthority(store.env))throw fail('Academy access projection is disabled.',409,'ACADEMY_AUTHORITY_DISABLED');
 const offer=id(event.offeringId||event.offering?.id),current=await store.first('SELECT s.authority,s.generation,o.kind FROM source_access_scopes s JOIN offerings o USING(offering_id) WHERE s.offering_id=?',[offer]);const studio=current?.authority==='WEBSITE';
 const generation=integer(event.generation,1),out=[];if(current&&generation<current.generation){if(studio)return [];throw fail('This source generation is obsolete.',409,'ACCESS_GENERATION');}
 if(event.type==='access-scope'){
  const historical=await store.first('SELECT * FROM completed_course_registrations WHERE offering_id=?',[offer]),completed=event.completedCourse;
  if(completed){
   if(event.offering.kind!=='COURSE'||event.liveEnabled!==false||!/^[a-f0-9]{64}$/.test(completed.packageSha256||''))throw fail('Review the completed Course registration.',409,'COMPLETED_COURSE_CONFLICT');
   const registration=id(completed.registrationId),website=id(completed.websiteId);
   if(historical&&(historical.registration_id!==registration||historical.website_id!==website||historical.package_sha256!==completed.packageSha256))throw fail('Preserve this completed Course’s reviewed website.',409,'COMPLETED_COURSE_CONFLICT');
  }
  if(current&&current.kind!==event.offering.kind)throw fail('Source offering kind does not match.',409);if(!['COURSE','TAFSEER'].includes(event.offering.kind)||!Array.isArray(event.classes)||event.classes.length>200||!Array.isArray(event.websites)||event.websites.length>200)throw fail('Invalid source access scope.');
  try{new Intl.DateTimeFormat('en',{timeZone:event.timezone}).format();}catch{throw fail('Invalid source timezone.');}
  const seen=new Set();for(const w of event.websites){id(w.website_id);date(w.completion_date);if(seen.has(w.website_id))throw fail('Duplicate source website.');seen.add(w.website_id);const mapped=await store.first('SELECT offering_id FROM websites WHERE website_id=?',[w.website_id]);if(!mapped||mapped.offering_id!==offer)throw fail('Source website mapping needs review.',409);}
  out.push(store.statement('INSERT INTO offerings VALUES(?,?,?,?,0) ON CONFLICT(offering_id) DO UPDATE SET active=excluded.active WHERE offerings.kind=excluded.kind',[offer,event.offering.kind,text(event.offering.title),flag(event.enabled)]),store.statement(`INSERT INTO source_access_scopes(offering_id,generation,version,enabled,live_enabled,timezone,classes_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT(offering_id) DO UPDATE SET generation=excluded.generation,version=excluded.version,enabled=excluded.enabled,live_enabled=excluded.live_enabled,timezone=excluded.timezone,classes_json=excluded.classes_json `,[offer,generation,version,flag(event.enabled),flag(Boolean(event.liveEnabled)&&!completed&&!historical),text(event.timezone,100),JSON.stringify(event.classes.map(id))]),store.statement('UPDATE source_access_websites SET enabled=0 WHERE offering_id=?',[offer]));
  if(completed)out.push(store.statement('INSERT INTO completed_course_registrations VALUES(?,?,?,?) ON CONFLICT(offering_id) DO NOTHING',[offer,id(completed.registrationId),id(completed.websiteId),completed.packageSha256]));
  if(event.offering.kind==='COURSE'){const model=event.accessModel||'PAID';if(!['FREE','PAID'].includes(model))throw fail('Invalid Course access model.');out.push(store.statement('INSERT INTO course_access_models VALUES(?,?) ON CONFLICT(offering_id) DO UPDATE SET access_model=excluded.access_model WHERE NOT EXISTS(SELECT 1 FROM course_publications p WHERE p.offering_id=excluded.offering_id AND p.access_model<>excluded.access_model)',[offer,model]));}
 if(event.programmeKey!==undefined){if(event.programmeKey!=='mothers'||event.offering.kind!=='TAFSEER'||event.accessModel!=='MONTHLY')throw fail('Invalid independent monthly programme.');const prior=await store.first('SELECT offering_id FROM programme_offerings WHERE programme_key=?',[event.programmeKey]);if(prior&&prior.offering_id!==offer)throw fail('This programme already has a different native identity.',409,'PROGRAMME_MAPPING_CONFLICT');out.push(store.statement("INSERT INTO programme_offerings VALUES('mothers',?,'MONTHLY') ON CONFLICT(programme_key) DO NOTHING",[offer]));}
 for(const w of event.websites)out.push(store.statement('INSERT INTO source_access_websites VALUES(?,?,?) ON CONFLICT(website_id) DO UPDATE SET enabled=excluded.enabled',[w.website_id,offer,flag(Boolean(w.active))]),store.statement('UPDATE websites SET completion_date=?,completion_month=? WHERE website_id=?',[w.completion_date,w.completion_date.slice(0,7),w.website_id]));
 }else{
  const accountId=id(event.account.accountId),p=event.participation;if(!p||!Array.isArray(p.windows)||p.windows.length>100||!Array.isArray(event.months)||event.months.length>512||!Array.isArray(event.websiteMonths)||event.websiteMonths.length>240||!Array.isArray(event.grants)||event.grants.length>128||![null,'ADMIN','TEACHER'].includes(event.role))throw fail('Invalid source access snapshot.');
  if(!current||Boolean(p.course)!==(current.kind==='COURSE'))throw fail('Prepare the matching source scope before access.',409);
  const master=await store.first('SELECT active,admitted,epoch,global_admin FROM accounts WHERE account_id=?',[accountId]),masterMatches=!master||Boolean(master.active)===event.account.active&&Boolean(master.admitted)===event.account.admitted&&master.epoch===event.account.epoch&&Boolean(master.global_admin)===event.account.globalAdmin;
  out.push(masterMatches?store.statement('DELETE FROM source_access_master_fences WHERE account_id=? AND offering_id=?',[accountId,offer]):store.statement('INSERT INTO source_access_master_fences VALUES(?,?,?,?,?,?) ON CONFLICT(account_id,offering_id) DO UPDATE SET epoch=excluded.epoch,active=excluded.active,admitted=excluded.admitted,global_admin=excluded.global_admin',[accountId,offer,integer(event.account.epoch),flag(event.account.active),flag(event.account.admitted),flag(event.account.globalAdmin)]));
  const verified=integer(event.verifiedAt,1,Date.now()+30_000),windows=p.windows.map(w=>({classId:id(w.class_id),active:Boolean(w.active),start:w.start_date?date(w.start_date):null,end:w.end_date?date(w.end_date):null})),websiteMonths=event.websiteMonths.map(month),months=event.months.map(m=>({month:month(m.month),cohort:text(m.cohort,180)})),grants=event.grants.map(id);
  if(new Set(months.map(m=>JSON.stringify(m))).size!==months.length||new Set(grants).size!==grants.length)throw fail('Duplicate source rights.');
  for(const website of grants){const w=await store.first('SELECT offering_id FROM websites WHERE website_id=?',[website]);if(w?.offering_id!==offer)throw fail('Source grant maps to another offering.',409);}
  const personStatement=store.statement('INSERT INTO source_access_people VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(account_id,offering_id) DO UPDATE SET generation=excluded.generation,version=excluded.version,verified_at=excluded.verified_at,ready=excluded.ready,windows_json=excluded.windows_json,has_allocation=excluded.has_allocation,course=excluded.course',[accountId,offer,generation,version,verified,Number(!event.blocked&&masterMatches),JSON.stringify(windows),flag(Boolean(p.hasAllocation)),flag(p.course)]);
  if(studio)return [...out,...accountStatements(event.account),...(event.role?[store.statement("INSERT INTO staff VALUES(?,?,?,?) ON CONFLICT(account_id,offering_id) DO UPDATE SET role=excluded.role,can_create_account=excluded.can_create_account WHERE staff.role<>excluded.role OR staff.can_create_account<>excluded.can_create_account",[accountId,offer,event.role,Number(event.role==='ADMIN'&&current.kind==='COURSE')])]:[store.statement('DELETE FROM staff WHERE account_id=? AND offering_id=?',[accountId,offer])]),personStatement];
  const rightsHash=await sha256(JSON.stringify({enrolled:flag(p.enrolled),live:flag(p.live),purchased:flag(p.purchased),role:event.role,canCreate:Number(event.role==='ADMIN'&&current.kind==='COURSE'),months,websiteMonths,grants})),previous=await store.first('SELECT payload_hash FROM source_access_rights_snapshots WHERE account_id=? AND offering_id=?',[accountId,offer]);
  if(previous?.payload_hash===rightsHash)return [...out,...accountStatements(event.account),personStatement];
  out.push(store.statement('INSERT INTO source_access_rights_snapshots VALUES(?,?,?) ON CONFLICT(account_id,offering_id) DO UPDATE SET payload_hash=excluded.payload_hash',[accountId,offer,rightsHash]));
  out.push(...accountStatements(event.account),store.statement('INSERT INTO participation VALUES(?,?,?,?,?,\'\') ON CONFLICT(account_id,offering_id) DO UPDATE SET enrolled=excluded.enrolled,live=excluded.live,purchased=excluded.purchased',[accountId,offer,flag(p.enrolled),flag(p.live),flag(p.purchased)]),store.statement('DELETE FROM staff WHERE account_id=? AND offering_id=?',[accountId,offer]),store.statement('DELETE FROM paid_months WHERE account_id=? AND offering_id=?',[accountId,offer]),store.statement('DELETE FROM website_months WHERE account_id=? AND offering_id=?',[accountId,offer]),store.statement('INSERT INTO website_months SELECT ?,?,value FROM json_each(?)',[accountId,offer,JSON.stringify(websiteMonths)]),store.statement("INSERT INTO paid_months SELECT ?,?,json_extract(value,'$.month'),json_extract(value,'$.cohort'),'Academy authoritative projection' FROM json_each(?)",[accountId,offer,JSON.stringify(months)]),store.statement('DELETE FROM surah_grants WHERE account_id=? AND website_id IN(SELECT website_id FROM websites WHERE offering_id=?)',[accountId,offer]),store.statement("INSERT INTO surah_grants SELECT ?,value,'Academy authoritative projection' FROM json_each(?)",[accountId,JSON.stringify(grants)]));
  if(event.role)out.push(store.statement('INSERT INTO staff VALUES(?,?,?,?)',[accountId,offer,event.role,Number(event.role==='ADMIN'&&current.kind==='COURSE')]));
  out.push(personStatement);
 }
 return out;
}
export async function fenceAccess(store,event,version){
 if(event.type==='access')await store.run('UPDATE source_access_people SET ready=0 WHERE account_id=? AND offering_id=? AND version<=?',[id(event.account.accountId),id(event.offeringId),version]);
 else if(event.type==='access-scope')await store.run('UPDATE source_access_scopes SET enabled=0 WHERE offering_id=? AND version<=?',[id(event.offering.id),version]);
}
export async function joinAudience(store,actor,offeringId,session,scope){
 const source=await accessGate(store,actor,offeringId,{live:true});if(!source)return;
 if(actor.global_admin||scope.role==='ADMIN')return;
 const audience=await store.first('SELECT * FROM source_session_audiences WHERE session_id=?',[session.session_id]);if(!audience)throw fail('Academy session audience has not been confirmed.',403,'JOIN_AUDIENCE');
 if(permittedSessionAudience(actor,scope,source,audience,session))return;
 throw fail('This session belongs to another Academy audience.',403,'JOIN_AUDIENCE');
}
export function permittedSessionAudience(actor,scope,source,audience,session){
 if(!source||actor.global_admin||scope.role==='ADMIN')return true;
 if(!audience?.teacher_ids_json||!audience.class_ids_json)return false;
 const teachers=JSON.parse(audience.teacher_ids_json).map(v=>v.toLowerCase());if(scope.role==='TEACHER'&&teachers.includes(actor.account_id.toLowerCase()))return true;
 if(source.course&&scope.live)return true;
 if(!source.course&&scope.enrolled&&source.live_enabled){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:source.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(session.starts_at)).map(p=>[p.type,p.value])),day=parts.year+'-'+parts.month+'-'+parts.day,classes=new Set(JSON.parse(source.classes_json).map(v=>v.toLowerCase())),sessionClasses=JSON.parse(audience.class_ids_json).map(v=>v.toLowerCase()),windows=JSON.parse(source.windows_json||'[]');
  if(windows.length?windows.some(w=>w.active&&classes.has(w.classId.toLowerCase())&&sessionClasses.includes(w.classId.toLowerCase())&&(!w.start||w.start<=day)&&(!w.end||w.end>=day)):!source.has_allocation&&classes.size===1&&sessionClasses.some(c=>classes.has(c)))return true;
 }
 return false;
}
