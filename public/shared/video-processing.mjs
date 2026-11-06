import {mountMediaAdmin} from './media-admin-panel.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=v=>JSON.parse(JSON.stringify(v));
export function processingSourceAPI(request,offeringId){
 const path='/api/admin/'+encodeURIComponent(offeringId);
 return async(url,{method='GET',body}={})=>{
  const u=new URL(url,'https://local.invalid');
  if(u.pathname===path+'/media-options'&&method==='GET')return request('video-source-options');
  if(u.pathname===path+'/recording'&&method==='PUT')return request('video-source-upload-part',{assetId:u.searchParams.get('assetId'),partNumber:Number(u.searchParams.get('partNumber')),file:body});
  if(u.pathname===path+'/recording'&&method==='GET')throw Error('Choose a supported recording action.');
  if(u.pathname===path+'/recording'&&['start','complete'].includes(body?.action)){const {action,...input}=body;return request('video-source-upload-'+action,input);}
  if(u.pathname===path&&body?.action==='youtube'){const {action,...input}=body;return request('video-source-youtube',input);}
  if(u.pathname===path&&body?.action==='media-attach'){
   const {action,supportingFiles,...input}=body;if(supportingFiles?.length)throw Error('Add supporting readings through the existing Content tools.');return request('video-source-attach',input);
  }
  throw Error('Choose a supported recording action.');
 };
}
function topics(text){return text.split(/\r?\n/).filter(x=>x.trim()).map(line=>{const m=line.trim().match(/^(\d{1,3}:[0-5]\d(?::[0-5]\d)?)\s+(.+)$/);if(!m)throw Error('Use one timestamp and topic per line, such as 00:00 Introduction.');return {time:m[1],title:m[2]};});}
export function mountVideoProcessing(host,{request,offeringId,playlistId,current=()=>true,onClose=()=>{},onSaved=()=>{},styleHref='/shared/media-attachment.css'}){
 let disposed=false,busy=false,dirty=false,pending=null,attachmentUI=null,capabilities=null,options=null,detail=null,source=null,quote=null,job=null,candidate=null,recordings=[],next=null,publication=null,history=[],historyNext=null;
 const active=()=>!disposed&&host.isConnected&&current();
 const assert=()=>{if(!active())throw new DOMException('The account or Course changed.','AbortError');};
 const canLeave=()=>!busy&&!pending&&!dirty&&attachmentUI?.canLeave?.()!==false;
 const tell=text=>{if(active())host.querySelector('[data-vp-status]')?.replaceChildren(document.createTextNode(text));};
 function frame(html){if(!active())return;attachmentUI?.();attachmentUI=null;host.innerHTML='<section class="studio-media-attachment"><h2>Process video</h2><p role="status" aria-live="polite" data-vp-status></p>'+html+'<p><button type="button" data-vp="close">Back to Course Media</button></p></section>';lock();}
 function lock(){if(!active())return;for(const n of host.querySelectorAll('button,input,textarea,select')){if(n.closest('[data-vp-attachment]'))continue;n.disabled=busy||Boolean(pending&&n.dataset.vp!=='retry')||n.dataset.vpStale==='true';}if(pending&&!host.querySelector('[data-vp="retry"]')){const b=document.createElement('button');b.type='button';b.dataset.vp='retry';b.textContent='Retry this same action';host.querySelector('[data-vp-status]').after(b);b.disabled=busy;}host.setAttribute('aria-busy',String(busy));}
 async function read(action,input={}){assert();const result=await request(action,input);assert();return result;}
 function clearPrivate(){attachmentUI?.();attachmentUI=null;detail=null;source=null;quote=null;job=null;candidate=null;options=null;recordings=[];history=[];historyNext=null;publication=null;pending=null;dirty=false;host.replaceChildren();}
 async function run(fn){if(busy||!active())return;busy=true;lock();try{await fn();}catch(error){if(!active())return;if([401,403].includes(error.status)){clearPrivate();frame('<p role="alert">Your current Admin access needs to be checked. Reopen Course Media before continuing.</p>');}else tell(error.message||'This action could not be confirmed.');}finally{busy=false;if(active())lock();}}
 async function commit(action,input,after){
  if(!pending)pending={action,input:clone(input),after};
  const operation=pending;lock();
  try{const result=await read(operation.action,operation.input);pending=null;dirty=false;await operation.after(result);}
  catch(error){if(error.status&&error.status<500&&error.code!=='STUDIO_CONFIRMATION_PENDING'){pending=null;}throw error;}
 }
 function start(){
  frame('<p>Attach the exact recording privately, then supply its available timestamped transcript. AI processing starts only after you authorise this run. Your saved lesson and existing publication remain until you review and accept a replacement.</p><p><button type="button" data-vp="new">Attach a recording</button> <button type="button" data-vp="existing">Choose a saved recording</button></p><p>For a Zoom recording, use an MP4 and transcript obtained through your authorised Zoom account. This control does not fetch private Zoom or YouTube captions automatically.</p>');
 }
 async function chooseExisting(after=''){
  const page=await read('video-source-recordings',{playlistId,...(after?{after}:{})});recordings=after?[...recordings,...page.recordings]:page.recordings;next=page.next;
  frame('<h3>Choose this playlist’s recording</h3>'+recordings.map(r=>'<p><button type="button" data-vp="select" data-id="'+esc(r.id)+'">'+esc(r.title)+'</button> · '+esc(r.recordedDate||'Undated')+' · '+(r.published?'Published':'Private')+'</p>').join('')+(!recordings.length?'<p>No recording is attached to this playlist yet.</p>':'')+(page.more?'<button type="button" data-vp="more">Load more recordings</button>':'')+'<p><button type="button" data-vp="new">Attach a new recording</button></p>');
 }
 async function newRecording(){
  options=await read('video-source-options');if(options.kind!=='COURSE'||!options.playlists.some(p=>p.id===playlistId&&p.legacy!==true))throw Error('Reopen the current Course playlist before attaching a recording.');
  frame('<div data-vp-attachment></div>');
  attachmentUI=mountMediaAdmin(host.querySelector('[data-vp-attachment]'),{api:processingSourceAPI((a,b)=>read(a,b),offeringId),offeringId,playlistId,current:active,initialRecord:{media:[]},optionsPromise:Promise.resolve(options),attachOnly:true,sourceOnly:true,maxRecordingBytes:capabilities.maxUploadBytes,styleHref,onAttached:async id=>{await selectRecording(id);},onChanged:onSaved});
 }
 async function selectRecording(id){
  detail=await read('video-source-detail',{attachmentId:id});source=null;quote=null;job=null;candidate=null;publication=null;dirty=false;
  if(detail.recordedContext?.playlist?.id!==playlistId)throw Error('This recording belongs to a different playlist. Reopen its original destination.');
  if(capabilities.processingAvailable){const page=await read('video-processing-history',{attachmentId:id});history=page.jobs;historyNext=page.next;if(history.length||page.more){showHistory();return;}}
  transcript();
 }
 function showHistory(){
  frame('<h3>'+esc(detail.title)+'</h3><h4>Recent private processing requests</h4>'+history.map(j=>'<p><button type="button" data-vp="history-job" data-id="'+esc(j.jobId)+'">View '+esc(new Date(j.authorisedAt).toLocaleString())+' · '+esc(j.state)+'</button></p>').join('')+(historyNext?'<button type="button" data-vp="history-more">More requests</button>':'')+'<p><button type="button" data-vp="transcript">Supply another transcript</button></p><p>Each new AI run needs a separate authorisation. A recent unknown outcome may still have incurred a charge.</p>');
 }
 function transcript(){
  frame('<h3>'+esc(detail.title)+'</h3><p>'+esc(detail.recordedContext?.playlist?.name||'')+' · '+esc(detail.recordedContext?.teacherName||'Review the recorded Teacher first')+'</p>'+
   (!capabilities.processingAvailable?'<p>This recording is saved privately. AI processing is not configured yet; its current summary and publication are unchanged.</p>':
   '<form data-vp-transcript><label>Timestamped transcript file · VTT or SRT<input type="file" data-vp-file accept=".vtt,.srt,text/vtt,application/x-subrip"></label><label>Transcript format<select name="format"><option>VTT</option><option>SRT</option></select></label><label>Timestamped transcript<textarea name="transcript" rows="10" required></textarea></label><label>Recording duration in seconds<input name="durationSeconds" type="number" min="1" max="86400" required></label><p>Maximum transcript size: 512 KiB. Keep its timestamps aligned with this recording. Caption text alone does not verify quotations against the audio.</p><button type="submit">Save transcript privately and review processing limits</button></form>'));
 }
 async function showQuote(){
  frame('<h3>Processing limits</h3><p>Checking the saved transcript’s current limits…</p><button type="button" data-vp="quote">Retry checking limits</button>');
  quote=await read('video-processing-quote',{sourceId:source.sourceId});
  frame('<h3>Authorise this processing run</h3><p>'+esc(detail.title)+'</p><p>Model: '+esc(quote.model)+' · profile: '+esc(quote.profile)+'</p><p>Maximum output: '+esc(quote.maxOutputTokens)+' tokens. Maximum request: '+esc(quote.maxRequestBytes)+' bytes. These are configured limits, not a monetary estimate.</p><p>This starts one generation request. A lost provider response may still incur a charge; another run needs your separate authorisation. It cannot replace your saved lesson or publish automatically.</p><form data-vp-authorise><label><input type="checkbox" name="authorise" required>I authorise this AI processing run under the displayed limits.</label><button type="submit">Authorise and process</button></form>');
 }
 function showJob(){
  const state=job.state;
  frame('<h3>Processing request</h3><p data-vp-job-state>'+esc(state)+'</p><p>'+(['QUEUED','RUNNING'].includes(state)?'The server reports this request as '+state.toLowerCase()+'. Use Check progress when you want an update.':'CANDIDATE'===state?'A private candidate is ready for your review.':state==='ACCEPTED'?'You accepted this candidate as a private native draft.':'This run needs review. No automatic paid retry will be made; a provider charge may be uncertain.')+'</p>'+
   '<p><button type="button" data-vp="status">Check progress</button> '+(['CANDIDATE','ACCEPTED'].includes(state)?'<button type="button" data-vp="candidate">Review private candidate</button>':'')+(state==='ACCEPTED'?'<button type="button" data-vp="accepted">Review saved draft and publication</button>':'')+'</p>'+
   (!['QUEUED','RUNNING'].includes(state)?'<button type="button" data-vp="reprocess">Review limits for a separately authorised run</button>':'<button type="button" data-vp="cancel">Cancel this request</button>'));
  if(job.dispatch==='UNCONFIRMED')tell('The Workflow acknowledgement is unconfirmed. This is the existing request; a new paid run has not been authorised.');
 }
 const referenceRow=(r,i)=>'<fieldset data-vp-ref><legend>Reference '+(i+1)+'</legend><label><input type="checkbox" name="include">Include after checking</label><label>Timestamp<input name="time" value="'+esc(r.time||'00:00')+'"></label><label>Arabic excerpt<textarea name="arabic">'+esc(r.arabic||'')+'</textarea></label><label>Meaning<textarea name="meaning">'+esc(r.meaning||'')+'</textarea></label><p>Unverified source evidence: '+esc(r.evidence||'None supplied')+'</p></fieldset>';
 const quotationRow=(r,i)=>'<fieldset data-vp-quote><legend>Quotation '+(i+1)+'</legend><label><input type="checkbox" name="include">Include only after checking the audio</label><label>Timestamp<input name="time" value="'+esc(r.time||'00:00')+'"></label><label>Words actually spoken<textarea name="text">'+esc(r.text||'')+'</textarea></label><label>Speaker<input name="speaker" value="'+esc(r.speaker||'')+'"></label><p>Unverified source evidence: '+esc(r.evidence||'None supplied')+'</p></fieldset>';
 const noteRow=r=>'<fieldset data-vp-note><label>Timestamp<input name="time" value="'+esc(r.time)+'"></label>'+['title','chapter','reflection','practice'].map(k=>'<label>'+esc(k)+'<textarea name="'+k+'">'+esc(r[k]||'')+'</textarea></label>').join('')+'</fieldset>';
 function review(){
  const value=candidate.candidate,c=value.learnerPreview,e=value.privateEvidence,academic=value.style==='ACADEMIC';
  frame('<h3>Review the private candidate</h3><p>Private source evidence and uncertain matches below are excluded from learner content. References and quotations start unselected. Review facts and wording against the recording.</p>'+
   (candidate.stale?'<p role="alert">The saved recording or draft changed. This candidate cannot overwrite it. Reopen the current lesson before authorising another run.</p>':'')+
   '<form data-vp-review><label>Full summary<textarea name="summary" maxlength="20000" rows="10" required>'+esc(c.summary)+'</textarea></label><label>Topic guide · one timestamp and heading per line<textarea name="topics" required rows="6">'+esc(c.topics.map(t=>t.time+' '+t.title).join('\n'))+'</textarea></label>'+
   '<label>Checked lesson or book reference · optional<textarea name="lessonReference" maxlength="2000">'+esc(c.lessonReference||'')+'</textarea></label><p>Unverified suggested reference: '+esc(e.lessonReferenceCandidate||'None')+'</p><label><input type="checkbox" name="confirmLessonReference">I checked the lesson/book reference I entered.</label>'+
   '<label>'+(academic?'Actual assigned homework · optional':'Reflection and daily practice · optional')+'<textarea name="application" maxlength="20000">'+esc(c.application||'')+'</textarea></label><label><input type="checkbox" name="confirmAssignedHomework">Any homework entered was explicitly assigned in this recording.</label>'+
   (!academic?'<h4>Connected topic notes</h4><div data-vp-notes>'+(c.topicNotes||[]).map(noteRow).join('')+'</div>':'')+
   '<details><summary>References and Arabic excerpts</summary><div data-vp-references>'+(e.references||[]).map(referenceRow).join('')+'</div><button type="button" data-vp="add-reference">Add a checked reference</button><label><input type="checkbox" name="confirmReferences">I checked every included Arabic excerpt, meaning and reference.</label></details>'+
   '<details><summary>Audio-verified quotations</summary><div data-vp-quotes>'+(e.quotations||[]).map(quotationRow).join('')+'</div><button type="button" data-vp="add-quotation">Add an audio-verified quotation</button><label><input type="checkbox" name="confirmAudioQuotations">I checked every included quotation against the audio.</label></details>'+
   '<details><summary>Private review notes and assignment evidence</summary>'+(e.reviewNotes||[]).map(n=>'<p>'+esc(n)+'</p>').join('')+(e.assignments||[]).map(a=>'<p>'+esc(a.evidence)+'</p>').join('')+'</details>'+
   '<label><input type="checkbox" name="reviewed" required>I reviewed this full companion against this recording.</label><button type="submit"'+(candidate.stale?' disabled data-vp-stale="true"':'')+'>Accept as a private draft</button></form><p><button type="button" data-vp="reprocess">Review limits for a separately authorised run</button></p>');
 }
 async function accepted(){
  frame('<h3>Saved private draft</h3><p>Checking the current saved lesson…</p><button type="button" data-vp="accepted">Retry saved draft review</button>');
  detail=await read('video-source-detail',{attachmentId:detail.attachmentId});publication={operationId:crypto.randomUUID(),attachmentId:detail.attachmentId,revision:detail.attributionRevision,draftContext:detail.draftContext,sourceRevision:detail.sourceRevision,companionKey:detail.companionDraftKey,companionRevision:detail.companionRevision,confirm:true};
  frame('<h3>Saved private draft</h3><p>'+esc(detail.title)+'</p><p style="white-space:pre-wrap">'+esc(detail.companion?.summary||'')+'</p><ol>'+(detail.companion?.topics||[]).map(t=>'<li>'+esc(t.time)+' · '+esc(t.title)+'</li>').join('')+'</ol><p>Existing publication is preserved until you explicitly publish this current reviewed lesson.</p><button type="button" data-vp="publish">Publish this reviewed lesson</button>');
 }
 async function click(event){
  const action=event.target.closest('[data-vp]')?.dataset.vp;if(!action)return;event.preventDefault();
  if(action==='close'){if(!canLeave()){tell('Save, cancel or retry the current work before leaving.');return;}onClose();return;}
  if(action==='retry'){await run(()=>commit(pending.action,pending.input,pending.after));return;}
  if(busy||pending)return;
  if(action==='add-reference'){const rows=host.querySelector('[data-vp-references]');if(rows.children.length>=100){tell('Keep at most 100 references.');return;}rows.insertAdjacentHTML('beforeend',referenceRow({},rows.children.length));dirty=true;return;}
  if(action==='add-quotation'){const rows=host.querySelector('[data-vp-quotes]');if(rows.children.length>=20){tell('Review the existing quotation candidates first.');return;}rows.insertAdjacentHTML('beforeend',quotationRow({},rows.children.length));dirty=true;return;}
  if(dirty&&!['publish','cancel'].includes(action)&&!window.confirm('Discard the unsaved private review changes?'))return;
  await run(async()=>{
   if(action==='history-more'){const page=await read('video-processing-history',{attachmentId:detail.attachmentId,after:historyNext});history.push(...page.jobs);historyNext=page.next;return showHistory();}
   if(action==='history-job'){const selected=history.find(j=>j.jobId===event.target.closest('[data-id]').dataset.id);if(!selected)throw Error('Reopen the current processing request.');source={sourceId:selected.sourceId};job=await read('video-processing-status',{jobId:selected.jobId});return showJob();}
   if(action==='transcript'){source=null;quote=null;job=null;candidate=null;dirty=false;return transcript();}
   if(action==='quote')return showQuote();
   if(action==='new')return newRecording();
   if(action==='existing')return chooseExisting();
   if(action==='more')return chooseExisting(next);
   if(action==='select')return selectRecording(event.target.closest('[data-id]').dataset.id);
   if(action==='status'){job=await read('video-processing-status',{jobId:job.jobId});return showJob();}
   if(action==='candidate'){candidate=await read('video-processing-candidate',{jobId:job.jobId});dirty=false;return review();}
   if(action==='accepted')return accepted();
   if(action==='reprocess'){if(!window.confirm('Review limits for a new AI run? It needs separate authorisation and may incur another charge. Saved edits and publication remain.'))return;dirty=false;candidate=null;return showQuote();}
   if(action==='cancel'){if(!window.confirm('Cancel this request? An already-started provider request may still incur a charge.'))return;return commit('video-processing-cancel',{operationId:crypto.randomUUID(),jobId:job.jobId,cancel:true},value=>{job=value;showJob();});}
   if(action==='publish'){if(!window.confirm('Publish only this current reviewed lesson through its existing publication controls?'))return;return commit('video-source-publication',publication,()=>{onSaved();frame('<p>The lesson publication was confirmed. Other saved lessons are unchanged.</p>');});}
  });
 }
 async function submit(event){
  const form=event.target;if(!form.matches('[data-vp-transcript],[data-vp-authorise],[data-vp-review]'))return;event.preventDefault();if(busy||pending||!form.reportValidity())return;
  await run(async()=>{
   const fields=new FormData(form);
   if(form.matches('[data-vp-transcript]'))return commit('video-processing-source',{operationId:crypto.randomUUID(),attachmentId:detail.attachmentId,format:fields.get('format'),durationSeconds:Number(fields.get('durationSeconds')),transcript:fields.get('transcript')},async value=>{source=value;await showQuote();});
   if(form.matches('[data-vp-authorise]'))return commit('video-processing-authorise',{operationId:crypto.randomUUID(),sourceId:source.sourceId,quoteHash:quote.quoteHash,authorise:fields.get('authorise')==='on'},value=>{job=value;showJob();});
   const selected=(selector,keys)=>[...form.querySelectorAll(selector)].filter(row=>row.querySelector('[name=include]').checked).map(row=>Object.fromEntries(keys.map(k=>[k,row.querySelector('[name='+k+']').value])));
   const notes=[...form.querySelectorAll('[data-vp-note]')].map(row=>Object.fromEntries(['time','title','chapter','reflection','practice'].map(k=>[k,row.querySelector('[name='+k+']').value])));
   const academic=candidate.candidate.style==='ACADEMIC',companion={schema:'LEARNER_COMPANION_V1',summary:fields.get('summary'),topics:topics(fields.get('topics')),lessonReference:fields.get('lessonReference'),application:fields.get('application'),assignmentLabel:academic?'Homework':'Practice and application',topicNotes:notes,references:selected('[data-vp-ref]',['time','arabic','meaning']),quotations:selected('[data-vp-quote]',['time','text','speaker'])};
   return commit('video-processing-accept',{operationId:crypto.randomUUID(),jobId:job.jobId,candidateHash:candidate.candidateHash,revision:candidate.baseCompanionRevision,reviewed:fields.get('reviewed')==='on',companion,...Object.fromEntries(['confirmLessonReference','confirmAssignedHomework','confirmReferences','confirmAudioQuotations'].map(k=>[k,fields.get(k)==='on']))},async value=>{job=value;candidate=null;onSaved();await accepted();});
  });
 }
 async function change(event){
  if(!event.target.matches('[data-vp-file]'))return;const file=event.target.files?.[0];if(!file)return;
  try{if(file.size>512*1024)throw Error('Choose a transcript no larger than 512 KiB.');const format=file.name.toLowerCase().endsWith('.srt')?'SRT':file.name.toLowerCase().endsWith('.vtt')?'VTT':null;if(!format)throw Error('Choose a VTT or SRT transcript.');const value=await file.text();assert();const form=host.querySelector('[data-vp-transcript]');form.elements.format.value=format;form.elements.transcript.value=value;dirty=true;}catch(error){tell(error.message);}
 }
 const input=event=>{if(!event.target.closest('[data-vp-attachment]'))dirty=true;};
 const beforeUnload=e=>{if(!canLeave()){e.preventDefault();e.returnValue='';}};
 const contextCheck=()=>{if(!current())dispose();};
 function dispose(){if(disposed)return;disposed=true;clearPrivate();host.innerHTML='<p>Reopen Course Media to check current access.</p>';host.removeEventListener('click',click);host.removeEventListener('submit',submit);host.removeEventListener('input',input);host.removeEventListener('change',change);window.removeEventListener('beforeunload',beforeUnload);window.removeEventListener('pageshow',contextCheck);window.removeEventListener('storage',contextCheck);window.removeEventListener('pagehide',dispose);for(const name of ['website-account-changed','website-session-ended','m4l-academy-session','m4l-academy-workspace'])window.removeEventListener(name,contextCheck);}
 host.addEventListener('click',click);host.addEventListener('submit',submit);host.addEventListener('input',input);host.addEventListener('change',change);window.addEventListener('beforeunload',beforeUnload);window.addEventListener('pageshow',contextCheck);window.addEventListener('storage',contextCheck);window.addEventListener('pagehide',dispose);for(const name of ['website-account-changed','website-session-ended','m4l-academy-session','m4l-academy-workspace'])window.addEventListener(name,contextCheck);
 frame('<p>Checking current processing availability…</p>');const ready=run(async()=>{capabilities=await read('video-source-capabilities');if(!capabilities.sourceAvailable)throw Error('Processing is not enabled for this Course.');start();});
 dispose.canLeave=canLeave;dispose.ready=ready;return dispose;
}
