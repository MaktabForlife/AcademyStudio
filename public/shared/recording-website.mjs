import {esc} from './model.mjs';
import {recordingStart,recordingTopics} from './recording-companion.mjs';
import {tafseerCourseCover,replaceTafseerArtwork,tafseerDisplayCourse} from './tafseer-cover.mjs';
import {renderCourse,renderBlock} from './student.mjs';

const video=row=>row?.attachment_id&&['video/youtube','video/mp4'].includes(row.type);
const sourceId=guide=>guide.editorialLessonId||guide.lessonId;
const date=value=>{const d=new Date(value);return value&&!Number.isNaN(d.getTime())?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Johannesburg'}).format(d):'';};
export const seriesRoute=(route,id='')=>new URLSearchParams({view:route,...(id?{id}:{})}).toString();
export function parseSeriesRoute(value){const p=new URLSearchParams(value.replace(/^#/,'')),view=p.get('view');return ['home','lessons','about','recording','lesson','materials','sessions'].includes(view)?{route:view,...(p.get('id')?{[view==='recording'?'recordingId':'lessonId']:p.get('id')}:{})}:{route:'home'};}

// Only the already permission-filtered feed can supply operational playback.
// Pending companions are included solely when the private review adapter names them.
export function seriesRecordings({media=[],guides=[],pendingIds=[],companions=[],details=new Map()}={}){
 const unique=new Map(),entries=[];
 for(const row of media.filter(video)){const key=Number.isSafeInteger(row.playlistPosition)&&row.playlistPosition>0?'playlist-entry:'+row.attachment_id:'legacy:'+(row.asset_id||row.attachment_id)+JSON.stringify(row.recordedContext||null),previous=unique.get(key),reviewed=r=>guides.some(g=>g.lessonId===r.lesson_id&&g.status==='reviewed');if(!previous||reviewed(row)&&!reviewed(previous))unique.set(key,row);}
 for(const row of [...unique.values()].sort((a,b)=>(Number.isSafeInteger(a.playlistPosition)&&a.playlistPosition>0&&Number.isSafeInteger(b.playlistPosition)&&b.playlistPosition>0?a.playlistPosition-b.playlistPosition:0)||String(a.lesson_date||'').localeCompare(String(b.lesson_date||''))||String(a.attachment_id).localeCompare(String(b.attachment_id)))){
  const lessonGuides=guides.filter(g=>g.lessonId===row.lesson_id&&g.status==='reviewed'),guide=lessonGuides[0];
  const readingIds=[...new Set(lessonGuides.map(g=>g.readingId).filter(Boolean))];
  const topics=[...new Map(lessonGuides.flatMap(g=>g.topics||[]).map(topic=>[JSON.stringify([topic.start,topic.title]),topic])).values()].sort((a,b)=>a.start-b.start);
  const companion=companions.find(c=>c.attachmentId===row.attachment_id);
  entries.push({id:row.attachment_id,row,recordedContext:row.recordedContext,duration:companion?.durationSeconds||row.duration_seconds,companion:details.get(row.attachment_id),summaryFormat:companion?.summaryFormat,lessonReference:companion?.lessonReference,title:guide?.title||row.title||'Recorded lesson',summary:companion?.summary??guide?.summary??row.summary??'',date:row.lesson_date,readingIds,topics,quote:companion?.quote||guide?.quote});
 }
 const pending=new Set(pendingIds);
 for(const guide of guides)if(pending.has(sourceId(guide))&&!entries.some(e=>e.row?.lesson_id===guide.lessonId)){
  const id='pending:'+sourceId(guide),existing=entries.find(e=>e.id===id);
  if(existing){if(guide.readingId&&!existing.readingIds.includes(guide.readingId))existing.readingIds.push(guide.readingId);}
  else entries.push({id,pending:true,title:guide.title,summary:guide.summary||'',readingIds:guide.readingId?[guide.readingId]:[],topics:guide.topics||[],quote:guide.quote});
 }
 return entries;
}

// An association is explicit in the source, never inferred from reading order.
export function independentReadings(course,guides=[],entries=[]){
 // The server has already filtered this document's text. If a recording is
 // unavailable (including a deliberate text-only grant), its permitted support
 // must still be reachable from Read. An association never grants playback.
 const linked=new Set(entries.flatMap(e=>e.readingIds||[]));
 return (course.lessons||[]).filter(l=>!linked.has(l.id));
}
const action=(label,route,id='',extra='')=>`<button type="button" data-sp="${route==='recording'?'recording':route==='lesson'?'lesson':'route'}" ${['recording','lesson'].includes(route)?`data-id="${esc(id)}"`:`data-route="${esc(route)}"`} ${extra}>${label}</button>`;
const playIcon='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 3 11 7-11 7Z" fill="currentColor"/></svg>';
function playback(entry,start=0,label='Listen',extra=''){
 const row=entry?.row;
 if(video(row))return `<button type="button" class="rs-listen" data-material="${esc(row.attachment_id)}" data-type="${esc(row.type)}" data-filename="${esc(entry.title)}" data-recording-start="${recordingStart(start)}" ${extra}>${playIcon}${label}</button>`;
 if(entry?.authorVideo)return `<button type="button" class="rs-listen" data-author-video="${esc(entry.authorVideo)}" data-recording-start="${recordingStart(start)}" ${extra}>${playIcon}${label}</button>`;
 return '';
}
const summaryHTML=entry=>entry.summaryFormat==='bullets'?'<ul class="rs-card-summary">'+entry.summary.split('\n').filter(t=>t.trim()).map(t=>'<li>'+esc(t.replace(/^-\s*/,''))+'</li>').join('')+'</ul>':'<p class="rs-card-summary">'+esc(entry.summary)+'</p>';
const readingLinks=(entry,course)=>entry.readingIds.filter(id=>course.lessons.some(l=>l.id===id)).map(id=>action(esc(course.lessons.find(l=>l.id===id).title)+' <span aria-hidden="true">→</span>','lesson',id,'class="rs-reading-link"')).join('');
function companionBody(c,entry){
 if(!c)return '';
 return `${c.lessonReference?`<p class="rs-reference">${esc(c.lessonReference)}</p>`:''}${(c.topicNotes||[]).map(t=>`<section class="rs-topic-note"><h3>${esc(t.title)}</h3>${t.time?playback(entry,recordingTopics([t.time+' Topic'])[0]?.start,esc(t.time)):''}${t.chapter?`<p class="rs-reference">${esc(t.chapter)}</p>`:''}<p>${esc(t.reflection)}</p><h4>Practice</h4><p>${esc(t.practice)}</p></section>`).join('')}${c.application?`<section class="rs-application"><h2>${esc(c.assignmentLabel)}</h2><p class="rs-preserve-lines">${esc(c.application)}</p></section>`:''}${c.references?.length?`<section class="rs-references"><h2>Ayat &amp; hadith</h2>${c.references.map(r=>`<article>${r.arabic?`<p lang="ar" dir="rtl">${esc(r.arabic)}</p>`:''}<p>${esc(r.meaning)}</p>${r.time?playback(entry,recordingTopics([r.time+' Reference'])[0]?.start,esc(r.time)):''}</article>`).join('')}</section>`:''}${c.transcript?`<details class="rs-transcript"><summary>Read full transcript</summary><pre>${esc(c.transcript)}</pre></details>`:''}`;
}
export function recordingDetail(entry,course){
 if(!entry)return `<div class="rs-empty"><h1>Recording unavailable</h1><p>This recording is not in the lessons currently available to you.</p>${action('Return to recordings','home')}</div>`;
 const stamp=date(entry.date),topics=entry.companion?.topics||entry.topics||[],quotes=entry.companion?.quotations||[];
 const follow=`<details class="rs-topics"><summary>Follow along by topic</summary>${topics.length?`<ol>${topics.map(t=>`<li>${entry.row||entry.authorVideo?playback(entry,t.start,`<span class="rs-topic-time">${esc(t.time)}</span><span>${esc(t.title)}</span>`,'aria-label="'+esc(t.time+' '+t.title)+'"'):`<div><span class="rs-topic-time">${esc(t.time)}</span><span>${esc(t.title)}</span></div>`}</li>`).join('')}</ol>`:'<p class="rs-muted">A topic guide has not been added to this recording.</p>'}</details>`;
 return `<article class="rs-episode"><div class="rs-episode-heading">${action('← Listen','home','','class="rs-back"')}<p class="sp-eyebrow">RECORDING${stamp?' · '+esc(stamp):''}${entry.duration?' · '+Math.round(entry.duration/60)+' MIN':''}</p><h1 tabindex="-1">${esc(entry.title)}</h1>${entry.recordedContext?.teacherName?`<p class="rs-reference">Teacher: ${esc(entry.recordedContext.teacherName)}</p>`:''}</div>
 <div class="rs-watch-read-layout"><section class="rs-watch-pane" aria-label="Watch and follow by topic"><div class="rs-player-slot"></div><div class="rs-actions">${playback(entry)}${entry.pending?'<span class="rs-pending">Recording link pending</span>':''}</div>${follow}</section>
 <section class="rs-read-pane" aria-label="Read along"><div class="rs-companion-layout${quotes.length?' has-quotations':''}"><div>${entry.summary?`<section class="rs-description"><h2>Lesson summary</h2>${summaryHTML(entry)}</section>`:''}${companionBody(entry.companion,entry)}${entry.row?.supportingFiles?.length?`<section class="rs-supporting-files"><h2>Supporting files</h2>${entry.row.supportingFiles.map(f=>`<button type="button" data-material="${esc(f.attachmentId)}" data-type="${esc(f.type)}" data-filename="${esc(f.title)}">${esc(f.title)}</button>`).join('')}</section>`:''}</div>${quotes.length?`<aside class="rs-words">${quotes.map(q=>`<blockquote>${esc(q.text)}</blockquote><p>${esc(q.speaker)}</p>${playback(entry,recordingTopics([q.time+' Quote'])[0]?.start,'Hear quotation')}`).join('')}</aside>`:''}</div>${entry.readingIds.length?`<section class="rs-associated"><h2>Read alongside</h2>${readingLinks(entry,course)}</section>`:''}${entry.quote?.text?`<aside class="rs-words"><span class="sp-eyebrow">WORDS TO CARRY</span><blockquote>${esc(entry.quote.text)}</blockquote></aside>`:''}</section></div></article>`;
}

export function recordingList({entries=[],loaded=true,more=false}={}){
 const starts=new Map();let previous=null;for(const entry of entries){const c=entry.recordedContext,key=c?JSON.stringify([c.offeringId,c.classIds,c.subject?.key||null,[...c.teacherIds].sort()]):'historical';if(c&&key!==previous)starts.set(entry.id,c);previous=key;}

 return `<section aria-labelledby="rs-recordings-title"><div class="rs-list-heading"><h2 id="rs-recordings-title">Recordings</h2><span>${entries.length}${more?'+':''} ${entries.length===1?'lesson':'lessons'}</span></div><div class="rs-episodes">${entries.map((e,i)=>`${starts.has(e.id)?`<h3 class="rs-teacher-group">${esc(starts.get(e.id).subject?.name||'Course recordings')} · ${esc(starts.get(e.id).teacherName)}</h3>`:''}<article class="rs-episode-card${(e.companion?.quotations?.[0]?.text||e.quote?.text)?' has-quotation':''}"><div class="rs-card-main"><div class="rs-card-meta"><span>RECORDING ${String(i+1).padStart(2,'0')}</span>${e.date?`<time datetime="${esc(e.date)}">${esc(date(e.date))}</time>`:''}${e.pending?'<span>Link pending</span>':''}${e.duration?`<span>${Math.round(e.duration/60)} min</span>`:''}</div><h3>${action(esc(e.title),'recording',e.id)}</h3>${e.summary?summaryHTML(e):'<p class="rs-summary-pending">The recording summary has not been added yet.</p>'}${e.summaryFormat==='bullets'&&(e.lessonReference||e.companion?.lessonReference)?'<p class="rs-reference">'+esc(e.lessonReference||e.companion.lessonReference)+'</p>':''}<div class="rs-card-actions">${action(playIcon+'Listen','recording',e.id,'class="rs-listen" data-listen="1"')}</div></div>${(e.companion?.quotations?.[0]?.text||e.quote?.text)?'<blockquote class="rs-card-quotation">'+esc(e.companion?.quotations?.[0]?.text||e.quote.text)+'</blockquote>':''}</article>`).join('')||`<p class="rs-empty">${loaded?'No recordings are available here yet.':'Loading your recordings…'}</p>`}</div>${more?'<button type="button" data-more-media class="rs-more">Show more recordings ↓</button>':''}</section>`;
}
export function readingList(readings=[]){return `<section><div class="rs-list-heading"><h1>Read</h1><span>${readings.length} ${readings.length===1?'reading':'readings'}</span></div><p class="rs-intro">Read and reflect. Supporting readings are also available from the recordings you can open.</p><div class="rs-readings">${readings.map(l=>`<article class="rs-reading-card"><p class="sp-eyebrow">${esc(l.group||'READ & REFLECT')}</p><h2>${action(esc(l.title),'lesson',l.id)}</h2>${l.summary?`<p>${esc(l.summary)}</p>`:''}${action('Read <span aria-hidden="true">→</span>','lesson',l.id,'class="rs-reading-link"')}</article>`).join('')||'<p class="rs-empty">There are no separate readings in this series yet. You can find the companion readings on each recording’s page.</p>'}</div></section>`;}

export function recordingWebsiteTabs(){return [['home','Listen'],['lessons','Read']];}

// Rearrange presentation only. The original reading nodes and authoring schema survive.
export function presentRecordingWebsite(root,{course,ui,assets,entries=[],guides=[],loaded=true,more=false,resources=[],pages=course.pages}={}){
 const document=root.ownerDocument;
 course=tafseerDisplayCourse(course);
 const inner=root.querySelector('.sp-inner'),page=root.querySelector('.sp-page');if(!inner||!page)return;
 const original=document.createElement('div');original.className='rs-original-reading';
 for(const node of [...page.children])if(!node.matches('.sp-footer'))original.append(node);
 const compact=!['home','about'].includes(ui.route),active=ui.route==='lesson'?'lessons':ui.route==='recording'?'home':ui.route;
 const cover=inner.querySelector('.sp-hero-image,.rs-series-cover>img')?.cloneNode(true);
 const tabs=recordingWebsiteTabs(course,pages);
 inner.classList.add('rs-shell');inner.dataset.seriesView=ui.route;
 inner.innerHTML=`${course.displayIdentity?.programmeKey==='mothers'?'<a class="rs-back rs-collections-back" href="/studio/?classroom=mothers">← MOU subjects</a>':'<a class="rs-back rs-collections-back" href="/studio/?view=collections&amp;collection='+ (course.displayIdentity?.kind==='TAFSEER'?'tafseer':'courses')+'">← Collections</a>'}<header class="rs-series-header${compact?' rs-compact':''}"><div class="rs-series-cover"></div><div class="rs-series-identity"><p class="sp-eyebrow">${esc(course.tag||'UMM ABBAD ACADEMY')}</p><${ui.route==='home'?'h1':'div'} class="rs-series-title">${action(esc(course.name),'home','','class="rs-series-name"')}</${ui.route==='home'?'h1':'div'}><p class="rs-subtitle">${esc(course.home.subtitle||'')}</p>${!compact&&course.home.description?`<p class="rs-series-description">${esc(course.home.description)}</p>`:''}<div class="sp-row-actions rs-series-tools">${action('About','about','','aria-current="'+(ui.route==='about'?'page':'false')+'"')}${pages?.materials||course.materials?.files?.length?action('PDF','materials','','aria-label="Course PDFs"'): ''}</div></div></header><nav class="rs-tabs" aria-label="Series navigation">${tabs.map(([route,label])=>action(label,route,'',`aria-current="${active===route?'page':'false'}"`)).join('')}</nav><section class="sp-page rs-page${ui.route==='lesson'?' sp-reading-page':''}"></section><footer class="sp-footer"><span>Umm Abbad Academy</span><span>Learn with purpose. Return often.</span></footer>`;
 const coverTarget=inner.querySelector('.rs-series-cover'),nameCover=tafseerCourseCover(course);if(nameCover){coverTarget.classList.add('tafseer-name-artwork');coverTarget.setAttribute('role','img');coverTarget.setAttribute('aria-label',course.name);coverTarget.innerHTML=nameCover;inner.classList.add('rs-tafseer');}else if(course.displayIdentity?.cover&&course.displayIdentity.key==='tawakkul-mindset'){const image=document.createElement('img');image.src=course.displayIdentity.cover;image.alt=course.name;coverTarget.append(image);}else if(cover)coverTarget.append(cover);else coverTarget.innerHTML=`<img data-course-image="${esc(course.home.imageId)}" src="/shared/assets/lilac-600.webp" alt="${esc(course.home.imageAlt||course.name)}">`;
 const target=inner.querySelector('.rs-page');
 if(ui.route==='home'){target.innerHTML=recordingList({entries,loaded,more})+(resources.length?'<section class=rs-readings aria-label="Playlist materials"><h2>Supporting material</h2>'+resources.map(r=>'<article class=rs-reading-card><p class=sp-eyebrow>'+esc(r.kind==='PDF'?'PDF':'READING WEBSITE')+'</p><h3><a href="'+esc(r.href)+'">'+esc(r.title)+'</a></h3></article>').join('')+'</section>':'');target.querySelector('.rs-episodes').insertAdjacentHTML('beforeend','<div class="rs-live-sessions" data-rs-live-sessions></div>');}
 else if(ui.route==='recording'){
  const entry=entries.find(e=>e.id===ui.recordingId),inline=course.displayIdentity?.readerLayout==='podcast-inline';target.innerHTML=!loaded&&!entry?'<p class="rs-empty">Loading your recording…</p>':recordingDetail(inline&&entry?{...entry,quote:null}:entry,course);
  if(entry&&!entry.pending){
   const readings=course.lessons.filter(l=>inline?l.sourceEdition===true&&(entries.length===1||entry.readingIds.includes(l.id)):entry.readingIds.includes(l.id)),collection=document.createElement('section');collection.className='rs-inline-readings';
   collection.innerHTML='<h2>Read alongside</h2>';
   for(const reading of readings){const holder=document.createElement('div');holder.innerHTML=renderCourse(course,{...ui,route:'lesson',lessonId:reading.id},assets);const article=holder.querySelector('.sp-lesson-article');if(!article)continue;article.id='recording-reading-'+reading.id;article.classList.add('rs-embedded-reading');const heading=article.querySelector('.sp-page-title');heading.id='recording-title-'+reading.id;article.setAttribute('aria-labelledby',heading.id);
    // These source blocks already have dedicated summary, quotation and topic
    // positions above. Keep the saved text intact in Read; avoid a second copy
    // in the recording's side-by-side companion.
    for(const node of article.querySelectorAll('[data-recording-intro],[data-recording-topics],[data-recording-quote]'))node.remove();
    for(const section of article.querySelectorAll('.sp-reading-section'))if(![...section.children].some(n=>!n.matches('h2,.sp-eyebrow')&&n.textContent.trim()))section.remove();
    if(heading.textContent.trim()===entry.title.trim()){article.setAttribute('aria-label',heading.textContent);article.removeAttribute('aria-labelledby');heading.remove();article.querySelector(':scope > .sp-eyebrow')?.remove();}
    collection.append(article);}
   if(readings.length){target.querySelector('.rs-read-pane').append(collection);target.querySelector('.rs-associated')?.remove();}
   const primary=course.lessons.filter(l=>l.sourceEdition===false&&entry.readingIds.includes(l.id)),closing=primary.flatMap(l=>l.sections).filter(s=>s.sourceKey==='recording-application:'+entry.row.lesson_id),quotes=primary.flatMap(l=>l.sections.flatMap(s=>s.blocks)).filter(b=>b.type==='quote'&&b.sourceKey==='recording-quote:'+entry.row.lesson_id);
   for(const section of closing){const end=document.createElement('section');end.className='rs-inline-closing';end.innerHTML='<h2>'+esc(section.title)+'</h2>'+section.blocks.map(b=>renderBlock(b,ui,assets)).join('');if(quotes.length){const words=document.createElement('aside');words.className='rs-words';words.innerHTML='<h3>Words to carry</h3>'+quotes.map(b=>renderBlock(b,ui,assets)).join('');const first=end.querySelector('.sp-block');if(first)first.after(words);else end.append(words);}target.querySelector('.rs-read-pane').append(end);}
  }
 }
 else if(ui.route==='lessons')target.innerHTML=readingList(independentReadings(course,guides,entries))+(resources.length?'<section class=rs-readings aria-label="Playlist materials">'+resources.map(r=>'<article class=rs-reading-card><p class=sp-eyebrow>'+esc(r.kind==='PDF'?'PDF':'READING WEBSITE')+'</p><h2><a href="'+esc(r.href)+'">'+esc(r.title)+'</a></h2></article>').join('')+'</section>':'');
 else if(ui.route==='about')target.innerHTML=`<section class="rs-about"><p class="sp-eyebrow">ABOUT THIS SERIES</p><h1>${esc(course.home.headline||course.name)}</h1><p class="rs-about-subtitle">${esc(course.home.subtitle)}</p><p>${esc(course.home.description)}</p>${course.home.caption?`<p class="rs-muted">${esc(course.home.caption)}</p>`:''}</section>`;
 else {const linked=ui.route==='lesson'&&entries.find(e=>e.readingIds.includes(ui.lessonId));if(linked){const back=original.querySelector('.sp-reading-toolbar [data-sp=lesson]');if(back&&back.textContent.includes('Recorded lesson')){back.dataset.sp='recording';back.dataset.id=linked.id;back.textContent='← Recording';}else original.insertAdjacentHTML('afterbegin',action('← Back to recording','recording',linked.id,'class="rs-back"'));}target.append(original);}
 replaceTafseerArtwork(root,course);
}

// Used only by private author previews; no operational website rights are inferred.
function authorSource(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;const id=u.hostname==='youtu.be'?u.pathname.slice(1):['www.youtube.com','youtube.com','www.youtube-nocookie.com'].includes(u.hostname)?(u.pathname==='/watch'?u.searchParams.get('v'):/^\/(embed|shorts|live)\//.test(u.pathname)?u.pathname.split('/')[2]:null):null;return /^[A-Za-z0-9_-]{11}$/.test(id||'')?id:null;}catch{return null;}}
export function authorRecordings(course){
 const entries=new Map();
 for(const l of course.lessons||[])for(const b of l.sections.flatMap(s=>s.blocks))if(b.type==='video'){
  const id=authorSource(b.videoUrl);if(!id)continue;
  let entry=entries.get(id);if(!entry){entry={id:'author:'+id,authorVideo:id,title:b.text||l.title,summary:l.summary||'',readingIds:[],topics:[],duration:b.durationSeconds};entries.set(id,entry);}
  if(!entry.readingIds.includes(l.id))entry.readingIds.push(l.id);
  const topics=recordingTopics(b.items||[]);if(topics.length)entry.topics=[...new Map([...entry.topics,...topics].map(t=>[t.start,t])).values()].sort((a,b)=>a.start-b.start);
 }
 return [...entries.values()];
}
