import {reviewMouCatalogue,mouLessonState,runMouLesson} from './mou-prepared-review.mjs';
import {esc} from './model.mjs';
export function mountMouPrepared(host,{api,offeringId,current}){
 let disposed=false,busy=false,queue,items=[];
 const active=()=>!disposed&&host.isConnected&&current();
 const assert=()=>{if(!active())throw new DOMException('The account or programme changed.','AbortError');};
 async function load(){
  const value=await api('/api/admin/'+encodeURIComponent(offeringId)+'/prepared-recordings');assert();
  const parsed=await reviewMouCatalogue(value.plan);assert();queue=value;items=parsed;draw();
 }
 function draw(){
  if(!active())return;
  host.innerHTML='<h2>Prepared MOU lessons</h2><p>Review each video link and saved summary. Attach privately first, then publish that lesson when ready. Other lessons stay unchanged.</p><p data-prepared-status role="status" aria-live="polite"></p>'+items.map(item=>{
   let state,error;try{state=mouLessonState(queue.plan,item,queue.facts);}catch(e){error=e.message;}
   return '<article class="card prepared-mou-lesson"><h3>'+esc(item.title)+'</h3><p>'+esc(item.recordedDate)+' · '+Math.round(item.durationSeconds/60)+' min · '+esc(error?'Needs review':state.label)+'</p><p><a href="https://www.youtube.com/watch?v='+esc(item.videoId)+'" target="_blank" rel="noopener noreferrer">Review video ↗</a></p><details><summary>Read saved summary and topic guide</summary><p style="white-space:pre-wrap">'+esc(item.companion.summary)+'</p><ol>'+item.companion.topics.map(t=>'<li>'+esc(t.time)+' · '+esc(t.title)+'</li>').join('')+'</ol>'+(item.companion.application?'<h4>'+esc(item.companion.assignmentLabel||'Practice')+'</h4><p style="white-space:pre-wrap">'+esc(item.companion.application)+'</p>':'')+'</details>'+(error?'<p role="alert">'+esc(error)+'</p>':state.published?'<p>Published with its existing monthly/cohort access.</p>':'<button type="button" data-prepared-action="attach" data-prepared-id="'+esc(item.editorialLessonId)+'"'+(busy||state.attached?' disabled':'')+'>Attach privately</button> <button type="button" data-prepared-action="publish" data-prepared-id="'+esc(item.editorialLessonId)+'"'+(busy||!state.attached?' disabled':'')+'>Publish this lesson</button>')+'</article>';
  }).join('');
 }
 host.onclick=async event=>{
  const button=event.target.closest('[data-prepared-action]');if(!button||busy||!active())return;
  const phase=button.dataset.preparedAction,itemId=button.dataset.preparedId;
  if(phase==='publish'&&!window.confirm('Publish this reviewed lesson and its summary for eligible MOU learners?'))return;
  busy=true;draw();const report=text=>{if(active())host.querySelector('[data-prepared-status]').textContent=text;};
  try{await runMouLesson({plan:queue.plan,itemId,phase,api,current:assert,report});assert();busy=false;await load();report(phase==='attach'?'Lesson attached privately. Review it, then choose Publish this lesson.':'This lesson is published.');}
  catch(error){busy=false;if(active()){draw();report(error.name==='AbortError'?'':error.message+' Reopen the review and retry the same lesson; existing saved steps will be reused.');}}
 };
 host.innerHTML='<h2>Prepared MOU lessons</h2><p role="status">Loading the private review…</p>';
 void load().catch(error=>{if(active())host.innerHTML='<h2>Prepared MOU lessons</h2><p role="alert">'+esc(error.message)+'</p>';});
 return ()=>{disposed=true;queue=null;items=[];host.onclick=null;host.replaceChildren();};
}
