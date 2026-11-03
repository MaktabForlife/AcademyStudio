// The owner's explicit cover selections override older cached catalogue art.
// Exact public presentation keys only; these labels never grant course access.
const covers=Object.freeze({
 'tawakkul':'/_assets/9108516c2722b78ed8d680415421a0669c7a8549aa7f015a5e35db20132c7806/shared/assets/tawakkul-mindset-approved.png',
 'tawakkul-mindset':'/_assets/9108516c2722b78ed8d680415421a0669c7a8549aa7f015a5e35db20132c7806/shared/assets/tawakkul-mindset-approved.png',
 'imratun-muminah':'/_assets/9108516c2722b78ed8d680415421a0669c7a8549aa7f015a5e35db20132c7806/shared/assets/imratun-muminah-approved.webp',
 'resilience':'/_assets/9108516c2722b78ed8d680415421a0669c7a8549aa7f015a5e35db20132c7806/circles/assets/resilience-quran-poster-source.png'
});
export const approvedCourseCover=key=>Object.hasOwn(covers,key)?covers[key]:null;
