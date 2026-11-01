import {bodyJSON,fail,sha256} from './protocol.mjs';
import {recordingAttachmentPreflight} from './recording-companions.mjs';
import {reviewMouCatalogue} from '../public/shared/mou-prepared-review.mjs';
import {academyAuthority} from './access.mjs';
export const preparedMouKey=offeringId=>'admin/prepared-recordings/'+encodeURIComponent(offeringId)+'/mou-v1.json';
export async function preparedRecordings(env,store,actor,offeringId){
 const scope=await store.scope(actor,offeringId,{admin:true});
 if(scope.programme_key!=='mothers'||academyAuthority(env)&&!scope.studioAuthority)throw fail('Prepared MOU review requires this programme’s current Studio Admin authority.',403);
 // Private R2 only: no prepared lesson text or source package is a public asset.
 const object=await env.CONTENT.get(preparedMouKey(offeringId));
 if(!object)throw fail('The prepared lessons have not been staged for Admin review yet.',404,'PREPARED_REVIEW_NOT_STAGED');
 if(object.size>500000)throw fail('The prepared review exceeds its bounded size.',413);
 const plan=await bodyJSON(object.body,500000);
 if(plan.preflight?.offeringId!==offeringId)throw fail('This review belongs to another programme.',409);
 let items;try{items=await reviewMouCatalogue(plan);}catch{throw fail('The prepared review needs its verified source package.',409);}
 const facts=await recordingAttachmentPreflight(store,offeringId,items.map(i=>i.videoId));
 facts.websites=await store.all('SELECT w.website_id,w.offering_id,w.draft_key,w.published_key,w.revision,w.enabled,p.enabled subject_enabled FROM websites w LEFT JOIN programme_subjects p ON p.offering_id=w.offering_id AND p.website_id=w.website_id WHERE w.offering_id=? AND w.website_id IN(SELECT value FROM json_each(?))',[offeringId,JSON.stringify(items.map(i=>i.websiteId))]);
 return {plan,facts,revision:await sha256(JSON.stringify(plan))};
}
