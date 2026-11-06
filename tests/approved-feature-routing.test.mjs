import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {routeApproved,featureReleaseWorkflow} from '../tools/approved-deployment.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex'),repo='MaktabForlife/Academy',base='a'.repeat(40),source='b'.repeat(40),merge='c'.repeat(40),head='d'.repeat(40);
function fixture({configuration=false,prior=false,withdraw=false}={}){
 const comment={user:{login:'MaktabForlife'},body:'Synthetic bound optimisation record'},record=hash(comment.body);
 const proof={repo,mergeSha:merge,headSha:head,pr:11,commentId:12,commentHash:record,approvalStatusId:13,plan:{schema:1,kind:configuration?'configuration':'release',target:configuration?'none':'feature',contains_jwt:!configuration,database_changes:false,version:'110.36',feature_sha:source,feature_base_sha:base}};
 const writes=[],reads=[];let current=base;
 const workflow=configuration?'feature-isolation-check.yml':'feature-jwt-release.yml';
 const api=async(path,options={})=>{
  if(options.method){
   writes.push({path,...options});
   if(options.method==='PATCH'){assert.equal(path,'/repos/'+repo+'/git/refs/heads/feature-preview');assert.deepEqual(options.body,{sha:source,force:false});current=source;return {};}
   assert.equal(options.method,'POST');assert.equal(path,'/repos/'+repo+'/actions/workflows/'+workflow+'/dispatches');
   assert.deepEqual(options.body,{ref:'feature-preview',inputs:{approval_pr:'11',approval_merge_sha:merge,check_only:configuration?'true':'false'}});return null;
  }
  reads.push(path);
  if(path.endsWith('/git/ref/heads/feature-preview'))return {object:{sha:current}};
  if(path.endsWith('/git/ref/heads/studio_dev'))return {object:{sha:merge}};
  if(path.includes('/compare/'))return {status:'ahead',behind_by:0,files:[{filename:configuration?'tools/example.mjs':'backend/src/auth/v110/example.mjs'}]};
  if(path.includes('/statuses?'))return [{id:13,context:'optimisation/approval',state:withdraw?'failure':'success',creator:{login:'MaktabForlife'},description:'optimisation-record-sha256:'+record}];
  if(path.endsWith('/issues/comments/12'))return comment;
  if(path.includes('/actions/workflows/')){assert(path.includes('/'+workflow+'/runs?'));return {workflow_runs:prior?[{head_sha:source,display_title:'Approved Feature '+merge,status:'completed',conclusion:'success'}]:[]};}
  assert.fail('Unexpected synthetic GitHub path');
 };
 return {proof,api,writes,reads};
}
test('approved JWT release fast-forwards exact Feature head and dispatches only JWT routine workflow',async()=>{
 const f=fixture(),out=await routeApproved(f.proof,f.api);assert.equal(out.route,'none');assert.equal(out.promotion,'DISPATCHED');assert.equal(out.checkOnly,false);assert.equal(f.writes.length,2);
});
test('configuration source check dispatches legacy validation with check_only true and no application release',async()=>{
 const f=fixture({configuration:true}),out=await routeApproved(f.proof,f.api);assert.equal(out.route,'none');assert.equal(out.checkOnly,true);assert.equal(f.writes.length,2);
});
test('same approved successful JWT dispatch is idempotent, without another workflow invocation',async()=>{
 const f=fixture({prior:true}),out=await routeApproved(f.proof,f.api);assert.equal(out.promotion,'ALREADY_DISPATCHED');assert.equal(f.writes.filter(x=>x.method==='POST').length,0);
});
test('withdrawn approval cannot promote or dispatch',async()=>{
 const f=fixture({withdraw:true});await assert.rejects(routeApproved(f.proof,f.api));assert.equal(f.writes.length,0);
});
test('a component never dispatches an application',async()=>{
 const f=fixture();f.proof.plan.kind='component';const out=await routeApproved(f.proof,async()=>assert.fail('No GitHub effect'));assert.equal(out.route,'none');
});
test('JWT selector cannot choose production or undeclared JWT Feature release',()=>{
 assert.throws(()=>featureReleaseWorkflow({kind:'release',target:'production',contains_jwt:true}));assert.throws(()=>featureReleaseWorkflow({kind:'release',target:'feature',contains_jwt:false}));
});
