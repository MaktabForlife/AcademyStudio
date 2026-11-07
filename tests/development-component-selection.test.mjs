import test from 'node:test';
import assert from 'node:assert/strict';
import {registry,assertRegistry,selectComponent,assertContext,assertSafeEnvironment,preflightPair,assertRetainedVersionState,assertSelectionBinding,assertSourcePreservation} from '../tools/development-component-selection.mjs';
const item=registry.components[0],sha='a'.repeat(40),repo=item.repository;
const fixture=()=>({repository:repo,prNumber:5,sourceSha:sha,pr:{number:5,state:'open',merged:false,base:{ref:'studio_dev',repo:{full_name:repo}},head:{sha,repo:{full_name:repo}}},plan:{schema:1,request:item.request,kind:'component',target:'development',contains_jwt:false,database_changes:false},files:[{filename:'deployment/release-plan.json'},{filename:'public/course-media.mjs'}]});
test('selected Development component records actual source and literal counterpart without approval',()=>{
 const value=selectComponent(fixture());assert.equal(value.actualSourceSha,sha);assert.deepEqual(value.counterpart,item.counterpart);assert.equal(value.approval,false);assert.equal(value.deployable,false);
});
for(const [name,change]of [
 ['wrong explicit version',x=>x.plan.version='109.28'],
 ['production',x=>x.plan.target='production'],['release',x=>x.plan.kind='release'],['JWT',x=>{x.plan.contains_jwt=true;x.plan.target='feature';}],['DB effects',x=>x.plan.database_changes=true],
 ['unknown request',x=>x.plan.request='unreviewed'],['unknown PR',x=>x.prNumber=50],['changed source',x=>x.pr.head.sha='b'.repeat(40)],['foreign fork',x=>x.pr.head.repo.full_name='foreign/AcademyStudio'],
 ['wrong base',x=>x.pr.base.ref='main'],['closed PR',x=>x.pr.state='closed'],['already merged',x=>x.pr.merged=true],
 ['renamed live schema',x=>x.files.push({filename:'tools/innocent.mjs',previous_filename:'migrations/0040_live.sql'})],
 ['runtime JWT path',x=>x.files.push({filename:'src/auth/jwt-v110.mjs'})],['hosting change',x=>x.files.push({filename:'config/hosting.json'})],
 ['production dispatch change',x=>x.files.push({filename:'.github/workflows/paired-release.yml'})],
 ['unreviewed checker',x=>x.files.push({filename:'tools/cloud-release-check.mjs',sha:'b'.repeat(40)})]
])test('no source/package check selection for '+name,()=>{const value=fixture();change(value);assert.throws(()=>selectComponent(value));});
test('counterpart/checker floating refs and duplicate component records are rejected',()=>{
 for(const change of [x=>x.components[0].counterpart.sha='studio_dev',x=>x.checker.sha='main',x=>x.components[0].counterpart.repository=repo,x=>x.components.push(x.components[0])]){const value=structuredClone(registry);change(value);assert.throws(()=>assertRegistry(value));}
});
test('proposal and eventual PR caller contexts never accept a production push or dispatch',()=>{
 assertContext({event:'push',repository:repo,ref:'refs/heads/validation/development-component-pair-check-20261107',proposalOnly:true});
 for(const event of ['workflow_dispatch','push'])assert.throws(()=>assertContext({event,repository:repo,ref:'refs/heads/studio_dev',proposalOnly:false,prNumber:5,eventPR:{number:5,base:{ref:'studio_dev',repo:{full_name:repo}},head:{sha,repo:{full_name:repo}}}}));
 assertContext({event:'pull_request',repository:repo,ref:'refs/pull/5/merge',proposalOnly:false,prNumber:5,eventPR:{number:5,base:{ref:'studio_dev',repo:{full_name:repo}},head:{sha,repo:{full_name:repo}}}});
});
test('private environment material is rejected before package/check work',()=>{for(const name of ['CLOUDFLARE_API_TOKEN','CF_FEATURE_DEPLOY_TOKEN','FEATURE_TEST_ADMIN_PIN','PIN_SECRET'])assert.throws(()=>assertSafeEnvironment({[name]:'synthetic-not-a-credential'}));assertSafeEnvironment({GH_TOKEN:'read-only-github-fixture'});});
test('missing same-tab dependency fails, while exact relative-import translation is retained',()=>{
 const academyView="export {x} from './m4l-existing-media-view.mjs';",studioView="export {x} from './existing-media-view.mjs';";
 assert.throws(()=>preflightPair({academyView,studioView,academyNative:'old opener',requiresSameTab:true}),/DEPENDENCY_ACADEMY_SAME_TAB/);
 assert(preflightPair({academyView,studioView,academyNative:'sameTab:true',requiresSameTab:true}));
 assert.throws(()=>preflightPair({academyView:academyView+' changed',studioView,academyNative:'sameTab:true',requiresSameTab:true}),/DEPENDENCY_EXACT_SHARED_MODULE/);
});

test('historical package preservation records absence and rejects fabricated or changed old trees',()=>{
 assertRetainedVersionState(null,null);assertRetainedVersionState('a'.repeat(40),'a'.repeat(40));
 for(const [before,after]of [[null,'a'.repeat(40)],['a'.repeat(40),null],['a'.repeat(40),'b'.repeat(40)]])assert.throws(()=>assertRetainedVersionState(before,after),/RETAINED_V10925_STATE_CHANGED/);
});

test('stored evidence cannot redirect literal checker/counterpart/source/version bindings',()=>{
 const value=selectComponent(fixture()),context={repository:repo,prNumber:5,sourceSha:sha};assertSelectionBinding(value,context);
 for(const change of [x=>x.counterpart.sha='b'.repeat(40),x=>x.checker.sha='b'.repeat(40),x=>x.actualSourceSha='b'.repeat(40),x=>x.repository='MaktabForlife/Academy',x=>x.pr=6,x=>x.version='109.28',x=>x.registrySHA256='b'.repeat(64),x=>x.sourcePlan.target='production']){const bad=structuredClone(value);change(bad);assert.throws(()=>assertSelectionBinding(bad,context));}
});
test('generated source remains the actual app source apart from explicit package/version transformations',()=>{
 const values={'version.json':JSON.stringify({version:'109.25'}),'backend/src/academy/d1/worker.js':"export const health={version:'109.25',protected:true};\n"};
 const readOriginal=path=>values[path],readCurrent=path=>path==='version.json'?JSON.stringify({version:'109.27'}):values[path].replace('109.25','109.27');
 assertSourcePreservation({side:'Academy',changes:['version.json','backend/src/academy/d1/worker.js','release/v109.27/public/a.js'],readOriginal,readCurrent});
 assert.throws(()=>assertSourcePreservation({side:'AcademyStudio',changes:['src/worker.mjs'],readOriginal,readCurrent}),/NONPACKAGE_SOURCE_CHANGED/);
 assert.throws(()=>assertSourcePreservation({side:'Academy',changes:['backend/src/academy/d1/worker.js'],readOriginal,readCurrent:path=>readCurrent(path).replace('protected:true','protected:false')}),/VERSION_CODE_CHANGED/);
});
