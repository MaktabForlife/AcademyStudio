// Reuse the published announcement nodes and their existing gallery/contact
// actions. This presentation layer neither fetches nor publishes content.
import {accessBadge} from './access-badge.mjs';
export function publicHome(document){
 const prepared=new WeakSet();
 return ()=>{
  for(const card of document.querySelectorAll('a.free-course-card[data-free-course],a.free-course-card[data-paid-course]')){
   const key=card.dataset.freeCourse||card.dataset.paidCourse,art=card.querySelector('.free-course-art');if(!art||art.dataset.cardStandard==='green')continue;
   art.dataset.cardStandard='green';const title=card.querySelector('h3'),label=title?.textContent||card.getAttribute('aria-label')?.split(' · ')[0];if(!label)continue;
   const caption=document.createElement('span');caption.className='homepage-course-caption';const heading=document.createElement('h3');heading.textContent=label;caption.append(heading);
   const metadata=[...(window.AcademyApprovedFreeCourses||[]),...(window.AcademyPaidCourses||[])].find(c=>c.key===key);
   if(Number.isSafeInteger(metadata?.recordingCount)){const count=document.createElement('small');count.textContent=metadata.recordingCount+' '+(metadata.recordingCount===1?'recording':'recordings');caption.append(count);}
   art.querySelectorAll('.free-course-title,.free-course-badge,.course-recording-count').forEach(node=>node.remove());caption.insertAdjacentHTML('beforeend',accessBadge(card.dataset.freeCourse?'free':'required'));art.append(caption);
   if(key==='tawakkul-mindset'){let image=art.querySelector('img');if(!image){image=document.createElement('img');art.prepend(image);}image.src='/shared/assets/tawakkul-mindset-approved.png';image.alt='منهج التوكل · Tawakkul Mindset';}
  }

  const section=document.querySelector('#academy-news'),reel=section?.querySelector('#academy-news-reel');
  if(!section||!reel||prepared.has(section))return;
  const cards=[...reel.querySelectorAll('.academy-news-card')];if(!cards.length)return;
  prepared.add(section);section.classList.add('announcements-master-detail');
  reel.removeAttribute('data-reel');reel.removeAttribute('tabindex');reel.removeAttribute('role');reel.className='announcement-detail';reel.setAttribute('aria-label','Selected announcement');
  section.querySelectorAll('.reel-controls').forEach(node=>node.remove());
  const layout=document.createElement('div');layout.className='announcement-layout';reel.before(layout);layout.append(reel);
  const side=document.createElement('div');side.className='announcement-summaries';layout.append(side);
  const controls=document.createElement('div');controls.className='announcement-steps';
  controls.innerHTML='<button type="button" aria-label="Previous announcement">←</button><span aria-live="polite"></span><button type="button" aria-label="Next announcement">→</button>';
  const list=document.createElement('nav');list.className='announcement-summary-list';list.setAttribute('aria-label','Choose an announcement');side.append(controls,list);
  const buttons=cards.map((card,index)=>{
   card.id='announcement-detail-'+index;card.setAttribute('role','region');
   const button=document.createElement('button');button.type='button';button.setAttribute('aria-controls',card.id);
   const image=card.querySelector('img'),title=card.querySelector('h3'),category=card.querySelector('.news-category');
   const heading=(title?.innerText||title?.textContent||image?.alt||'Academy announcement').replace(/\s+/g,' ').replace(/ flyer$/,'').trim();
   const small=document.createElement('small');small.textContent=category?.textContent||(card.dataset.announcement==='kahf-bootcamp'?'Happening now':'2027 prospectus');
   const strong=document.createElement('strong');strong.textContent=heading;button.append(small,strong);
   const summary=card.querySelector('h3 + p');if(summary){const p=document.createElement('span');p.textContent=summary.textContent;button.append(p);}
   button.onclick=()=>select(index);list.append(button);card.setAttribute('aria-label',heading);return button;
  });
  let selected=0;
  function select(index){selected=(index+cards.length)%cards.length;cards.forEach((card,i)=>{card.hidden=i!==selected;});buttons.forEach((button,i)=>button.setAttribute('aria-current',i===selected?'true':'false'));controls.querySelector('span').textContent=(selected+1)+' of '+cards.length;}
  const steps=controls.querySelectorAll('button');steps[0].onclick=()=>select(selected-1);steps[1].onclick=()=>select(selected+1);select(0);
 };
}
