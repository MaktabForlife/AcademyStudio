// Read the Academy-published snapshot. Legacy flyers remain only before the
// explicitly reviewed first publication; an empty publication stays empty.
import {announcementDisplay,openAnnouncement} from './announcements-view.mjs';
import {announcementFeed} from './announcement-feed.mjs';
import {accessBadge} from './access-badge.mjs';
import {approvedCourseCover} from './approved-course-artwork.mjs';
export function publicHome(document){
 const prepared=new WeakSet(),preparedTrackers=new WeakSet(),view=document.defaultView,feed=announcementFeed({url:new URL('/api/public/academy-announcements',document.baseURI||view.location?.href||'https://local.invalid/').href,assetBase:document.baseURI||view.location?.href||'https://local.invalid/',assetPath:'/api/public/academy-announcements/',fetcher:(...args)=>view.fetch(...args),storage:view.sessionStorage});
 function mountAnnouncements(section,reel){
  prepared.add(section);
  const stylesheet='/shared/announcements-view.css';if(!document.querySelector('link[href="'+stylesheet+'"]')){const link=document.createElement('link');link.rel='stylesheet';link.href=stylesheet;document.head.append(link);}
  const panel=document.createElement('div');panel.className='announcement-public-panel';panel.setAttribute('aria-live','polite');panel.innerHTML='<p role="status">Loading announcements…</p>';reel.before(panel);reel.hidden=true;
  const oldControls=[...section.querySelectorAll('.reel-controls')];oldControls.forEach(node=>node.hidden=true);
  let mounted=null;const show=value=>{if(!section.isConnected)return;section.hidden=!value.announcements.length;section.classList.add('announcements-v2');if(mounted)mounted.update(value.announcements);else mounted=announcementDisplay(panel,{announcements:value.announcements,onOpen:(row,opener)=>openAnnouncement(document,row,{opener})});};
  const load=async()=>{try{show(await feed.load());}catch(error){if(!section.isConnected)return;if(feed.saved){show(feed.saved);return;}if(error.code==='ANNOUNCEMENTS_NOT_ACTIVATED'){panel.remove();reel.hidden=false;oldControls.forEach(node=>node.hidden=false);legacyAnnouncements(section,reel);return;}panel.innerHTML='<p role="status">Announcements could not be loaded.</p><button type="button">Try again</button>';panel.querySelector('button').onclick=load;}};void load();
 }
 function legacyAnnouncements(section,reel){
  const cards=[...reel.querySelectorAll('.academy-news-card')];if(!cards.length)return;
  section.classList.add('announcements-master-detail','announcements-collage');
  reel.removeAttribute('data-reel');reel.removeAttribute('tabindex');reel.removeAttribute('role');reel.className='announcement-detail';
  section.querySelectorAll('.reel-controls').forEach(node=>node.remove());
  const layout=document.createElement('div');layout.className='announcement-layout';reel.before(layout);
  const collage=document.createElement('div');collage.className='announcement-picture-collage';collage.setAttribute('aria-label','Academy announcement pictures');layout.append(collage);
  const side=document.createElement('div');side.className='announcement-summaries';layout.append(side);
  const list=document.createElement('nav');list.className='announcement-summary-list';list.setAttribute('aria-label','Choose an announcement');side.append(list);
  const viewer=document.createElement('dialog');viewer.className='announcement-viewer';viewer.setAttribute('aria-labelledby','announcement-viewer-title');
  const toolbar=document.createElement('header'),heading=document.createElement('h2'),close=document.createElement('button');heading.id='announcement-viewer-title';close.type='button';close.textContent='Close ×';close.setAttribute('aria-label','Close announcement');toolbar.append(heading,close);viewer.append(toolbar,reel);section.append(viewer);
  let selected=0,opener;
  function select(index,trigger){selected=index;opener=trigger;heading.textContent=buttons[index].querySelector('strong').textContent;cards.forEach((card,i)=>{card.hidden=i!==index;});buttons.forEach((button,i)=>button.setAttribute('aria-current',i===index?'true':'false'));if(!viewer.open){if(viewer.showModal)viewer.showModal();else viewer.setAttribute('open','');}}
  close.onclick=()=>{if(viewer.close)viewer.close();else viewer.removeAttribute('open');opener?.focus?.();};
  viewer.addEventListener('close',()=>opener?.focus?.());
  const buttons=cards.map((card,index)=>{
   card.id='announcement-detail-'+index;card.setAttribute('role','region');
   const button=document.createElement('button');button.type='button';button.setAttribute('aria-controls',card.id);button.setAttribute('aria-haspopup','dialog');
   const image=card.querySelector('img'),title=card.querySelector('h3'),category=card.querySelector('.news-category');
   const label=(title?[...title.childNodes].map(node=>node.nodeName==='BR'?' ':node.textContent).join(''):image?.alt||'Academy announcement').replace(/\s+/g,' ').replace(/ flyer$/,'').trim();
   const small=document.createElement('small');small.textContent=category?.textContent||(card.dataset.announcement==='kahf-bootcamp'?'Happening now':'2027 prospectus');
   const strong=document.createElement('strong');strong.textContent=label;button.append(small,strong);
   const summary=card.querySelector('h3 + p');if(summary){const p=document.createElement('span');p.textContent=summary.textContent;button.append(p);}
   button.onclick=()=>select(index,button);list.append(button);card.setAttribute('aria-label',label);card.hidden=true;
   if(image){const tile=document.createElement('button');tile.type='button';tile.setAttribute('aria-label','View '+label);tile.setAttribute('aria-haspopup','dialog');const picture=document.createElement('img');picture.src=image.getAttribute('src');picture.alt='';picture.loading='lazy';tile.append(picture);tile.onclick=()=>select(index,tile);collage.append(tile);}
   return button;
  });
  // Reuse the existing Academy enquiry flow once for all enrolment flyers.
  if(cards.some(card=>card.dataset.announcement?.startsWith('2027-'))){const enrol=document.createElement('button');enrol.type='button';enrol.className='announcement-enrol';enrol.dataset.action='news-enquiry';enrol.dataset.id='enrolments';enrol.textContent='Enrol now ↗';side.append(enrol);}

 }
 return ()=>{
  const trackers=document.querySelector('#memorisation-reel');
  if(trackers&&!preparedTrackers.has(trackers)&&view?.AcademyMemorisation?.selectSets){
   preparedTrackers.add(trackers);const shown=new Set([...trackers.querySelectorAll('[data-memory-set]')].map(card=>card.dataset.memorySet));
   const remaining=(view.AcademyMemorisationSets||[]).filter(set=>!shown.has(set.id));
   for(const set of view.AcademyMemorisation.selectSets(remaining,Math.max(0,6-shown.size))){
    const card=document.createElement('article');card.className='memory-card';card.dataset.memorySet=set.id;const top=document.createElement('div');top.className='memory-card-top';const level=document.createElement('span');level.className='memory-level';level.textContent='Level '+set.level;const title=document.createElement('h3');title.textContent=set.name;const count=document.createElement('p');count.textContent=set.tasks.length+' '+(set.subject==='SURAHS'?'surahs':'duas');top.append(level,title,count);const bottom=document.createElement('div');bottom.className='memory-card-bottom';const open=document.createElement('button');open.type='button';open.dataset.action='memorisation-set';open.dataset.id=set.id;open.textContent='View tasks';bottom.append(open);card.append(top,bottom);trackers.append(card);
   }
  }
  for(const card of document.querySelectorAll('a.free-course-card[data-free-course],a.free-course-card[data-paid-course]')){
   const key=card.dataset.freeCourse||card.dataset.paidCourse,art=card.querySelector('.free-course-art');if(!art||art.dataset.cardStandard==='green')continue;
   art.dataset.cardStandard='green';const title=card.querySelector('h3'),label=title?.textContent||card.getAttribute('aria-label')?.split(' · ')[0];if(!label)continue;
   const caption=document.createElement('span');caption.className='homepage-course-caption';const heading=document.createElement('h3');heading.textContent=label;caption.append(heading);
   const metadata=[...(view?.AcademyApprovedFreeCourses||[]),...(view?.AcademyPaidCourses||[])].find(c=>c.key===key);
   if(Number.isSafeInteger(metadata?.recordingCount)){const count=document.createElement('small');count.textContent=metadata.recordingCount+' '+(metadata.recordingCount===1?'recording':'recordings');caption.append(count);}
   art.querySelectorAll('.free-course-title,.free-course-badge,.course-recording-count').forEach(node=>node.remove());caption.insertAdjacentHTML('beforeend',accessBadge(card.dataset.freeCourse?'free':'required'));art.append(caption);
   const cover=approvedCourseCover(key);if(cover){let image=art.querySelector('img');if(!image){image=document.createElement('img');art.prepend(image);}image.src=cover;image.alt=label;}
  }

  const section=document.querySelector('#academy-news'),reel=section?.querySelector('#academy-news-reel');
  if(section&&reel&&!prepared.has(section))mountAnnouncements(section,reel);
 };
}
