import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {newCourse,newBlock,THEMES} from '../public/shared/model.mjs';
import {validatePackage} from '../public/shared/content-schema.mjs';
import {recordingGuides} from '../public/shared/recording-companion.mjs';

const tool=new URL('../tools/prepare-recording-companion.mjs',import.meta.url).pathname;
async function rehearsal(run){
 const dir=await mkdtemp(join(tmpdir(),'recording-preparation-'));
 try{await run(dir);}finally{await rm(dir,{recursive:true,force:true});}
}
const compile=(source,guides,output)=>execFileSync(process.execPath,[tool,source,guides,output],{stdio:'pipe'});
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const write=(file,value)=>writeFile(file,JSON.stringify(value));
function example(){
 const document=newCourse();document.materials.files=[{id:'original-pdf',assetId:'reused-pdf',title:'Original notes',description:'Author notes'}];
 return {original:{format:document.format,websiteId:'synthetic-website',document,media:[{assetId:'reused-pdf',kind:'PDF'}]},review:{theme:'terracotta',guides:[{status:'reviewed',lessonId:'stable-recording',readingId:document.lessons[0].id,title:'An active introduction',summary:'Recognise the signs and give them your attention.',application:'Make time to reflect.\n\nCarry the reminder into daily life.',quote:{text:'A checked source quotation.',timestamp:'2:15',attribution:'Original speaker'},topics:[{time:'1:05',title:'A verified topic'}]}]}};
}

test('preparation preserves author content and stable media while both editors receive ordinary validated blocks',async()=>rehearsal(async dir=>{
 const {original,review}=example(),source=join(dir,'source.json'),guides=join(dir,'guides.json'),output=join(dir,'prepared.json');
 await write(source,original);await write(guides,review);const before=await readFile(source,'utf8');compile(source,guides,output);const result=await read(output);
 assert.equal(await readFile(source,'utf8'),before);assert.deepEqual(result.media,original.media);assert.deepEqual(result.document.materials,original.document.materials);assert.equal(result.document.theme,'terracotta');assert.deepEqual(validatePackage(result.document,{review:true}),[]);
 const lesson=result.document.lessons[0];for(const section of original.document.lessons[0].sections)assert.deepEqual(lesson.sections.find(row=>row.id===section.id),section);
 assert.equal(recordingGuides(result.document).length,1);const closing=lesson.sections.find(section=>section.title==='Carry the lesson into daily life');assert(closing);assert.equal(closing.blocks[0].type,'text');assert.equal(closing.blocks[0].text,review.guides[0].application);
 const audit=await read(output+'.audit.json');assert.equal(audit.practicalClosings,1);assert.equal(audit.originalSectionsUnchanged,true);
 // A revised companion updates its own fields without dropping an editor's
 // unrelated passage in the same section or creating duplicate source blocks.
 const sourceSection=lesson.sections.find(section=>section.id.startsWith('recording-section-')),unrelated={...newBlock('text'),text:'An independent author passage.'};sourceSection.blocks.push(unrelated);
 await write(output,result);review.guides[0].application='A revised practical reflection.';review.guides[0].summary='A revised active introduction.';await write(guides,review);
 const next=join(dir,'next.json');compile(output,guides,next);const revised=await read(next),after=revised.document.lessons[0];assert.equal(recordingGuides(revised.document).length,1);assert.equal(recordingGuides(revised.document)[0].summary,review.guides[0].summary);assert.deepEqual(after.sections.find(section=>section.id===sourceSection.id).blocks.find(block=>block.id===unrelated.id),unrelated);assert.equal(after.sections.length,lesson.sections.length);assert.equal(after.sections.find(section=>section.id===closing.id).blocks[0].id,closing.blocks[0].id);
}));

test('invalid or unreviewed companion input never produces a prepared package',async()=>rehearsal(async dir=>{
 const {original,review}=example(),source=join(dir,'source.json'),guides=join(dir,'guides.json'),output=join(dir,'prepared.json');await write(source,original);
 for(const mutate of [r=>r.guides[0].status='pending',r=>r.guides.push(structuredClone(r.guides[0])),r=>r.theme='arbitrary-style',r=>r.guides[0].readingId='missing-reading',r=>r.guides[0].application='',r=>r.guides[0].topics=[{time:'1:90',title:'Invalid time'}]]){
  const copy=structuredClone(review);mutate(copy);await write(guides,copy);assert.throws(()=>compile(source,guides,output));await assert.rejects(readFile(output),{code:'ENOENT'});
 }
 await write(guides,review);assert.throws(()=>compile(source,guides,source));assert.deepEqual(await read(source),original);
}));

test('PDF-guided palettes use the shared content contract and retain readable recording-button text',()=>{
 const luminance=hex=>{const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
 for(const [name,palette] of Object.entries(THEMES)){
  const document=newCourse();document.theme=name;assert.deepEqual(validatePackage(document,{review:true}),[]);assert((1.05/(luminance(palette.accent)+.05))>=4.5,name+' button contrast');
 }
 const invalid=newCourse();invalid.theme='custom-unvalidated';assert.throws(()=>validatePackage(invalid));
});
