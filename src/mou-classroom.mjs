import {mouSubjects} from '../public/shared/mou-subjects.mjs';
import {comingSoonLabel} from '../public/shared/course-notices.mjs';
import {programmeSnapshot} from './navigation.mjs';
import {mouDefinition} from './programme-policy.mjs';
import {accessGate,permittedSessionAudience} from './access.mjs';
import {websiteAccess} from './content.mjs';
import {fail,id,date,flag,boundedAge} from './protocol.mjs';

const subjectPlan=()=>mouSubjects.map(s=>({key:s.key,title:s.title,state:s.first?'PREPARING':'COMING_SOON',availabilityLabel:s.first?null:comingSoonLabel,website:null}));
const localMonth=(time,zone)=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit'}).formatToParts(new Date(time)).map(p=>[p.type,p.value]));return p.year+'-'+p.month;};
export async function mouClassroom(store,actor){
 if(!(await programmeSnapshot(store,actor)).includes('mothers'))throw fail('Mothers of the Ummah access is required.',403,'MOU_ACCESS_REQUIRED');
 const definition=await mouDefinition(store),now=Date.now(),subjects=subjectPlan();
 const result={schema:'MOU_CLASSROOM_V1',title:'Mothers of the Ummah',context:{accountId:actor.account_id,epoch:actor.epoch},programme:{key:'mothers',kind:'PROGRAMME',accessModel:'MONTHLY',offeringId:null,authority:null,state:'PENDING_CONNECTION'},management:{canManage:false,requiresAuthorityRefresh:false,authority:'ACADEMY_PROXY',offeringId:null},monthly:{state:'NOT_CONNECTED',month:null,hasCurrentMonth:false,hasRetainedMonths:false},materialsConnected:false,subjects,timetable:{state:'NOT_CONNECTED',serverTime:now,sessions:[]}};
 if(!definition)return result;
 const offer=definition.offering_id,scope=await store.scope(actor,offer),source=await accessGate(store,actor,offer),staff=Boolean(actor.global_admin||scope.role),month=localMonth(now,definition.timezone);
 const months=await store.first(`SELECT EXISTS(SELECT 1 FROM paid_months WHERE account_id=? AND offering_id=? AND month=? UNION ALL SELECT 1 FROM website_months WHERE account_id=? AND offering_id=? AND month=?) current_month,EXISTS(SELECT 1 FROM paid_months WHERE account_id=? AND offering_id=? UNION ALL SELECT 1 FROM website_months WHERE account_id=? AND offering_id=?) retained`,[actor.account_id,offer,month,actor.account_id,offer,month,actor.account_id,offer,actor.account_id,offer]);
 result.programme={...result.programme,offeringId:offer,authority:definition.authority==='WEBSITE'?'STUDIO':'ACADEMY',state:staff||scope.live?'ACTIVE':'MATERIALS_ONLY'};
 result.monthly={state:'CONNECTED',month,hasCurrentMonth:Boolean(months.current_month),hasRetainedMonths:Boolean(months.retained)};
 const canManage=Boolean(actor.global_admin||scope.role==='ADMIN');
 result.management={canManage,requiresAuthorityRefresh:canManage&&actor.verified_at<now-boundedAge(store.env,true),authority:'ACADEMY_PROXY',offeringId:offer};
 // Only the first real bound subject is looked up. Nine forthcoming display
 // entries have no operational identities, entitlement queries or actions.
 const binding=await store.first("SELECT b.website_id FROM programme_subjects b JOIN websites w ON w.website_id=b.website_id AND w.offering_id=b.offering_id WHERE b.offering_id=? AND b.display_key='surah-al-baqarah' AND b.enabled=1",[offer]);
 if(binding){
  const admin=Boolean(actor.global_admin||scope.role==='ADMIN');let website=null;
  try{website=await websiteAccess(store,actor,binding.website_id,{admin});}catch(error){if(![403,404].includes(error.status))throw error;}
  if(website){
   const published=Boolean(website.enabled&&website.published_key),canEdit=admin&&actor.verified_at>=now-boundedAge(store.env,true);
   result.subjects[0]={...subjects[0],state:published?'PUBLISHED':'PREPARING',website:{id:website.website_id,title:website.title,completionMonth:website.completion_month,canOpen:published,canEdit,...(published?{href:'/studio/?website='+encodeURIComponent(website.website_id)}:{}),...(canEdit?{editorHref:'/builder/?website='+encodeURIComponent(website.website_id)}:{})}};result.materialsConnected=published;
  }else result.subjects[0]={...subjects[0],state:'LOCKED'};
 }
 if(!definition.live_enabled||!staff&&!scope.live_entitled){result.timetable.state='LIVE_ACCESS_REQUIRED';return result;}
 await accessGate(store,actor,offer,{live:true,admin:staff});
 const snapshot=await store.first('SELECT version FROM stream_heads WHERE stream=?',['timetable:'+offer]);
 if(!snapshot){result.timetable.state='PENDING';return result;}
 const sessions=await store.all(`SELECT t.session_id,t.title,t.starts_at,t.ends_at,t.cancelled,t.zoom_url IS NOT NULL has_zoom,a.class_ids_json,a.teacher_ids_json,d.timezone,d.classes_json,
 (SELECT json_group_array(n.display_name) FROM json_each(a.teacher_ids_json) j JOIN accounts n ON n.account_id=j.value) teacher_labels
 FROM timetable t INDEXED BY timetable_public_offering LEFT JOIN source_session_audiences a USING(session_id) LEFT JOIN source_session_details d USING(session_id)
 WHERE t.offering_id=? AND t.cancelled=0 AND t.ends_at>? AND t.starts_at>=? ORDER BY t.starts_at,t.session_id LIMIT 50`,[offer,now,now-86400_000]);
 const maxAge=Math.min(Math.max(30,Math.min(86400,Number(store.env.LIVE_ACCESS_MAX_AGE_SECONDS)||boundedAge(store.env)/1000))*1000,boundedAge(store.env,staff));
 const eligibleUntil=Math.min(actor.expires_at,actor.verified_at+boundedAge(store.env),source.verified_at+maxAge);
 // List only this actor's real audience. Eligibility is time-independent, but
 // expires with the proof; a browser timer cannot turn a denied gate into true.
 result.timetable.sessions=sessions.filter(s=>permittedSessionAudience(actor,scope,source,s,s)).map(s=>{
  const eligibleToJoin=Boolean(definition.live_enabled&&(staff||scope.live)&&source.ready&&eligibleUntil>now&&s.has_zoom);
  return {id:s.session_id,title:s.title,startsAt:s.starts_at,endsAt:s.ends_at,timezone:s.timezone||definition.timezone,classIds:JSON.parse(s.class_ids_json||'[]'),classes:JSON.parse(s.classes_json||'null')||JSON.parse(s.class_ids_json||'[]').map(id=>({id,label:null})),teacherLabels:JSON.parse(s.teacher_labels||'[]'),joinOpensAt:s.starts_at-300_000,eligibleToJoin,eligibilityExpiresAt:Math.min(eligibleUntil,s.ends_at),canJoin:Boolean(eligibleToJoin&&now>=s.starts_at-300_000&&now<s.ends_at),joinPath:'/api/offerings/'+encodeURIComponent(offer)+'/join'};
 });
 result.timetable.state=result.timetable.sessions.length?'PUBLISHED':'NO_UPCOMING_SESSIONS';
 return result;
}

export async function bindMouSubject(store,actor,offer,input,options={}){
 const scope=await store.scope(actor,offer,{admin:true}),definition=await mouDefinition(store);
 if(scope.programme_key!=='mothers'||definition?.offering_id!==offer||definition.authority!=='WEBSITE'||definition.phase!=='COMMITTED')throw fail('Complete the independent MOU handover before binding a subject.',409,'MOU_HANDOVER_REQUIRED');
 if(input.displayKey!=='surah-al-baqarah')throw fail('Only the confirmed first MOU subject can be connected. Forthcoming subjects stay inert.');
 const websiteId=id(input.websiteId),enabled=flag(input.enabled),website=await store.first('SELECT offering_id,completion_date,completion_month FROM websites WHERE website_id=?',[websiteId]);
 if(website?.offering_id!==offer)throw fail('Choose an existing native website in this MOU programme.',403,'MOU_SUBJECT_SCOPE');
 if(website.completion_date&&date(website.completion_date).slice(0,7)!==website.completion_month)throw fail('Review the saved subject completion date.',409,'MOU_SUBJECT_REVIEW_REQUIRED');
 const expectedSQL=`(${options.expectedSQL||'1'}) AND EXISTS(SELECT 1 FROM programme_offerings WHERE programme_key='mothers' AND offering_id=?) AND EXISTS(SELECT 1 FROM websites WHERE website_id=? AND offering_id=?)`;
 return store.mutate(actor,offer,input,[store.statement("INSERT INTO programme_subjects VALUES(?,'surah-al-baqarah',?,?) ON CONFLICT(offering_id,display_key) DO UPDATE SET website_id=excluded.website_id,enabled=excluded.enabled",[offer,websiteId,enabled])],{saved:true,websiteId},{...options,studio:true,expectedSQL,expectedArgs:[...(options.expectedArgs||[]),offer,websiteId,offer]});
}
