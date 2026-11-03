const id=value=>typeof value==='string'&&value.length>0&&value.length<=160;
export function validDeviceState(document,state={}){
 const lessons=new Set(document.lessons.map(lesson=>lesson.id)),notes=new Set(document.lessons.flatMap(lesson=>lesson.sections.flatMap(section=>section.blocks.filter(block=>block.type==='reflection').map(block=>block.id))));
 return {completed:[...new Set((Array.isArray(state.completed)?state.completed:[]).filter(key=>lessons.has(key)))],reflections:Object.fromEntries(Object.entries(state.reflections&&typeof state.reflections==='object'?state.reflections:{}).filter(([key,value])=>notes.has(key)&&typeof value==='string'&&value.length<=20000)),readingSize:Math.max(16,Math.min(24,Number(state.readingSize)||18))};
}
export function exportDeviceLearning({accountId,websiteId,document,state}){
 if(!id(accountId)||!id(websiteId))throw Error('Sign in and choose a website before exporting device learning.');
 return {format:'DEVICE_LEARNING_V1',accountId,websiteId,...validDeviceState(document,state)};
}
export function importDeviceLearning(value,{accountId,websiteId,document,current={}}){
 if(value?.format!=='DEVICE_LEARNING_V1'||value.accountId!==accountId||value.websiteId!==websiteId)throw Error('Choose an export for this account and website.');
 const incoming=validDeviceState(document,value),saved=validDeviceState(document,current);
 // Existing answers win; importing a partial/older device file never erases work.
 return {...incoming,completed:[...new Set([...saved.completed,...incoming.completed])],reflections:{...incoming.reflections,...saved.reflections}};
}
// Academy-side adapter for a later approved release. The authenticated old
// reader supplies its already-selected prefix; this never scans other accounts,
// reads session credentials or attempts cross-origin browser storage access.
export function exportAcademyDeviceLearning({storage,prefix,accountId,websiteId,document}){
 if(typeof prefix!=='string'||!prefix.startsWith('kahf-course-')&&!prefix.startsWith('course-website-'))throw Error('Choose the current Academy reader storage prefix.');
 const read=key=>{try{return storage.getItem(prefix+key);}catch{return null;}};
 const parse=(value,fallback)=>{try{return JSON.parse(value)||fallback;}catch{return fallback;}};
 const savedNotes=parse(read('reflections-v2'),{});const state={completed:parse(read('completed'),[]),reflections:savedNotes&&typeof savedNotes==='object'&&!Array.isArray(savedNotes)?savedNotes:{},readingSize:read('text-size')};
 for(const lesson of document.lessons)for(const section of lesson.sections)for(const block of section.blocks)if(block.type==='reflection'&&block.legacyNoteKey&&!Object.hasOwn(state.reflections,block.id)){const old=read('note-'+lesson.id+'-'+block.legacyNoteKey);if(old)state.reflections[block.id]=old;}
 return exportDeviceLearning({accountId,websiteId,document,state});
}
