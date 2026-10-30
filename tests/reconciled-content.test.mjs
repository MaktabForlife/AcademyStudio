import test from 'node:test';import assert from 'node:assert/strict';
import {chooseDraft,matchRecording,reconcileRecording,seedReconciledFixture} from '../tools/reconciled-content.mjs';
import {bindRecordingGuides} from '../public/shared/media-bindings.mjs';
test('reconciliation retains a newer draft and holds divergent source edits',()=>{
 const base={id:'course',text:'original'},current={...base,text:'new private edit'},incoming={...base,text:'recording companion'};
 assert.equal(chooseDraft({base,current:base,incoming}).status,'INCOMING_DRAFT');
 assert.equal(chooseDraft({base,current,incoming:base}).document,current);
 const conflict=chooseDraft({base,current,incoming});assert.equal(conflict.status,'CONFLICT_CURRENT_PRESERVED');assert.equal(conflict.document,current);assert.equal(conflict.candidate,incoming);
 assert.equal(chooseDraft({base,current:incoming,incoming}).status,'ALREADY_PRESENT');
});
test('recordings match stable video/lesson identities within the same offering without changing historical rights',()=>{
 const reference={offeringId:'tafseer',sourceLessonId:'original',kind:'YOUTUBE',youtubeId:'abc12345678',linked:true,state:'PUBLISHED',date:'2024-12-30',cohorts:['old-class']};
 const source={lessonId:'editorial-local',videoId:'abc12345678',lessonDate:'2025-01-11'},result=matchRecording([reference],'tafseer',source);
 assert.equal(result.status,'MATCHED');assert.equal(result.native,reference);assert.equal(result.dateDiscrepancy,true);assert.deepEqual(result.native.cohorts,['old-class']);
 assert.equal(matchRecording([reference],'another-course',source).status,'NATIVE_MAPPING_PENDING');
 assert.equal(matchRecording([reference],null,source).status,'OFFERING_MAPPING_PENDING');
 assert.equal(matchRecording([reference,reference],'tafseer',source).status,'AMBIGUOUS_NATIVE_REFERENCE');
 assert.equal(matchRecording([reference],'tafseer',{...source,lessonId:'original',videoId:'different00'}).status,'LESSON_VIDEO_CONFLICT');
 assert.equal(matchRecording([{...reference,state:'HIDDEN'}],'tafseer',source).status,'SOURCE_HIDDEN');
});
test('resolved metadata separates the source pending declaration from current mapping and publication state',()=>{
 const native={offeringId:'tafseer',sourceLessonId:'native',kind:'YOUTUBE',youtubeId:'abc12345678',linked:true,state:'PUBLISHED',date:'2026-01-01',cohorts:['original-class']},source={lessonId:'editorial',videoId:'abc12345678',nativeMappingPending:true};
 const resolved=reconcileRecording([native],'tafseer',source);
 assert.equal(resolved.status,'MATCHED');assert.equal(resolved.nativeMappingPending,false);assert.equal(resolved.sourceNativeMappingPending,true);assert.equal(source.nativeMappingPending,true);
 const pending=reconcileRecording([],'tafseer',{...source,nativeMappingPending:false});assert.equal(pending.status,'NATIVE_MAPPING_PENDING');assert.equal(pending.nativeMappingPending,true);assert.equal(pending.sourceNativeMappingPending,false);
 const inherited=reconcileRecording([native],'tafseer',{lessonId:'editorial',videoId:source.videoId},true);assert.equal(inherited.sourceNativeMappingPending,true);assert.equal(inherited.nativeMappingPending,false);
 const hidden=reconcileRecording([{...native,state:'HIDDEN'}],'tafseer',source);assert.equal(hidden.status,'SOURCE_HIDDEN');assert.equal(hidden.nativeMappingPending,false,'Identity can be resolved while delivery stays hidden');
});
test('reconciled fixture adapter refuses hosted and source-authority environments before mutation',async()=>{
 for(const env of [{ENVIRONMENT:'parallel',AUTHORITY_MODE:'ACADEMY'},{ENVIRONMENT:'local',AUTHORITY_MODE:'ACADEMY'},{ENVIRONMENT:'isolated-preview'}])await assert.rejects(seedReconciledFixture({env},'/unused'),/DISPOSABLE_LOCAL_FIXTURE_REQUIRED/);
});
test('guide aliases require the exact asset and native lesson in the current permitted feed',()=>{
 const guide={lessonId:'editorial-1',readingId:'reading-1',summary:'Original summary'},bindings=[{editorialLessonId:'editorial-1',nativeLessonId:'native-1',assetId:'asset-1'}],allowed={attachment_id:'delivery-1',asset_id:'asset-1',lesson_id:'native-1'};
 assert.deepEqual(bindRecordingGuides([guide],[allowed],bindings),[{...guide,lessonId:'native-1',editorialLessonId:'editorial-1'}]);
 assert.equal(guide.lessonId,'editorial-1');
 for(const media of [[],[{...allowed,asset_id:'another-asset'}],[{...allowed,lesson_id:'another-lesson'}]])assert.equal(bindRecordingGuides([guide],media,bindings)[0],guide);
 assert.equal(bindRecordingGuides([guide],[allowed],[...bindings,...bindings])[0],guide,'Ambiguous aliases stay unresolved');
});
