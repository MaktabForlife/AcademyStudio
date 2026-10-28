import {bodyJSON,fail} from './protocol.mjs';
export async function publishSchedule(env,store,offeringId){
 const offering=await store.first('SELECT active,revision FROM offerings WHERE offering_id=?',[offeringId]);
 const sessions=offering.active?await store.all('SELECT session_id,offering_id,title,starts_at,ends_at,cancelled FROM timetable WHERE offering_id=? ORDER BY starts_at LIMIT 200',[offeringId]):[];
 for(let attempt=0;attempt<5;attempt++){
  const object=await env.CONTENT.get('public/schedule.json'),current=object?await bodyJSON(object.body):{offerings:{}};
  if((current.offerings[offeringId]?.revision||0)>=offering.revision)return;
  current.offerings[offeringId]={revision:offering.revision,sessions};
  const encoded=JSON.stringify(current);if(new TextEncoder().encode(encoded).length>1_500_000)throw fail('The public schedule needs a smaller publication window.',503);
  const saved=await env.CONTENT.put('public/schedule.json',encoded,{onlyIf:object?{etagMatches:object.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});if(saved)return;
 }throw fail('Public timetable delivery is waiting for a retry.',503,'SCHEDULE_DELIVERY_PENDING');
}
