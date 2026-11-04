// The owner's explicit cover selections override older cached catalogue art.
// Exact public presentation keys only; these labels never grant course access.
const covers=Object.freeze({
 'tawakkul':'/_assets/15bcf09e4bde897f57816220d377abc670d0dfd15d1d3c8f7df35999cb64fb55/shared/assets/tawakkul-mindset-approved.png',
 'tawakkul-mindset':'/_assets/15bcf09e4bde897f57816220d377abc670d0dfd15d1d3c8f7df35999cb64fb55/shared/assets/tawakkul-mindset-approved.png',
 'imratun-muminah':'/_assets/15bcf09e4bde897f57816220d377abc670d0dfd15d1d3c8f7df35999cb64fb55/shared/assets/imratun-muminah-approved.webp',
 'resilience':'/_assets/15bcf09e4bde897f57816220d377abc670d0dfd15d1d3c8f7df35999cb64fb55/circles/assets/resilience-quran-poster-source.png'
});
export const approvedCourseCover=key=>Object.hasOwn(covers,key)?covers[key]:null;
