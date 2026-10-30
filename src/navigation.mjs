import {fail,id,boundedAge} from './protocol.mjs';
import {publicCatalogue,catalogueAccess} from './circles.mjs';
export const programmeLabels={alimiyah:'Aalimiyah',reboot:'Reboot Your Maktab','arabic-intensive':'Arabic Intensive',mothers:'Mothers of the Ummah',hifz:'Hifz Academy'};
export function checkedProgrammes(value){
 if(!value||!Array.isArray(value.programmes)||value.programmes.length>5||value.programmes.some(k=>!Object.hasOwn(programmeLabels,k))||new Set(value.programmes).size!==value.programmes.length)throw fail('Invalid Academy navigation.');
 return value.programmes;
}
export async function programmeSnapshot(store,actor){
 const row=await store.first('SELECT epoch,verified_at,programmes_json FROM circles_navigation WHERE account_id=?',[actor.account_id]);
 if(!row||row.epoch!==actor.epoch||row.verified_at<Date.now()-boundedAge(store.env))throw fail('Confirm your programme access to continue.',409,'ACCESS_REFRESH_REQUIRED');
 return checkedProgrammes({programmes:JSON.parse(row.programmes_json)});
}
export async function circlesNavigation(env,store,actor){
 const programmes=await programmeSnapshot(store,actor),items=(await publicCatalogue(env)).items.filter(i=>i.kind==='COURSE'&&i.websiteId&&!i.pending);
 if(items.length>50)throw fail('The short course navigation needs review.',503);
 // Ordinary menu presentation keeps the twelve-hour bound, including staff.
 // The destination retains its existing, independent sensitive-action checks.
 const rights=await catalogueAccess(store,actor,items.map(i=>i.websiteId),{navigationOnly:true});
 if(rights.websites.some(r=>r.needsRefresh))throw fail('Confirm your course access to continue.',409,'ACCESS_REFRESH_REQUIRED');
 const permitted=new Set(rights.websites.filter(r=>r.canOpen).map(r=>r.websiteId));
 const purchased=new Set(rights.websites.filter(r=>r.canOpen&&r.accessBasis==='purchase').map(r=>r.websiteId));
 // Indexed latest-class lookups order purchased courses without expiring a
 // completed purchase. No course body, meeting URL or Academy call is needed.
 const dates=purchased.size?await store.all(`SELECT w.website_id,
  (SELECT t.starts_at FROM timetable t WHERE t.offering_id=w.offering_id AND t.cancelled=0 ORDER BY t.starts_at DESC,t.session_id DESC LIMIT 1) latest_class
  FROM json_each(?) r JOIN websites w ON w.website_id=r.value`,[JSON.stringify([...purchased])]):[];
 const latest=new Map(dates.map(r=>[r.website_id,r.latest_class]));
 const purchasedCourses=items.filter(i=>purchased.has(i.websiteId)).map(i=>({key:i.key,label:i.title,href:'/studio/?website='+encodeURIComponent(id(i.websiteId)),cover:i.cover,latestClass:latest.get(i.websiteId)||null})).sort((a,b)=>(b.latestClass||0)-(a.latestClass||0)||a.label.localeCompare(b.label));
 return {academia:['alimiyah','reboot','arabic-intensive'].filter(k=>programmes.includes(k)).map(key=>({key,label:programmeLabels[key]})),mothers:programmes.includes('mothers'),hifz:programmes.includes('hifz')?'https://hifz.maktab4life.org/':null,tafseer:'/studio/?view=collections&collection=tafseer',shortCourses:items.filter(i=>permitted.has(i.websiteId)).map(i=>({label:i.title,href:'/studio/?website='+encodeURIComponent(id(i.websiteId))})),purchasedCourses};
}
