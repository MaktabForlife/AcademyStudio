// The owner's explicit cover selections override older cached catalogue art.
// Exact public presentation keys only; these labels never grant course access.
const covers=Object.freeze({
 'tawakkul':'/shared/assets/tawakkul-mindset-approved.png',
 'tawakkul-mindset':'/shared/assets/tawakkul-mindset-approved.png',
 'imratun-muminah':'/shared/assets/imratun-muminah-approved.webp',
 'resilience':'/circles/assets/resilience-quran-poster-source.png'
});
export const approvedCourseCover=key=>Object.hasOwn(covers,key)?covers[key]:null;
