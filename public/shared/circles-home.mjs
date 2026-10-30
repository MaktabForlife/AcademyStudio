import {esc} from './model.mjs';

// Presentation from single-circle-home cd99cd7. Destinations use the connected
// application; none of the prototype's example registers/workflows are included.
const branches={
 studio:{name:'Self-paced learning',hint:'Tafseer · Qur’an & Hadith courses',title:'A space to listen.<br>To reflect.<br>To return.',mobile:'Listen. Reflect.<br>Return.',cta:'Explore the collections'},
 academy:{name:'Academy',hint:'Programmes & guided learning',title:'Knowledge<br>with roots.<br>Learning<br>with purpose.',mobile:'Knowledge,<br>with purpose.',cta:'Open Academy'},
 hifz:{name:'Hifz',hint:'Memorisation & revision',title:'Hold the Qur’an<br>close to<br>your heart.',mobile:'Memorise.<br>Revisit. Grow.',cta:'Open Academy'}
};
export const homeBranch=value=>Object.hasOwn(branches,value)?value:'studio';
export function learningBranches(value){const branch=homeBranch(value);return Object.entries(branches).map(([key,b],i)=>`<a href="/?branch=${key}" data-home-branch="${key}" aria-current="${key===branch?'page':'false'}"><span aria-hidden="true">0${i+1}</span>${esc(b.name)}</a>`).join('');}
export function circlesHome(value){
 const branch=homeBranch(value),b=branches[branch];
 return `<section class="connected-circle-home" aria-label="Welcome to Umm Abbad Academy"><div class="circle-home-welcome"><span>Ahlan wa sahlan · Welcome</span><span lang="ar" dir="rtl">أهلاً وسهلاً</span></div><div class="circle-home-composition">
 <div class="circle-home-image"><img src="/shared/home-assets/academy-learning.png" alt="A woman studying the Qur’an, from the Academy website"><span>A place to grow, with knowledge.</span></div>
 <div class="circle-home-orb"><p class="eyebrow">${branch==='studio'?'Self-paced learning':'Umm Abbad '+esc(b.name)}</p><h1><span class="circle-full">${b.title}</span><span class="circle-mobile">${b.mobile}</span></h1><p>${esc(b.hint)}<br>Rooted in your daily life.</p>${branch==='studio'?`<a class="circle-home-primary" href="/?view=collections" data-home-collections>${esc(b.cta)} <span aria-hidden="true">→</span></a>`:`<button class="circle-home-primary" data-home-academy>${esc(b.cta)} <span aria-hidden="true">→</span></button>`}</div>
 <article class="circle-home-panel circle-home-worship"><span class="eyebrow">WORSHIP UPON BASEERA</span><h2>Worship with understanding.</h2><p>Learning that brings knowledge into practice.</p><a href="#academy-story">Explore our approach <span aria-hidden="true">→</span></a></article>
 <article class="circle-home-panel circle-home-academia"><span class="eyebrow">ISLAMIC ACADEMIA</span><h2>Islamic Academia.<br>With depth and purpose.</h2><p>Aalimiya, Reboot Your Maktab, and Mothers of the Ummah.</p><a href="/?branch=academy" data-home-branch="academy">Explore Academy <span aria-hidden="true">→</span></a></article>
 <article class="circle-home-panel circle-home-womanhood"><img src="/shared/home-assets/study.jpg" alt="A Qur’an open on a wooden table" loading="lazy"><div><span class="eyebrow">WOMANHOOD</span><h2>Faith, woven into the life you lead.</h2><a href="#academy-story">Explore womanhood <span aria-hidden="true">→</span></a></div></article>
 </div><div class="circle-home-foot"><span>Knowledge to carry. Reflections to keep.</span><button data-home-replay>Replay animation <span aria-hidden="true">↻</span></button></div>
 <section id="academy-story" class="circle-home-story"><p class="eyebrow">The story behind the name</p><h2>Umm Abbad.<br><em>Mother of a Great Worshipper.</em></h2><p>Our Academy brings the pursuit of Islamic knowledge into women’s daily lives. Qur’anic learning, spiritual growth, and the realities of womanhood belong in the same conversation.</p></section></section>`;
}
