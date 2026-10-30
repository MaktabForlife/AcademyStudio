import {esc} from './model.mjs';
const link=(href,label,attributes='')=>`<a class="btn outline" href="${esc(href)}" ${attributes}>${esc(label)}</a>`;
export function circleChoices(area,navigation){
 if(!navigation)return '<p role="status">Checking your programme access…</p>';
 const academia=navigation.academia.map(item=>link('/?login=1&area=academy',item.label,`data-programme-key="${esc(item.key)}"`)).join('');
 const classrooms=(navigation.mothers?link('/studio/?classroom=mothers','Mothers of the Ummah'):'')+navigation.shortCourses.map(item=>link(item.href,item.label)).join('');
 const hifz=navigation.hifz?link(navigation.hifz,'Open Hifz Academy','data-programme-key="hifz"') : '';
 const empty='<p>No programmes are currently assigned to your account in this area.</p>';
 if(area==='arabic-adventures')return '';
 if(area==='academy')return academia||empty;
 if(area==='mothers'||area==='courses')return classrooms||empty;
 if(area==='hifz')return hifz||empty;
 return `<section><h3>Islamic Academia</h3>${academia||empty}</section><section><h3>Classrooms to nurture minds</h3>${classrooms||empty}</section>${hifz?`<section><h3>Hifz</h3>${hifz}</section>`:''}`;
}
export const mothersClassroom=()=>`<section class="card"><p class="eyebrow">YOUR CLASSROOM</p><h1>Mothers of the Ummah</h1><p>Your existing programme membership is active.</p><p>The classroom materials are still being connected.</p><a href="/">Return to Circles</a></section>`;
