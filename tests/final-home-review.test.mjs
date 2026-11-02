import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {publicHome} from '../public/shared/public-home.mjs';
test('collage summary buttons open original full flyers and exam duas with one shared native enquiry action',async t=>{
 const flyers=['aalimiyah','reboot','arabic-intensive','mothers','tafseer'];
 const {document}=parseHTML('<section id="academy-news"><div id="academy-news-reel">'+flyers.map(id=>'<article class="academy-news-card" data-announcement="2027-'+id+'"><img src="/original-'+id+'.png" alt="'+id+' flyer"><button data-action="flyer-gallery">All programmes</button></article>').join('')+'<article class="academy-news-card"><h3>Exam wishes</h3><p lang="ar" dir="rtl">رَبِّ زِدْنِي عِلْمًا</p></article></div></section>'),original=[...document.querySelectorAll('.academy-news-card')];
 const view=document.defaultView,prior=view.fetch;view.fetch=async()=>Response.json({error:'Not activated',code:'ANNOUNCEMENTS_NOT_ACTIVATED'},{status:404});t.after(()=>view.fetch=prior);
 let galleryOpened=0;original[0].querySelector('button').onclick=()=>galleryOpened++;publicHome(document)();for(let i=0;i<4;i++)await new Promise(r=>setImmediate(r));
 assert.equal(document.querySelectorAll('.announcement-picture-collage img').length,5);assert.equal(document.querySelectorAll('.announcement-enrol[data-action=news-enquiry][data-id=enrolments]').length,1);
 const summaries=document.querySelectorAll('.announcement-summary-list>button');summaries[0].click();assert(document.querySelector('dialog').hasAttribute('open'));assert.equal(original[0].hidden,false);assert.equal(original[0].querySelector('img').getAttribute('src'),'/original-aalimiyah.png');original[0].querySelector('button').click();assert.equal(galleryOpened,1);
 summaries[5].click();assert.equal(original[5].hidden,false);assert.match(document.querySelector('dialog').textContent,/رَبِّ/);document.querySelector('dialog>header button').click();assert(!document.querySelector('dialog').hasAttribute('open'));assert.equal(document.querySelectorAll('dialog .academy-news-card').length,6);
});
