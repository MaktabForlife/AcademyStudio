import {esc} from './model.mjs';
import {approvedCourseCover} from './approved-course-artwork.mjs';

// Cover labels only. No teaching text or stored source artwork is changed.
const titles={
 foundations:['','علوم القرآن'],
 fatir:['سورة','فاطر'],
 yaseen:['سورة','يس'],
 saffat:['سورة','الصافات'],
 ankabut:['سورة','العنكبوت'],
 luqman:['سورة','لقمان'],
 muzammil:['سورة','المزمل'],
 qasas:['سورة','القصص'],
 sajdah:['سورة','السجدة']
};

const courseNames={
 'foundations of tafseer':'foundations',
 'ulumul qur’an':'foundations',
 'ulumul quran':'foundations',
 'qur’anic studies':'foundations',
 'quranic studies':'foundations',
 'introduction to qur’anic studies':'foundations',
 'introduction to quranic studies':'foundations',
 'surah fatir':'fatir',
 'surah yaseen':'yaseen',
 'surah as saffat':'saffat',
 'surah al ankabut':'ankabut',
 'surah luqman':'luqman',
 'surah al muzzammil':'muzammil',
 'surah al muzammil':'muzammil',
 'surah al qasas':'qasas',
 'surah as sajdah':'sajdah'
};
function courseKey(course){
 if(course?.displayIdentity&&course.displayIdentity.kind!=='TAFSEER')return null;
 if(course?.displayIdentity?.key&&Object.hasOwn(titles,course.displayIdentity.key))return course.displayIdentity.key;
 return courseNames[(course?.name||'').toLowerCase().replace(/[-–—]/g,' ').replace(/\s+/g,' ').trim()];
}
export function tafseerDisplayCourse(course){
 if(!course)return course;
 const key=courseKey(course);
 return key==='foundations'?{...course,name:'Introduction to Qur’anic Studies',home:{...course.home,headline:'Introduction to Qur’anic Studies',subtitle:'علوم القرآن'}}:course;
}

export function tafseerCourseCover(course){
 const name=course?.name||'',key=courseKey(course);
 return key?tafseerCover({kind:'TAFSEER',key,title:key==='foundations'?'Introduction to Qur’anic Studies':name}):'';
}

// Replace the old cover wherever it is displayed, including the source editor.
// Saved editions and their archived asset references are not rewritten.
export function replaceTafseerArtwork(root,course){
 const approved=approvedCourseCover(course.displayIdentity?.key);
 if(approved){for(const image of root.querySelectorAll('.rs-series-cover img,img[data-course-image]'))if(image.closest('.rs-series-cover')||image.dataset.courseImage===course.home?.imageId){image.src=approved;image.removeAttribute('data-course-image');}return;}
 const artwork=tafseerCourseCover(course);if(!artwork||!course.home?.imageId)return;
 for(const image of root.querySelectorAll('img[data-course-image]'))if(image.dataset.courseImage===course.home.imageId){
  const card=root.ownerDocument.createElement('span');card.className='tafseer-name-artwork';card.setAttribute('role','img');card.setAttribute('aria-label',tafseerDisplayCourse(course).name);card.innerHTML=artwork;image.replaceWith(card);
 }
}

export function tafseerCover(item){
 const title=titles[item.key];if(item.kind!=='TAFSEER'||!title)return '';
 return `<span class="tafseer-frame" aria-hidden="true"><svg viewBox="0 0 300 280" fill="none" preserveAspectRatio="none"><path d="M28 12h244v8a12 12 0 0 0 12 12h4v216h-4a12 12 0 0 0-12 12v8H28v-8a12 12 0 0 0-12-12h-4V32h4a12 12 0 0 0 12-12Z"/><path d="M36 22h228v9a14 14 0 0 0 14 14v190a14 14 0 0 0-14 14v9H36v-9a14 14 0 0 0-14-14V45a14 14 0 0 0 14-14Z"/><path d="m150 15 5 5-5 5-5-5Zm0 240 5 5-5 5-5-5Z"/></svg></span><span class="tafseer-lettering" lang="ar" dir="rtl"><span class="tafseer-prefix">${esc(title[0])}</span><span class="tafseer-surah-name">${esc(title[1])}</span><svg class="tafseer-flourish" viewBox="0 0 110 14" fill="none" aria-hidden="true"><path d="M5 7h34m32 0h34M39 7l8-5 8 5-8 5Zm16 0 8-5 8 5-8 5Z"/><circle cx="3" cy="7" r="1.5"/><circle cx="107" cy="7" r="1.5"/></svg></span><span class="tafseer-english" lang="en" dir="ltr">${esc(item.key==='fatir'?'Text pending':item.key==='foundations'?'Introduction to Qur’anic Studies':item.title)}</span>`;
}
