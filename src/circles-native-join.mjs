import {fail,date,httpsURL,boundedAge} from './protocol.mjs';
import {academyCommand} from './academy-client.mjs';

export async function circlesNativeJoin(env,store,actor,input,fetcher){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['mode','joinKey','date'].includes(k))||!['learn','teach','admin'].includes(input.mode)||typeof input.joinKey!=='string'||!input.joinKey||input.joinKey.length>1200)throw fail('Refresh the timetable and select a lesson.');
 const day=date(input.date);
 if(!actor.source_ref)throw fail('Sign in through Academy to join this lesson.',401,'SIGN_IN_REQUIRED');
 const proof=await store.first('SELECT epoch,verified_at,programmes_json FROM circles_navigation WHERE account_id=?',[actor.account_id]);
 if(!proof||proof.epoch!==actor.epoch||proof.verified_at<Date.now()-boundedAge(env))throw fail('Confirm your current programme access.',409,'ACCESS_REFRESH_REQUIRED');
 // One explicit click, one fresh native resolver. Never use a dashboard
 // snapshot, projected ws-* identity or a cached URL as Join authority.
 const result=await academyCommand(env,store,'/internal/website/lesson-join',{sourceRef:actor.source_ref,mode:input.mode,joinKey:input.joinKey,date:day},fetcher);
 const current=await store.actor(actor.token_hash),latest=await store.first('SELECT epoch,verified_at,programmes_json FROM circles_navigation WHERE account_id=?',[actor.account_id]);
 if(current.account_id!==actor.account_id||current.epoch!==actor.epoch||current.source_ref!==actor.source_ref||current.global_admin!==actor.global_admin||!latest||latest.epoch!==proof.epoch||latest.verified_at!==proof.verified_at||latest.programmes_json!==proof.programmes_json)throw fail('Your account or permissions changed. Reopen the timetable.',409,'ACCESS_REFRESH_REQUIRED');
 let joinUrl;try{if(result.success!==true||typeof result.joinUrl!=='string')throw Error();joinUrl=httpsURL(result.joinUrl);}catch{throw fail('Academy could not confirm the lesson link.',503,'INVALID_NATIVE_JOIN');}
 return {joinUrl};
}
