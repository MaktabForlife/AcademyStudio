import {fail,id,integer,text,month,date} from './protocol.mjs';
import {change} from './admin.mjs';
import {rejectAuthorityWrite} from './access.mjs';
import {newCourse} from '../public/shared/model.mjs';
import {saveContent} from './content.mjs';

const revisionSQL='COALESCE((SELECT revision FROM access_revisions WHERE offering_id=?),0)=?';
const revision=async(store,offer)=>(await store.first('SELECT revision FROM access_revisions WHERE offering_id=?',[offer]))?.revision||0;
const expected=(offer,value)=>({studio:true,expectedSQL:revisionSQL,expectedArgs:[offer,integer(value)]});
async function monthlyScope(store,actor,offer,{readOnly=false}={}){
 const scope=await store.scope(actor,offer,{admin:true,readOnly});
 if(scope.kind!=='TAFSEER')throw fail('Short courses use whole-course access, not monthly subscriptions.');
 await rejectAuthorityWrite(store,offer);return scope;
}
export function calendarYears(values){
 if(!Array.isArray(values)||!values.length||values.length>5||values.some(y=>!Number.isInteger(y)||y<1000||y>9999)||new Set(values).size!==values.length)throw fail('Choose up to five different calendar years.');
 return values.slice().sort();
}
export async function monthlyGrid(store,actor,offer,input){
 await monthlyScope(store,actor,offer,{readOnly:true});const current=await revision(store,offer),years=calendarYears(input.years),after=input.after?id(input.after):'',search=text(input.search||'',100);
 // Bound the member page before joining people or reading any historical rights.
 const page=await store.all(`WITH page AS MATERIALIZED (SELECT account_id FROM access_members WHERE offering_id=? AND account_id>? ORDER BY account_id LIMIT 26)
 SELECT p.account_id,a.display_name,a.active,a.admitted,
 (COALESCE(e.enrolled,0)=1 OR EXISTS(SELECT 1 FROM paid_months m WHERE m.offering_id=? AND m.account_id=p.account_id)
 OR EXISTS(SELECT 1 FROM website_months m WHERE m.offering_id=? AND m.account_id=p.account_id)
 OR EXISTS(SELECT 1 FROM websites w JOIN surah_grants g ON g.website_id=w.website_id AND g.account_id=p.account_id WHERE w.offering_id=?)) student
 FROM page p JOIN accounts a USING(account_id) LEFT JOIN participation e ON e.offering_id=? AND e.account_id=p.account_id ORDER BY p.account_id`,[offer,after,offer,offer,offer,offer]);
 const candidates=page.slice(0,25),rows=candidates.filter(r=>r.student&&(!search||(r.display_name+' '+r.account_id).toLowerCase().includes(search.toLowerCase()))),ids=JSON.stringify(rows.map(r=>r.account_id));
 const months=years.flatMap(y=>Array.from({length:12},(_,i)=>y+'-'+String(i+1).padStart(2,'0')));
 const paid=await store.all('SELECT account_id,month,cohort FROM paid_months WHERE offering_id=? AND account_id IN(SELECT value FROM json_each(?)) AND month IN(SELECT value FROM json_each(?)) ORDER BY account_id,month,cohort LIMIT 6001',[offer,ids,JSON.stringify(months)]);
 if(paid.length>6000)throw fail('Choose fewer years for this register.',409);
 if(current!==await revision(store,offer))throw fail('The register changed. Refresh before editing.',409,'CHANGE_CONFLICT');
 return {available:true,prepared:true,policy:{enabled:true,revision:current},canConfigure:false,years,students:rows.map(r=>({accountId:r.account_id,name:r.display_name,active:Boolean(r.active&&r.admitted),months:Object.fromEntries(months.flatMap(m=>{const cohorts=paid.filter(p=>p.account_id===r.account_id&&p.month===m).map(p=>p.cohort);return cohorts.length?[[m,{subscribed:true,revision:current,classIds:cohorts}]]:[];})),suggestedClassIds:{}})),after:page.length>25?candidates.at(-1).account_id:null};
}
export async function saveMonthlyGrid(env,store,actor,offer,input){
 await monthlyScope(store,actor,offer);
 const canonical={action:'monthly-grid-save',operationId:id(input.operationId),entries:input.entries,removalReason:input.removalReason||'',policyRevision:integer(input.policyRevision)},replay=await store.replay(actor.account_id,canonical.operationId,await store.requestHash(offer,canonical));if(replay)return replay;
 if(!Array.isArray(input.entries)||!input.entries.length||input.entries.length>240)throw fail('Save up to 240 month changes together.');
 const seen=new Set(),entries=input.entries.map(e=>{const accountId=id(e.accountId),m=month(e.month),k=JSON.stringify([accountId,m]);if(seen.has(k)||typeof e.subscribed!=='boolean')throw fail('Choose each student month once.');seen.add(k);return {...e,accountId,month:m};});
 const accounts=await store.all('SELECT a.account_id,a.active,a.admitted FROM json_each(?) j JOIN accounts a ON a.account_id=j.value',[JSON.stringify([...new Set(entries.map(e=>e.accountId))])]);
 if(accounts.length!==new Set(entries.map(e=>e.accountId)).size||entries.some(e=>e.subscribed&&!accounts.some(a=>a.account_id===e.accountId&&a.active&&a.admitted)))throw fail('Choose active registered students before adding paid months.');
 const existing=await store.all('SELECT p.account_id,p.month,p.cohort FROM json_each(?) j JOIN paid_months p ON p.offering_id=? AND p.account_id=json_extract(j.value,\'$.accountId\') AND p.month=json_extract(j.value,\'$.month\') LIMIT 6001',[JSON.stringify(entries.map(e=>({accountId:e.accountId,month:e.month}))),offer]);
 if(existing.length>6000)throw fail('Save a smaller register change.');
 const changes=entries.flatMap(e=>{
  // Removal uses the saved original cohorts; browser input cannot substitute them.
  const cohorts=e.subscribed?e.classIds:existing.filter(p=>p.account_id===e.accountId&&p.month===e.month).map(p=>p.cohort);
  if(!Array.isArray(cohorts)||!cohorts.length||cohorts.length>200||cohorts.some(c=>typeof c!=='string'||!c||c.length>180)||new Set(cohorts).size!==cohorts.length)throw fail('Choose the original classes covered by each paid month.');
  return cohorts.map(cohort=>({accountId:e.accountId,month:e.month,cohort,paid:e.subscribed,reason:input.removalReason||''}));
 });
 if(changes.length>240)throw fail('Save a smaller batch of months and classes.');
 const statements=await change(env,store,actor,offer,{action:'paid-months',changes},{collect:true});
 return store.mutate(actor,offer,canonical,statements,{saved:true},expected(offer,input.policyRevision));
}
export async function accessTable(store,actor,offer){
 const scope=await monthlyScope(store,actor,offer,{readOnly:true});if(scope.programme_key==='mothers')throw fail('MOU subject date editing is not available yet.',409,'MOU_TABLE_HELD');
 const current=await revision(store,offer);
 const rows=await store.all('SELECT website_id,title,completion_date,completion_month,revision,enabled,published_key FROM websites WHERE offering_id=? AND NOT EXISTS(SELECT 1 FROM mou_playlists p WHERE p.website_id=websites.website_id) ORDER BY website_id LIMIT 201',[offer]);
 if(rows.length>200)throw fail('This table needs a narrower website selector.',409);
 if(current!==await revision(store,offer))throw fail('The Surah table changed. Refresh before editing.',409,'CHANGE_CONFLICT');
 return {available:true,prepared:true,policyRevision:current,surahs:rows.map(r=>({id:r.website_id,name:r.title,completionDate:r.completion_date||'',completionMonth:r.completion_month,revision:r.revision,active:Boolean(r.enabled),eligibleStudents:null,hasDraft:true}))};
}
export async function saveAccessTable(env,store,actor,offer,input){
 const scope=await monthlyScope(store,actor,offer);if(scope.programme_key==='mothers')throw fail('MOU subject date editing is not available yet.',409,'MOU_TABLE_HELD');
 const canonical={action:'access-table-save',operationId:id(input.operationId),entries:input.entries,policyRevision:integer(input.policyRevision)},replay=await store.replay(actor.account_id,canonical.operationId,await store.requestHash(offer,canonical));if(replay)return replay;
 if(!Array.isArray(input.entries)||!input.entries.length||input.entries.length>40)throw fail('Save up to 40 table changes together.');
 const ids=new Set(),entries=input.entries.map(e=>{
  const key=id(e.id);if(ids.has(key))throw fail('Choose each website once.');ids.add(key);const name=text(e.name,160).trim();if(!name)throw fail('Enter a name for each row.');
  const completionDate=e.completionDate?date(e.completionDate):null;
  if(!completionDate)throw fail('Enter the Surah completion date.');
  if(completionDate&&completionDate>new Date().toISOString().slice(0,10))throw fail('Completion dates cannot be in the future.');
  return {id:key,name,completionDate,revision:integer(e.revision)};
 });
 const previous=await store.all('SELECT website_id,offering_id,completion_date,completion_month,revision FROM websites WHERE website_id IN(SELECT value FROM json_each(?))',[JSON.stringify([...ids])]);
 const total=await store.first('SELECT count(*) n FROM websites WHERE offering_id=?',[offer]);if(total.n+entries.filter(e=>!previous.some(r=>r.website_id===e.id)).length>200)throw fail('Keep up to 200 Surah websites.');
 const statements=[];
 for(const e of entries){
  const old=previous.find(r=>r.website_id===e.id);if(old&&old.offering_id!==offer)throw fail('Choose a website in this programme.',403);
  if((old?.revision||0)!==e.revision)throw fail('This row changed. Reopen the saved table.',409,'CHANGE_CONFLICT');
  // An undated legacy row keeps its saved qualifying month until Admin supplies a date.
  const completionMonth=e.completionDate?.slice(0,7)||old?.completion_month||null;
  if(old)statements.push(store.statement('UPDATE websites SET title=?,completion_date=?,completion_month=?,revision=revision+1 WHERE website_id=? AND offering_id=?',[e.name,e.completionDate,completionMonth,e.id,offer]));
  else {const doc=newCourse();doc.id=e.id;doc.name=e.name;doc.tag='TAFSEER AND TADABBUR';doc.lessons=[];doc.home={...doc.home,headline:e.name,subtitle:'',description:'',imageId:'',imageAlt:'',caption:'',journeyTitle:'',themes:[],recordingLayout:'podcast'};doc.pages={sessions:false,materials:false,assessments:false};doc.materials={intro:'',files:[]};const contentKey=await saveContent(env,doc,e.id);statements.push(store.statement('INSERT INTO websites(website_id,offering_id,title,completion_month,draft_key,published_key,enabled,revision,completion_date) VALUES(?,?,?,?,?,NULL,0,0,?)',[e.id,offer,e.name,completionMonth,contentKey,e.completionDate]),store.statement('INSERT INTO source_access_websites(website_id,offering_id,enabled) VALUES(?,?,1)',[e.id,offer]));}
 }
 return store.mutate(actor,offer,canonical,statements,{saved:true},expected(offer,input.policyRevision));
}
