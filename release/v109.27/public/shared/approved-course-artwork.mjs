// The owner's explicit cover selections override older cached catalogue art.
// Exact public presentation keys only; these labels never grant course access.
const covers=Object.freeze({
 'tawakkul':'/_assets/c1c4983c31d0c151ee9715f885798991f8f9a2a9c37fa7921752ac7bc8761165/shared/assets/tawakkul-mindset-approved.png',
 'tawakkul-mindset':'/_assets/c1c4983c31d0c151ee9715f885798991f8f9a2a9c37fa7921752ac7bc8761165/shared/assets/tawakkul-mindset-approved.png',
 'imratun-muminah':'/_assets/c1c4983c31d0c151ee9715f885798991f8f9a2a9c37fa7921752ac7bc8761165/shared/assets/imratun-muminah-approved.webp',
 'resilience':'/_assets/c1c4983c31d0c151ee9715f885798991f8f9a2a9c37fa7921752ac7bc8761165/circles/assets/resilience-quran-poster-source.png'
});
export const approvedCourseCover=key=>Object.hasOwn(covers,key)?covers[key]:null;
