import {esc} from './model.mjs';
import {recordingStart,recordingTopics} from './recording-companion.mjs';

const video=row=>row?.attachment_id&&['video/youtube','video/mp4'].includes(row.type);
const sourceId=guide=>guide.editorialLessonId||guide.lessonId;
const date=value=>{const d=new Date(value);return value&&!Number.isNaN(d.getTime())?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Johannesburg'}).format(d):'';};
export const seriesRoute=(route,id='')=>new URLSearchParams({view:route,...(id?{id}:{})}).toString();
export function parseSeriesRoute(value){const p=new URLSearchParams(value.replace(/^#/,'')),view=p.get('view');return ['home','lessons','about','recording','lesson','materials','sessions'].includes(view)?{route:view,...(p.get('id')?{[view==='recording'?'recordingId':'lessonId']:p.get('id')}:{})}:{route:'home'};}

// Only the already permission-filtered feed can supply operational playback.
// Pending companions are included solely when the private review adapter names them.
export function seriesRecordings({media=[],guides=[],pendingIds=[]}={}){
 const unique=new Map(),entries=[];
 for(const row of media.filter(video)){const key=row.asset_id||row.attachment_id,previous=unique.get(key),reviewed=r=>guides.some(g=>g.lessonId===r.lesson_id&&g.status==='reviewed');if(!previous||reviewed(row)&&!reviewed(previous))unique.set(key,row);}
 for(const row of [...unique.values()].sort((a,b)=>String(a.lesson_date||'').localeCompare(String(b.lesson_date||''))||String(a.attachment_id).localeCompare(String(b.attachment_id)))){
  const guide=guides.find(g=>g.lessonId===row.lesson_id&&g.status==='reviewed');
  entries.push({id:row.attachment_id,row,title:guide?.title||row.title||'Recorded lesson',summary:guide?.summary||'',date:row.lesson_date,readingIds:guide?.readingId?[guide.readingId]:[],topics:guide?.topics||[],quote:guide?.quote});
 }
 const pending=new Set(pendingIds);
 for(const guide of guides)if(pending.has(sourceId(guide))&&!entries.some(e=>e.row?.lesson_id===guide.lessonId))entries.push({id:'pending:'+sourceId(guide),pending:true,title:guide.title,summary:guide.summary||'',readingIds:guide.readingId?[guide.readingId]:[],topics:guide.topics||[],quote:guide.quote});
 return entries;
}

// An association is explicit in the source, never inferred from reading order.
export function independentReadings(course,guides=[],entries=[]){
 const linked=new Set([...guides.map(g=>g.readingId),...entries.flatMap(e=>e.readingIds||[])]);
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
const readingLinks=(entry,course)=>entry.readingIds.filter(id=>course.lessons.some(l=>l.id===id)).map(id=>action(esc(course.lessons.find(l=>l.id===id).title)+' <span aria-hidden="true">→</span>','lesson',id,'class="rs-reading-link"')).join('');
export function recordingDetail(entry,course){
 if(!entry)return `<div class="rs-empty"><h1>Recording unavailable</h1><p>This recording is not in the lessons currently available to you.</p>${action('Return to recordings','home')}</div>`;
 const stamp=date(entry.date),topics=entry.topics||[];
 return `<article class="rs-episode"><div class="rs-episode-heading">${action('← All recordings','home','','class="rs-back"')}<p class="sp-eyebrow">RECORDING${stamp?' · '+esc(stamp):''}${entry.duration?' · '+Math.round(entry.duration/60)+' MIN':''}</p><h1 tabindex="-1">${esc(entry.title)}</h1><div class="rs-actions">${playback(entry)}${entry.pending?'<span class="rs-pending">Recording link pending</span>':''}</div></div>${entry.summary?`<section class="rs-description"><h2>Lesson summary</h2><p>${esc(entry.summary)}</p></section>`:''}<section class="rs-topics" aria-labelledby="rs-topics-title"><div class="rs-section-title"><span class="rs-section-icon" aria-hidden="true">≋</span><h2 id="rs-topics-title">Follow along by topic</h2></div>${topics.length?`<ol>${topics.map(t=>`<li>${entry.row||entry.authorVideo?playback(entry,t.start,`<span class="rs-topic-time">${esc(t.time)}</span><span>${esc(t.title)}</span>`,'aria-label="'+esc(t.time+' '+t.title)+'"'):`<div><span class="rs-topic-time">${esc(t.time)}</span><span>${esc(t.title)}</span></div>`}</li>`).join('')}</ol>`:'<p class="rs-muted">A topic guide has not been added to this recording.</p>'}</section>${entry.readingIds.length?`<section class="rs-associated"><h2>Read alongside</h2>${readingLinks(entry,course)}</section>`:''}${entry.quote?.text?`<aside class="rs-words"><span class="sp-eyebrow">WORDS TO CARRY</span><blockquote>${esc(entry.quote.text)}</blockquote></aside>`:''}</article>`;
}
export function recordingList({entries=[],loaded=true,more=false}={}){
 return `<section aria-labelledby="rs-recordings-title"><div class="rs-list-heading"><h2 id="rs-recordings-title">Recordings</h2><span>${entries.length}${more?'+':''} ${entries.length===1?'lesson':'lessons'}</span></div><div class="rs-episodes">${entries.map((e,i)=>`<article class="rs-episode-card"><div class="rs-card-meta"><span>RECORDING ${String(i+1).padStart(2,'0')}</span>${e.date?`<time datetime="${esc(e.date)}">${esc(date(e.date))}</time>`:''}${e.pending?'<span>Link pending</span>':''}${e.duration?`<span>${Math.round(e.duration/60)} min</span>`:''}</div><h3>${action(esc(e.title),'recording',e.id)}</h3>${e.summary?`<p class="rs-card-summary">${esc(e.summary)}</p>`:''}<div class="rs-card-actions">${playback(e)}${action('View lesson <span aria-hidden="true">→</span>','recording',e.id,'class="rs-view-lesson"')}</div></article>`).join('')||`<p class="rs-empty">${loaded?'No recordings are available here yet.':'Loading your recordings…'}</p>`}</div>${more?'<button type="button" data-more-media class="rs-more">Show more recordings ↓</button>':''}</section>`;
}
export function readingList(readings=[]){return `<section><div class="rs-list-heading"><h1>Read</h1><span>${readings.length} ${readings.length===1?'reading':'readings'}</span></div><p class="rs-intro">Material to read and reflect on in its own right. Readings linked to a recording are kept with that lesson.</p><div class="rs-readings">${readings.map(l=>`<article class="rs-reading-card"><p class="sp-eyebrow">${esc(l.group||'READ & REFLECT')}</p><h2>${action(esc(l.title),'lesson',l.id)}</h2>${l.summary?`<p>${esc(l.summary)}</p>`:''}${action('Read <span aria-hidden="true">→</span>','lesson',l.id,'class="rs-reading-link"')}</article>`).join('')||'<p class="rs-empty">There are no separate readings in this series yet. You can find the companion readings on each recording’s page.</p>'}</div></section>`;}

// Rearrange presentation only. The original reading nodes and authoring schema survive.
export function presentRecordingWebsite(root,{course,ui,entries=[],guides=[],loaded=true,more=false,pages=course.pages}={}){
 const inner=root.querySelector('.sp-inner'),page=root.querySelector('.sp-page');if(!inner||!page)return;
 const original=document.createElement('div');original.className='rs-original-reading';
 for(const node of [...page.children])if(!node.matches('.sp-footer'))original.append(node);
 const compact=!['home','about'].includes(ui.route),active=ui.route==='lesson'?'lessons':ui.route==='recording'?'home':ui.route;
 const cover=inner.querySelector('.sp-hero-image,.rs-series-cover>img')?.cloneNode(true);
 const tabs=[['home','Recordings'],['lessons','Read'],['about','About'],...(pages?.materials?[['materials','Materials']]:[]),...(pages?.sessions?[['sessions','Sessions']]:[])];
 inner.classList.add('rs-shell');inner.dataset.seriesView=ui.route;
 inner.innerHTML=`<header class="rs-series-header${compact?' rs-compact':''}"><div class="rs-series-cover"></div><div class="rs-series-identity"><p class="sp-eyebrow">${esc(course.tag||'UMM ABBAD ACADEMY')}</p><${ui.route==='home'?'h1':'div'} class="rs-series-title">${action(esc(course.name),'home','','class="rs-series-name"')}</${ui.route==='home'?'h1':'div'}><p class="rs-subtitle">${esc(course.home.subtitle||'')}</p>${!compact&&course.home.description?`<p class="rs-series-description">${esc(course.home.description)}</p>`:''}<div class="sp-row-actions rs-series-tools"></div></div></header><nav class="rs-tabs" aria-label="Series navigation">${tabs.map(([route,label])=>action(label,route,'',`aria-current="${active===route?'page':'false'}"`)).join('')}</nav><section class="sp-page rs-page${ui.route==='lesson'?' sp-reading-page':''}"></section><footer class="sp-footer"><span>Umm Abbad Academy</span><span>Learn with purpose. Return often.</span></footer>`;
 const coverTarget=inner.querySelector('.rs-series-cover');if(cover)coverTarget.append(cover);else coverTarget.innerHTML=`<img data-course-image="${esc(course.home.imageId)}" src="/shared/assets/lilac-600.webp" alt="${esc(course.home.imageAlt||course.name)}">`;
 const target=inner.querySelector('.rs-page');
 if(ui.route==='home')target.innerHTML=recordingList({entries,loaded,more});
 else if(ui.route==='recording')target.innerHTML=!loaded&&!entries.some(e=>e.id===ui.recordingId)?'<p class="rs-empty">Loading your recording…</p>':recordingDetail(entries.find(e=>e.id===ui.recordingId),course);
 else if(ui.route==='lessons')target.innerHTML=readingList(independentReadings(course,guides,entries));
 else if(ui.route==='about')target.innerHTML=`<section class="rs-about"><p class="sp-eyebrow">ABOUT THIS SERIES</p><h1>${esc(course.home.headline||course.name)}</h1><p class="rs-about-subtitle">${esc(course.home.subtitle)}</p><p>${esc(course.home.description)}</p>${course.home.caption?`<p class="rs-muted">${esc(course.home.caption)}</p>`:''}</section>`;
 else {const linked=ui.route==='lesson'&&entries.find(e=>e.readingIds.includes(ui.lessonId));if(linked){const back=original.querySelector('.sp-reading-toolbar [data-sp=lesson]');if(back&&back.textContent.includes('Recorded lesson')){back.dataset.sp='recording';back.dataset.id=linked.id;back.textContent='← Recording';}else original.insertAdjacentHTML('afterbegin',action('← Back to recording','recording',linked.id,'class="rs-back"'));}target.append(original);}
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
