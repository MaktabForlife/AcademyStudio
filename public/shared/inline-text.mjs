import {clone,setPath,validateCourse} from './model.mjs';

// Only teaching text can change here. IDs, file references and access settings
// continue to belong to the full website builder and their existing services.
export function inlineFields(course){
 const fields=new Map(),add=(path,label)=>fields.set(path,label);
 add('name','Course name');add('tag','Course label');
 for(const key of ['headline','subtitle','description','caption','journeyTitle'])add('home.'+key,({headline:'Welcome heading',subtitle:'Course subtitle',description:'Introduction',caption:'Cover caption',journeyTitle:'Journey heading'})[key]);
 course.home.themes.forEach((t,i)=>{for(const key of ['label','title','arabic','description'])add(`home.themes.${i}.${key}`,'Journey card '+key);});
 course.lessons.forEach((l,i)=>{
  for(const key of ['title','summary'])add(`lessons.${i}.${key}`,'Lesson '+key);
  l.sections.forEach((s,j)=>{const prefix=`lessons.${i}.sections.${j}`;add(prefix+'.title','Section heading');
   s.blocks.forEach((b,k)=>{const p=prefix+`.blocks.${k}`,keys=({text:['text'],arabic:['arabic'],ayah:['arabic','translation','reference'],quote:['text','arabic','attribution','reference'],words:['leftArabic','leftMeaning','rightArabic','rightMeaning'],reflection:['text'],image:['caption'],note:['text','attribution'],callout:['text']})[b.type]||[];
    for(const key of keys)add(p+'.'+key,({text:'Lesson text',arabic:'Arabic text',translation:'Translation',reference:'Ayah reference',attribution:'Source or summary heading',caption:'Image caption'})[key]||'Word study');
    if(b.type==='list'&&['concept','radial','steps'].includes(b.presentation)){add(p+'.text','Graphic heading');add(p+'.attribution','Graphic subtitle');}
    if(b.type==='list')b.items.forEach((_,n)=>add(p+'.items.'+n,'List item '+(n+1)));
   });
  });
 });
 add('materials.intro','Course materials introduction');
 course.materials.files.forEach((_,i)=>{add(`materials.files.${i}.title`,'Material title');add(`materials.files.${i}.description`,'Material description');});
 return fields;
}
export function changeInlineText(course,path,value){
 if(typeof value!=='string'||!inlineFields(course).has(path))throw Error('Choose an editable text area.');
 setPath(course,path,value.replace(/\r\n?/g,'\n'));course.updatedAt=new Date().toISOString();
}

export function inlineSession({request,active=()=>true}){
 let record=null,saved='',busy=false,epoch=0;const pending=new Map();
 const assert=current=>{if(!active()||current!==epoch)throw new DOMException('The Academy account changed.','AbortError');};
 const mutate=async(action,input)=>{const key=action+JSON.stringify(input);if(!pending.has(key))pending.set(key,{...input,operationId:crypto.randomUUID()});const result=await request(action,pending.get(key));pending.delete(key);return result;};
 const exclusive=async action=>{if(busy)throw Error('Please wait for the current save.');const current=epoch;busy=true;try{return await action(current);}finally{if(epoch===current)busy=false;}};
 const session={
  get record(){return record;},get busy(){return busy;},get dirty(){return Boolean(record&&JSON.stringify(record.document)!==saved);},
  async open(){return exclusive(async current=>{const next=await request('get',{});assert(current);record={...next,document:clone(next.document)};saved=JSON.stringify(record.document);return record;});},
  change(path,text){if(!record||busy)throw Error('Open Edit text before changing a passage.');changeInlineText(record.document,path,text);},
  async save(){return exclusive(async current=>{
   if(!record)throw Error('Open Edit text first.');validateCourse(record.document);
   if(!session.dirty&&record.revision)return record;
   const document=clone(record.document),result=await mutate('save',{revision:record.revision,document});assert(current);
   record.revision=result.revision;saved=JSON.stringify(document);return record;
  });},
  async publish(){
   if(!record)throw Error('Open Edit text first.');const errors=validateCourse(record.document,{review:true});if(errors.length)throw Error(errors.join(' '));
   await session.save();return exclusive(async current=>{const result=await mutate('publish',{revision:record.revision});assert(current);record.revision=result.revision;record.enabled=true;return result;});
  },
  clear(){epoch++;record=null;saved='';busy=false;pending.clear();}
 };return session;
}

export function decorateInlineText(root,course,ui){
 const fields=inlineFields(course),mark=(element,path)=>{if(!element||!fields.has(path))return;element.textContent=path.split('.').reduce((value,key)=>value[key],course);element.dataset.inlinePath=path;element.setAttribute('contenteditable','plaintext-only');element.setAttribute('role','textbox');element.setAttribute('aria-label',fields.get(path));element.setAttribute('aria-multiline','true');element.dataset.inlinePlaceholder=fields.get(path);element.setAttribute('spellcheck',String(element.lang!=='ar'));};
 const one=(selector,path,host=root)=>mark(host.querySelector(selector),path);
 one('.sp-course-row strong','name');one('.sp-course-row small','tag');one('.sp-sidebar h2','name');one('.sp-sidebar>.sp-eyebrow','tag');
 // Editable headings inside journey/lesson buttons need a non-interactive
 // container so typing and selecting text cannot activate course navigation.
 for(const button of root.querySelectorAll('.sp-theme,.sp-lesson-card')){const div=root.ownerDocument.createElement('div');div.className=button.className;div.dataset.inlineLessonId=button.dataset.id||'';div.append(...button.childNodes);button.replaceWith(div);}
 if(ui.route==='home'){
  one('.sp-hero h1','home.headline');one('.sp-subtitle','home.subtitle');one('.sp-description','home.description');one('.sp-hero-image figcaption','home.caption');one('.sp-page>.sp-section-heading h2','home.journeyTitle');
  root.querySelectorAll('.sp-theme').forEach((card,i)=>{one('small',`home.themes.${i}.label`,card);one('h3',`home.themes.${i}.title`,card);one('[lang="ar"]',`home.themes.${i}.arabic`,card);one('p',`home.themes.${i}.description`,card);});
 }else if(ui.route==='lessons')root.querySelectorAll('.sp-lesson-card').forEach(card=>{const i=course.lessons.findIndex(l=>l.id===card.dataset.inlineLessonId);if(i>=0){one('h3',`lessons.${i}.title`,card);one('p',`lessons.${i}.summary`,card);}});
 else if(ui.route==='lesson'){
  const index=course.lessons.findIndex(l=>l.id===ui.lessonId),lesson=course.lessons[index];if(!lesson)return;
  const prefix=`lessons.${index}`;one('.sp-lesson-article>.sp-page-title',prefix+'.title');one('.sp-lesson-article>.sp-lead',prefix+'.summary');
  root.querySelectorAll('.sp-reading-section').forEach((section,j)=>{const p=prefix+`.sections.${j}`;one('h2',p+'.title',section);
   const blocks=[...section.children].filter(el=>el.classList.contains('sp-block'));
   lesson.sections[j].blocks.forEach((block,k)=>{const el=blocks[k];if(!el)return;const path=p+`.blocks.${k}`,text=(selector,key)=>one(selector,path+'.'+key,el);
    if(block.type==='arabic')mark(el,path+'.arabic');
    else if(['text','callout'].includes(block.type))text('p','text');
    else if(block.type==='ayah'){text('.sp-reference','reference');text('.sp-arabic','arabic');text('figcaption','translation');}
    else if(block.type==='quote'){text('.sp-arabic','arabic');if(block.reference){text('.sp-reference','reference');text('figcaption','text');}else{text('p:not(.sp-arabic)','text');text('cite','attribution');}}
    else if(block.type==='list'){if(['concept','radial','steps'].includes(block.presentation)){text('.sp-diagram-centre strong','text');text('.sp-diagram-centre>span','attribution');el.querySelectorAll('.sp-diagram-text').forEach((li,n)=>mark(li,path+'.items.'+n));}else el.querySelectorAll('li').forEach((li,n)=>mark(li,path+'.items.'+n));}
    else if(block.type==='words')el.querySelectorAll(':scope>div').forEach((div,n)=>{one('.sp-arabic',path+'.'+(n?'rightArabic':'leftArabic'),div);one('p:not(.sp-arabic)',path+'.'+(n?'rightMeaning':'leftMeaning'),div);});
    else if(block.type==='reflection'){text('label','text');el.querySelector('textarea').disabled=true;for(const button of el.querySelectorAll('.sp-reflection-actions button'))button.disabled=true;}
    else if(block.type==='image')text('figcaption','caption');
    else if(block.type==='note'){text('summary','attribution');text('p','text');}
   });
  });
 }else if(ui.route==='materials'){
  one('.sp-page>.sp-lead','materials.intro');root.querySelectorAll('.sp-material').forEach((card,i)=>{if(i>=course.materials.files.length)return;one('h2',`materials.files.${i}.title`,card);one('p',`materials.files.${i}.description`,card);});
 }
}
