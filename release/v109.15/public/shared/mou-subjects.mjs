import {esc} from './model.mjs';
import {comingSoonLabel} from './course-notices.mjs';

// Display keys from the confirmed prospectus plan are not native website IDs
// or permissions. No content/media/enrolment link is made from these labels.
export const mouSubjects=Object.freeze([
 ['surah-al-baqarah','Tadabbur: Surah al-Baqarah'],
 ['riyadus-saaliheen','Riyadus Saaliheen'],
 ['arbaeen-imam-nawawi','Arba’een of Imam Nawawi'],
 ['murshidul-qaari','Murshidul Qaari'],
 ['madaarijus-saalikeen','Madaarijus Saalikeen'],
 ['al-adab-al-mufrad','Al-Adab al-Mufrad'],
 ['ihya-ulumid-deen','Ihya Ulumid Deen'],
 ['taarikh-history-of-islam','Taarikh: History of Islam'],
 ['kitabul-adhkar','Kitabul Adhkar'],
 ['shamail-of-nabi','Shamail of Nabi ﷺ']
].map(([key,title],index)=>Object.freeze({key,title,first:index===0})));

export function mouSubjectsHTML(){
 return `<section class="mou-subjects" aria-labelledby="mou-subjects-title"><h2 id="mou-subjects-title">Programme content</h2><div class="card-grid">${mouSubjects.map(subject=>`<article class="card mou-subject-card" aria-label="${esc(subject.title)} · ${subject.first?'First subject':comingSoonLabel}">${subject.first?'<p class="eyebrow">FIRST SUBJECT</p>':''}<h3>${esc(subject.title)}</h3><p>${subject.first?'The first subject is being prepared.':'Coming soon <span lang="ar" dir="rtl">إن شاء الله</span>'}</p></article>`).join('')}</div></section>`;
}
