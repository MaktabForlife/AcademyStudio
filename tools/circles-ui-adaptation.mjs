// Keep the author's source checkout intact. The connected UI must rehearse the
// hosted access boundary even on localhost; private editorial previews stay out.
export function connectedCourseSource(source){
 const preview="export const isLocalPreview = location => ";
 const missing="if(!response.ok)throw Error('The course could not be opened.');";
 if(!source.includes(preview)||!source.includes(missing))throw Error('Review the updated course-source UI contract.');
 return source.replace(preview,preview+'!globalThis.AcademyConnectedCirclesUI && ')
  .replace(missing,"if(response.status===404)return {mode:'pending'};"+missing);
}
export function connectedPodcastView(source){
 const panel='function accessPanel(){',topics="resolved.mode==='ready'?topicDropdown(entry,topicsOpen):''";
 if(!source.includes(panel)||!source.includes(topics))throw Error('Review the updated podcast UI contract.');
 return source.replace(panel,panel+`if(!isMothers&&selected?.access==='free')return '<section class="course-access-panel"><span class="free-access">Free course</span><h2>Materials coming soon</h2><p>This course is being prepared. Please check back soon.</p></section>';`)
  .replace('function recordings(){','function recordings(){if(!contentAvailable)return accessPanel();')
  .replace(topics,"resolved.mode==='ready'||globalThis.AcademyConnectedCirclesUI?topicDropdown(entry,topicsOpen):''")
  .replace("This recording is awaiting its ${isMothers?'Academy':'Studio'} connection.",'This recording will be available soon.');
}
export function connectedCoursePage(source){
 if(!source.includes('</head>'))throw Error('Review the updated course page entry.');
 return source.replace('</head>','<script>globalThis.AcademyConnectedCirclesUI=true;</script></head>');
}
