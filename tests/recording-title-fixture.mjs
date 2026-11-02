import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {seedPlaylistArtwork} from './playlist-card-fixture.mjs';
import {pendingMedia,reviewedCompanion,saveMediaDraft,publishMediaDraft} from '../public/shared/media-workflow.mjs';
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
export async function titleFixture({kind='COURSE',sourceKind='YOUTUBE',websiteOrigin='https://website.test'}={}){
 const f=await fixture({websiteOrigin,authorityMode:'ACADEMY',verification:{accountSeconds:43200,adminSeconds:60},nativeTeacherChoices:[{id:'native-teacher',name:'Checked Teacher'},{id:'teacher',name:'Another checked Teacher'}],nativeMediaClasses:[{id:'native-class',name:'Native class'}]});
 try{
 const offer=kind==='COURSE'?'course':'tafseer',path='/api/admin/'+offer,playlistId='title-playlist';if(kind==='MOU')await f.run("INSERT INTO programme_offerings VALUES('mothers','tafseer','MONTHLY')");
 await f.run("INSERT INTO source_access_scopes VALUES(?,'WEBSITE',1,1,1,1,'Africa/Johannesburg','[\"native-class\"]')",offer);await f.run("INSERT INTO access_handovers VALUES(?,'title-test-owner','COMMITTED',1,1,0,'',0,0)",offer);
 for(const account of ['admin','learner','teacher','outsider','former'])await f.run("INSERT INTO source_access_people VALUES(?,?,1,1,?,1,'[]',0,1)",account,offer,Date.now());
 const admin=(await f.login('admin')).cookie;await f.run("UPDATE sessions SET source_ref='native-synthetic-admin' WHERE account_id='admin'");
 const api=async(p,{body,method,headers={}}={})=>{if(body instanceof Blob){headers={'Content-Type':body.type,...headers};body=new Uint8Array(await body.arrayBuffer());}return ok(await f.request(p,{cookie:admin,method:method||(body?'POST':'GET'),body,headers}));};const post=body=>api(path,{body:{operationId:crypto.randomUUID(),...body}});
 let table=await api(path+'/playlists');await post({action:'mou-playlist-save',playlistId,name:'Title test playlist',closeDate:'',revision:table.revision,playlistRevision:0,websiteRevision:0});
 const companion=reviewedCompanion({summary:'Original recording summary.',topics:'00:00 Opening',durationSeconds:60,application:'Original application',lessonReference:'Original reference',imported:{transcript:'Keep this original transcript'}}),pending=pendingMedia({title:'Original recording title',sourceKind,...(sourceKind==='UPLOAD'?{recordingFile:new File([new Uint8Array([0,0,0,24]),'ftypmp42synthetic mp4 payload'],'recording.mp4',{type:'video/mp4'})}:{sourceURL:'https://youtu.be/abcdefghijk'}),teacherIds:['native-teacher'],playlistId,cohort:'native-class',lessonDate:kind==='COURSE'?'':'2024-01-11',durationSeconds:60,companion,supportingFiles:[new File(['%PDF-1.7\nLocal only\n%%EOF'],'support.pdf',{type:'application/pdf'})]});
 await saveMediaDraft({pending,api,path});let detail=await api(path+'/media-detail?attachment='+pending.attachmentId);await publishMediaDraft({detail,operations:{recording:crypto.randomUUID()},api,path});
 if(kind==='COURSE')await seedPlaylistArtwork(f,playlistId);table=await api(path+'/playlists');const row=table.playlists.find(r=>r.id===playlistId);await post({action:'mou-playlist-publication',playlistId,published:true,revision:table.revision,playlistRevision:row.revision,websiteRevision:row.websiteRevision});
 if(kind!=='COURSE')await post({action:'paid-months',changes:[{accountId:'learner',month:table.currentMonth,cohort:'native-class',paid:true}]});
 const learner=(await f.login('learner')).cookie,outsider=(await f.login('outsider')).cookie;await f.run("UPDATE sessions SET source_ref='native-synthetic-'||account_id WHERE account_id IN('learner','outsider')");
 const get=()=>api(path+'/media-detail?attachment='+pending.attachmentId),draft=(d,title='Revised recording title')=>({action:'media-companion-save',operationId:crypto.randomUUID(),attachmentId:d.attachmentId,title,attributionRevision:d.attributionRevision,revision:d.companionRevision,durationSeconds:d.durationSeconds,companion:{...d.companion,summary:'Revised recording summary.'}}),publish=d=>({action:'media-publication',operationId:crypto.randomUUID(),attachmentId:d.attachmentId,revision:d.attributionRevision,draftContext:d.draftContext,sourceRevision:d.sourceRevision,companionKey:d.companionDraftKey,companionRevision:d.companionRevision});
 const feed=async cookie=>f.request('/api/offerings/'+offer+'/media?website='+playlistId,{cookie});return {...f,offer,path,playlistId,pending,admin,learner,outsider,api,post,get,draft,publish,feed};
 }catch(error){await f.close();throw error;}
}
