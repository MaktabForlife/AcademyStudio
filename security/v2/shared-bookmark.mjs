import {requireThat} from './codec.mjs';

const readerPath='/studio/';
const areaOrigin='https://worshipuponbaseera.ummabbadacademy.app';
const websiteId=/^[A-Za-z0-9_:-]{1,160}$/;
const lessonId=/^[A-Za-z0-9_-]{1,80}$/;
const recordingId=/^[A-Za-z0-9_:-]{1,180}$/;

export function studioBookmark(value){
 requireThat(typeof value==='string'&&value.length<=2048&&value.startsWith(readerPath+'?')
  &&!/[\u0000-\u0020\u007f\\]/.test(value),'UNREGISTERED_RETURN',400);
 const url=new URL(value,areaOrigin);
 const query=[...url.searchParams],fragment=[...new URLSearchParams(url.hash.slice(1))];
 const website=url.searchParams.get('website'),edition=url.searchParams.get('edition');
 const selection=new URLSearchParams(url.hash.slice(1)),view=selection.get('view'),id=selection.get('id');
 requireThat(url.origin===areaOrigin&&url.pathname===readerPath&&query.length===(edition===null?1:2)
  &&query.every(([key])=>key==='website'||key==='edition')&&websiteId.test(website||'')
  &&(edition===null||edition==='published')&&fragment.length===2&&fragment.every(([key])=>key==='view'||key==='id')
  &&(view==='lesson'?lessonId.test(id||''):view==='recording'&&recordingId.test(id||'')),'UNREGISTERED_RETURN',400);
 const options=new URLSearchParams({website,...(edition?{edition}:{})});
 const choice=new URLSearchParams({view,id});
 return {type:'studio-bookmark',website,edition,view,id,returnTo:readerPath+'?'+options+'#'+choice};
}
