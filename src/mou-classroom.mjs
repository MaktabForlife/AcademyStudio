import {mouSubjects} from '../public/shared/mou-subjects.mjs';
import {comingSoonLabel} from '../public/shared/course-notices.mjs';
import {programmeSnapshot} from './navigation.mjs';
import {mouDefinition} from './programme-policy.mjs';
import {accessGate,permittedSessionAudience} from './access.mjs';
import {websiteAccess} from './content.mjs';
import {fail,id,date,flag,boundedAge} from './protocol.mjs';
import {learnerPlaylists} from './mou-playlists.mjs';

const subjectPlan=()=>mouSubjects.map(s=>({key:s.key,title:s.title,state:s.first?'PREPARING':'COMING_SOON',availabilityLabel:s.first?null:comingSoonLabel,website:null}));
const localMonth=(time,zone)=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit'}).formatToParts(new Date(time)).map(p=>[p.type,p.value]));return p.year+'-'+p.month;};
export async function mouClassroom(store,actor){
 if(!(await programmeSnapshot(store,actor)).includes('mothers'))throw fail('Mothers of the Ummah access is required.',403,'MOU_ACCESS_REQUIRED');
 const definition=await mouDefinition(store),now=Date.now(),subjects=subjectPlan();
 const result={schema:'MOU_CLASSROOM_V1',title:'Mothers of the Ummah',context:{accountId:actor.account_id,epoch:actor.epoch},programme:{key:'mothers',kind:'PROGRAMME',accessModel:'MONTHLY',offeringId:null,authority:null,state:'PENDING_CONNECTION'},management:{canManage:false,requiresAuthorityRefresh:false,authority:'ACADEMY_PROXY',offeringId:null},monthly:{state:'NOT_CONNECTED',month:null,hasCurrentMonth:false,hasRetainedMonths:false},materialsConnected:false,subjects,timetable:{state:'NOT_CONNECTED',serverTime:now,sessions:[]}};
 if(!definition)return result;
 const offer=definition.offering_id,scope=await store.scope(actor,offer),source=await accessGate(store,actor,offer,{readOnly:true}),staff=Boolean(actor.global_admin||scope.role),month=localMonth(now,definition.timezone);
 const months=await store.first(`SELECT EXISTS(SELECT 1 FROM paid_months WHERE account_id=? AND offering_id=? AND month=? UNION ALL SELECT 1 FROM website_months WHERE account_id=? AND offering_id=? AND month=?) current_month,EXISTS(SELECT 1 FROM paid_months WHERE account_id=? AND offering_id=? UNION ALL SELECT 1 FROM website_months WHERE account_id=? AND offering_id=?) retained`,[actor.account_id,offer,month,actor.account_id,offer,month,actor.account_id,offer,actor.account_id,offer]);
 result.programme={...result.programme,offeringId:offer,authority:definition.authority==='WEBSITE'?'STUDIO':'ACADEMY',state:staff||scope.live?'ACTIVE':'MATERIALS_ONLY'};
 result.monthly={state:'CONNECTED',month,hasCurrentMonth:Boolean(months.current_month),hasRetainedMonths:Boolean(months.retained)};
 result.playlists=await learnerPlaylists(store,actor,offer,{staff});
 const canManage=Boolean(actor.global_admin||scope.role==='ADMIN');
 result.management={canManage,requiresAuthorityRefresh:canManage&&actor.verified_at<now-boundedAge(store.env,true),authority:'ACADEMY_PROXY',offeringId:offer};
 // One bounded binding/permission query for the approved catalogue. No per-card
 // websiteAccess or per-topic queries. A card never confers material rights.
 const bindings=await store.all(`SELECT b.display_key,w.website_id,w.enabled,w.published_key,w.completion_month,
 EXISTS(SELECT 1 FROM attachments x WHERE x.website_id=w.website_id AND x.offering_id=w.offering_id AND x.audience='RECORDING' AND x.published=1
 AND (?=1 OR EXISTS(SELECT 1 FROM paid_months m WHERE m.account_id=? AND m.offering_id=x.offering_id AND m.month=substr(x.lesson_date,1,7) AND m.cohort=x.cohort))) has_recordings,
 EXISTS(SELECT 1 FROM surah_grants g WHERE g.account_id=? AND g.website_id=w.website_id) text_grant
 FROM programme_subjects b JOIN websites w ON w.website_id=b.website_id AND w.offering_id=b.offering_id WHERE b.offering_id=? AND b.enabled=1 AND NOT EXISTS(SELECT 1 FROM mou_playlist_only_websites pw WHERE pw.website_id=w.website_id) LIMIT 11`,[Number(staff),actor.account_id,actor.account_id,offer]);
 if(bindings.length>10)throw fail('Review the MOU subject catalogue.',409);
 for(const binding of bindings){
  const index=subjects.findIndex(s=>s.key===binding.display_key);if(index<0)continue;
  const permitted=staff||binding.has_recordings||binding.text_grant||Boolean(months.retained);if(!permitted)continue;
  const published=Boolean(binding.enabled&&binding.published_key),canEdit=canManage&&actor.verified_at>=now-boundedAge(store.env,true);
  result.subjects[index]={...subjects[index],state:published?'PUBLISHED':'PREPARING',availabilityLabel:null,website:{id:binding.website_id,title:subjects[index].title,completionMonth:binding.completion_month,canOpen:published,canEdit,...(published?{href:'/studio/?website='+encodeURIComponent(binding.website_id)}:{}),...(canEdit?{editorHref:'/builder/?website='+encodeURIComponent(binding.website_id)}:{})}};
 }
 result.materialsConnected=result.subjects.some(s=>s.website?.canOpen)||result.playlists.length>0;
 if(!definition.live_enabled||!staff&&!scope.live_entitled){result.timetable.state='LIVE_ACCESS_REQUIRED';return result;}
 await accessGate(store,actor,offer,{live:true,admin:staff,readOnly:true});
 const snapshot=await store.first('SELECT version FROM stream_heads WHERE stream=?',['timetable:'+offer]);
 if(!snapshot){result.timetable.state='PENDING';return result;}
 const sessions=await store.all(`SELECT t.session_id,t.title,t.starts_at,t.ends_at,t.cancelled,t.zoom_url IS NOT NULL has_zoom,a.class_ids_json,a.teacher_ids_json,d.timezone,d.classes_json,
 (SELECT json_group_array(n.display_name) FROM json_each(a.teacher_ids_json) j JOIN accounts n ON n.account_id=j.value) teacher_labels
 FROM timetable t INDEXED BY timetable_public_offering LEFT JOIN source_session_audiences a USING(session_id) LEFT JOIN source_session_details d USING(session_id)
 WHERE t.offering_id=? AND t.cancelled=0 AND t.ends_at>? AND t.starts_at>=? ORDER BY t.starts_at,t.session_id LIMIT 50`,[offer,now,now-86400_000]);
 const maxAge=Math.min(Math.max(30,Math.min(86400,Number(store.env.LIVE_ACCESS_MAX_AGE_SECONDS)||boundedAge(store.env)/1000))*1000,boundedAge(store.env));
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
 const replay=await store.replay(actor.account_id,input.operationId,await store.requestHash(offer,input));if(replay){await store.scope(actor,offer,{admin:true});return replay;}
 const scope=await store.scope(actor,offer,{admin:true}),definition=await mouDefinition(store);
 if(scope.programme_key!=='mothers'||definition?.offering_id!==offer||definition.authority!=='WEBSITE'||definition.phase!=='COMMITTED')throw fail('Complete the independent MOU handover before binding a subject.',409,'MOU_HANDOVER_REQUIRED');
 if(!mouSubjects.some(s=>s.key===input.displayKey))throw fail('Choose an approved MOU subject identity.');
 const websiteId=id(input.websiteId),enabled=flag(input.enabled),website=await store.first('SELECT offering_id,completion_date,completion_month FROM websites WHERE website_id=?',[websiteId]);
 if(website?.offering_id!==offer)throw fail('Choose an existing native website in this MOU programme.',403,'MOU_SUBJECT_SCOPE');
 if(website.completion_date&&date(website.completion_date).slice(0,7)!==website.completion_month)throw fail('Review the saved subject completion date.',409,'MOU_SUBJECT_REVIEW_REQUIRED');
 if(input.createOnly)options={...options,expectedSQL:`(${options.expectedSQL||'1'}) AND NOT EXISTS(SELECT 1 FROM programme_subjects WHERE offering_id=? AND display_key=?)`,expectedArgs:[...(options.expectedArgs||[]),offer,input.displayKey]};
 const expectedSQL=`(${options.expectedSQL||'1'}) AND EXISTS(SELECT 1 FROM programme_offerings WHERE programme_key='mothers' AND offering_id=?) AND EXISTS(SELECT 1 FROM websites WHERE website_id=? AND offering_id=?)`;
 return store.mutate(actor,offer,input,[store.statement("INSERT INTO programme_subjects VALUES(?,?,?,?) ON CONFLICT(offering_id,display_key) DO UPDATE SET website_id=excluded.website_id,enabled=excluded.enabled",[offer,input.displayKey,websiteId,enabled])],{saved:true,websiteId},{...options,studio:true,expectedSQL,expectedArgs:[...(options.expectedArgs||[]),offer,websiteId,offer]});
}
