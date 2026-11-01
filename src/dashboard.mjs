import {fail,boundedAge,sha256,bodyJSON} from './protocol.mjs';
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
export async function dashboardSnapshot(env,store,actor,input,fetcher){
 if(input.mode!==undefined&&!modes.includes(input.mode)||input.refresh!==undefined&&typeof input.refresh!=='boolean'||Object.keys(input).some(k=>!['mode','refresh'].includes(k)))throw fail('Choose a valid dashboard.');
 if(!actor.source_ref)throw fail('Sign in through Academy to open your dashboard.',401);
 const proof=await store.first('SELECT epoch,verified_at,programmes_json FROM circles_navigation WHERE account_id=?',[actor.account_id]);
 if(!proof||proof.epoch!==actor.epoch||proof.verified_at<Date.now()-boundedAge(env))throw fail('Confirm your current programme access.',409,'ACCESS_REFRESH_REQUIRED');const permittedProgrammes=checkedProgrammes({programmes:JSON.parse(proof.programmes_json)});
 const key='private/dashboard/'+await sha256(actor.account_id)+'/'+(input.mode||'default')+'.json',object=await env.CONTENT.get(key),saved=object?await bodyJSON(object.body,230_000):null;
 const policyEpoch=await coursePolicyEpoch(store),nativeValid=saved&&saved.accountId===actor.account_id&&saved.epoch===actor.epoch&&saved.permissionVerifiedAt===proof.verified_at&&saved.checkedAt>Date.now()-boundedAge(env)&&currentProgrammeNavigation(saved.dashboard?.programmeNavigation,permittedProgrammes),valid=nativeValid&&saved.coursePolicyEpoch===policyEpoch;
 if(valid&&(!input.refresh||saved.checkedAt>Date.now()-60_000))return {...saved.dashboard,cached:true};
 const reuseNative=nativeValid&&!input.refresh,result=reuseNative?{dashboard:structuredClone(saved.dashboard)}:await academyCommand(env,store,'/internal/website/dashboard',{sourceRef:actor.source_ref,...(input.mode?{mode:input.mode}:{})},fetcher),data=result.dashboard;
 if(!data||!modes.includes(data.mode)||!Array.isArray(data.availableModes)||!data.availableModes.includes(data.mode))throw fail('Academy could not load this dashboard.',503);
 checkedProgrammeNavigation(data.programmeNavigation,permittedProgrammes);
 const catalogue=await publicCatalogue(env),courseItems=catalogue.items.filter(i=>i.kind==='COURSE'&&i.websiteId&&!i.pending).slice(0,50),rights=courseItems.length?await catalogueAccess(store,actor,courseItems.map(i=>i.websiteId),{navigationOnly:true}):{websites:[]},allowed=new Set(rights.websites.filter(w=>w.canOpen&&!w.needsRefresh).map(w=>w.websiteId));
 const sites=courseItems.length?await store.all('SELECT website_id,offering_id FROM websites WHERE website_id IN(SELECT value FROM json_each(?))',[JSON.stringify(courseItems.map(i=>i.websiteId))]):[];
 if(data.mode==='learn')for(const area of data.activities){if(area.navigationKey==='mothers')area.destinationHref='/studio/?classroom=mothers';else if(area.websiteKind==='TAFSEER')area.destinationHref='/studio/?view=collections&collection=tafseer';else if(area.websiteKind==='COURSE'){delete area.destinationHref;const matches=sites.filter(w=>w.offering_id===area.websiteOfferingId&&allowed.has(w.website_id));if(matches.length===1)area.destinationHref='/studio/?website='+encodeURIComponent(matches[0].website_id);}}
 const current=await store.actor(actor.token_hash),latest=await store.first('SELECT epoch,verified_at FROM circles_navigation WHERE account_id=?',[actor.account_id]);
 if(current.epoch!==actor.epoch||latest?.epoch!==proof.epoch||latest?.verified_at!==proof.verified_at)throw fail('Your permissions changed. Reload the dashboard.',409,'ACCESS_REFRESH_REQUIRED');
 const latestPolicy=await store.first('SELECT revision FROM course_policy_state WHERE singleton=1');if(latestPolicy?.revision!==policyEpoch)throw fail('The Course policy changed. Reopen the dashboard.',409,'COURSE_POLICY_CHANGED');
 const value={accountId:actor.account_id,epoch:actor.epoch,permissionVerifiedAt:proof.verified_at,coursePolicyEpoch:policyEpoch,checkedAt:Date.now(),dashboard:data},serialized=JSON.stringify(value);if(new TextEncoder().encode(serialized).length>230_000)throw fail('Choose a smaller dashboard period.',503);
 await env.CONTENT.put(key,serialized,{httpMetadata:{contentType:'application/json'}});return {...data,cached:false};
}
