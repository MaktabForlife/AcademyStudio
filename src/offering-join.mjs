import {accessGate,joinAudience} from './access.mjs';
import {fail,id} from './protocol.mjs';
// Shared by the cookie route and the signed native hub. References never grant
// access or override today's server clock, current class or paid/free rules.
export async function offeringJoin(store,actor,offeringId,scope,input){
 if(scope.completed_course)throw fail('This completed Course has no live sessions.',403,'JOIN_CLOSED');
 await accessGate(store,actor,offeringId,{live:true});
 if(!actor.global_admin&&!scope.live&&!scope.role)throw fail('Current live-session access is required.',403);
 const session=await store.first('SELECT session_id,starts_at,ends_at,zoom_url,cancelled FROM timetable WHERE session_id=? AND offering_id=?',[id(input.sessionId),offeringId]),now=Date.now();
 if(!session||session.cancelled||now<session.starts_at-300_000||now>=session.ends_at||!session.zoom_url)throw fail('Joining is available from five minutes before the lesson until it ends.',403,'JOIN_CLOSED');
 await joinAudience(store,actor,offeringId,session,scope);
 return {destination:session.zoom_url};
}
