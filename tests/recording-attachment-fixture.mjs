import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fixture} from './fixture.mjs';
import {newCourse} from '../public/shared/model.mjs';
import {prepareAttachments} from '../tools/prepare-recording-attachments.mjs';
import {mouSubjects} from '../public/shared/mou-subjects.mjs';
import {learnerCompanion} from '../public/shared/learner-companion.mjs';
export async function recordingAttachmentFixture({attach=true,offeringId='mou-local-recording-review',cohort='local-review'}={}){
 const root=resolve('../..'),f=await fixture({verification:{accountSeconds:43200,adminSeconds:60,liveSeconds:43200}}),offer=offeringId,packages=await prepareAttachments(root,resolve('local-content/recording-attachments'));
 try{
 await f.run("INSERT INTO offerings(offering_id,kind,title,active) VALUES(?,'TAFSEER','Mothers of the Ummah',1)",offer);
 await f.run("INSERT INTO source_access_scopes VALUES(?,'WEBSITE',1,1,1,0,'Africa/Johannesburg',?)",offer,JSON.stringify([cohort]));
 await f.run("INSERT INTO access_handovers VALUES(?,'local-only-review','COMMITTED',1,1,0,'',0,0)",offer);
 await f.run("INSERT INTO programme_offerings VALUES('mothers',?,'MONTHLY')",offer);
 for(const who of ['admin','learner','former','grant-only','outsider'])await f.run("INSERT INTO circles_navigation VALUES(?,1,?,'[\"mothers\"]')",who,Date.now());
 await f.run("INSERT INTO participation VALUES('learner',?,1,0,0,?)",offer,cohort);
 await f.run("INSERT INTO paid_months VALUES('learner',?,'2026-10',?,'Synthetic local review rights')",offer,cohort);
 const admin=(await f.login('admin')).cookie,learner=(await f.login('learner')).cookie,receipts=[];
 const native=async(path,input)=>{const response=await f.request(path,{cookie:admin,method:'POST',body:{operationId:crypto.randomUUID(),...input}});if(response.status!==200)throw Error(JSON.stringify({path,response:response.body}));return response;};
 const baqarah=JSON.parse(await readFile(resolve(root,'outputs/academy-release-1088-20261031/imports/mou-baqarah.json'),'utf8')),baqSite=baqarah.websiteId,key='websites/'+baqSite+'/versions/local-unchanged-baqarah.json';
 await f.content.put(key,JSON.stringify(baqarah.document));await f.run('INSERT INTO websites VALUES(?,?,?,NULL,?,?,0,1,NULL)',baqSite,offer,'Surah Al-Baqarah',key,key);
 await f.run("INSERT INTO programme_subjects VALUES(?,'surah-al-baqarah',?,1)",offer,baqSite);
 for(const a of baqarah.assets){const bytes=Buffer.from(a.base64,'base64'),key='local-baqarah-originals/'+a.assetId;await f.media.put(key,bytes);await f.run('INSERT INTO objects VALUES(?,?,?,?,?,?,NULL)',a.assetId,key,a.mimeType,a.filename,a.bytes,a.sha256);await f.run('INSERT INTO asset_owners VALUES(?,?)',a.assetId,offer);}
 for(const r of baqarah.recordings){await f.run('INSERT INTO objects VALUES(?,NULL,?,?,0,NULL,?)',r.assetId,'video/youtube',r.title,r.videoId);await f.run('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?,?,1)',r.attachmentId,offer,baqSite,r.assetId,r.lessonId,r.lessonDate,r.cohort,r.title,'RECORDING');await f.run('INSERT INTO paid_months VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING','learner',offer,r.lessonDate.slice(0,7),r.cohort,'Synthetic fixture for existing Baqarah');}
 const edition='local-unchanged-baqarah',support={format:'RECORDING_SUPPORT_V1',websiteId:baqSite,edition,...baqarah.recordingSupport};await f.content.put('local-baqarah-support.json',JSON.stringify(support));await f.run('INSERT INTO website_recording_support VALUES(?,?,?)',baqSite,edition,'local-baqarah-support.json');
 for(const item of (attach?packages.manifest.items:[]).filter(i=>i.owner==='STUDIO')){
  const lesson=packages.lessons.find(l=>l.id===item.editorialLessonId),websiteId='local-subject-'+item.subjectDisplayKey,assetId='local-asset-'+item.editorialLessonId,attachmentId='local-recording-'+item.editorialLessonId,title=mouSubjects.find(s=>s.key===item.subjectDisplayKey).title;
  const document=newCourse();document.id=websiteId;document.name=title;document.tag='MOTHERS OF THE UMMAH';document.home={...document.home,headline:title,subtitle:'',description:'',imageId:'',imageAlt:title,caption:'',journeyTitle:'',themes:[],recordingLayout:'podcast'};document.lessons=[];document.pages={sessions:false,materials:false,assessments:false};document.materials={intro:'',files:[]};
  await native('/api/admin/'+offer,{action:'website-create',websiteId,title,document});
  await native('/api/admin/'+offer,{action:'youtube',assetId,videoId:new URL(lesson.sourceURL).searchParams.get('v'),title:lesson.title});
  await native('/api/admin/'+offer,{action:'content-batch',changes:[{action:'attachment',assetId,attachmentId,websiteId,lessonId:'local-lesson-'+item.editorialLessonId,lessonDate:item.recordedDate,cohort,title:lesson.title,audience:'RECORDING',published:true}]});
  const published=await native('/api/websites/'+websiteId+'/edit',{action:'publish',revision:0});
  await native('/api/admin/'+offer,{action:'mou-subject',websiteId,displayKey:item.subjectDisplayKey,enabled:true});
  const input={action:'companion-save',attachmentId,revision:0,sourceRevision:item.sourceRevision,durationSeconds:item.durationSeconds,companion:lesson.draft},saved=await native('/api/admin/'+offer,input);
  const companionPublished=await native('/api/admin/'+offer,{action:'companion-publish',attachmentId,revision:saved.body.revision,sourceRevision:item.sourceRevision,draftKey:saved.body.draftKey});
  receipts.push({editorialLessonId:item.editorialLessonId,websiteId,assetId,attachmentId,localOnly:true,hostedAttached:false,localWriteBudget:{save:{queries:saved.queries,rowsRead:saved.reads,rowsWritten:Number(saved.response.headers.get('X-Local-D1-Rows-Written'))},publish:{queries:companionPublished.queries,rowsRead:companionPublished.reads,rowsWritten:Number(companionPublished.response.headers.get('X-Local-D1-Rows-Written'))}},expectedCompanion:learnerCompanion(lesson.draft)});
 }
 return {...f,offer,admin,learner,receipts,baqarah,packages,native};
 }catch(error){await f.close();throw error;}
}
