import {tafseerDisplayCourse} from '../shared/tafseer-cover.mjs';
import {esc} from '../shared/model.mjs';

const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${name==='play'?'<rect x="3" y="3" width="18" height="18" rx="5"/><path d="m10 8 6 4-6 4Z"/>':'<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Z"/><path d="M12 5v15"/>'}</svg>`;

// Public presentation fixtures only. These buttons never call enrolment or media APIs.
export function renderPreviewHome(data){
 const css=document.createElement('link');css.rel='stylesheet';css.href='/preview/cards.css';document.head.append(css);
 const home=document.getElementById('homepage'),grid=document.getElementById('public-cards');home.classList.add('recordings-preview');
 home.querySelector('.hero .eyebrow').textContent='TAFSEER & COURSES · UMM ABBAD ACADEMY';
 home.querySelector('.hero h1').innerHTML='Listen. Reflect.<br><em>Let understanding grow.</em>';
 home.querySelector('.hero > div > p:not(.eyebrow)').textContent='Watch or listen to the lesson recordings, then deepen your understanding through companion reading and personal reflection.';
 home.querySelector('.hero aside p').innerHTML='Hear the lesson.<br>Carry it into your life.';
 document.getElementById('explore-button').textContent='Explore the lessons ↓';
 home.querySelector('.section-title .eyebrow').textContent='LESSON RECORDINGS · COMPANION READING';
 home.querySelector('.section-title h2').textContent='Tafseer & courses';
 const introduction=document.createElement('p');introduction.className='preview-catalogue-intro';introduction.textContent='Begin with Foundations, then explore each independent surah or course. The recordings lead your study; the reading accompanies them.';home.querySelector('.section-title').after(introduction);
 const note=document.createElement('p');note.className='preview-catalogue-note';note.textContent='Layout preview: these card buttons demonstrate the experience. Recordings and learning links are not connected here.';grid.after(note);
 const cards=data.cards.map(card=>({...card,title:tafseerDisplayCourse({name:card.title}).name})).sort((a,b)=>(a.id==='foundations'?-1:0)-(b.id==='foundations'?-1:0));
 grid.className='preview-course-grid';
 grid.innerHTML=cards.map(card=>{
  const foundation=card.id==='foundations',tone=['sage','rose','gold','plum'].includes(card.tone)?card.tone:'plum';
  return `<article class="preview-course-card preview-tone-${tone}" aria-labelledby="title-${esc(card.id)}">
   <div class="preview-card-meta"><span>${foundation?'START HERE · TAFSEER':card.id==='kahf'?'COURSE · BOOTCAMP':'TAFSEER'}</span>${foundation?'<span class="preview-open-badge">Open to all</span>':''}</div>
   <span class="preview-card-arabic" lang="ar" dir="rtl">${esc(card.arabic)}</span>
   <h3 id="title-${esc(card.id)}">${esc(card.title)}</h3>
   <p class="preview-card-summary">${esc(card.description)}</p>
   <div class="preview-card-actions">
    <button class="preview-recordings" data-preview-card="${esc(card.id)}" data-preview-kind="${foundation?'foundation':'recordings'}" aria-label="${foundation?'Explore':'View recordings for'} ${esc(card.title)}">${icon(foundation?'book':'play')}<span>${foundation?'Explore Foundations':'View recordings'}</span><span class="preview-action-arrow" aria-hidden="true">→</span></button>
    <button class="preview-reading" data-preview-card="${esc(card.id)}" data-preview-kind="reading" aria-label="Read ${esc(card.title)} companion website">${icon('book')}<span>${foundation?'Introduction & study notes':'Companion reading'}</span><span class="preview-action-arrow" aria-hidden="true">→</span></button>
   </div>
  </article>`;
 }).join('');
 const dialog=document.createElement('dialog');dialog.className='preview-card-dialog';dialog.setAttribute('aria-labelledby','preview-card-dialog-title');dialog.setAttribute('aria-describedby','preview-card-dialog-message');dialog.innerHTML='<p class="eyebrow">HOMEPAGE LAYOUT PREVIEW</p><h2 id="preview-card-dialog-title"></h2><p id="preview-card-dialog-message"></p><p class="preview-dialog-note">This preview does not play recordings, open learning pages or send access requests.</p><button class="primary" autofocus>Close</button>';document.body.append(dialog);
 dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
 grid.addEventListener('click',event=>{
  const button=event.target.closest('[data-preview-card]');if(!button)return;
  const card=cards.find(card=>card.id===button.dataset.previewCard);if(!card)return;
  const kind=button.dataset.previewKind;dialog.querySelector('h2').textContent=card.title+(kind==='recordings'?' · Recordings':kind==='reading'?' · Reading':'');
  dialog.querySelector('#preview-card-dialog-message').textContent=card.id==='foundations'?'Foundations of Tafseer will be open to all. Use it as the starting point for your study.':kind==='recordings'?'Contact Admin to receive access to the lesson recordings.':'Companion reading supports your study of the recorded lessons. Contact Admin to receive access.';
  dialog.showModal();
 });
}
