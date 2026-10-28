import {createWebsiteEditSession} from '/shared/website-edit-session.mjs';
import {api,mutate,identity} from '/api.mjs';import {esc,clone} from '/shared/model.mjs';
const $=id=>document.getElementById(id),websiteId=new URLSearchParams(location.search).get('website');let record=null,studio=null,epoch=0,editing=null;
const previous=document.createElement('button');previous.textContent='Previous editions';previous.type='button';$('selected-course-name').after(previous);
const edition=document.createElement('p');edition.className='website-edition';edition.setAttribute('role','status');$('selected-course-name').after(edition);
function label(){if(record?.document)$('selected-course-name').textContent=record.document.name;edition.textContent=`Private draft · revision ${record?.revision||0} · ${record?.publishedVersion?'Published '+String(record.publishedVersion).slice(0,10):record?.enabled?'Existing published edition retained':'Not published'}${editing?.pending?' · Retry unfinished save':''}`;}
function session(){return createWebsiteEditSession({websiteId,owner:()=>identity.account?.accountId,request:(action,input)=>action==='open'?api(endpoint()):api(endpoint(),{body:input})});}
const endpoint=()=>'/api/websites/'+encodeURIComponent(websiteId)+'/edit';
const metadata=row=>({id:row.asset_id,name:row.name,type:row.type,size:row.size||0,source:row.type.startsWith('image/')?'IMAGE':'PLATFORM',offeringId:record.offeringId,attachmentId:row.attachment_id,lessonId:row.lesson_id,url:row.url});
async function fileMetadata(assetId){const captured=epoch,data=await api('/api/websites/'+encodeURIComponent(websiteId)+'/assets?assetId='+encodeURIComponent(assetId));if(captured!==epoch)throw new DOMException('Account changed.','AbortError');const row=data.assets?.find(row=>row.asset_id===assetId);if(!row)throw Error('This website file is unavailable.');const asset=metadata(row),found=record.assets.findIndex(item=>item.id===assetId);if(found<0)record.assets.push(asset);else record.assets[found]=asset;return asset;}
previous.onclick=async()=>{
 if(studio.hasUnsavedChanges()||editing.pending){$('save-status').textContent='Save or export unsaved work and finish any retry before restoring a previous edition.';return;}
 const captured=epoch;let before='';$('dialog-title').textContent='Previous website editions';$('dialog-body').innerHTML='<p>Restore an edition as a private draft. Learners keep seeing the published edition until you publish.</p><div data-editions></div><button data-history-more>Load editions</button><p data-history-status role="status"></p>';
 const list=$('dialog-body').querySelector('[data-editions]'),more=$('dialog-body').querySelector('[data-history-more]'),note=$('dialog-body').querySelector('[data-history-status]');
 async function load(){more.disabled=true;try{const data=await api('/api/websites/'+encodeURIComponent(websiteId)+'/history'+(before?'?before='+before:''));if(captured!==epoch)return;const batch=data.history.slice(0,50);for(const row of batch){const item=document.createElement('article');item.className='website-list-card';const name=document.createElement('p');name.textContent='Edition '+row.revision+' · '+row.action;const button=document.createElement('button');button.textContent='Restore private draft';button.onclick=async()=>{button.disabled=true;try{await editing.restore(row.revision);record=editing.record;record.assets=record.assets.map(metadata);label();await studio.openRemote();$('studio-dialog').close();}catch(error){note.textContent=error.message;button.disabled=false;}};item.append(name,button);list.append(item);}before=batch.at(-1)?.revision;more.hidden=data.history.length<=50;more.textContent='Load older editions';}catch(error){note.textContent=error.message;}finally{more.disabled=false;}}
 more.onclick=load;$('studio-dialog').showModal();await load();
};
function end(){epoch++;editing?.clear();studio?.clearRemote();record=null;$('website-editor').hidden=true;$('website-list-panel').hidden=false;$('website-list').replaceChildren();$('website-list-status').textContent='Your Academy session changed. Return to the homepage to sign in.';}
window.addEventListener('website-session-ended',end);window.addEventListener('website-account-changed',end);
async function attach(source){
 if(!source||source.audience!=='WEBSITE'||!['application/pdf','image/png','image/jpeg','image/webp'].includes(source.mime_type))throw Error('Choose an authorised website PDF or image. Lesson recordings and their notes retain their original access rules.');
 const attachmentId='website-'+websiteId+'-'+source.asset_id;
 await mutate('/api/admin/'+record.offeringId,{action:'attachment',attachmentId,assetId:source.asset_id,websiteId,lessonId:source.lesson_id,lessonDate:source.lesson_date,cohort:source.cohort,title:source.title,audience:'WEBSITE',published:false});
 return fileMetadata(source.asset_id);
}
async function reusableFiles(){
 const captured=epoch,rows=new Map();let after='';
 $('dialog-title').textContent='Reuse a website PDF or image';
 $('dialog-body').innerHTML='<p>Files are linked by reference. Recording and lesson-month permissions stay separate.</p><div data-reusable-files></div><button data-reusable-more>Load files</button><p data-reusable-status role="status"></p>';
 const list=$('dialog-body').querySelector('[data-reusable-files]'),more=$('dialog-body').querySelector('[data-reusable-more]'),note=$('dialog-body').querySelector('[data-reusable-status]');
 async function load(){more.disabled=true;try{const data=await api('/api/admin/'+record.offeringId+'?after='+encodeURIComponent(after));if(captured!==epoch)return;const batch=data.media.slice(0,50);after=batch.at(-1)?.attachment_id||after;
  for(const row of batch)if(row.audience==='WEBSITE'&&['application/pdf','image/png','image/jpeg','image/webp'].includes(row.mime_type)&&!rows.has(row.asset_id)){rows.set(row.asset_id,row);list.insertAdjacentHTML('beforeend',`<article class="website-list-card"><h3>${esc(row.title||row.filename)}</h3><small>${esc(row.mime_type==='application/pdf'?'PDF':'Image')}</small><button data-attach="${esc(row.asset_id)}">Reuse file</button></article>`);}
  more.hidden=data.media.length<=50;more.textContent='Load more files';note.textContent=rows.size?'':'No reusable website files on this page. Upload a new file in Lesson media, or load more.';
 }catch(error){note.textContent=error.message;}finally{more.disabled=false;}}
 more.onclick=load;list.onclick=async event=>{const button=event.target.closest('[data-attach]');if(!button)return;button.disabled=true;try{await studio.attachAcademyMaterial(await attach(rows.get(button.dataset.attach)));$('studio-dialog').close();}catch(error){note.textContent=error.message;button.disabled=false;}};
 $('studio-dialog').showModal();await load();
}

window.COURSE_WEBSITE_ADMIN={websiteId,nativeMedia:true,surahId:null,ownerKey:()=>identity.account?.accountId,revision:()=>record?.revision||0,list:()=>{if(!studio||studio.canLeave())location.assign('/?manage=1');},drafts:async()=>record?[clone(editing.record.document)]:[],
 async save(document){const captured=epoch;try{if(editing.pending)await editing.retry();editing.replace(document);await editing.save();if(captured!==epoch)throw new DOMException('Account changed.','AbortError');record.revision=editing.record.revision;record.document=clone(editing.record.document);label();}catch(error){if(error.status===403)end();else label();throw error;}},
 async assets(){const captured=epoch;return Promise.all(record.assets.map(async asset=>{const blob=asset.type.startsWith('image/')?await api(asset.url+'?draft=1',{blob:true}):null;if(captured!==epoch)throw new DOMException('Account changed.','AbortError');return {...asset,courseId:record.document.id,blob};}));},
 async assetBlob(assetId){const asset=record.assets.find(a=>a.id===assetId);if(!asset)throw Error('File not found.');return api(asset.url+'?draft=1',{blob:true});},
 async download(assetId){const blob=await this.assetBlob(assetId),asset=record.assets.find(a=>a.id===assetId),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=asset.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
 async upload(asset){const operationId='upload-'+asset.id;await api('/api/admin/'+record.offeringId+'/files?'+new URLSearchParams({assetId:asset.id,operationId,filename:asset.name}),{method:'PUT',body:asset.blob});
  await mutate('/api/admin/'+record.offeringId,{action:'attachment',attachmentId:'website-image-'+asset.id,assetId:asset.id,websiteId,lessonId:record.document.lessons[0]?.id||'website-cover',lessonDate:new Date().toISOString().slice(0,10),cohort:'',title:asset.name,audience:'WEBSITE',published:false});await fileMetadata(asset.id);},
 async publish(){if(studio.hasUnsavedChanges())throw Error('Save your draft before publishing.');const result=await editing.publish();record.revision=result.revision;record.enabled=true;record.publishedVersion=result.publishedVersion||result.revision;label();},
 async withdraw(){if(!confirm('Withdraw this website? Its draft and publication history will be retained.'))return false;const result=await editing.withdraw();record.revision=result.revision;record.enabled=false;label();return true;},
 async attachReference(reference){if(reference.offeringId!==record.offeringId)throw Error('This copy needs an authorised shared-file mapping before import into another offering.');const data=await api('/api/admin/'+record.offeringId);const source=data.media.find(row=>row.asset_id===reference.assetId&&row.audience==='WEBSITE');if(!source)throw Error('Choose the authorised file through Reuse existing PDF or image.');return attach(source);},
 async attachMedia(){try{await reusableFiles();}catch(error){$('save-status').textContent=error.message;}}
};
try{identity.account=await api('/api/me');if(!websiteId)throw Error('Choose a website from Media / Lesson media.');editing=session();record=await editing.open();record.assets=record.assets.map(metadata);label();window.COURSE_WEBSITE_ADMIN.surahId=record.document.pages.sessions?null:websiteId;$('website-list-panel').hidden=true;$('website-editor').hidden=false;$('selected-course-name').textContent=record.document.name;studio=await import('/shared/studio.mjs');}
catch(error){$('website-list-status').textContent=error.message;}
