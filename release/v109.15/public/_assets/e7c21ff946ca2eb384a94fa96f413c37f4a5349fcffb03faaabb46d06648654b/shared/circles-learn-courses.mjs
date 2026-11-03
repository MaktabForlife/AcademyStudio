// Presentation only: both lists come from the same account-checked navigation.
// Admin reader access must never be presented as a purchase.
export function learnCourses(navigation,mode){
 if(!navigation||!['learn','teach','admin'].includes(mode))return null;
 const purchased=navigation.purchasedCourses;if(!Array.isArray(purchased))return null;
 if(mode!=='learn'||!Array.isArray(navigation.adminCourses))return purchased;
 const courses=new Map(purchased.map(course=>[course.href,course]));
 for(const course of navigation.adminCourses)if(!courses.has(course.href))courses.set(course.href,course);
 return [...courses.values()];
}
