// The owner's explicit cover selections override older cached catalogue art.
// Exact public presentation keys only; these labels never grant course access.
const covers=Object.freeze({
 'tawakkul':'/_assets/e7c21ff946ca2eb384a94fa96f413c37f4a5349fcffb03faaabb46d06648654b/shared/assets/tawakkul-mindset-approved.png',
 'tawakkul-mindset':'/_assets/e7c21ff946ca2eb384a94fa96f413c37f4a5349fcffb03faaabb46d06648654b/shared/assets/tawakkul-mindset-approved.png',
 'imratun-muminah':'/_assets/e7c21ff946ca2eb384a94fa96f413c37f4a5349fcffb03faaabb46d06648654b/shared/assets/imratun-muminah-approved.webp',
 'resilience':'/_assets/e7c21ff946ca2eb384a94fa96f413c37f4a5349fcffb03faaabb46d06648654b/circles/assets/resilience-quran-poster-source.png'
});
export const approvedCourseCover=key=>Object.hasOwn(covers,key)?covers[key]:null;
