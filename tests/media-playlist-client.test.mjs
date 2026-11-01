import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mountMediaAdmin} from '../public/shared/media-admin-panel.mjs';
import {checkedMediaPlaylist,checkedMediaSelection,pendingMedia,saveMediaDraft,publishMediaDraft,reviewedCompanion} from '../public/shared/media-workflow.mjs';
const {parseHTML}=createRequire(import.meta.url)('linkedom');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const choices=(kind='COURSE',programmeKey=null)=>({kind,programmeKey,teachers:[{id:'teacher-one',name:'Registered Teacher'}],classes:[{id:'original-class',name:'Original recorded class'}],subjects:[{id:'legacy-site',name:'Legacy Surah'}],playlists:[{id:'explicit-playlist',websiteId:'playlist-wrapper',name:'Checked playlist',closeDate:null}]});
function input(extra={}){
 const durationSeconds=60;
 return {sourceKind:'YOUTUBE',sourceURL:'https://www.youtube.com/watch?v=abcdefghijk',title:'Reviewed source',playlistId:'explicit-playlist',teacherIds:['teacher-one'],durationSeconds,companion:reviewedCompanion({summary:'Actual source-specific summary.',topics:'00:00 Opening\n00:20 Main point',application:'Reviewed practice.',durationSeconds}),supportingFiles:[],...extra};
}
async function panel(t,options){
 const previous={document:globalThis.document,window:globalThis.window};
 const {document,window}=parseHTML('<html><head></head><body><section id="media"></section></body></html>');
 globalThis.document=document;globalThis.window=window;window.confirm=()=>false;
 const calls=[],host=document.getElementById('media');
 const dispose=mountMediaAdmin(host,{offeringId:'course',current:()=>true,initialRecord:{media:[]},optionsPromise:Promise.resolve(options),api:async path=>{calls.push(path);throw Error('Unexpected request');},mutate:async()=>{throw Error('Unexpected mutation');}});
 t.after(()=>{dispose();for(const [name,value]of Object.entries(previous)){if(value===undefined)delete globalThis[name];else globalThis[name]=value;}});
 await flush();return {document,host,calls};
}

for(const [label,kind,programmeKey]of [['Course','COURSE',null],['Tafseer','TAFSEER',null],['MOU','TAFSEER','mothers']]){
 test(label+' attachment form selects a checked playlist without a timetable session',async t=>{
  const f=await panel(t,choices(kind,programmeKey)),form=f.host.querySelector('[data-media-attach]');
  assert(form.querySelector('select[name=playlistId][required]'));
  assert.equal(form.querySelector('select[name=playlistId] option[value="explicit-playlist"]').textContent,'Checked playlist · Open'+(kind==='COURSE'?'':' · current paid month'));
  assert.equal(form.querySelector('[name=websiteId]'),null,'No guessed Surah/website fallback');
  assert.equal(form.querySelector('[name=sessionId],[name=sessionDate],[name=publicationId]'),null);
  assert.equal(form.querySelector('[name=cohort]')!==null,kind!=='COURSE');
  assert.equal(form.querySelector('[name=lessonDate]').hasAttribute('required'),kind!=='COURSE');
  assert.equal(form.querySelector('[type=submit]').disabled,false);assert.deepEqual(f.calls,[]);
 });
 test(label+' cannot create ungrouped media when the native playlist list is empty',async t=>{
  const options=choices(kind,programmeKey);options.playlists=[];const f=await panel(t,options);
  assert(f.host.querySelector('[data-media-attach] [type=submit]').disabled);
  assert.match(f.host.textContent,/Create a playlist/);assert.equal(f.host.querySelector('[name=websiteId]'),null);
 });
}

test('legacy website descriptors are not silently adopted as new recording playlists',async t=>{
 const options=choices();options.playlists[0].legacy=true;const f=await panel(t,options);
 assert(f.host.querySelector('[data-media-attach] [type=submit]').disabled);
 assert.throws(()=>checkedMediaPlaylist(options,'explicit-playlist'),/current playlist/);
});

test('checked selection preserves a native playlist parent, Teacher and original recorded class/date',()=>{
 const options=choices('TAFSEER'),value=input({cohort:'original-class',lessonDate:'2024-03-11'});
 const selected=checkedMediaSelection(options,value);assert.equal(selected.playlist.id,value.playlistId);assert.equal(selected.websiteId,'playlist-wrapper');assert.deepEqual(selected.teacherIds,['teacher-one']);
 for(const change of [{playlistId:''},{playlistId:'legacy-site'},{cohort:'Unknown class'},{lessonDate:'2024-02-31'},{teacherIds:[]},{teacherIds:['teacher-one','TEACHER-ONE']},{teacherIds:['unknown']},{websiteId:'different-wrapper'}])assert.throws(()=>checkedMediaSelection(options,{...value,...change}));
});

test('bad or removed selections cause no source, file, attachment or companion writes',async()=>{
 for(const bad of [{playlistId:'removed'},{teacherIds:[]},{teacherIds:['unknown']},{cohort:'other-class'}]){
  const p=pendingMedia(input({cohort:'original-class',lessonDate:'2024-03-11',...bad})),calls=[];
  await assert.rejects(saveMediaDraft({pending:p,path:'/api/admin/tafseer',api:async(path,options)=>{calls.push({path,options});return choices('TAFSEER');}}));
  assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/admin/tafseer/media-options');assert.equal(calls[0].options,undefined);
 }
 assert.throws(()=>pendingMedia(input({playlistId:null})),/Choose a playlist/);
});

test('lost acknowledgements preserve the selected playlist, exact identities and processed content across retries',async()=>{
 const original=input({supportingFiles:[new File(['%PDF-1.7\nSynthetic source\n%%EOF'],'source.pdf',{type:'application/pdf'})],sessionId:'must-not-be-used'}),p=pendingMedia(original),calls=[];let lose=true;
 const api=async(path,options)=>{calls.push({path,body:options?.body,method:options?.method});if(path.endsWith('/media-options'))return choices();if(options?.body?.action==='media-companion-save'&&lose){lose=false;throw Error('Lost acknowledgement');}return {};};
 await assert.rejects(saveMediaDraft({pending:p,api,path:'/api/admin/course'}),/Lost acknowledgement/);
 original.playlistId='another';original.teacherIds.push('unknown');original.sourceURL='https://youtu.be/lmnopqrstuv';original.companion.summary='Changed elsewhere';original.supportingFiles.length=0;
 await saveMediaDraft({pending:p,api,path:'/api/admin/course'});
 const attaches=calls.filter(c=>c.body?.action==='media-attach'),sources=calls.filter(c=>c.body?.action==='youtube'),companions=calls.filter(c=>c.body?.action==='media-companion-save');
 assert.equal(attaches.length,2);assert.deepEqual(attaches[0].body,attaches[1].body);
 assert.equal(attaches[0].body.playlistId,'explicit-playlist');assert.equal(attaches[0].body.websiteId,'playlist-wrapper');assert.deepEqual(attaches[0].body.teacherIds,['teacher-one']);
 assert.equal(attaches[0].body.supportingFiles.length,1);assert(!Object.keys(attaches[0].body).some(k=>/session/i.test(k)));
 assert.deepEqual(sources[0].body,sources[1].body);assert.equal(sources[0].body.videoId,'abcdefghijk');assert.deepEqual(companions[0].body,companions[1].body);assert.equal(companions[1].body.companion.summary,'Actual source-specific summary.');
 assert.equal(calls.filter(c=>c.path.endsWith('/media-options')).length,2,'One bounded options read per explicit Save');
 const before=calls.length;await assert.rejects(saveMediaDraft({pending:p,api,path:'/api/admin/another'}),/original programme/);assert.equal(calls.length,before);
});

test('a changed playlist wrapper stops a resumed save before any additional source writes',async()=>{
 const p=pendingMedia(input()),calls=[];let changed=false;
 const api=async(path,options)=>{calls.push({path,options});if(path.endsWith('/media-options')){const o=choices();if(changed)o.playlists[0].websiteId='different-parent';return o;}if(options?.body?.action==='youtube'){changed=true;throw Error('Lost source acknowledgement');}return {};};
 await assert.rejects(saveMediaDraft({pending:p,api,path:'/api/admin/course'}),/Lost source/);const before=calls.length;
 await assert.rejects(saveMediaDraft({pending:p,api,path:'/api/admin/course'}),/playlist parent changed/);
 assert.equal(calls.length,before+1);assert(calls.at(-1).path.endsWith('/media-options'));
});

test('an account change during the checked selection read cannot start a source upload',async()=>{
 const calls=[],p=pendingMedia(input());let changed=false;
 await assert.rejects(saveMediaDraft({pending:p,path:'/api/admin/course',current:()=>{if(changed)throw Error('Account changed');},api:async(path,options)=>{calls.push({path,options});changed=true;return choices();}}),/Account changed/);
 assert.equal(calls.length,1);assert.equal(calls[0].options,undefined);
});

test('publication checks the saved playlist and Teacher without publishing the playlist or guessing a legacy group',async()=>{
 const base={attachmentId:'recording',published:false,recordedContext:{teacherIds:['teacher-one'],playlist:{id:'explicit-playlist',websiteId:'playlist-wrapper',name:'Checked playlist'}},attributionRevision:1,draftContext:'exact-context'},calls=[];
 const api=async(path,options)=>{calls.push({path,body:options?.body});return path.endsWith('/media-options')?choices():{};};
 await publishMediaDraft({detail:base,operations:{recording:'one-publication'},api,path:'/api/admin/course'});
 assert.deepEqual(calls.map(c=>c.body?.action).filter(Boolean),['media-publication']);
 for(const detail of [{...base,recordedContext:{...base.recordedContext,teacherIds:[]}},{...base,recordedContext:{...base.recordedContext,playlist:{id:'removed',websiteId:'playlist-wrapper'}}},{...base,recordedContext:{teacherIds:['teacher-one']}}]){
  calls.length=0;await assert.rejects(publishMediaDraft({detail,operations:{recording:'held'},api,path:'/api/admin/course'}));assert.equal(calls.filter(c=>c.body).length,0);
 }
 calls.length=0;await publishMediaDraft({detail:{...base,published:true,recordedContext:{teacherIds:['teacher-one']}},operations:{recording:'legacy-review'},api,path:'/api/admin/course'});
 assert.equal(calls.at(-1).body.action,'media-publication');assert(!('playlistId' in calls.at(-1).body),'Published historical media is not silently moved or copied');
});
