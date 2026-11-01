import {dashboardHeads} from './dashboard-context.mjs';
import {fail,boundedAge,sha256,bodyJSON,date} from './protocol.mjs';
import {checkedProgrammes} from './navigation.mjs';
import {publicCatalogue,catalogueAccess} from './circles.mjs';
import {academyCommand} from './academy-client.mjs';
import {coursePolicyEpoch} from './course-policy.mjs';
const modes=['learn','teach','admin'];
export function checkedProgrammeNavigation(value,permitted){
 if(!Array.isArray(value)||value.length>3)throw fail('Academy could not check programme navigation.',503);
 const keys=new Set(),ids=new Set();for(const row of value){if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(key=>!['navigationKey','activityKey'].includes(key))||!['alimiyah','reboot','arabic-intensive'].includes(row.navigationKey)||!permitted.includes(row.navigationKey)||typeof row.activityKey!=='string'||!/^PROGRAM:[-A-Za-z0-9_:]{1,160}$/.test(row.activityKey)||keys.has(row.navigationKey)||ids.has(row.activityKey.toUpperCase()))throw fail('Academy could not check programme navigation.',503);keys.add(row.navigationKey);ids.add(row.activityKey.toUpperCase());}
 return value;
}
const currentProgrammeNavigation=(value,permitted)=>{try{checkedProgrammeNavigation(value,permitted);return true;}catch{return false;}};
const weekVersion=1,cacheFormat='DASHBOARD_WEEKS_V1';
export function dashboardWeek(value){
 const selectedDate=date(value),anchor=new Date(selectedDate+'T12:00:00Z');anchor.setUTCDate(anchor.getUTCDate()-anchor.getUTCDay());
 const weekStart=date(anchor.toISOString().slice(0,10));anchor.setUTCDate(anchor.getUTCDate()+6);return {selectedDate,weekStart,weekEnd:date(anchor.toISOString().slice(0,10))};
}
export function dashboardDay(time,timezone){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(time)).map(p=>[p.type,p.value]));return date(p.year+'-'+p.month+'-'+p.day);
}
const defaultMode=available=>['admin','teach','learn'].find(mode=>available.includes(mode));
async function readSnapshot(bucket,key,limit){const object=await bucket.get(key);if(!object||object.size>limit)return null;try{return await bodyJSON(object.body,limit);}catch{return null;}}
function checkedWeek(data){
 try{return data?.timetableWeekVersion===weekVersion&&dashboardWeek(data.weekStart).weekStart===data.weekStart&&dashboardWeek(data.weekStart).weekEnd===data.weekEnd&&data.startDate===data.weekStart&&data.endDate===data.weekEnd&&typeof data.timezone==='string'&&data.timezone.length<=100&&Boolean(dashboardDay(Date.now(),data.timezone))&&Array.isArray(data.timetable)&&data.timetable.length<=200&&data.timetable.every(row=>typeof row.date==='string'&&row.date>=data.weekStart&&row.date<=data.weekEnd&&(row.meetingGroup===undefined||/^meeting-[1-9]\d{0,5}$/.test(row.meetingGroup)));}catch{return false;}
}
export async function dashboardSnapshot(env,store,actor,input,fetcher){
 if(!input||Array.isArray(input)||input.mode!==undefined&&!modes.includes(input.mode)||input.refresh!==undefined&&typeof input.refresh!=='boolean'||input.date!==undefined&&input.weekStart!==undefined||Object.keys(input).some(k=>!['mode','refresh','date','weekStart'].includes(k)))throw fail('Choose a valid dashboard and one date or week.');
 const requested=input.date!==undefined||input.weekStart!==undefined?dashboardWeek(input.date??input.weekStart):null;
 if(!actor.source_ref)throw fail('Sign in through Academy to open your dashboard.',401);
 const proof=await store.first(`SELECT n.epoch,n.verified_at,n.programmes_json,COALESCE((SELECT version FROM stream_heads h WHERE h.stream='account:'||n.account_id),0) account_version,(SELECT offering_id FROM source_access_master_fences f WHERE f.account_id=n.account_id LIMIT 1) fenced_offering FROM circles_navigation n WHERE n.account_id=?`,[actor.account_id]);
 if(!proof||proof.epoch!==actor.epoch||proof.verified_at<Date.now()-boundedAge(env))throw fail('Confirm your current programme access.',409,'ACCESS_REFRESH_REQUIRED');const permittedProgrammes=checkedProgrammes({programmes:JSON.parse(proof.programmes_json)});
 if(proof.fenced_offering)throw fail('Confirm the current Academy master account before opening this dashboard.',409,'ACCESS_REFRESH_REQUIRED');
 const heads=await dashboardHeads(store,actor),contextHash=await sha256(JSON.stringify([actor.account_id,actor.epoch,actor.source_ref,proof.verified_at,proof.programmes_json,proof.account_version,heads.native])),base='private/dashboard/'+await sha256(actor.account_id)+'/'+contextHash+'/',meta=await readSnapshot(env.CONTENT,base+'context.json',4000);
 const metaValid=meta?.format===cacheFormat&&meta.contextHash===contextHash&&meta.checkedAt>Date.now()-boundedAge(env)&&modes.includes(meta.defaultMode)&&Array.isArray(meta.availableModes)&&meta.availableModes.includes(meta.defaultMode)&&typeof meta.timezone==='string';
 let period=requested,mode=input.mode||(metaValid?meta.defaultMode:null);
 if(!period&&metaValid)try{period=dashboardWeek(dashboardDay(Date.now(),meta.timezone));}catch{/* Invalid private metadata is a cache miss. */}
 const saved=period&&mode?await readSnapshot(env.CONTENT,base+mode+'/'+period.weekStart+'.json',230_000):null;
 const policyEpoch=await coursePolicyEpoch(store),accessHash=await sha256(JSON.stringify([heads.access,policyEpoch])),nativeValid=saved?.format===cacheFormat&&saved.contextHash===contextHash&&saved.accountId===actor.account_id&&saved.epoch===actor.epoch&&saved.permissionVerifiedAt===proof.verified_at&&saved.checkedAt>Date.now()-boundedAge(env)&&saved.dashboard?.nativeJoinVersion===1&&saved.dashboard?.studioJoinVersion===1&&saved.dashboard?.freeProgrammeJoinVersion===1&&saved.dashboard?.mode===mode&&saved.dashboard?.weekStart===period?.weekStart&&checkedWeek(saved.dashboard)&&currentProgrammeNavigation(saved.dashboard?.programmeNavigation,permittedProgrammes),valid=nativeValid&&saved.coursePolicyEpoch===policyEpoch&&saved.accessContext===heads.access;
 const currentContext=async()=>{
  const current=await store.actor(actor.token_hash),latest=await store.first(`SELECT n.epoch,n.verified_at,n.programmes_json,COALESCE((SELECT version FROM stream_heads h WHERE h.stream='account:'||n.account_id),0) account_version,(SELECT offering_id FROM source_access_master_fences f WHERE f.account_id=n.account_id LIMIT 1) fenced_offering FROM circles_navigation n WHERE n.account_id=?`,[actor.account_id]);
  if(latest?.fenced_offering||current.epoch!==actor.epoch||current.source_ref!==actor.source_ref||latest?.epoch!==proof.epoch||latest?.verified_at!==proof.verified_at||latest?.account_version!==proof.account_version||latest?.programmes_json!==proof.programmes_json)throw fail('Your permissions changed. Reload the dashboard.',409,'ACCESS_REFRESH_REQUIRED');
  if(JSON.stringify(await dashboardHeads(store,actor))!==JSON.stringify(heads))throw fail('The published timetable or permissions changed. Reopen the dashboard.',409,'DASHBOARD_CHANGED');
  const latestPolicy=await store.first('SELECT revision FROM course_policy_state WHERE singleton=1');if(latestPolicy?.revision!==policyEpoch)throw fail('The Course policy changed. Reopen the dashboard.',409,'COURSE_POLICY_CHANGED');
 };
 const selected=data=>{
  const serverTime=Date.now(),today=dashboardDay(serverTime,data.timezone),day=requested?.selectedDate||today;
  if(day<data.weekStart||day>data.weekEnd)throw fail('The current timetable week changed. Reopen the dashboard.',409,'DASHBOARD_WEEK_CHANGED');
  return {...data,selectedDate:day,today,serverTime,weekToken:contextHash+':'+data.mode+':'+data.weekStart+':'+accessHash,dateBrowsingAvailable:data.sourceWeekVersion!==0};
 };
 if(valid&&(!input.refresh||saved.checkedAt>Date.now()-60_000)){await currentContext();return {...selected(saved.dashboard),cached:true};}
 const reuseNative=nativeValid&&!input.refresh,result=reuseNative?{dashboard:structuredClone(saved.dashboard)}:await academyCommand(env,store,'/internal/website/dashboard',{sourceRef:actor.source_ref,...(input.mode?{mode:input.mode}:{}),...(requested?{date:requested.selectedDate}:{})},fetcher);let data=result.dashboard;
 const legacySource=data&&data.timetableWeekVersion===undefined;if(legacySource)data={...data,timetableWeekVersion:weekVersion,weekStart:data.startDate,weekEnd:data.endDate,sourceWeekVersion:0};
 if(!checkedWeek(data)||data.nativeJoinVersion!==1||data.studioJoinVersion!==1||data.freeProgrammeJoinVersion!==1||!modes.includes(data.mode)||input.mode&&data.mode!==input.mode||!Array.isArray(data.availableModes)||data.availableModes.length>3||!data.availableModes.includes(data.mode)||data.availableModes.some(m=>!modes.includes(m))||requested&&data.weekStart!==requested.weekStart)throw fail('Academy could not load this timetable week.',503);
 checkedProgrammeNavigation(data.programmeNavigation,permittedProgrammes);selected(data);
 const catalogue=await publicCatalogue(env),courseItems=catalogue.items.filter(i=>i.kind==='COURSE'&&i.websiteId&&!i.pending).slice(0,50),rights=courseItems.length?await catalogueAccess(store,actor,courseItems.map(i=>i.websiteId),{navigationOnly:true}):{websites:[]},allowed=new Set(rights.websites.filter(w=>w.canOpen&&!w.needsRefresh).map(w=>w.websiteId));
 const sites=courseItems.length?await store.all('SELECT website_id,offering_id FROM websites WHERE website_id IN(SELECT value FROM json_each(?))',[JSON.stringify(courseItems.map(i=>i.websiteId))]):[];
 if(data.mode==='learn')for(const area of data.activities){if(area.navigationKey==='mothers')area.destinationHref='/studio/?classroom=mothers';else if(area.websiteKind==='TAFSEER')area.destinationHref='/studio/?view=collections&collection=tafseer';else if(area.websiteKind==='COURSE'){delete area.destinationHref;const matches=sites.filter(w=>w.offering_id===area.websiteOfferingId&&allowed.has(w.website_id));if(matches.length===1)area.destinationHref='/studio/?website='+encodeURIComponent(matches[0].website_id);}}
 await currentContext();if(legacySource)return {...selected(data),cached:false};
 const checkedAt=reuseNative?saved.checkedAt:Date.now(),value={format:cacheFormat,contextHash,accountId:actor.account_id,epoch:actor.epoch,permissionVerifiedAt:proof.verified_at,coursePolicyEpoch:policyEpoch,accessContext:heads.access,checkedAt,dashboard:data},serialized=JSON.stringify(value);if(new TextEncoder().encode(serialized).length>230_000)throw fail('Choose a smaller dashboard period.',503);
 await env.CONTENT.put(base+data.mode+'/'+data.weekStart+'.json',serialized,{httpMetadata:{contentType:'application/json'}});
 await env.CONTENT.put(base+'context.json',JSON.stringify({format:cacheFormat,contextHash,checkedAt,timezone:data.timezone,availableModes:data.availableModes,defaultMode:defaultMode(data.availableModes)}),{httpMetadata:{contentType:'application/json'}});
 await currentContext();return {...selected(data),cached:false};
}
