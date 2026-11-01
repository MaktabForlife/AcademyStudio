import {reviewMouCatalogue,mouLessonState,runMouLesson} from './mou-prepared-review.mjs';
import {esc} from './model.mjs';
export function mountMouPrepared(host,{api,offeringId,current,optionsPromise}){
 host.classList.add('studio-media-prepared');
 if(!document.querySelector('link[href="/shared/media-attachment.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/shared/media-attachment.css';document.head.append(link);}
 let disposed=false,busy=false,queue,choices,items=[],selected=new Map(),playlists=new Map();
 const active=()=>!disposed&&host.isConnected&&current();
 const assert=()=>{if(!active())throw new DOMException('The account or programme changed.','AbortError');};
 async function load(){
  const value=await api('/api/admin/'+encodeURIComponent(offeringId)+'/prepared-recordings');assert();
  const parsed=await reviewMouCatalogue(value.plan);assert();queue=value;items=parsed;choices=optionsPromise?await optionsPromise:await api('/api/admin/'+encodeURIComponent(offeringId)+'/media-options');optionsPromise=null;assert();
  for(const item of items){try{const saved=mouLessonState(queue.plan,item,queue.facts).attribution;if(saved&&JSON.parse(saved.draft_json).playlist){selected.delete(item.editorialLessonId);playlists.delete(item.editorialLessonId);}}catch{/* Keep unfinished choices available for review. */}}
  draw();
 }
 function draw(){
  if(!active())return;
  host.innerHTML='<h2>Prepared MOU lessons</h2><p>Review each video link and saved summary. Attach privately first, then publish that lesson when ready. Other lessons stay unchanged.</p><p data-prepared-status role="status" aria-live="polite"></p>'+items.map(item=>{
   let state,error;try{state=mouLessonState(queue.plan,item,queue.facts);}catch(e){error=e.message;}
   return '<article class="card prepared-mou-lesson"><h3>'+esc(item.title)+'</h3><p>'+esc(item.recordedDate)+' · '+Math.round(item.durationSeconds/60)+' min · '+esc(error?'Needs review':state.label)+'</p><p><a href="https://www.youtube.com/watch?v='+esc(item.videoId)+'" target="_blank" rel="noopener noreferrer">Review video ↗</a></p><details><summary>Read saved summary and topic guide</summary><p style="white-space:pre-wrap">'+esc(item.companion.summary)+'</p><ol>'+item.companion.topics.map(t=>'<li>'+esc(t.time)+' · '+esc(t.title)+'</li>').join('')+'</ol>'+(item.companion.application?'<h4>'+esc(item.companion.assignmentLabel||'Practice')+'</h4><p style="white-space:pre-wrap">'+esc(item.companion.application)+'</p>':'')+'</details>'+(state?.attribution?'<p>Teacher: '+esc(JSON.parse(state.attribution.draft_json).teacherName)+'</p>':'')+'<label>Independent MOU playlist<select data-prepared-playlist="'+esc(item.editorialLessonId)+'"'+(busy||state?.attribution&&JSON.parse(state.attribution.draft_json).playlist?' disabled':'')+'><option value="">Choose a playlist</option>'+(choices.playlists||[]).map(p=>{const saved=state?.attribution?JSON.parse(state.attribution.draft_json).playlist?.id:null;return '<option value="'+esc(p.id)+'"'+((saved||playlists.get(item.editorialLessonId))===p.id?' selected':'')+'>'+esc(p.name)+' · '+esc(p.closeDate?'Closed '+p.closeDate:'Open · current paid month')+'</option>';}).join('')+'</select></label><p>Open playlists use the current paid month. After closure, the close date’s month unlocks the completed playlist. The original recording date stays as history.</p><fieldset'+(busy||state?.attribution?' disabled':'')+'><legend>Recorded Teacher · '+esc(item.title)+'</legend>'+choices.teachers.map(t=>'<label><input type="checkbox" data-prepared-teacher="'+esc(item.editorialLessonId)+'" value="'+esc(t.id)+'"'+((state?.attribution?JSON.parse(state.attribution.draft_json).teacherIds:selected.get(item.editorialLessonId)||[]).includes(t.id)?' checked':'')+'> '+esc(t.name)+'</label>').join('')+(!choices.teachers.length?'<p>No checked Teachers are available. Refresh your Academy session to continue.</p>':'')+'</fieldset>'+(error?'<p role="alert">'+esc(error)+'</p>':state.published?'<p>Published with its saved access rules.</p>':'<button type="button" data-prepared-action="attach" data-prepared-id="'+esc(item.editorialLessonId)+'"'+(busy||state.attached&&state.attribution&&JSON.parse(state.attribution.draft_json).playlist||!(selected.get(item.editorialLessonId)?.length||state?.attribution)||!(playlists.get(item.editorialLessonId)||state?.attribution&&JSON.parse(state.attribution.draft_json).playlist?.id)?' disabled':'')+'>Attach privately</button> <button type="button" data-prepared-action="publish" data-prepared-id="'+esc(item.editorialLessonId)+'"'+(busy||!state.attached||!state.attribution||!JSON.parse(state.attribution.draft_json).playlist?' disabled':'')+'>Publish this lesson</button>')+'</article>';
  }).join('');
 }
 host.onchange=event=>{const el=event.target;if(el.matches('[data-prepared-playlist]')){playlists.set(el.dataset.preparedPlaylist,el.value);draw();return;}if(!el.matches('[data-prepared-teacher]'))return;selected.set(el.dataset.preparedTeacher,[...host.querySelectorAll('[data-prepared-teacher]')].filter(t=>t.dataset.preparedTeacher===el.dataset.preparedTeacher&&t.checked).map(t=>t.value));const focused=el.value;draw();[...host.querySelectorAll('[data-prepared-teacher]')].find(t=>t.dataset.preparedTeacher===el.dataset.preparedTeacher&&t.value===focused)?.focus();};
 host.onclick=async event=>{
  const button=event.target.closest('[data-prepared-action]');if(!button||busy||!active())return;
  const phase=button.dataset.preparedAction,itemId=button.dataset.preparedId;
  if(phase==='publish'&&!window.confirm('Publish this reviewed lesson and its summary for eligible MOU learners?'))return;
  busy=true;draw();const report=text=>{if(active())host.querySelector('[data-prepared-status]').textContent=text;};
  try{await runMouLesson({plan:queue.plan,itemId,phase,teacherIds:selected.get(itemId),playlistId:playlists.get(itemId),api,current:assert,report});assert();busy=false;await load();report(phase==='attach'?'Lesson attached privately. Review it, then choose Publish this lesson.':'This lesson is published.');}
  catch(error){busy=false;if(active()){draw();report(error.name==='AbortError'?'':error.message+' Reopen the review and retry the same lesson; existing saved steps will be reused.');}}
 };
 host.innerHTML='<h2>Prepared MOU lessons</h2><p role="status">Loading the private review…</p>';
 void load().catch(error=>{if(active())host.innerHTML='<h2>Prepared MOU lessons</h2><p role="alert">'+esc(error.message)+'</p>';});
 const leave=()=>!busy&&!selected.size&&!playlists.size||window.confirm('Leave the prepared lesson review? Unsaved choices will be discarded; completed steps stay private.');
 const unload=event=>{if(busy||selected.size||playlists.size){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',unload);
 const dispose=()=>{window.removeEventListener('beforeunload',unload);disposed=true;queue=null;items=[];host.onclick=null;host.onchange=null;selected.clear();playlists.clear();host.replaceChildren();};dispose.canLeave=leave;return dispose;
}
