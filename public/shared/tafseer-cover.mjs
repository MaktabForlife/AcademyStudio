import {esc} from './model.mjs';

// Cover labels only. No teaching text or stored source artwork is changed.
const titles={
 foundations:['مدخل إلى','التفسير'],
 fatir:['سورة','فاطر'],
 yaseen:['سورة','يس'],
 saffat:['سورة','الصافات'],
 ankabut:['سورة','العنكبوت'],
 luqman:['سورة','لقمان'],
 muzammil:['سورة','المزمل'],
 qasas:['سورة','القصص'],
 sajdah:['سورة','السجدة']
};

export function tafseerCover(item){
 const title=titles[item.key];if(item.kind!=='TAFSEER'||!title)return '';
 return `<span class="tafseer-frame" aria-hidden="true"><svg viewBox="0 0 300 280" fill="none" preserveAspectRatio="none"><path d="M28 12h244v8a12 12 0 0 0 12 12h4v216h-4a12 12 0 0 0-12 12v8H28v-8a12 12 0 0 0-12-12h-4V32h4a12 12 0 0 0 12-12Z"/><path d="M36 22h228v9a14 14 0 0 0 14 14v190a14 14 0 0 0-14 14v9H36v-9a14 14 0 0 0-14-14V45a14 14 0 0 0 14-14Z"/><path d="m150 15 5 5-5 5-5-5Zm0 240 5 5-5 5-5-5Z"/></svg></span><span class="tafseer-lettering" lang="ar" dir="rtl"><span class="tafseer-prefix">${esc(title[0])}</span><span class="tafseer-surah-name">${esc(title[1])}</span><svg class="tafseer-flourish" viewBox="0 0 110 14" fill="none" aria-hidden="true"><path d="M5 7h34m32 0h34M39 7l8-5 8 5-8 5Zm16 0 8-5 8 5-8 5Z"/><circle cx="3" cy="7" r="1.5"/><circle cx="107" cy="7" r="1.5"/></svg></span><span class="tafseer-english" lang="en" dir="ltr">${esc(item.key==='fatir'?'Text pending':item.title)}</span>`;
}
