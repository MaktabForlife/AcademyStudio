import {accessBadge} from './access-badge.mjs';
import {esc} from './model.mjs';
import {homepageFreeCourseHref} from './homepage-free-courses.mjs';
import {learnCourses} from './circles-learn-courses.mjs';
import {approvedCourseCover} from './approved-course-artwork.mjs';

// Dates are ordering hints only; never infer completion or entitlement.
export function coursePreview(courses,limit=6){
 return courses.slice(0,limit);
}

export function purchasedCourseCards(courses){
 return courses.map(course=>{const access=course.accessLabel||'Your paid course',cover=approvedCourseCover(course.key)||course.cover;return `<a class="circles-purchased-course" href="${esc(course.href)}" aria-label="${esc(course.label)} · ${esc(access)}">${cover?`<img src="${esc(cover)}" alt="" loading="lazy">`:'<span class="course-cover-fallback" aria-hidden="true"></span>'}<span class="course-artwork-caption"><small>${esc(access)}</small><h3>${esc(course.label)}</h3>${Number.isSafeInteger(course.recordings)?`<span class="course-recording-count">${course.recordings>1000?'1000+':course.recordings} ${course.recordings===1?'recording':'recordings'}</span>`:''}${accessBadge(course.accessState||'subscribed')}</span></a>`;}).join('');
}

// Keep the artwork and the five explicitly reactivated free-course bookmarks.
// Other free cards retain their existing inactive presentation.
export function circlesCourseRow(document){
 const templates=new WeakMap(),rendered=new WeakMap(),positions=new WeakMap();
 function arrange(section,signedIn){
  section.classList.toggle('circles-dashboard-courses',signedIn);
  if(signedIn){const hero=document.querySelector('#circles-dashboard')||document.querySelector('#learning-circles');if(!hero)return;if(!positions.has(section)){const marker=document.createComment('public courses');section.before(marker);positions.set(section,marker);}if(hero.nextElementSibling!==section)hero.after(section);}
  else if(positions.has(section)){positions.get(section).replaceWith(section);positions.delete(section);}
 }
 function inactiveCards(root){
  for(const card of root.querySelectorAll('a[data-free-course]')){
   if(homepageFreeCourseHref(card.dataset.freeCourse))continue;
   const placeholder=document.createElement('article');
   placeholder.className=card.className+' circles-free-inactive';
   placeholder.innerHTML=card.innerHTML;placeholder.setAttribute('aria-disabled','true');
   placeholder.setAttribute('aria-label',(card.getAttribute('aria-label')||'Free course')+' · Inactive');
   const badge=placeholder.querySelector('.free-course-badge');if(badge)badge.textContent='Inactive';
   placeholder.querySelector('.free-course-featured')?.remove();card.replaceWith(placeholder);
  }
 }
 return (signedIn,navigation,mode)=>{
  const section=document.querySelector('#programmes.academy-free-courses');if(!section)return;
  if(!templates.has(section)){inactiveCards(section);templates.set(section,section.innerHTML);}
  arrange(section,signedIn);
  const signature=JSON.stringify([signedIn,mode,signedIn?navigation?.purchasedCourses:null,signedIn?navigation?.adminCourses:null]);
  if(rendered.get(section)===signature){inactiveCards(section);return;}
  section.innerHTML=templates.get(section);
  if(signedIn){
   const publicTrack=section.querySelector('#free-course-reel');
   section.querySelector('.eyebrow').textContent='Your learning';
   section.querySelector('h2').textContent='My courses';
   section.querySelector('.branch-programme-intro').textContent='Your current and recent courses.';
   const all=document.createElement('a');all.href='/studio/?view=collections&collection=courses';all.className='circles-show-all-courses';all.textContent='Show all';all.setAttribute('aria-label','Show all courses');section.querySelector('.section-head').append(all);
   publicTrack.id='circles-purchased-course-row';publicTrack.classList.add('circles-purchased-course-row');publicTrack.setAttribute('aria-label','Your paid courses');
   const courses=learnCourses(navigation,mode);
   publicTrack.innerHTML=!courses?'<p role="status">Loading your courses…</p>':courses.length?purchasedCourseCards(coursePreview(courses)):'<p>No paid courses are linked to this account.</p>';
  }
  // Store before the observer refreshes; unchanged output causes no mutations.
  rendered.set(section,signature);
 };
}
