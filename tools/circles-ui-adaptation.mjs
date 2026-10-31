// Keep the author's source checkout intact. The connected UI must rehearse the
// hosted access boundary even on localhost; private editorial previews stay out.
export function inactiveFreeCourseCards(source){
 const card=source.split('\n').find(line=>line.startsWith('function freeCourseCard('));
 if(!card||!card.includes('data-free-course=')||!card.includes('</a>'))throw Error('Review the free-course card contract.');
 const inactive=card.replace('<a class="free-course-card ','<article class="circles-free-inactive free-course-card ')
  .replace(' href="${esc(c.href)}" data-free-course="${esc(c.key)}"',' aria-disabled="true"')
  .replace(' · Free course"',' · Free course · Inactive"').replace('>Free</span>','>Inactive</span>')
  .replace("${i===0?'<span class=\"free-course-featured\">Featured</span>':''}",'').replace('</a>','</article>');
 return source.replace(card,inactive);
}
export function connectedCourseSource(source){
 const preview="export const isLocalPreview = location => ";
 const missing="if(!response.ok)throw Error('The course could not be opened.');";
 if(!source.includes(preview)||!source.includes(missing))throw Error('Review the updated course-source UI contract.');
 return source.replace(preview,preview+'!globalThis.AcademyConnectedCirclesUI && ')
  .replace(missing,"if(response.status===404)return {mode:'pending'};"+missing);
}
export function connectedPodcastView(source){
 const panel='function accessPanel(){',topics="resolved.mode==='ready'?topicDropdown(entry,topicsOpen):''",freeCards="${freeCatalogue.map(coverCard).join('')}";
 if(!source.includes(panel)||!source.includes(topics)||!source.includes(freeCards))throw Error('Review the updated podcast UI contract.');
 return ("import {forthcomingCourseNotices,comingSoonCard} from '../shared/course-notices.mjs';\n"+source)
  .replace(freeCards,freeCards+"${forthcomingCourseNotices.map(comingSoonCard).join('')}")
  .replace(panel,panel+`if(!isMothers&&selected?.access==='free')return '<section class="course-access-panel"><span class="free-access">Free course</span><h2>Materials coming soon</h2><p>This course is being prepared. Please check back soon.</p></section>';`)
  .replace('function recordings(){','function recordings(){if(!contentAvailable)return accessPanel();')
  .replace(topics,"resolved.mode==='ready'||globalThis.AcademyConnectedCirclesUI?topicDropdown(entry,topicsOpen):''")
  .replace("This recording is awaiting its ${isMothers?'Academy':'Studio'} connection.",'This recording will be available soon.');
}
export function connectedCoursePage(source,{catalogueNotices=false}={}){
 if(!source.includes('</head>'))throw Error('Review the updated course page entry.');
 return source.replace('</head>',(catalogueNotices?'<link rel="stylesheet" href="/course-notices.css">':'')+'<script>globalThis.AcademyConnectedCirclesUI=true;</script></head>');
}
