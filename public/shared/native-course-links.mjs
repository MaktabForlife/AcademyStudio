// Public metadata selects the registered website. It is never a media grant:
// the destination reader checks the current account and native Course policy.
const id=value=>typeof value==='string'&&/^[-A-Za-z0-9_:]{1,180}$/.test(value);
const aliases=Object.freeze({
 'surah-al-kahf':['surah-al-kahf','kahf'],
 'stillness-in-my-salah':['stillness-in-my-salah','salaah'],
 'tawakkul-mindset':['tawakkul-mindset','tawakkul']
});
export function nativeCourseIndex(items){
 if(!Array.isArray(items)||items.length>200)throw Error('The course catalogue needs to be refreshed.');
 const index=new Map();
 for(const item of items){
  if(item?.kind!=='COURSE'||item.pending===true||!item.websiteId)continue;
  if(!id(item.key)||!id(item.websiteId)||typeof item.title!=='string'||!item.title.trim()||item.title.length>240||index.has(item.key))throw Error('The course catalogue needs review.');
  index.set(item.key,{websiteId:item.websiteId,title:item.title,href:'/studio/?website='+encodeURIComponent(item.websiteId)});
 }
 for(const keys of Object.values(aliases))if(new Set(keys.map(key=>index.get(key)?.websiteId).filter(Boolean)).size>1)throw Error('This course has conflicting website links.');
 return index;
}
export async function loadNativeCourseIndex({fetcher=globalThis.fetch}={}){
 const response=await fetcher('/api/public/circles',{credentials:'omit',cache:'no-store'});
 if(!response.ok)throw Error('The course catalogue could not be loaded. Please refresh.');
 const value=await response.json();return nativeCourseIndex(value.items);
}
export function withNativeCourseLink(item,index){
 const matches=(aliases[item.key]||[item.key]).map(key=>index.get(key)).filter(Boolean);
 if(!matches.length)return {...item};
 if(new Set(matches.map(row=>row.websiteId)).size!==1)throw Error('This course has conflicting website links.');
 const match=matches[0];
 return {...item,title:match.title,href:match.href,nativeWebsiteId:match.websiteId,recordingCount:null};
}

// A registered Course mapping is not a mapping of its old lesson IDs. Preserve
// the bookmark and offer explicit recovery rather than silently selecting a
// different recording or guessing an attachment from its title/date/order.
export function hasHistoricalLessonContext(url){
 const value=new URL(url),params=value.searchParams;
 return Boolean(value.hash)||[...params.keys()].some(key=>key!=='course'&&!['concept','branch','embed','role'].includes(key));
}
