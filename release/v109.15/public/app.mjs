import {recordingTextEditor} from './shared/recording-text-editor.mjs';
import {playlistMetadataEditor} from './shared/playlist-metadata-editor.mjs';
import {ensurePlaylistCardStyles} from './shared/playlist-card.mjs';
import {publishedPlaylistRows,presentPublishedPlaylists,playlistMediaQuery,mergePlaylistMediaPage} from './shared/published-playlists.mjs';
import {pinEntry} from './shared/pin-entry.mjs';
import {headerIcon} from './shared/header-icons.mjs';
import {installHeaderDates} from './shared/header-dates.mjs';
import {installProgrammeShell} from './shared/programme-shell.mjs';
import {dashboardHomeHref,readDashboardView,clearDashboardView,dashboardViewStorage,updateDashboardHomeLinks} from './shared/dashboard-home.mjs';
import {startReaderView,readerHasLiveSessions} from './shared/reader-startup.mjs';
import {protectAccountHistory} from './shared/account-history.mjs';
import {createMouClassroom,renderMouClassroom} from './shared/mou-classroom.mjs';
import {openAcademyFromCircles} from './shared/circles-sign-in.mjs';
import {applicationPath as websiteApplicationPath,collectionKind} from './shared/circles-routes.mjs';
const appPath=websiteApplicationPath(document);
import {circlesCatalogue} from './shared/circles-catalogue.mjs';
import {replaceTafseerArtwork,tafseerDisplayCourse,tafseerCourseCover} from './shared/tafseer-cover.mjs';
import {presentRecordingWebsite,seriesRecordings,seriesRoute,parseSeriesRoute} from './shared/recording-website.mjs';
import {bindRecordingGuides} from './shared/media-bindings.mjs';
import {localReviewStatus} from './shared/local-review-status.mjs';
import {recordingGuides,recordingStart,recordingTopicGuide,recordingMomentLink,companionPlayer,arrangeRecordingReading} from './shared/recording-companion.mjs';
import './shared/reading-focus.mjs';
import {exportDeviceLearning,importDeviceLearning} from './shared/device-learning.mjs';
import {combinedSessionCards,mediaButton,joinIsOpen} from './shared/lesson-media.mjs';
import {readerEditing} from './reader-editing.mjs';
import {api,mutate,identity,changed,downloadJSON} from './api.mjs';
import {esc} from './shared/model.mjs';import {renderCourse} from './shared/student.mjs';
const $=id=>document.getElementById(id);let current=null,assets=new Map(),urls=new Set(),ui=null,config=null,adminModule=null,generation=0;
let beforeEditing=null,delivery=null,joinTimer=null,mediaEpoch=0,activeRecording=null,managementHandoff=null,mouClassroomView=null;
const recordingPlayer=companionPlayer({workspace:$('reader-workspace'),panel:$('companion-player')});
const currentRecordingGuides=()=>bindRecordingGuides(recordingGuides(current?.document),delivery?.media||[],delivery?.bindings||[]);
const currentSeriesRecordings=()=>seriesRecordings({companions:delivery?.companions||[],details:delivery?.details||new Map(),media:delivery?.media||[],guides:currentRecordingGuides(),pendingIds:current?.canEdit&&current.localReview?.edition==='reviewDraft'?current.localReview.unmappedEditorialLessonIds:[]});
const freshDelivery=()=>({companions:[],details:new Map(),bindings:[],media:[],sessions:[],loaded:false,more:false,request:null,sessionRequest:null,serverOffset:0,playlist:null});
const textEditor=readerEditing({root:$('course-reader'),identity,api,current:()=>current,route:()=>ui,showDraft(record){document.querySelectorAll('[data-reader-toolbar]').forEach(node=>node.hidden=true);beforeEditing={record:current,ui:structuredClone(ui),assets};current={...record,canEdit:true};assets=new Map(record.assets.map(a=>[a.asset_id,{...a,id:a.asset_id,url:a.url+'?draft=1'}]));ui={...ui,route:['recording','about'].includes(ui.route)?'home':ui.route,isPreview:true,completed:[],reflections:{}};draw();},showPublished(){document.querySelectorAll('[data-reader-toolbar]').forEach(node=>node.hidden=false);if(beforeEditing){current=beforeEditing.record;ui=beforeEditing.ui;assets=beforeEditing.assets;beforeEditing=null;draw();}},async refresh(){const id=current.websiteId;beforeEditing=null;await openWebsite(id);}});
const recordingEditor=recordingTextEditor({api,identity,getCurrent:()=>current,onPublished:async()=>{delivery=freshDelivery();await loadMedia();draw();}});
const playlistEditor=playlistMetadataEditor({api,identity,getCurrent:()=>current,onPublished:async()=>{if(current)await openWebsite(current.websiteId);}});
const pins=pinEntry($('sign-in-form'));
installHeaderDates({programme:true});
function openSignIn(){pins.clear();$('sign-in-dialog').showModal();}
$('sign-in-dialog').addEventListener('close',()=>{pins.clear();$('sign-in-status').textContent='';});
const removeReaderToolbars=()=>document.querySelectorAll('[data-reader-toolbar]').forEach(node=>node.remove());
const canLeaveWorkspace=()=>recordingEditor.canLeave()&&playlistEditor.canLeave()&&textEditor.canLeave()&&(!$('administration')||$('administration').hidden||!adminModule?.canLeave||adminModule.canLeave());
const show=name=>{if(name==='administration')document.title='Studio Admin · Umm Abbad Academy';if(typeof programmeShell!=='undefined')programmeShell.setMode(name==='administration'?'admin':'learn');if(name!=='administration')adminModule?.close?.();if(name!=='my-learning')mouClassroomView?.clear();if(name!=='course-reader'){removeReaderToolbars();closeMedia();}$('reader-workspace').hidden=name!=='course-reader';for(const key of ['my-learning','course-reader','administration'])$(key).hidden=key!==name;};
const status=message=>$('status').textContent=message;
const time=value=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
function closeMedia(){mediaEpoch++;activeRecording=null;recordingPlayer.close();for(const video of $('media-body').querySelectorAll('video'))video.pause();$('media-body').replaceChildren();$('media-dialog').close();}
function clear(){recordingEditor.clear();playlistEditor.clear();programmeShell.update(null);mouClassroomView?.clear();managementHandoff?.close();pins.clear();clearTimeout(joinTimer);closeMedia();removeReaderToolbars();textEditor.clear();beforeEditing=null;generation++;delivery=null;current=null;ui=null;for(const url of urls)URL.revokeObjectURL(url);urls.clear();assets.clear();$('course-reader').replaceChildren();$('learning-cards').replaceChildren();$('administration').replaceChildren();$('account-name').textContent='';$('account-menu').open=false;$('account-menu').hidden=true;$('sign-in-button').hidden=false;$('sign-out-button').hidden=true;$('manage-button').hidden=true;$('academy-button').hidden=true;show('my-learning');}
protectAccountHistory({window,identity,clear});
window.addEventListener('website-account-changed',()=>{recordingEditor.clear();playlistEditor.clear();clearDashboardView(dashboardViewStorage());mouClassroomView?.clear();if(new URLSearchParams(location.search).get('classroom')==='mothers')$('learning-cards').replaceChildren();managementHandoff?.close();textEditor.clear();beforeEditing=null;});
window.addEventListener('website-session-ended',event=>{clearDashboardView(dashboardViewStorage());clear();if(event.detail?.externalAccountChange){location.reload();return;}status('Your session changed. Sign in to Academy to continue.');});
async function profile(checked){try{const me=checked||await api('/api/me',{optionalSession:!identity.account});identity.account=me;programmeShell.update(me);$('account-name').textContent=me.displayName;$('account-menu').hidden=false;$('sign-in-button').hidden=true;$('sign-out-button').hidden=false;$('manage-button').hidden=false;$('academy-button').hidden=false;return me;}catch(error){if(error.status===401)programmeShell.update(null);return null;}}
let catalogueItems=[];
const isMouRoute=()=>{const params=new URLSearchParams(location.search);return appPath==='/studio/'&&params.get('classroom')==='mothers'&&!params.has('website')&&!$('my-learning').hidden;};
mouClassroomView=createMouClassroom({request:api,identity,isCurrent:isMouRoute,onChange:view=>{$('learning-cards').className='';$('learning-cards').innerHTML=renderMouClassroom(view);updateDashboardHomeLinks(document,identity.account);},navigate:destination=>location.assign(destination)});
async function catalogue(root,isCurrent=()=>true){
 const data=await api('/api/public/circles');if(!isCurrent())return false;catalogueItems=data.items;if(!catalogueItems.length)return false;
 let rights=[];if(identity.account){const ids=[...new Set(catalogueItems.map(i=>i.websiteId).filter(Boolean))];for(let i=0;i<ids.length;i+=50){const params=new URLSearchParams();for(const id of ids.slice(i,i+50))params.append('website',id);rights.push(...(await api('/api/circles/access?'+params)).websites);if(!isCurrent())return false;}}
 $('my-learning').querySelector('h1').textContent=new URLSearchParams(location.search).get('collection')==='courses'?'Courses':'Tafseer and Tadabbur';document.title=(new URLSearchParams(location.search).get('collection')==='courses'?'Courses':'Tafseer')+' · Umm Abbad Academy';root.className='connected-circles collection-card-only';root.innerHTML=circlesCatalogue(catalogueItems,rights,{applicationPath:appPath,kind:collectionKind(new URLSearchParams(location.search).get('collection'))});document.body.classList.add('has-circles-catalogue');return true;
}
async function library(checked=null){
 if(!canLeaveWorkspace())return;
 textEditor.clear();beforeEditing=null;clearTimeout(joinTimer);generation++;delivery=null;current=null;ui=null;
 for(const url of urls)URL.revokeObjectURL(url);urls.clear();assets.clear();$('course-reader').replaceChildren();
 show('my-learning');document.body.classList.remove('has-circles-catalogue');
 $('my-learning').classList.toggle('mou-active',new URLSearchParams(location.search).get('classroom')==='mothers');
 if(new URLSearchParams(location.search).get('classroom')==='mothers'){
  document.title='Mothers of the Ummah · Umm Abbad Academy';
  if(!identity.account){mouClassroomView.clear();$('learning-cards').replaceChildren();openSignIn();return;}
  status('');return mouClassroomView.load({checked:checked?.classroom,checkedError:checked?.errors?.classroom});
 }
 mouClassroomView.clear();$('learning-cards').replaceChildren();
 if(new URLSearchParams(location.search).get('view')!=='collections')history.pushState(null,'',appPath+'?view=collections');
 const key=generation,accountGeneration=identity.generation,route=location.pathname+location.search;
 const isCurrent=()=>key===generation&&accountGeneration===identity.generation&&route===location.pathname+location.search&&!$('my-learning').hidden;
 const locationQuery=new URLSearchParams(location.search),placed=locationQuery.has('placement')||locationQuery.has('placementOffering');const hasCatalogue=placed?false:await catalogue($('learning-cards'),isCurrent);if(!isCurrent())return;
 if(!identity.account){if(!hasCatalogue)openSignIn();return;}
 const root=$('learning-cards');if(!hasCatalogue){root.className='connected-circles collection-card-only';root.innerHTML=circlesCatalogue([],[],{applicationPath:appPath,kind:collectionKind(new URLSearchParams(location.search).get('collection'))});document.body.classList.add('has-circles-catalogue');}
 const pages={playlists:[],websites:[],more:false,busy:false};
 async function loadPublished(more=false){
  if(pages.busy||!isCurrent())return;pages.busy=true;
  try{const after=more?pages.websites.at(-1)?.website_id:null,query=new URLSearchParams({published:'1'});if(after)query.set('after',after);for(const name of ['placement','placementOffering','class'])if(locationQuery.has(name))query.set(name,locationQuery.get(name));
   const response=await api('/api/websites?'+query);if(!isCurrent())return;
   const next=publishedPlaylistRows(response.playlists);pages.playlists=[...new Map([...pages.playlists,...next].map(row=>[row.id,row])).values()];pages.websites=[...new Map([...pages.websites,...response.websites].map(row=>[row.website_id,row])).values()];pages.more=response.more===true&&Boolean(pages.websites.at(-1)?.website_id);
   presentPublishedPlaylists(root,{...pages,known:catalogueItems,onMore:()=>loadPublished(true).catch(error=>{if(isCurrent())status(error.message);})});
  }finally{pages.busy=false;}
 }
 await loadPublished();
}
const deviceKey=()=>`website-learning:${identity.account.accountId}:${current.websiteId}`;
function remember(){if(textEditor.editing)return;try{localStorage.setItem(deviceKey(),JSON.stringify({completed:ui.completed,reflections:ui.reflections,readingSize:ui.readingSize}));}catch{status('Browser storage is unavailable. Export your reflections before closing.');}}
const presentationCourse=()=>({...current.document,displayIdentity:{...current.presentation,kind:current.presentation?.kind||current.kind,programmeKey:current.programmeKey||current.presentation?.programmeKey}});
const liveTimetableAvailable=()=>readerHasLiveSessions(current);
function settleReaderRoute(){if(!textEditor.editing&&ui?.route==='sessions'){ui.route='home';history.replaceState(null,'',location.pathname+location.search+'#'+seriesRoute('home'));}}
function draw(){if(!current||!identity.account)return;settleReaderRoute();const panel=$('companion-player');panel.remove();$('course-reader').innerHTML=renderCourse({...tafseerDisplayCourse(presentationCourse()),home:{...current.document.home,recordingLayout:current.document.home.recordingLayout||'podcast'},pages:{...current.document.pages,assessments:false}},ui,assets);if(!textEditor.editing)presentRecordingWebsite($('course-reader'),{course:presentationCourse(),pages:{...current.document.pages,sessions:liveTimetableAvailable()},ui,assets,entries:currentSeriesRecordings(),resources:current.playlistResources||[],guides:recordingGuides(current.document),loaded:delivery.loaded,more:delivery.more});($('course-reader').querySelector('.rs-player-slot')||$('reader-workspace')).append(panel);document.title=(ui.route==='recording'?(currentSeriesRecordings().find(e=>e.id===ui.recordingId)?.title||'Recording')+' · ':ui.route==='lesson'?(current.document.lessons.find(l=>l.id===ui.lessonId)?.title||'Read')+' · ':'')+tafseerDisplayCourse(presentationCourse()).name;replaceTafseerArtwork($('course-reader'),presentationCourse());textEditor.draw();renderDelivery();if(textEditor.editing)for(const control of $('course-reader').querySelectorAll('[data-sp-note]'))control.disabled=true;void loadImages();}
async function loadImages(){const key=generation,images=$('course-reader').querySelectorAll('img[data-course-image]');for(const image of images){const asset=assets.get(image.dataset.courseImage);if(!asset||!asset.type.startsWith('image/'))continue;if(!asset.blobURL){try{asset.imageRequest||=api(asset.url,{blob:true}).then(blob=>{if(key!==generation)return;asset.blobURL=URL.createObjectURL(blob);urls.add(asset.blobURL);}).finally(()=>{asset.imageRequest=null;});await asset.imageRequest;if(key!==generation)return;}catch(error){if(key===generation)status(error.message);continue;}}if(asset.blobURL)image.src=asset.blobURL;}}
async function openWebsite(websiteId,returnLesson,checked=null,checkedError=null){if(!canLeaveWorkspace())return;recordingEditor.clear();playlistEditor.clear();mouClassroomView?.clear();if(isMouRoute())$('learning-cards').replaceChildren();closeMedia();textEditor.clear();beforeEditing=null;removeReaderToolbars();if(!identity.account){const same=new URLSearchParams(location.search).get('website')===websiteId;if(!same)history.pushState(null,'',appPath+'?website='+encodeURIComponent(websiteId));openSignIn();return;}generation++;for(const url of urls)URL.revokeObjectURL(url);urls.clear();const key=generation,requestedEdition=new URLSearchParams(location.search).get('edition');if(checkedError)throw Object.assign(Error(checkedError.message),checkedError);const record=checked||await api('/api/websites/'+encodeURIComponent(websiteId)+(requestedEdition==='published'?'?edition=published':''));if(key!==generation)return;current=record;programmeShell.allowAdmin(record.canEdit===true);assets=new Map(record.assets.map(a=>[a.asset_id,{...a,id:a.asset_id}]));delivery=freshDelivery();delivery.initial=record.initialMedia||null;clearTimeout(joinTimer);let saved={};try{saved=JSON.parse(localStorage.getItem(deviceKey())||'{}');}catch{}
 ui={portal:true,route:'home',lessonId:record.document.lessons[0]?.id,readingSize:Math.max(16,Math.min(24,Number(saved.readingSize)||18)),completed:Array.isArray(saved.completed)?saved.completed.filter(id=>record.document.lessons.some(l=>l.id===id)):[],reflections:saved.reflections&&typeof saved.reflections==='object'?saved.reflections:{},sessionsHTML:'<p>Select Sessions to load the published timetable.</p>',nativeMaterialsHTML:'',journalEligible:false};
 const sameWebsite=new URLSearchParams(location.search).get('website')===websiteId;Object.assign(ui,sameWebsite?parseSeriesRoute(location.hash):{route:'home'});
 const requestedLesson=returnLesson??new URLSearchParams(location.search).get('lesson');if((sameWebsite||returnLesson)&&requestedLesson&&record.document.lessons.some(l=>l.id===requestedLesson)){ui.route='lesson';ui.lessonId=requestedLesson;}
 show('course-reader');history[sameWebsite?'replaceState':'pushState'](null,'',appPath+'?website='+encodeURIComponent(websiteId)+(requestedEdition==='published'?'&edition=published':'')+'#'+seriesRoute(ui.route,ui.route==='recording'?ui.recordingId:ui.route==='lesson'?ui.lessonId:''));status('');draw();
 const toolbar=document.createElement('nav');toolbar.className='toolbar reader-tools';toolbar.setAttribute('aria-label','Website tools');toolbar.innerHTML='<details><summary>Website tools</summary><div>'+(record.canEdit?'<span class=website-edition>Published edition '+esc(record.publishedVersion?.slice(0,10)||'on file')+'</span>':'')+'<button data-library>Academy Library ↗</button><button data-device-export>Export reading progress & reflections</button><button data-device-import>Import device learning</button></div></details>';$('account-panel').append(toolbar);toolbar.dataset.readerToolbar='';
 if(liveTimetableAvailable())void loadTimetable().then(()=>{if(key===generation)draw();}).catch(error=>status(error.message));
 if(ui.route==='sessions')void sessions();else if(ui.route==='materials')void materials().catch(error=>status(error.message));else void loadMedia().then(async()=>{if(key!==generation)return;draw();if(ui.route==='recording'){const entry=currentSeriesRecordings().find(e=>e.id===ui.recordingId);if(entry?.row)await openMaterial('/api/media/'+entry.row.attachment_id,entry.row.type,entry.title,0,false);}}).catch(error=>status(error.message));
}
function renderDelivery(){
 if(!current||!delivery||!ui||textEditor.editing)return;
 if(current.canEdit){ensurePlaylistCardStyles(document,'/_assets/e7c21ff946ca2eb384a94fa96f413c37f4a5349fcffb03faaabb46d06648654b/shared/playlist-card.css');const tools=$('course-reader').querySelector('.rs-series-tools');const exactPlaylistId=delivery.playlist?.id||current.playlistId;if(tools&&exactPlaylistId&&!tools.querySelector('[data-edit-playlist]'))tools.insertAdjacentHTML('afterbegin','<button type="button" data-edit-playlist="'+esc(exactPlaylistId)+'">Edit playlist</button>');if(ui.route==='recording'){const entry=currentSeriesRecordings().find(row=>row.id===ui.recordingId);if(entry?.row&&!$('course-reader').querySelector('[data-edit-recording-text]'))$('course-reader').querySelector('.rs-episode-heading')?.insertAdjacentHTML('beforeend','<button type="button" data-edit-recording-text="'+esc(entry.row.attachment_id)+'">Edit recording text</button>');}else if(ui.route==='home')for(const card of $('course-reader').querySelectorAll('.rs-episode-card')){const id=card.querySelector('[data-sp=recording]')?.dataset.id,entry=currentSeriesRecordings().find(row=>row.id===id);if(entry?.row&&!card.querySelector('[data-edit-recording-text]'))card.querySelector('.rs-card-actions')?.insertAdjacentHTML('beforeend','<button type="button" data-edit-recording-text="'+esc(entry.row.attachment_id)+'">Edit recording text</button>');}}
 if(current.kind==='COURSE'&&ui.route==='home'){const tools=$('course-reader').querySelector('.rs-series-tools');if(tools)tools.insertAdjacentHTML('beforeend','<a href="/studio/?view=collections&amp;collection=courses&amp;placementOffering='+encodeURIComponent(current.offeringId)+'">Course playlists</a>');}
 const reviewNotice=localReviewStatus(current);if(reviewNotice)$('course-reader').querySelector('.sp-page')?.insertAdjacentHTML('afterbegin',reviewNotice);

 const now=Date.now()+delivery.serverOffset,live=delivery.sessions.find(session=>joinIsOpen(session,now)),sessionRows=$('course-reader').querySelector('[data-rs-live-sessions]'),upcoming=delivery.sessions.filter(session=>session.ends_at>now).sort((a,b)=>a.starts_at-b.starts_at);
 if(sessionRows){sessionRows.innerHTML=upcoming.length?combinedSessionCards({sessions:upcoming,now}):'';const count=$('course-reader').querySelector('.rs-list-heading>span');if(count&&upcoming.length)count.textContent=currentSeriesRecordings().length+' recordings · '+upcoming.length+' upcoming/live '+(upcoming.length===1?'session':'sessions');}
 if(live)for(const row of $('course-reader').querySelectorAll('.sp-row-actions,.sp-sidebar')){if(!row.querySelector('[data-join]')){const button=document.createElement('button');button.className='sp-primary';button.dataset.join=live.session_id;button.textContent='Join now';row.append(button);}}
 if(ui.route==='lesson'){
  const sourceLessons=new Set(currentRecordingGuides().filter(guide=>guide.readingId===ui.lessonId).map(guide=>guide.lessonId));const files=delivery.media.filter(row=>row.lesson_id===ui.lessonId||sourceLessons.has(row.lesson_id));
  const guides=currentRecordingGuides(),shown=arrangeRecordingReading({root:$('course-reader'),guides:currentRecordingGuides().filter(guide=>guide.readingId===ui.lessonId),media:files});for(const quote of $('course-reader').querySelectorAll('[data-recording-quote]')){quote.querySelector('cite')?.remove();const guide=guides.find(guide=>(guide.editorialLessonId||guide.lessonId)===quote.dataset.recordingQuote),row=files.find(row=>row.lesson_id===guide?.lessonId&&['video/youtube','video/mp4'].includes(row.type));if(row)quote.insertAdjacentHTML('beforeend',recordingMomentLink(row,guide?.quote?.timestamp));}
  const shownTopics=new Set();for(const list of $('course-reader').querySelectorAll('[data-recording-topics]')){const guide=guides.find(guide=>(guide.editorialLessonId||guide.lessonId)===list.dataset.recordingTopics),row=files.find(row=>row.lesson_id===guide?.lessonId&&['video/youtube','video/mp4'].includes(row.type)),html=recordingTopicGuide(row,guide?.topics);if(html){const holder=document.createElement('div');holder.innerHTML=html;list.replaceWith(holder.firstElementChild);shownTopics.add(row.lesson_id);}else list.hidden=true;}
  const remaining=files.filter(row=>row.type!=='application/pdf'&&!shown.has(row.attachment_id));if(remaining.length){const article=$('course-reader').querySelector('.sp-lesson-article');if(article){const section=document.createElement('section');section.className='sp-lesson-linked-media';section.setAttribute('aria-label','Lesson recordings and notes');section.innerHTML='<h2>Lesson recordings & notes</h2><div class="sp-lesson-media">'+remaining.map(row=>mediaButton(row)+(shownTopics.has(row.lesson_id)?'':recordingTopicGuide(row,guides.find(guide=>guide.lessonId===row.lesson_id)?.topics))).join('')+'</div>';article.after(section);}}
 }
}
async function loadMedia({more=false}={}){
 const bound=delivery,key=generation;if(!bound||bound.request)return bound?.request;
 if(bound.loaded&&!more)return;
 const params=playlistMediaQuery(current.websiteId,{after:more?bound.media.at(-1)?.attachment_id:'',playlist:bound.playlist});
 bound.request=(bound.initial&&!more?Promise.resolve(bound.initial):api('/api/offerings/'+current.offeringId+'/media?'+params)).then(async data=>{bound.initial=null;if(key!==generation||delivery!==bound)return;const page=mergePlaylistMediaPage(bound,data,{more});bound.playlist=page.playlist;bound.companions=[...new Map([...bound.companions,...(data.companions||[])].map(c=>[c.attachmentId,c])).values()];bound.media=page.media;bound.bindings=[...new Map([...bound.bindings,...(data.mediaBindings||[])].map(b=>[JSON.stringify([b.editorialLessonId,b.nativeLessonId,b.assetId]),b])).values()];bound.more=data.more;bound.loaded=true;if(ui?.route==='recording'&&bound.companions.some(c=>c.attachmentId===ui.recordingId)&&!bound.details.has(ui.recordingId)){const id=ui.recordingId,value=await api('/api/media/'+encodeURIComponent(id)+'/companion');if(key!==generation||delivery!==bound)return;bound.details.set(id,value);}}).finally(()=>{bound.request=null;});
 return bound.request;
}
async function loadTimetable(){
 if(!liveTimetableAvailable())return;const bound=delivery,key=generation;if(!bound)return;
 return bound.sessionRequest||=api('/api/offerings/'+current.offeringId+'/sessions').then(data=>{if(key!==generation)return;bound.sessions=data.sessions;bound.serverOffset=data.serverTime-Date.now();scheduleJoinBoundary();}).catch(error=>{if(error.status===403)return;bound.sessionRequest=null;throw error;});
}
function scheduleJoinBoundary(){clearTimeout(joinTimer);if(!delivery)return;const now=Date.now()+delivery.serverOffset,next=delivery.sessions.flatMap(row=>[row.starts_at-300_000,row.ends_at]).filter(time=>time>now).sort((a,b)=>a-b)[0];if(next)joinTimer=setTimeout(()=>{draw();scheduleJoinBoundary();},Math.min(next-now+50,2_147_483_647));}
async function sessions(){
 const bound=delivery,key=generation;if(!bound)return;
 const timetable=loadTimetable();
 try{await Promise.all([loadMedia(),timetable]);if(key!==generation)return;
  ui.sessionsHTML='<h1 class="sp-page-title">Sessions & recordings</h1>'+combinedSessionCards({sessions:bound.sessions,media:bound.media,now:Date.now()+bound.serverOffset})+(!bound.sessions.length&&!bound.media.length?'<p>No session materials are available for this website yet.</p>':'')+(bound.more?'<button data-more-media>Load more lessons</button>':'');draw();
 }catch(error){if(key===generation){ui.sessionsHTML='<p>'+esc(error.message)+'</p>';draw();}}
}
async function materials(){await loadMedia();const shown=new Set(current.document.materials.files.map(file=>file.assetId));ui.nativeMaterialsHTML=delivery.media.filter(row=>{if(row.type!=='application/pdf'||shown.has(row.asset_id))return false;shown.add(row.asset_id);return true;}).map(row=>`<article class="sp-material"><h2>${esc(row.title)}</h2>${mediaButton(row,{download:true})}</article>`).join('')+(delivery.more?'<button data-more-media>Load more materials</button>':'');draw();}
async function downloadMaterial(path,name){const key=generation,blob=await api(path,{blob:true});if(key!==generation)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name||'Course material.pdf';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function openMaterial(path,type,name,start=0,autoplay=true){
 if(type==='application/pdf')return downloadMaterial(path,(name||'Course material').replace(/\.pdf$/i,'')+'.pdf');
 start=recordingStart(start);
 // Seeking within the recording already playing reuses its authorised source,
 // just like the native seek bar; it does not query permissions per topic.
 if(activeRecording?.path===path&&activeRecording.type===type&&activeRecording.element.isConnected){const element=activeRecording.element;if(type==='video/youtube'){const url=new URL(element.src);url.searchParams.set('start',String(start));element.src=url.href;}else {element.currentTime=start;void element.play().catch(()=>status('Press Play in the recording player to start playback.'));}return;}
 closeMedia();const key=generation,opening=mediaEpoch;let element;
 if(type==='video/youtube'){const data=await api(path);element=document.createElement('iframe');if(!/^[A-Za-z0-9_-]{11}$/.test(data.videoId))throw Error('This recording link needs review.');element.src='https://www.youtube-nocookie.com/embed/'+data.videoId+'?playsinline=1&autoplay='+(autoplay?'1':'0')+'&start='+start;element.allow='autoplay; fullscreen; picture-in-picture';element.referrerPolicy='strict-origin-when-cross-origin';}
 else if(type==='video/mp4'){element=document.createElement('video');element.controls=true;element.autoplay=autoplay;element.src=path;if(start)element.addEventListener('loadedmetadata',()=>{element.currentTime=Math.min(start,Number.isFinite(element.duration)?Math.max(0,element.duration-.1):start);},{once:true});}
 else {const key=generation,blob=await api(path,{blob:true});if(key!==generation)return;const objectURL=URL.createObjectURL(blob);urls.add(objectURL);element=document.createElement('img');element.src=objectURL;}
 if(key!==generation||opening!==mediaEpoch||!identity.account)return;
 element.title=name||'Course material';if(type.startsWith('video/')){recordingPlayer.open(element,name,{recordingId:currentSeriesRecordings().find(e=>'/api/media/'+e.row?.attachment_id===path)?.id});activeRecording={path,type,element};if(type==='video/mp4'&&autoplay)void element.play().catch(()=>status('Press Play in the recording player to start playback.'));else status('Use the recording player’s Play control if playback does not start.');return;}$('media-body').append(element);$('media-dialog').showModal();
}
$('sign-in-form').addEventListener('submit',async event=>{event.preventDefault();if(!pins.validate())return;const form=event.target,button=form.querySelector('button');button.disabled=true;$('sign-in-status').textContent='Checking your Academy account…';const fields=new FormData(form);pins.clear();try{const verifier=token(),state=token(),challenge=base64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));const response=await api('/auth/login',{body:{uniqueid:fields.get('uniqueid'),pin:fields.get('pin'),challenge,state,...(form.dataset.setup==='1'?{setup:true,pinConfirmation:fields.get('pinConfirmation')}:{})}});await api('/auth/exchange',{body:{code:response.code,verifier,state}});form.reset();pins.clear();delete form.dataset.setup;$('pin-confirm-label').hidden=true;form.elements.pinConfirmation.required=false;clear();const me=await profile();changed(me);$('sign-in-dialog').close();const destination=new URLSearchParams(location.search).get('website');if(destination)await openWebsite(destination);else if(new URLSearchParams(location.search).get('manage')==='1')$('manage-button').click();else if(new URLSearchParams(location.search).get('destination')==='academy'){show('my-learning');status('Signed in. Select Open Academy to continue.');}else await library();}catch(error){if(error.code==='PIN_NOT_SET'){form.dataset.setup='1';$('pin-confirm-label').hidden=false;form.elements.pinConfirmation.required=true;$('sign-in-status').textContent='Enter your PIN again and confirm it to set up this Academy account.';}else $('sign-in-status').textContent=error.message;}finally{button.disabled=false;}});
const base64=buffer=>btoa(String.fromCharCode(...new Uint8Array(buffer))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');const token=()=>base64(crypto.getRandomValues(new Uint8Array(32)));
$('sign-in-button').onclick=()=>openSignIn();$('close-sign-in').onclick=()=>$('sign-in-dialog').close();$('home-button').onclick=()=>{if(!canLeaveWorkspace())return;const destination=identity.account?dashboardHomeHref(readDashboardView(dashboardViewStorage(),identity.account.accountId)):'/';programmeShell.noteNavigation?.(destination);location.assign(destination);};$('my-websites').onclick=()=>{if(new URLSearchParams(location.search).has('classroom'))history.pushState(null,'',appPath+'?view=collections');return library().catch(e=>status(e.message));};
$('sign-out-button').onclick=async()=>{try{await api('/auth/logout',{body:{}});}finally{changed(null);clear();if(appPath==='/studio/')location.assign('/');}};
$('header-home-button').onclick=()=>$('home-button').click();
$('header-refresh-button').onclick=()=>{if(canLeaveWorkspace())location.reload();};
for(const [id,icon,label]of [['header-home-button','home','Home · Return to your dashboard'],['header-refresh-button','refresh','Refresh this page']]){$(id).innerHTML=headerIcon(icon);$(id).setAttribute('aria-label',label);}
const programmeShell=installProgrammeShell({canLeave:canLeaveWorkspace,checkAdministration:async()=>{adminModule||=await import('./admin.mjs');return (await adminModule.managementOfferings()).length>0;}});
document.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||!event.target.closest('[data-circles-dashboard-home]'))return;event.preventDefault();event.stopImmediatePropagation();$('home-button').click();},true);
function openAcademy(libraryContext){
 if(config?.isolatedPreview){status('Academy Library is disconnected in this preview. The live Academy is unchanged.');return;}
 const child=window.open(config.academyOrigin+'/academy/website-platform/connect/','_blank');if(!child){status('Allow this window to open, then select Academy again.');return;}
 let connected=false,watch;const finish=()=>{window.removeEventListener('message',listener);clearInterval(watch);};
 const listener=async event=>{if(event.source!==child||event.origin!==config.academyOrigin)return;
  if(event.data?.type==='ACADEMY_WEBSITE_RETURN'&&libraryContext&&connected){try{
   if(!current||current.websiteId!==libraryContext.websiteId||libraryContext.lessonId&&ui.lessonId!==libraryContext.lessonId){if(!canLeaveWorkspace())return;await openWebsite(libraryContext.websiteId,libraryContext.lessonId);}
   window.focus();child.postMessage({type:'WEBSITE_LIBRARY_RETURNED'},config.academyOrigin);finish();}catch(error){status(error.message);}return;
  }
  if(event.data?.type!=='ACADEMY_WEBSITE_CHALLENGE'||connected)return;connected=true;
  try{const {state,challenge}=event.data,result=await api('/auth/academy',{body:{state,challenge,...(libraryContext?{library:libraryContext}:{})}});child.postMessage({type:'WEBSITE_ACADEMY_CODE',state,code:result.code},config.academyOrigin);if(!libraryContext)finish();}catch(error){status(error.message);finish();}
 };window.addEventListener('message',listener);watch=setInterval(()=>{if(child.closed)finish();},1000);
 setTimeout(()=>{if(!connected)finish();},60_000);
}
$('academy-button').onclick=()=>openAcademy();
$('manage-button').onclick=async()=>{if(!canLeaveWorkspace())return;textEditor.clear();beforeEditing=null;const actor=identity.generation,view=++generation;try{adminModule||=await import('./admin.mjs');const selection=new URLSearchParams(location.search),result=await adminModule.open($('administration'),{offeringId:selection.get('offering'),section:selection.get('section')});if(actor!==identity.generation||view!==generation)return;if(!result?.hasScope){status('No Studio administration scope is available for this account.');return;}programmeShell.allowAdmin(true);show('administration');const destination=appPath+'?manage=1'+(selection.get('offering')?'&offering='+encodeURIComponent(selection.get('offering')):'')+(selection.get('section')?'&section='+encodeURIComponent(selection.get('section')):'');if(location.pathname+location.search!==destination)history.pushState(null,'',destination);}catch(error){if(actor===identity.generation&&view===generation){if(error.status===401||error.status===403){adminModule?.invalidateManagement?.();adminModule?.close?.();programmeShell.allowAdmin(false);show('my-learning');}status(error.message);}}};
$('close-media').onclick=closeMedia;
$('media-dialog').addEventListener('cancel',closeMedia);
document.addEventListener('click',event=>{
 if(event.target.closest('.site-header a,.programme-dashboard-bar a')&&!canLeaveWorkspace()){event.preventDefault();return;}
 if(event.target.closest('[data-mou-refresh]')){event.preventDefault();void mouClassroomView.load({refresh:true});return;}
 const mouJoin=event.target.closest('[data-mou-join]');if(mouJoin){event.preventDefault();void mouClassroomView.join(mouJoin.dataset.mouJoin);return;}
 const participantsTable=event.target.closest('[data-participants-table]');if(participantsTable){event.preventDefault();if(!canLeaveWorkspace()||!identity.account||config?.isolatedPreview)return;managementHandoff?.close();managementHandoff=openAcademyFromCircles({academyOrigin:config.academyOrigin,request:api,dashboard:{mode:'admin',tool:'participants',offeringId:participantsTable.dataset.participantsTable},onError:status});return;}
 if(event.target.closest('[data-academy-management]')){event.preventDefault();if(!canLeaveWorkspace())return;if(!identity.account){openSignIn();return;}if(config?.isolatedPreview){status('Academy management is disconnected in this preview.');return;}managementHandoff?.close();managementHandoff=openAcademyFromCircles({academyOrigin:config.academyOrigin,request:api,dashboard:{mode:'admin',tool:'home'},onError:status});return;}
 const collections=event.target.closest('[data-home-collections]');if(collections&&!event.metaKey&&!event.ctrlKey){event.preventDefault();void library().catch(e=>status(e.message));return;}
 const tab=event.target.closest('[data-circles-tab]');if(tab){$('my-learning').querySelector('h1').textContent=tab.dataset.circlesTab==='COURSE'?'Courses':'Tafseer and Tadabbur';document.title=(tab.dataset.circlesTab==='COURSE'?'Courses':'Tafseer')+' · Umm Abbad Academy';const params=new URLSearchParams(location.search);params.set('view','collections');params.set('collection',tab.dataset.circlesTab==='COURSE'?'courses':'tafseer');history.pushState(null,'',appPath+'?'+params);const root=tab.closest('.connected-circles');for(const node of root.querySelectorAll('[data-circles-section]'))node.hidden=node.dataset.circlesSection!==tab.dataset.circlesTab;for(const node of root.querySelectorAll('[data-circles-tab]'))node.setAttribute('aria-current',node===tab?'page':'false');}
 const link=event.target.closest('a[data-circles-website]');if(link&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&event.button===0){event.preventDefault();void openWebsite(link.dataset.circlesWebsite).catch(e=>status(e.message));}
});
document.addEventListener('input',event=>{if(!textEditor.editing&&current&&event.target.hasAttribute('data-sp-note')){ui.reflections[event.target.dataset.spNote]=event.target.value;remember();}});
document.addEventListener('click',async event=>{if(event.target.closest('[data-inline-path],[data-inline-action]'))return;const button=event.target.closest('button');if(!button)return;try{
 if(button.dataset.editPlaylist){if(current?.canEdit&&(delivery?.playlist?.id||current.playlistId)===button.dataset.editPlaylist){if(current.courseWorkflow){if(canLeaveWorkspace())location.assign('/studio/?manage=1&section=media&offering='+encodeURIComponent(current.offeringId)+'&playlist='+encodeURIComponent(current.playlistId));}else await playlistEditor.open({playlistId:button.dataset.editPlaylist,offeringId:current.offeringId,websiteId:current.websiteId});}return;}
 if(button.dataset.editRecordingText){if(current?.canEdit&&delivery?.media.some(row=>row.attachment_id===button.dataset.editRecordingText))await recordingEditor.open({attachmentId:button.dataset.editRecordingText,offeringId:current.offeringId,websiteId:current.websiteId});return;}
 if(button.dataset.website){document.querySelectorAll('[data-reader-toolbar]').forEach(x=>x.remove());await openWebsite(button.dataset.website);}
 if(button.dataset.enrol){if(config.authorityMode==='ACADEMY'){status('Manage enrolment through Academy while both systems run in parallel.');return;}if(!identity.account){openSignIn();return;}await mutate('/api/offerings/'+button.dataset.enrol+'/enrol',{requestId:crypto.randomUUID(),note:''});status('Your enrolment request has been submitted.');}
 if(button.dataset.join){const result=await api('/api/offerings/'+current.offeringId+'/join',{body:{sessionId:button.dataset.join}});location.assign(result.destination);}
 if(button.dataset.material)await openMaterial('/api/media/'+button.dataset.material,button.dataset.type,button.dataset.filename,button.dataset.recordingStart);
 if(button.hasAttribute('data-more-media')){await loadMedia({more:true});if(ui.route==='sessions')await sessions();else if(['home','recording','lessons','about'].includes(ui.route))draw();else await materials();}
 if(button.hasAttribute('data-library')){if(canLeaveWorkspace())openAcademy({websiteId:current.websiteId,lessonId:ui.route==='lesson'?ui.lessonId:null});}
 if(button.hasAttribute('data-device-export')||button.dataset.sp==='download-reflections')downloadJSON(exportDeviceLearning({accountId:identity.account.accountId,websiteId:current.websiteId,document:current.document,state:ui}),'my-learning.json');
 if(button.hasAttribute('data-device-import'))$('device-import').click();
 if(!button.dataset.sp||!ui)return;if(!canLeaveWorkspace())return;recordingEditor.clear();playlistEditor.clear();const action=button.dataset.sp;
 if(action==='recording'){ui.route='recording';ui.recordingId=button.dataset.id;await loadMedia();if(delivery.companions.some(c=>c.attachmentId===ui.recordingId)&&!delivery.details.has(ui.recordingId)){const key=generation,id=ui.recordingId,value=await api('/api/media/'+encodeURIComponent(id)+'/companion');if(key!==generation)return;delivery.details.set(id,value);}}
 else if(action==='route'){if(ui.route==='recording')closeMedia();ui.route=button.dataset.route;if(ui.route==='sessions')await sessions();if(ui.route==='materials')await materials();}
 else if(action==='lesson'){ui.route='lesson';ui.lessonId=button.dataset.id;if(!textEditor.editing){await loadMedia();}}
 else if(action==='contents')ui.route='lessons';
 else if(action==='view-graphic'){const asset=assets.get(button.dataset.id),block=current.document.lessons.flatMap(l=>l.sections.flatMap(s=>s.blocks)).find(b=>b.assetId===button.dataset.id);if(asset?.blobURL){const box=document.createElement('div'),img=document.createElement('img');box.className='sp-graphic-zoom'+(block?.tint==='course'?' sp-artwork-tint':'');img.src=asset.blobURL;img.alt=block?.alt||'';box.append(img);$('media-body').replaceChildren(box);$('media-dialog').showModal();}}
 else if(action==='larger'||action==='smaller'){ui.readingSize=Math.max(16,Math.min(24,ui.readingSize+(action==='larger'?1:-1)));remember();}
 else if(action==='download-file'){const asset=assets.get(button.dataset.id);if(asset)await downloadMaterial(asset.url,asset.name);}
 else if(action==='copy-reflection'||action==='share-reflection'){const answer=ui.reflections[button.dataset.id]||'';if(action==='share-reflection'&&navigator.share)await navigator.share({text:answer});else await navigator.clipboard.writeText(answer);status('Reflection copied or shared.');}
 if(['route','lesson','recording','contents'].includes(action)&&!textEditor.editing)history.pushState(null,'',location.pathname+location.search+'#'+seriesRoute(ui.route,ui.route==='recording'?ui.recordingId:ui.route==='lesson'?ui.lessonId:''));
 draw();
 if(action==='recording'){const entry=currentSeriesRecordings().find(e=>e.id===ui.recordingId);if(entry?.row)await openMaterial('/api/media/'+entry.row.attachment_id,entry.row.type,entry.title,0,button.dataset.listen==='1');}
 if(action==='recording'||action==='lesson'||action==='route'){const heading=$('course-reader').querySelector('.rs-episode h1,.rs-list-heading h1,.rs-list-heading h2,.rs-about h1,.sp-lesson-article h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}const anchor=$('course-reader').querySelector('.sp-reading-toolbar,.sp-page'),panel=$('companion-player');if(anchor){const offset=window.matchMedia('(max-width:1050px)').matches&&!panel.hidden?panel.getBoundingClientRect().height+12:0;window.scrollTo({top:Math.max(0,anchor.getBoundingClientRect().top+window.scrollY-offset),behavior:'auto'});}}
 }catch(error){if(error.name!=='AbortError')status(error.message);}});
$('device-import').onchange=async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>1_000_000)throw Error('Choose a learning export smaller than 1 MB.');const data=JSON.parse(await file.text());const imported=importDeviceLearning(data,{accountId:identity.account.accountId,websiteId:current.websiteId,document:current.document,current:ui});Object.assign(ui,imported);remember();draw();status('Device learning imported. Existing reflection answers were kept.');}catch(error){status(error.message);}finally{event.target.value='';}};
document.addEventListener('visibilitychange',async()=>{if(document.visibilityState==='visible'&&identity.account){try{const me=await api('/api/me');if(me.accountId!==identity.account.accountId){clear();changed(me);status('Your account changed. Reopen your learning.');}}catch(error){status(error.message);}}});
await startReaderView({main:$('main'),status:$('status'),async load(){
 const params=new URLSearchParams(location.search),website=params.get('website'),mothers=params.get('classroom')==='mothers';
 if(website||mothers){
  const query=new URLSearchParams(website?{website,...(!['sessions','materials'].includes(parseSeriesRoute(location.hash).route)?{media:'1'}:{}),...(params.get('edition')==='published'?{edition:'published'}:{})}:{classroom:'mothers'});
  const boot=await api('/api/circles/reader-bootstrap?'+query,{optionalSession:!identity.account}).catch(error=>{if(error.status!==401)throw error;return null;});
  if(!boot){config=await api('/api/config');openSignIn();return;}
  config=boot.configuration;await profile(boot.account);
  if(website)await openWebsite(website,undefined,boot.website,boot.errors?.website);else await library(boot);return;
 }
 const configured=api('/api/config').then(value=>{config=value;});await Promise.all([configured,profile()]);
 if(params.get('manage')==='1'){if(identity.account)$('manage-button').click();else openSignIn();}else if(appPath==='/studio/'||params.get('view')==='collections')await library();
}});

// Compact menus retain the existing controls and close after an action.
document.addEventListener('click',event=>{for(const menu of document.querySelectorAll('#account-menu,[data-reader-toolbar] details'))if(menu.open&&(!menu.contains(event.target)||event.target.closest('button')))menu.open=false;});
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;for(const menu of document.querySelectorAll('#account-menu[open],[data-reader-toolbar] details[open]')){menu.open=false;menu.querySelector('summary')?.focus();}});

window.addEventListener('popstate',async()=>{if(!canLeaveWorkspace())return;try{const route=new URLSearchParams(location.search),website=route.get('website');if(route.get('manage')==='1'){$('manage-button').click();return;}if(!website){await library();return;}if(!current||current.websiteId!==website||$('course-reader').hidden){await openWebsite(website);return;}Object.assign(ui,parseSeriesRoute(location.hash));settleReaderRoute();if(ui.route==='sessions')await sessions();else if(ui.route==='materials')await materials();else {await loadMedia();draw();}}catch(error){status(error.message);}});
