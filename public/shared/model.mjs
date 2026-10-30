export const FORMAT='ACADEMY_COURSE_STUDIO_V1';
export const BLOCKS={text:'Lesson text',arabic:'Arabic passage',ayah:'Ayah & translation',quote:'Quotation',list:'List or graphic',words:'Word study',reflection:'Reflection question',image:'Image',note:'Source note',callout:'Key takeaway'};
export const THEMES={baqarah:{name:'Baqarah ivory & slate',accent:'#2e424e',soft:'#e8eff0',ink:'#252a2d',paper:'#fffff6',border:'#c8d3d6'},plum:{name:'Kahf plum',accent:'#694165',soft:'#eee3eb'},olive:{name:'Quiet olive',accent:'#526147',soft:'#e9ede3'},clay:{name:'Warm clay',accent:'#8b514b',soft:'#f1e4df'},rose:{name:'Yaseen rose',accent:'#8b425b',soft:'#f5e5eb',ink:'#46343b',paper:'#fffdfb',border:'#e6cbd7'},terracotta:{name:'Saffat terracotta',accent:'#984631',soft:'#f4e7da',ink:'#392f29',paper:'#fffdf8',border:'#dfcdb5'},ocean:{name:'Ankabut ocean',accent:'#005b83',soft:'#e6f3f7',ink:'#213c4a',paper:'#fcfeff',border:'#bbd9e5'},charcoal:{name:'Luqman charcoal & copper',accent:'#704c38',soft:'#efe6df',ink:'#262829',paper:'#fffdf9',border:'#cec6bc'},forest:{name:'Muzzammil forest',accent:'#174d45',soft:'#f0f5df',ink:'#253e37',paper:'#fffff9',border:'#c6d799'},sage:{name:'Sajdah sage',accent:'#46604a',soft:'#eaf0e4',ink:'#2f4034',paper:'#fcfdf9',border:'#cbd8c4'},sand:{name:'Qasas sand & stone',accent:'#6d6046',soft:'#eee6d8',ink:'#3d413c',paper:'#fdfcf8',border:'#d8cbb7'},burgundy:{name:'Foundations burgundy',accent:'#76234f',soft:'#f4e8ee',ink:'#43313c',paper:'#fffdfb',border:'#dfc7d5'}};
export const PAGES=[['home','Course home'],['lessons','Web lessons'],['sessions','Sessions & recordings'],['materials','Course materials'],['assessments','Assessments'],['appearance','Appearance & menu']];
export const uid=()=>crypto.randomUUID();
export const clone=value=>structuredClone(value);
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function newBlock(type='text'){
 if(!Object.hasOwn(BLOCKS,type))throw Error('Choose a supported lesson component.');
 return {id:uid(),type,aside:false,text:'',arabic:'',translation:'',reference:'',attribution:'',items:[''],...(type==='list'?{presentation:'list',ordered:false}:{}),leftArabic:'',leftMeaning:'',rightArabic:'',rightMeaning:'',assetId:'',alt:'',caption:''};
}
export function newSection(){return {id:uid(),title:'New section',label:'',blocks:[newBlock()]};}
export function newLesson(title='New lesson',group='Your lessons'){return {id:uid(),title,group,summary:'',sections:[newSection()]};}
export function newCourse(){
 const first=newLesson('Begin with the surah','Getting started');first.summary='An introduction to your course and a space for reflection.';
 first.sections[0].title='Your first lesson';first.sections[0].blocks[0].text='Welcome to your course. Replace this example with your own teaching, or add a new section below.';
 const reflection=newBlock('reflection');reflection.text='What would you like to carry into your week?';first.sections[0].blocks.push(reflection);
 return {format:FORMAT,id:uid(),name:'Surah Al Kahf',tag:'BOOTCAMP',theme:'plum',home:{recordingLayout:'cards',headline:'A complete nurturing from my Rabb.',subtitle:'The nurturing system of Allah Ta’ala in Surah Kahf',description:'A four-week journey through the trials of faith, wealth, knowledge and power.',imageId:'',imageAlt:'Lilac blossoms beside an open book',caption:'Knowledge to carry. Reflections to keep.',journeyTitle:'Four trials. A space to reflect.',themes:[['Faith','The People of the Cave','أصحاب الكهف','The trial of faith'],['Wealth','The Owner of Two Gardens','صاحب الجنتين','The trial of wealth'],['Knowledge','Musa & Al-Khidr','موسى والخضر','The trial of knowledge'],['Power','Dhul-Qarnayn','ذو القرنين','The trial of power']].map(([label,title,arabic,description])=>({id:uid(),label,title,arabic,description,lessonId:''}))},lessons:[first],pages:{sessions:true,materials:true,assessments:true},menu:{home:'Course',lessons:'Read',sessions:'Sessions',materials:'Files',assessments:'Assessments'},sessionOptions:{showTeacher:true,showNotes:true},materials:{intro:'Keep the resources you need for your course.',files:[]},updatedAt:new Date().toISOString()};
}
export function exampleBlock(type){
 const b=newBlock(type);
 Object.assign(b,({text:{text:'Type your lesson text directly here. Short paragraphs and clear headings make it easier to read on a phone.'},arabic:{arabic:'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'},ayah:{arabic:'',translation:'Add the translation here.',reference:''},quote:{text:'Add a quotation here.',attribution:'Add the source or speaker.'},list:{items:['First point','Second point']},words:{leftArabic:'',leftMeaning:'First meaning',rightArabic:'',rightMeaning:'Second meaning'},reflection:{text:'What does this lesson invite you to reflect on?'},note:{text:'Add your source or explanatory note.'},callout:{text:'The idea you would like students to remember.'},image:{alt:'',caption:''}})[type]||{});return b;
}
export function move(array,index,direction){const next=index+direction;if(next<0||next>=array.length)return false;[array[index],array[next]]=[array[next],array[index]];return true;}
export function duplicateLesson(lesson){const copy=clone(lesson);copy.id=uid();copy.title+=' — copy';for(const section of copy.sections){section.id=uid();for(const block of section.blocks)block.id=uid();}return copy;}
export function setPath(root,path,value){const parts=path.split('.');if(parts.some(p=>['__proto__','constructor','prototype'].includes(p)))throw Error('Invalid field.');let target=root;for(const part of parts.slice(0,-1)){if(!Object.hasOwn(target,part))throw Error('Unknown field.');target=target[part];}const key=parts.at(-1);const optional=target===root.home&&key==='recordingLayout'&&['cards','podcast'].includes(value)||target.type==='image'&&(key==='tint'&&['none','course'].includes(value)||key==='graphic'&&typeof value==='boolean')||key==='aside'&&target.type==='note'&&typeof value==='boolean'||target.type==='list'&&(key==='presentation'&&['list','concept','radial','steps'].includes(value)||key==='ordered'&&typeof value==='boolean');if(!Object.hasOwn(target,key)&&!optional)throw Error('Unknown field.');if(target.type==='image'&&key==='assetId'&&target[key]!==value)delete target.crop;target[key]=value;}
const text=(value,max=20000)=>typeof value==='string'&&value.length<=max;
export function validateCourse(course,{review=false}={}){
 const errors=[],ids=new Set();let blocks=0;
 const id=value=>{if(!text(value,80)||!/^[\w-]+$/.test(value)||ids.has(value))throw Error('The draft contains an invalid or repeated identifier.');ids.add(value);};
 if(!course||course.format!==FORMAT)throw Error('Choose an Academy Course Studio draft.');
 if(course.editorialLayout!==undefined&&typeof course.editorialLayout!=='boolean')throw Error('Check the reading layout.');
 if(typeof course.updatedAt!=='string'||!Number.isFinite(Date.parse(course.updatedAt)))throw Error('The draft has an invalid saved date.');
 if(JSON.stringify(course).length>1_000_000)throw Error('This course is too large for the design editor.');
 id(course.id);
 if(!text(course.name,160)||!text(course.tag,40)||!Object.hasOwn(THEMES,course.theme))throw Error('Check the course name and appearance.');
 if(course.academyMediaIds!==undefined&&(!Array.isArray(course.academyMediaIds)||course.academyMediaIds.length>80||course.academyMediaIds.some(v=>typeof v!=='string'||v.length>80)))throw Error('Choose valid Academy media references.');
 if(!course.home||!course.pages||!course.menu||!course.materials||!course.sessionOptions)throw Error('The draft is missing course settings.');
 for(const [key,limit] of Object.entries({headline:300,subtitle:500,description:4000,imageId:80,imageAlt:500,caption:500,journeyTitle:300}))if(!text(course.home[key],limit))throw Error('Check the course home fields.');
 if(course.home.recordingLayout!==undefined&&!['cards','podcast'].includes(course.home.recordingLayout))throw Error('Choose a recording card or podcast layout.');
 if(!Array.isArray(course.home.themes)||course.home.themes.length>8)throw Error('Use up to eight journey cards.');
 for(const theme of course.home.themes){id(theme.id);for(const key of ['label','title','arabic','description','lessonId'])if(!text(theme[key],1000))throw Error('Check the journey cards.');}
 for(const page of ['sessions','materials','assessments'])if(typeof course.pages[page]!=='boolean')throw Error('Check page visibility.');
 for(const page of ['home','lessons','sessions','materials','assessments'])if(!text(course.menu[page],40))throw Error('Check the menu labels.');
 if(typeof course.sessionOptions.showTeacher!=='boolean'||typeof course.sessionOptions.showNotes!=='boolean')throw Error('Check the session options.');
 if(!Array.isArray(course.lessons)||course.lessons.length>80)throw Error('Use up to eighty lessons.');
 if(review&&!course.name.trim())errors.push('Add a course name.');
 if(review&&course.home.imageId&&!course.home.imageAlt.trim())errors.push('Add a description for your cover image.');
 if(review&&!course.lessons.length)errors.push('Add at least one web lesson.');
 const lessonIds=new Set();
 for(const lesson of course.lessons){id(lesson.id);lessonIds.add(lesson.id);for(const key of ['title','group','summary'])if(!text(lesson[key],2000))throw Error('Check the lesson details.');if(review&&!lesson.title.trim())errors.push('Give each lesson a title.');
  if(!Array.isArray(lesson.sections)||lesson.sections.length>40)throw Error('Use up to forty sections in a lesson.');
  for(const section of lesson.sections){id(section.id);if(!text(section.title,300)||!text(section.label,100)||!Array.isArray(section.blocks)||section.blocks.length>40)throw Error('Check the lesson sections.');
   for(const block of section.blocks){id(block.id);if(!Object.hasOwn(BLOCKS,block.type))throw Error('The draft uses an unsupported lesson component.');blocks++;
    for(const key of ['text','arabic','translation','reference','attribution','leftArabic','leftMeaning','rightArabic','rightMeaning','assetId','alt','caption'])if(!text(block[key]))throw Error('Check the lesson component text.');
    if(!Array.isArray(block.items)||block.items.length>60||block.items.some(item=>!text(item,2000)))throw Error('Check the bullet points.');
    if(block.tint!==undefined&&(block.type!=='image'||!['none','course'].includes(block.tint)))throw Error('Check the image colour treatment.');
    if(block.crop!==undefined){const c=block.crop;if(block.type!=='image'||!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).sort().join(',')!=='height,sourceHeight,sourceWidth,width,x,y'||Object.values(c).some(v=>!Number.isFinite(v)||v<0||v>10000)||c.width<1||c.height<1||c.sourceWidth<1||c.sourceHeight<1||c.x+c.width>c.sourceWidth||c.y+c.height>c.sourceHeight)throw Error('Check the original graphic crop.');}
    if(block.graphic!==undefined&&typeof block.graphic!=='boolean')throw Error('Check the graphic setting.');
    if(block.presentation!==undefined&&(block.type!=='list'||!['list','concept','radial','steps'].includes(block.presentation)))throw Error('Choose a list or diagram layout.');
    if(block.ordered!==undefined&&typeof block.ordered!=='boolean')throw Error('Check list numbering.');
    if(block.emphasis!==undefined&&(block.type!=='text'||block.emphasis!=='key'))throw Error('Check the passage emphasis.');
    if(review&&['concept','radial','steps'].includes(block.presentation)&&(!block.text.trim()||!block.items.length||block.items.some(item=>!item.trim())))errors.push(`Complete the graphic in “${lesson.title}”.`);
    if(review&&block.type==='image'&&(!block.assetId||!block.alt.trim()))errors.push(`Add an image and description in “${lesson.title}”.`);
    if(review&&block.type==='ayah'&&(!block.arabic.trim()||!block.reference.trim()))errors.push(`Check the Arabic and reference in “${lesson.title}”.`);
   }
  }
 }
 if(blocks>1600)throw Error('Use up to sixteen hundred lesson components.');
 for(const theme of course.home.themes)if(theme.lessonId&&!lessonIds.has(theme.lessonId))throw Error('A journey card points to a lesson that is no longer present.');
 if(!text(course.materials.intro,4000)||!Array.isArray(course.materials.files)||course.materials.files.length>80)throw Error('Check the course materials.');
 for(const file of course.materials.files){if(review&&!file.assetId)errors.push('Choose a file for each course material.');id(file.id);if(!text(file.assetId,80)||!text(file.title,300)||!text(file.description,2000))throw Error('Check the material details.');}
 return errors;
}
export function referencedAssets(course){return [...new Set([...(course.academyMediaIds||[]),course.home.imageId,...course.lessons.flatMap(l=>l.sections.flatMap(s=>s.blocks.filter(b=>b.type==='image').map(b=>b.assetId))),...course.materials.files.map(f=>f.assetId)].filter(Boolean))];}
export function fileKind(bytes){if(bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46&&bytes[4]===0x2d)return 'application/pdf';if(bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a)return 'image/png';if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';return '';}
export async function checkFile(file){const kind=fileKind(new Uint8Array(await file.slice(0,16).arrayBuffer()));if(!kind)throw Error('Choose a PDF, PNG, JPG or WebP file.');const limit=(kind==='application/pdf'?16:5)*1024*1024;if(!file.size||file.size>limit)throw Error(kind==='application/pdf'?'Choose a PDF no larger than 16 MB.':'Choose an image no larger than 5 MB.');return kind;}
