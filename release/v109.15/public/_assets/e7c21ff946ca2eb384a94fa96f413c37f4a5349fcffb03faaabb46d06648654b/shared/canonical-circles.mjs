// Presentation compatibility only. Requested views are never account authority.
export const canonicalAcademyOrigin='https://academy-maktab4life.pages.dev';
const homePaths=new Set(['/','/index.html','/circles','/circles/','/circles/index.html']);
const oldViews=new Set(['website','academy','dashboard','collection','mothers']);
const nativeSections=new Set(['timetable','activity','assessments','assessment','progress','planning','notes']);
export function cleanDesignParameters(params){
 const value=new URLSearchParams(params);
 for(const key of ['concept','branch','role','embed'])value.delete(key);
 if(value.get('view')==='website')value.delete('view');
 return value;
}
export function canonicalCirclesDestination(input,{academyOrigin=canonicalAcademyOrigin}={}){
 const url=new URL(input),home=homePaths.has(url.pathname),params=cleanDesignParameters(url.searchParams);
 const search=()=>params.toString()===url.searchParams.toString()?url.search:params.size?'?'+params:'';
 if(!home&&!['/studio/','/builder/','/circles/prospectus-2027.html','/prospectus-2027.html','/circles/free-learning.html','/circles/academy/mothers/surah-al-baqarah/'].includes(url.pathname))return null;
 let path=url.pathname,hash=url.hash;
 if(home){
  path='/';const view=params.get('view'),section=hash.slice(1).split('/')[0];
  const functional=['website','offering','playlist','recording','classroom'].some(key=>params.has(key))||params.get('manage')==='1'||params.get('destination')==='academy'||view==='collections';
  if(functional)path='/studio/';
  else if(view==='collection'){path='/studio/';params.set('view','collections');}
  else if(view==='mothers'){path='/studio/';params.set('classroom','mothers');params.delete('view');}
  else {
   if(['academy','dashboard'].includes(view)||['overview','dashboard'].includes(section)){
    if(params.get('public')!=='1')params.set('dashboard','1');
   }
   if(oldViews.has(view))params.delete('view');
   // Old native bookmarks keep their exact tool hash and arguments. The native
   // page checks its own session and role; no return URL or query is authority.
   if(section==='administration'||nativeSections.has(section)){
    const origin=new URL(academyOrigin);
    if(origin.origin!==academyOrigin||!['https:','http:'].includes(origin.protocol)||origin.username||origin.password)throw Error('Invalid Academy origin');
    return origin.origin+(section==='administration'?'/academy/admin/':'/academy/')+search()+hash;
   }
   if(['about','story'].includes(section))hash='#academy-story';
   if(section==='login'){params.set('login','1');hash='';}
   if(section==='prospectus'){path='/prospectus-2027.html';hash='';}
  }
 }
 if(path==='/circles/prospectus-2027.html')path='/prospectus-2027.html';
 const destination=path+search()+hash;
 return destination===url.pathname+url.search+url.hash?null:destination;
}
export function retiredOperatorPath(path){return /^\/(?:preview|import)(?:\/|$)/.test(path);}
