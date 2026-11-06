import test from 'node:test';import assert from 'node:assert/strict';
import {generatePrivateCandidate as generate} from '../src/video-autolink/provider.mjs';
import {privateGeneratedCandidate} from '../src/video-autolink/candidate.mjs';
import {parseTimestampedTranscript} from '../src/video-autolink/transcript.mjs';
const raw='WEBVTT\n\n00:00.000 --> 00:02.000\nSynthetic evidence: read the assigned page.\n\n00:02.000 --> 00:04.000\nA source-grounded second point.';
const env={VIDEO_AUTOLINK_ENABLED:'1',OPENAI_API_KEY:'synthetic-provider-key-NOT-REAL',VIDEO_AI_MODEL:'synthetic-reviewed-model',VIDEO_AI_MAX_OUTPUT_TOKENS:'2000',VIDEO_AI_MAX_REQUEST_BYTES:'64000',VIDEO_AI_TIMEOUT_MS:'5000'};
const value=()=>({summary:'- A synthetic source-grounded point.',lessonReference:'PRIVATE unverified book candidate',application:'',taskAssigned:false,topics:[{time:'00:00',title:'Synthetic topic',sourceCueIndex:0}],topicNotes:[],referenceCandidates:[{time:'00:00',arabic:'PRIVATE Arabic candidate',meaning:'Unverified meaning',sourceCueIndex:null,evidence:''}],quotationCandidates:[{time:'00:00',text:'PRIVATE quotation candidate',speaker:'Synthetic speaker',sourceCueIndex:0,evidence:'read the assigned page'}],assignmentEvidence:[],reviewNotes:['PRIVATE review marker']});
function response(v=value(),extra={}){return Response.json({id:'resp_synthetic',status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(v)}]}],usage:{input_tokens:100,output_tokens:50,total_tokens:150},...extra},{headers:{'x-request-id':'req_synthetic'}});}
const base={env,transcript:raw,format:'VTT',durationSeconds:4,style:'ACADEMIC',clock:()=>1000};
const grant=async expected=>({requestHash:expected.requestHash,attemptId:'synthetic-attempt',expiresAt:10000});
test('disabled or unconfigured processor never reserves or calls the provider',async()=>{
 let reserved=0,calls=0;const options={...base,reserve:async()=>{reserved++;return grant({requestHash:'x'});},fetcher:async()=>{calls++;throw Error('must not fetch');}};
 assert.equal((await generate({...options,env:{}})).code,'PROCESSOR_DISABLED');
 for(const change of [{OPENAI_API_KEY:''},{VIDEO_AI_MODEL:''},{VIDEO_AI_MAX_OUTPUT_TOKENS:'2000x'},{VIDEO_AI_TIMEOUT_MS:'0'},{VIDEO_AI_MAX_REQUEST_BYTES:'0'}])assert.equal((await generate({...options,env:{...env,...change}})).code,'PROCESSOR_UNCONFIGURED');
 assert.equal(reserved,0);assert.equal(calls,0);
});
test('real adapter constructs one fixed-endpoint non-stored strict-schema request; generated evidence stays private and unverified',async()=>{
 let calls=0,reserved=0;
 const result=await generate({...base,reserve:async snapshot=>{reserved++;assert.equal(snapshot.model,env.VIDEO_AI_MODEL);assert.match(snapshot.requestHash,/^[a-f0-9]{64}$/);return grant(snapshot);},fetcher:async(url,options)=>{
  calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.equal(options.headers.get('Authorization'),'Bearer '+env.OPENAI_API_KEY);
  const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.model,env.VIDEO_AI_MODEL);assert.equal(body.max_output_tokens,2000);assert.equal(body.text.format.type,'json_schema');assert.equal(body.text.format.strict,true);assert.equal(body.text.format.schema.additionalProperties,false);assert.equal(body.tools,undefined);assert(!options.body.includes(env.OPENAI_API_KEY));assert(!options.signal.aborted);
  return response();
 }});
 assert.equal(calls,1);assert.equal(reserved,1);assert.equal(result.kind,'private-candidate');assert.deepEqual(result.receipt.usage,{input_tokens:100,output_tokens:50,total_tokens:150});
 const preview=result.candidate.learnerPreview;assert.equal(preview.schema,'LEARNER_COMPANION_V1');assert.equal(preview.summaryFormat,'bullets');assert.deepEqual(preview.quotations,[]);assert.deepEqual(preview.references,[]);assert.equal(preview.lessonReference,'');assert.equal(preview.transcript,undefined);
 assert.equal(result.candidate.privateEvidence.quotations[0].transcriptMatched,true);assert.equal(result.candidate.privateEvidence.quotations[0].audioVerified,false);assert.equal(result.candidate.privateEvidence.references[0].verified,false);assert(result.candidate.reviewRequired);
 assert(!JSON.stringify(result).includes('PRIVATE'));assert(!JSON.stringify(result).includes(env.OPENAI_API_KEY));assert.equal(Object.keys(result).includes('candidate'),false);
});
test('controlled input/header/budget failure happens before reservation, preserving its availability',async()=>{
 let reserved=0,calls=0;const options={...base,reserve:async s=>{reserved++;return grant(s);},fetcher:async()=>{calls++;return response();}};
 assert.equal((await generate({...options,transcript:'missing timestamps'})).code,'PROCESSING_SOURCE_INVALID');
 assert.equal((await generate({...options,env:{...env,OPENAI_API_KEY:'synthetic\ninvalid-header'}})).code,'PROCESSING_SOURCE_INVALID');
 assert.equal((await generate({...options,env:{...env,VIDEO_AI_MAX_REQUEST_BYTES:'1000'}})).code,'PROCESSING_INPUT_BUDGET_EXCEEDED');
 assert.equal(reserved,0);assert.equal(calls,0);
});
test('a matching unexpired owning reservation is required; concurrent fixture reservation losers do not call',async()=>{
 let calls=0;const run=reserve=>generate({...base,reserve,fetcher:async()=>{calls++;return response();}});
 assert.equal((await run(async()=>null)).code,'AUTHORISATION_NOT_CLAIMED');
 assert.equal((await run(async s=>({...await grant(s),requestHash:'wrong'}))).code,'AUTHORISATION_NOT_CLAIMED');
 assert.equal((await run(async s=>({...await grant(s),expiresAt:1000}))).code,'AUTHORISATION_EXPIRED');
 assert.equal((await run(async()=>{throw Error('PRIVATE database cause');})).code,'AUTHORISATION_NOT_CONFIRMED');assert.equal(calls,0);
 let claimed=false;const reserve=async s=>{if(claimed)return null;claimed=true;return grant(s);};const results=await Promise.all([run(reserve),run(reserve)]);assert.equal(calls,1);assert.equal(results.filter(r=>r.kind==='private-candidate').length,1);
});
test('network and HTTP errors never retry or echo private provider bodies/exception text',async()=>{
 for(const mode of ['network','server','rejected']){
  let calls=0,cancelled=0;const result=await generate({...base,reserve:grant,fetcher:async()=>{calls++;if(mode==='network')throw Error('PRIVATE transcript '+env.OPENAI_API_KEY);return new Response(new ReadableStream({cancel(){cancelled++;}}),{status:mode==='server'?503:429});}});
  assert.equal(calls,1);assert.equal(result.kind,'error');assert.equal(result.outcome,mode==='rejected'?'REJECTED':'UNKNOWN');assert(!JSON.stringify(result).includes('PRIVATE'));assert(!JSON.stringify(result).includes(env.OPENAI_API_KEY));if(mode!=='network')assert.equal(cancelled,1);
 }
});
test('incomplete/refusal/invalid native projection produce review-required outcomes, without automatic provider retry',async t=>{
 const cases=[
  ['incomplete',()=>response(value(),{status:'incomplete'})],
  ['refusal',()=>response(value(),{output:[{type:'message',role:'assistant',content:[{type:'refusal',refusal:'PRIVATE refusal details'}]}]})],
  ['unknown-key',()=>response({...value(),transcript:'PRIVATE full source'})],
  ['html',()=>response({...value(),summary:'<script>PRIVATE</script>'})],
  ['unanchored-topic',()=>response({...value(),topics:[{time:'00:03',title:'Wrong time',sourceCueIndex:0}]})],
  ['invented-homework',()=>response({...value(),application:'Unassigned homework'})],
  ['assignment-no-evidence',()=>response({...value(),taskAssigned:true,application:'Read a page'})]
 ];
 for(const [name,make]of cases)await t.test(name,async()=>{let calls=0;const result=await generate({...base,reserve:grant,fetcher:async()=>{calls++;return make();}});assert.equal(result.kind,'error');assert.equal(result.outcome,'REVIEW_REQUIRED');assert.equal(calls,1);assert(!JSON.stringify(result).includes('PRIVATE'));});
});
test('source-matched assignment evidence and MOU prose are private review candidates, never proof of audio or publication',()=>{
 const transcript=parseTimestampedTranscript(raw,{format:'VTT',durationSeconds:4}),model=value();model.taskAssigned=true;model.application='Read the assigned page.';model.assignmentEvidence=[{sourceCueIndex:0,evidence:'read the assigned page'}];model.topicNotes=[{time:'00:00',title:'Grounded reflection',chapter:'Source paragraph.',reflection:'A grounded reflection.',practice:'A grounded practice.',sourceCueIndex:0}];
 const result=privateGeneratedCandidate(model,{style:'MOU',transcript});assert.equal(result.learnerPreview.summaryFormat,'paragraph');assert.equal(result.privateEvidence.assignmentReviewRequired,true);assert.equal(result.learnerPreview.topicNotes.length,1);assert.deepEqual(result.learnerPreview.quotations,[]);assert.equal(result.published,undefined);assert.throws(()=>privateGeneratedCandidate(model,{style:'ACADEMIC',transcript}));
});
