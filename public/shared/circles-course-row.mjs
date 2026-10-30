import {esc} from './model.mjs';

export function purchasedCourseCards(courses){
 return courses.map(course=>`<a class="circles-purchased-course" href="${esc(course.href)}" aria-label="${esc(course.label)} · Your paid course">${course.cover?`<img src="${esc(course.cover)}" alt="" loading="lazy">`:''}<span><small>Your paid course</small><h3>${esc(course.label)}</h3></span><span aria-hidden="true">↗</span></a>`).join('');
}

// Keep the design owner's artwork. Free cards are layout placeholders until
// their placement and timed classroom connection are approved separately.
export function circlesCourseRow(document){
 const templates=new WeakMap(),rendered=new WeakMap();
 function inactiveCards(root){
  for(const card of root.querySelectorAll('a[data-free-course]')){
   const placeholder=document.createElement('article');
   placeholder.className=card.className+' circles-free-inactive';
   placeholder.innerHTML=card.innerHTML;placeholder.setAttribute('aria-disabled','true');
   placeholder.setAttribute('aria-label',(card.getAttribute('aria-label')||'Free course')+' · Inactive');
   const badge=placeholder.querySelector('.free-course-badge');if(badge)badge.textContent='Inactive';
   placeholder.querySelector('.free-course-featured')?.remove();card.replaceWith(placeholder);
  }
 }
 return (signedIn,navigation)=>{
  const section=document.querySelector('#programmes.academy-free-courses');if(!section)return;
  if(!templates.has(section)){inactiveCards(section);templates.set(section,section.innerHTML);}
  const signature=JSON.stringify([signedIn,signedIn?navigation?.purchasedCourses:null]);
  if(rendered.get(section)===signature){inactiveCards(section);return;}
  section.innerHTML=templates.get(section);
  if(signedIn){
   const publicTrack=section.querySelector('#free-course-reel'),freeCards=[...(publicTrack?.querySelectorAll('.circles-free-inactive')||[])];
   section.querySelector('.eyebrow').textContent='Your learning';
   section.querySelector('h2').textContent='My courses';
   section.querySelector('.branch-programme-intro').textContent='Your current and completed paid courses, with the latest classes first.';
   publicTrack.id='circles-purchased-course-row';publicTrack.classList.add('circles-purchased-course-row');publicTrack.setAttribute('aria-label','Your paid courses');
   const courses=navigation?.purchasedCourses;
   publicTrack.innerHTML=!courses?'<p role="status">Loading your courses…</p>':courses.length?purchasedCourseCards(courses):'<p>No paid courses are linked to this account.</p>';
   if(freeCards.length){const free=document.createElement('section');free.className='circles-free-placeholders';free.setAttribute('aria-labelledby','circles-free-placeholders-title');free.innerHTML='<h3 id="circles-free-placeholders-title">Free courses</h3><p>Inactive for now</p><div class="free-course-reel" aria-label="Inactive free courses"></div>';free.querySelector('.free-course-reel').append(...freeCards);section.append(free);}
  }
  // Store before the observer refreshes; unchanged output causes no mutations.
  rendered.set(section,signature);
 };
}
