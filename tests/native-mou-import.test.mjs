import test from 'node:test';import assert from 'node:assert/strict';
import {recordingAttachmentFixture} from './recording-attachment-fixture.mjs';
import {buildNativeMouPackage} from '../tools/native-mou-attachment-package.mjs';
import {reviewNativeMouPlan,executeNativeMouPlan,mouPreflightPath,mouOffering} from '../public/shared/native-mou-import.mjs';
test('the supported native Admin import reviews, exports a narrow preflight, resumes exact receipts and fences account changes',async t=>{
 const f=await recordingAttachmentFixture({attach:false,offeringId:mouOffering,cohort:'CLS-39751608-d213-4c66-a4d5-dccfbbeb1c57'});t.after(()=>f.close());
 let calls=0,active=true,failAt=0;const current=()=>{if(!active)throw Error('Account changed');};
 const api=async(path,options={})=>{calls++;if(calls===failAt)throw Error('Interrupted local request');const r=await f.request(path,{cookie:f.admin,method:options.body?'POST':'GET',body:options.body});assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
 const params=new URLSearchParams();for(const l of f.packages.lessons.filter(l=>l.kind==='studio'))params.append('source',new URL(l.sourceURL).searchParams.get('v'));
 const preflight=await api('/api/admin/'+f.offer+'/recording-attachments?'+params),plan=buildNativeMouPackage({preflight,...f.packages});assert.equal((await reviewNativeMouPlan(plan)).canExecute,true);assert.equal((await reviewNativeMouPlan({...plan,requiresFreshPreflight:true})).canExecute,false);
 assert.equal((await f.request(mouPreflightPath(plan),{cookie:f.learner})).status,403);
 const bad=structuredClone(plan);bad.requests[0].body.action='participant';await assert.rejects(reviewNativeMouPlan(bad));const privatePlan=structuredClone(plan);privatePlan.requests.find(s=>s.body.action==='companion-save').body.companion.reviewFlags=['private'];await assert.rejects(reviewNativeMouPlan(privatePlan),/Private/);
 calls=0;failAt=5;await assert.rejects(executeNativeMouPlan(plan,{api,current}),/Interrupted/);assert(calls===5);failAt=0;calls=0;const result=await executeNativeMouPlan(plan,{api,current});assert.equal(result.completed,4);assert.equal(calls,33,'One narrow preflight plus exactly 32 explicit bounded native steps');
 active=false;calls=0;await assert.rejects(executeNativeMouPlan(plan,{api,current}),/Account changed/);assert.equal(calls,0);
 const protectedPlan=structuredClone(plan);active=true;await f.run("UPDATE websites SET revision=revision+1 WHERE website_id=?",plan.items[0].websiteId);calls=0;await assert.rejects(executeNativeMouPlan(protectedPlan,{api,current}),/changed outside|Preserve/);assert.equal(calls,1,'Changed Admin draft stops at the preflight');
 t.diagnostic(JSON.stringify({reviewed:4,manualOnly:true,boundedSteps:32,privateFieldsRejected:true,accountFence:true,hostedCalls:0}));
});
