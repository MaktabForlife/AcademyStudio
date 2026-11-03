// The five featured cards explicitly reactivated by the owner on 31 October.
// These bookmarks resolve the current public native mapping before the Studio
// reader checks account/access; they never expose an author payload or media URL.
export const activeHomepageFreeCourseKeys=Object.freeze([
 'imratun-muminah','resilience','living-with-mindfulness',
 'my-role-as-a-muslim-friend','my-salaah-my-joy'
]);
export function homepageFreeCourseHref(key){
 return activeHomepageFreeCourseKeys.includes(key)?'/circles/free-learning.html?course='+encodeURIComponent(key):null;
}
