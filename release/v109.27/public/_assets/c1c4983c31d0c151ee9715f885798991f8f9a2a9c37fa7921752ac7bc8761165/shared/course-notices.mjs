import {esc} from './model.mjs';

// Confirmed catalogue presentation only. These notices have no website,
// enrolment, offering identity or content-access grant.
export const forthcomingCourseNotices=Object.freeze([
 Object.freeze({key:'parenting-for-the-aakirah',title:'Parenting for the Aakhirah',access:'free'}),
 Object.freeze({key:'names-of-allah-course',title:'Names of Allah',access:'free'})
]);
export const comingSoonLabel='Coming soon إن شاء الله';

export function comingSoonCard(item){
 return `<article class="free-library-card course-coming-soon" aria-label="${esc(item.title)} · ${comingSoonLabel}"><div class="free-cover course-notice-cover"><span class="free-library-badge">Free</span><span class="course-notice-ornament" aria-hidden="true">◇</span><h2>${esc(item.title)}</h2><p class="course-notice-status">Coming soon <span lang="ar" dir="rtl">إن شاء الله</span></p></div></article>`;
}
