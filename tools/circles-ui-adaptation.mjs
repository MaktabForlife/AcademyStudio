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
 return connectedNativeCourseNavigation(("import {forthcomingCourseNotices,comingSoonCard} from '../shared/course-notices.mjs';\n"+source)
  .replace(freeCards,freeCards+"${forthcomingCourseNotices.map(comingSoonCard).join('')}")
  .replace(panel,panel+`if(!isMothers&&selected?.access==='free')return '<section class="course-access-panel"><span class="free-access">Free course</span><h2>Materials coming soon</h2><p>This course is being prepared. Please check back soon.</p></section>';`)
  .replace('function recordings(){','function recordings(){if(!contentAvailable)return accessPanel();')
  .replace(topics,"resolved.mode==='ready'||globalThis.AcademyConnectedCirclesUI?topicDropdown(entry,topicsOpen):''")
  .replace("This recording is awaiting its ${isMothers?'Academy':'Studio'} connection.",'This recording will be available soon.'));
}
// Apply this additive delta to the already-connected deployed podcast module.
// It preserves that module's private-source safeguards and routes ready Courses
// through the functional native reader rather than its author-preview model.
export function connectedNativeCourseNavigation(source){
 if(source.includes("from '../shared/native-course-links.mjs'"))return source;
 const free='window.AcademyFreeLearning.approvedCourses().map(merge)',paid='(window.AcademyPaidCourses||[]).map(merge)',start='try{\n if(!selected){';
 const paidAction='${item.access===\'paid\'?`data-paid-access="${esc(item.key)}"`:String()}';
 for(const expected of [free,paid,start,paidAction])if(source.split(expected).length!==2)throw Error('Review the connected native Course navigation contract.');
 return "import {loadNativeCourseIndex,withNativeCourseLink} from '../shared/native-course-links.mjs';\n"+source
  .replace('const freeCatalogue=',"let nativeCourseIssue='';\nconst nativeCourseRoutes=!isMothers&&globalThis.AcademyConnectedCirclesUI?await loadNativeCourseIndex().catch(()=>{nativeCourseIssue='The course catalogue could not be loaded. Please refresh.';return new Map();}):new Map();\nconst freeCatalogue=")
  .replace(free,free+'.map(item=>withNativeCourseLink(item,nativeCourseRoutes))')
  .replace(paid,paid+'.map(item=>withNativeCourseLink(item,nativeCourseRoutes))')
  .replace(paidAction,'${item.access===\'paid\'&&!item.nativeWebsiteId?`data-paid-access="${esc(item.key)}"`:String()}')
  .replace(start,"try{\n if(nativeCourseIssue)throw Error(nativeCourseIssue);\n if(selected?.nativeWebsiteId){root.innerHTML='<p role=\"status\">Opening your course…</p>';location.replace(selected.href);}\n else if(!selected){");
}
export function connectedCoursePage(source,{catalogueNotices=false}={}){
 if(!source.includes('</head>'))throw Error('Review the updated course page entry.');
 return source.replace('</head>',(catalogueNotices?'<link rel="stylesheet" href="/course-notices.css">':'')+'<script>globalThis.AcademyConnectedCirclesUI=true;</script></head>');
}
