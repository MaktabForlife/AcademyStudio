import {fail,signedHeaders,bodyJSON,safeToken} from './protocol.mjs';
import {receive} from './integration.mjs';
export async function academyCommand(env,store,path,input,fetcher){
 const origin=new URL(env.ACADEMY_API_ORIGIN||env.ACADEMY_ORIGIN);if(origin.protocol!=='https:'||origin.origin!==(env.ACADEMY_API_ORIGIN||env.ACADEMY_ORIGIN))throw fail('Academy connection is unavailable.',503);
 for(let page=0;page<4;page++){
 const signed=await signedHeaders(env.WEBSITE_TO_ACADEMY_SECRET,path,{...input,issuedAt:Date.now()});
 const response=await fetcher(origin.origin+path,{method:'POST',headers:signed.headers,body:signed.payload,redirect:'manual',signal:AbortSignal.timeout(8000)});
 const result=await bodyJSON(response.body,262144);if(!response.ok)throw fail(result.error||'Academy could not complete this action.',response.status>=500?503:response.status,result.code||'ACADEMY_UNAVAILABLE');
 for(const item of result.deliveries||[])await receive(new Request(env.WEBSITE_ORIGIN+'/internal/academy/events',{method:'POST',headers:{'X-Maktab-Signature':item.signature},body:JSON.stringify(item.delivery)}),env,store);
 if(result.acknowledge?.length){const ack=await signedHeaders(env.WEBSITE_TO_ACADEMY_SECRET,'/internal/website/ack',{operationIds:result.acknowledge,issuedAt:Date.now()});try{const reply=await fetcher(origin.origin+'/internal/website/ack',{method:'POST',headers:ack.headers,body:ack.payload,redirect:'manual',signal:AbortSignal.timeout(5000)});await reply.body?.cancel();}catch{/* Delivery remains pending and exact retries are safe. */}}
 if(!result.continuation)return result;if(!safeToken(result.continuation))throw fail('Invalid Academy continuation.',503);path='/internal/website/continue-sign-in';input={sourceRef:result.continuation,statusOnly:Boolean(result.statusOnly)};
 }
 throw fail('Older account changes are still being synchronized. Retry sign-in shortly.',503,'ACCOUNT_DELIVERY_PENDING');
}
