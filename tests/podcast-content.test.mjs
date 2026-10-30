import test from 'node:test';import assert from 'node:assert/strict';
import{newCourse,newBlock,setPath}from'../public/shared/model.mjs';
import{validatePackage}from'../public/shared/content-schema.mjs';
import{renderCourse,renderBlock}from'../public/shared/student.mjs';
import{recordingOverview}from'../public/shared/recording-companion.mjs';
const ui={portal:true,route:'home',readingSize:18,reflections:{},isPreview:true};
test('podcast layout is an optional shared setting and retains existing reader actions',()=>{
 const d=newCourse();delete d.home.recordingLayout;assert.deepEqual(validatePackage(d),[]);setPath(d,'home.recordingLayout','podcast');assert.deepEqual(validatePackage(d),[]);
 const html=renderCourse(d,ui,new Map());assert(html.includes('data-recording-layout="podcast"'));for(const action of ['data-sp="contents"','data-route="materials"','data-route="lessons"'])assert(html.includes(action));
 for(const value of ['unknown',{},null,1]){const bad=structuredClone(d);bad.home.recordingLayout=value;assert.throws(()=>validatePackage(bad));}
 const rows=[{attachment_id:'authorised-video',lesson_id:'local-recording',title:'A checked recording',lesson_date:'2026-02-17',type:'video/youtube'}],overview=recordingOverview({media:rows,layout:'podcast'});
 assert(overview.includes('sp-podcast-overview'));assert(overview.includes('Play recording'));assert(!overview.includes('LESSON 01'));assert(!overview.includes('2026</time>'));assert(!overview.includes('youtube.com'));assert(!overview.includes('data-sp="complete"'));
 assert(recordingOverview({media:rows}).includes('Watch the full video'));assert(!recordingOverview({media:rows}).includes('sp-podcast-overview'));
});
test('original artwork crops reuse one stable reference and cannot escape the image bounds',()=>{
 const d=newCourse(),image={...newBlock('image'),assetId:'original',alt:'Original Arabic passage',crop:{x:15,y:30,width:200,height:70,sourceWidth:600,sourceHeight:900}};d.lessons[0].sections[0].blocks=[image];assert.deepEqual(validatePackage(d,{review:true}),[]);
 const html=renderBlock(image,ui,new Map([['original',{url:'blob:original'}]]));assert(html.includes('sp-original-crop'));assert(html.includes('aspect-ratio:200/70'));assert.equal((html.match(/src="blob:original"/g)||[]).length,1);assert(html.includes('loading="lazy"'));
 for(const mutate of [c=>c.x=-1,c=>c.width=1000,c=>c.height=0,c=>c.y=Infinity,c=>c.extra='unsupported',c=>c.sourceWidth='600']){const bad=structuredClone(d);mutate(bad.lessons[0].sections[0].blocks[0].crop);assert.throws(()=>validatePackage(bad));}
 setPath(d,'lessons.0.sections.0.blocks.0.assetId','replacement');assert(!d.lessons[0].sections[0].blocks[0].crop);assert.deepEqual(validatePackage(d),[]);
});
test('long source notes remain bounded without forcing loss of author text',()=>{
 const d=newCourse();d.lessons[0].sections[0].blocks=Array.from({length:30},(_,i)=>({...newBlock('text'),id:'source-'+i,text:'a'.repeat(19000)}));assert.deepEqual(validatePackage(d),[]);
 d.lessons[0].sections.push({id:'more-source',title:'More notes',label:'',blocks:Array.from({length:25},(_,i)=>({...newBlock('text'),id:'extra-'+i,text:'a'.repeat(19000)}))});assert.throws(()=>validatePackage(d),/too large/);
});

test('a source-rich course has a finite component bound',()=>{
 const d=newCourse();d.lessons=[];for(let l=0;l<2;l++){const lesson={id:'reading-'+l,title:'Original notes',group:'Source',summary:'',sections:[]};for(let s=0;s<21;s++)lesson.sections.push({id:'section-'+l+'-'+s,title:'Source section',label:'',blocks:Array.from({length:39},(_,i)=>({...newBlock('text'),id:'block-'+l+'-'+s+'-'+i}))});d.lessons.push(lesson);}
 assert.throws(()=>validatePackage(d),/sixteen hundred/);d.lessons[1].sections.pop();assert.deepEqual(validatePackage(d),[]);
});
