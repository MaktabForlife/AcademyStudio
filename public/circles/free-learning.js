(function (root) {
  'use strict';
  const epoch = Date.parse('2026-10-30T00:00:00+03:00');
  const interval = 6 * 24 * 60 * 60 * 1000;
  function rotationCycle(now = Date.now()) {
    const value = now instanceof Date ? now.getTime() : Number(now);
    return Number.isFinite(value) ? Math.max(0, Math.floor((value - epoch) / interval)) : 0;
  }
  function approvedCourses(courses = root.AcademyApprovedFreeCourses || []) {
    return courses.filter(course => course.approved === true && course.access === 'free' && course.collection !== 'tafseer');
  }
  function homepageCourses(now = Date.now(), courses = root.AcademyApprovedFreeCourses || []) {
    const eligible = approvedCourses(courses);
    if (!eligible.length) return [];
    const first = rotationCycle(now) * (eligible.length > 5 ? 5 : 1) % eligible.length;
    return [...eligible.slice(first), ...eligible.slice(0, first)].slice(0,5);
  }
  function homepagePaidCourses(now=Date.now(),courses=root.AcademyPaidCourses||[]){
    const eligible=courses.filter(course=>course.approved===true&&course.access==='paid');
    return eligible.length?[eligible[rotationCycle(now)%eligible.length]]:[];
  }
  function nextRotation(now = Date.now()) {
    return new Date(epoch + (rotationCycle(now) + 1) * interval).toISOString();
  }
  function patternedCover() {
    return `<span class="free-ulum-cover" role="img" aria-label="علوم القرآن · Introduction to Qur’anic Studies"><svg viewBox="0 0 300 300" aria-hidden="true"><defs><pattern id="free-ulum-pattern" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M18 2 23 13 34 18 23 23 18 34 13 23 2 18 13 13Z M7 7h22v22H7Z" fill="none" stroke="currentColor" stroke-width=".65"/></pattern></defs><rect width="300" height="300" fill="#f3eee1"/><rect width="300" height="300" fill="url(#free-ulum-pattern)" opacity=".5"/><path d="M35 22h230v12a12 12 0 0 0 12 12h1v208h-1a12 12 0 0 0-12 12v12H35v-12a12 12 0 0 0-12-12h-1V46h1a12 12 0 0 0 12-12Z" fill="#faf6eb" stroke="currentColor"/><path d="M45 34h210v12a12 12 0 0 0 12 12v184a12 12 0 0 0-12 12v12H45v-12a12 12 0 0 0-12-12V58a12 12 0 0 0 12-12Z" fill="none" stroke="currentColor" stroke-width=".5"/></svg><span class="free-ulum-arabic" lang="ar" dir="rtl">علوم القرآن</span><span class="free-ulum-flourish" aria-hidden="true">◇</span><span class="free-ulum-english">Introduction to<br>Qur’anic Studies</span></span>`;
  }
  const api = {rotationCycle, approvedCourses, homepageCourses, homepagePaidCourses, nextRotation, patternedCover};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AcademyFreeLearning = api;
})(globalThis);
