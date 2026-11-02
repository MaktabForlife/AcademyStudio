import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {newCourse} from '../public/shared/model.mjs';
export async function monthlyMediaFixture(){
 const f=await fixture({verification:{accountSeconds:43200,adminSeconds:60},nativeTeacherChoices:[{id:'teacher',name:'Synthetic checked Teacher'}],nativeMediaClasses:[{id:'historic-cohort',name:'Original class'}]});
 try{
 await f.run("INSERT INTO programme_offerings VALUES('mothers','tafseer','MONTHLY')");
 await f.run("INSERT INTO programme_subjects VALUES('tafseer','surah-al-baqarah','site-surah',1)");
 await f.run("INSERT INTO source_access_scopes VALUES('tafseer','WEBSITE',1,1,1,1,'Africa/Johannesburg','[\"historic-cohort\"]')");
 const order=Array.from({length:26},(_,i)=>(i*7)%26),document=newCourse();document.name='Synthetic existing Baqarah';document.home.imageId='';document.materials.files=[{id:'original-notes',assetId:'shared-pdf',title:'Original notes PDF',description:'One shared original'}];
 document.lessons=order.map(i=>({id:'reading-'+i,title:'Reading '+i,sections:[{id:'section-'+i,title:'Original reading',blocks:[{id:'summary-'+i,type:'note',aside:true,sourceKey:'recording:lesson-'+i,attribution:'Recording '+i,text:'Specific summary for recording '+i},{id:'topics-'+i,type:'list',sourceKey:'recording-topics:lesson-'+i,items:['00:00 Reviewed opening']}]}]}));
 document.lessons.push({id:'second-reading',title:'Second reading',sections:[{id:'second-section',title:'Another reading',blocks:[{id:'second-summary',type:'note',aside:true,sourceKey:'recording:lesson-0',attribution:'Recording 0',text:'Second original reading'}]}]});
 const sourceKey='websites/site-surah/versions/'+('a'.repeat(64))+'.json';await f.content.put(sourceKey,JSON.stringify(document));await f.run('UPDATE websites SET draft_key=?,published_key=?,enabled=1 WHERE website_id=?',sourceKey,sourceKey,'site-surah');
 for(let i=0;i<26;i++){await f.run("INSERT INTO objects VALUES(?,NULL,'video/youtube',?,0,'fixture','abcdefghijk')",'source-'+i,'Source '+i);await f.run("INSERT INTO attachments VALUES(?,'tafseer','site-surah',?,?,?,'historic-cohort',?,'RECORDING',1)",'recording-'+String(i).padStart(2,'0'),'source-'+i,'lesson-'+i,'2024-01-'+String(1+i%28).padStart(2,'0'),'Recording '+i);await f.run("INSERT INTO asset_owners VALUES(?,'tafseer')",'source-'+i);}
 const pdfBytes=new TextEncoder().encode('%PDF-1.7\nSynthetic original shared PDF\n%%EOF');await f.media.put('original-shared.pdf',pdfBytes);
 await f.run("INSERT INTO objects VALUES('shared-pdf','original-shared.pdf','application/pdf','original.pdf',?,'fixture-pdf',NULL)",pdfBytes.length);await f.run("INSERT INTO attachments VALUES('original-pdf','tafseer','site-surah','shared-pdf','','','','Original notes PDF','WEBSITE',1)");await f.run("INSERT INTO published_assets VALUES('site-surah','shared-pdf')");await f.run("INSERT INTO asset_owners VALUES('shared-pdf','tafseer')");
 const admin=(await f.login('admin')).cookie;await f.run("UPDATE sessions SET source_ref='synthetic-native-admin' WHERE account_id='admin'");const path='/api/admin/tafseer',requests=[];
 const api=async(url,{body,method}={})=>{const r=await f.request(url,{cookie:admin,method:method||(body?'POST':'GET'),body});requests.push({url,method:method||(body?'POST':'GET'),reads:r.reads,queries:r.queries,status:r.status});if(r.status!==200)throw Object.assign(Error(r.body.error),{status:r.status,code:r.body.code});return r.body;};
 let table=await api(path+'/playlists');await api(path,{body:{action:'mou-playlist-save',operationId:crypto.randomUUID(),playlistId:'target-playlist',name:'Private MOU collection',closeDate:'',revision:table.revision,playlistRevision:0,websiteRevision:0}});
 const review=()=>api(path+'/existing-collection?website=site-surah');const publish=async()=>{const t=await api(path+'/playlists'),p=t.playlists.find(row=>row.id==='target-playlist');return api(path,{body:{action:'mou-playlist-publication',operationId:crypto.randomUUID(),playlistId:p.id,published:true,revision:t.revision,playlistRevision:p.revision,websiteRevision:p.websiteRevision}});};
 return {...f,order,document,admin,path,api,requests,review,publish,pdfBytes};
 }catch(error){await f.close();throw error;}
}
