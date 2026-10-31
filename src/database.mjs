import {accessGate,liveAccess,academyAuthority} from './access.mjs';
import {fail,sha256,boundedAge,id} from './protocol.mjs';
export class Store {
 constructor(env){this.env=env;this.db=env.DB.withSession('first-primary');this.scopes=new Map();this.metrics={queries:0,rowsRead:0,rowsWritten:0};}
 statement(sql,args=[]){return this.db.prepare(sql).bind(...args);}
 count(result){for(const r of Array.isArray(result)?result:[result]){this.metrics.queries++;this.metrics.rowsRead+=r.meta?.rows_read||0;this.metrics.rowsWritten+=r.meta?.rows_written||0;}return result;}
 async all(sql,args=[]){const result=this.count(await this.statement(sql,args).all());return result.results;}
 async first(sql,args=[]){return (await this.all(sql,args))[0]||null;}
 async run(sql,args=[]){return this.count(await this.statement(sql,args).run());}
 async batch(statements){return this.count(await this.db.batch(statements));}
 async actor(tokenHash,now=Date.now(),{allowExpiredStatus=false}={}){
  const row=await this.first(`SELECT a.*,s.token_hash,s.expires_at,s.source_ref FROM sessions s JOIN accounts a USING(account_id)
   WHERE s.token_hash=? AND s.revoked=0 AND s.expires_at>? AND s.epoch=a.epoch AND NOT EXISTS(SELECT 1 FROM source_session_revocations r WHERE r.source_ref=s.source_ref) AND a.active=1 AND a.admitted=1`,[tokenHash,now]);
  if(!row)throw fail('Sign in to Academy to continue.',401,'SIGN_IN_REQUIRED');
  if(!allowExpiredStatus&&row.verified_at<now-boundedAge(this.env))throw fail('Your Academy account status needs to be refreshed.',401,'STATUS_EXPIRED');return row;
 }
 async scope(actor,offeringId,{admin=false,teacher=false}={}){
  id(offeringId);const cacheKey=actor.account_id+':'+offeringId;let row=this.scopes.get(cacheKey);if(!row){row=await this.first(`SELECT o.*,p.enrolled,p.live,p.purchased,p.cohort,s.role,(SELECT access_model FROM course_access_models m WHERE m.offering_id=o.offering_id) access_model,s.can_create_account
   FROM offerings o LEFT JOIN participation p ON p.offering_id=o.offering_id AND p.account_id=?
   LEFT JOIN staff s ON s.offering_id=o.offering_id AND s.account_id=? WHERE o.offering_id=? AND o.active=1`,[actor.account_id,actor.account_id,offeringId]);if(row)this.scopes.set(cacheKey,row);}
  if(!row)throw fail('This offering is unavailable.',404);const source=await accessGate(this,actor,offeringId,{admin:admin||teacher||Boolean(row.role)});if(source)row={...row,live:liveAccess(source,row)};
  if(admin||teacher){if(!actor.global_admin&&row.role!=='ADMIN'&&!(teacher&&row.role==='TEACHER'))throw fail('Your account cannot manage this offering.',403);if(actor.verified_at<Date.now()-boundedAge(this.env,true))throw fail('Refresh your Academy account before administration.',401,'ADMIN_STATUS_EXPIRED');}
  return row;
 }
 async replay(actorId,operationId,hash){const row=await this.first('SELECT actor_id,payload_hash,result_json FROM operations WHERE operation_id=?',[id(operationId)]);if(!row)return null;if(row.actor_id!==actorId||row.payload_hash!==hash)throw fail('This retry belongs to another change.',409,'RETRY_CONFLICT');return {...JSON.parse(row.result_json),replayed:true};}
 requestHash(scope,input){return sha256(JSON.stringify({scope:scope||'GLOBAL',input}));}
 guard(actor,offeringId,{admin=true,teacher=false,global=false,studio=false,masterGlobal=false,allowInactive=false,expectedSQL='1',expectedArgs=[]}={}){
  const guardId=crypto.randomUUID(),now=Date.now();
  const statement=this.statement(`INSERT INTO guards(guard_id,accepted) SELECT ?,EXISTS(
   SELECT 1 FROM accounts a JOIN sessions s USING(account_id) WHERE a.account_id=? AND s.token_hash=?
   AND NOT EXISTS(SELECT 1 FROM source_session_revocations r WHERE r.source_ref=s.source_ref) AND a.active=1 AND a.admitted=1 AND a.epoch=s.epoch AND s.revoked=0 AND s.expires_at>? AND a.verified_at>=?
   AND (?=0 OR a.global_admin=1 OR (?=0 AND EXISTS(SELECT 1 FROM staff f WHERE f.account_id=a.account_id AND f.offering_id=? AND (f.role='ADMIN' OR (?=1 AND f.role='TEACHER')))))
   AND (?='' OR EXISTS(SELECT 1 FROM offerings o WHERE o.offering_id=? AND (o.active=1 OR ?=1)))
   AND (${academyAuthority(this.env)&&offeringId?masterGlobal?"EXISTS(SELECT 1 FROM source_access_scopes x WHERE x.offering_id=? AND (?=1 OR x.enabled=1))":"EXISTS(SELECT 1 FROM source_access_scopes x WHERE x.offering_id=? AND (x.enabled=1 AND (x.authority='ACADEMY' OR x.authority='WEBSITE' AND EXISTS(SELECT 1 FROM access_handovers h WHERE h.offering_id=x.offering_id AND h.phase='COMMITTED')) AND EXISTS(SELECT 1 FROM source_access_people p WHERE p.offering_id=x.offering_id AND p.account_id=a.account_id AND p.ready=1 AND p.generation=x.generation AND p.verified_at>=?)))":'1'}) AND (${studio&&academyAuthority(this.env)?"EXISTS(SELECT 1 FROM source_access_scopes own JOIN access_handovers h USING(offering_id) WHERE own.offering_id=? AND own.authority='WEBSITE' AND h.phase='COMMITTED')":'1'}) AND (${expectedSQL}))`,[guardId,actor.account_id,actor.token_hash,now,now-boundedAge(this.env,admin),Number(admin),Number(global),offeringId||'',Number(teacher),offeringId||'',offeringId||'',Number(allowInactive),...(academyAuthority(this.env)&&offeringId?[offeringId,masterGlobal?Number(allowInactive):now-boundedAge(this.env,admin)]:[]),...(studio&&academyAuthority(this.env)?[offeringId]:[]),...expectedArgs]);
  return {statement,cleanup:this.statement('DELETE FROM guards WHERE guard_id=?',[guardId])};
 }
 async mutate(actor,offeringId,input,statements,result,options={}){
  const hash=await this.requestHash(offeringId,input),old=await this.replay(actor.account_id,input.operationId,hash);if(old)return old;
  const g=this.guard(actor,offeringId,options);
  const details=Object.fromEntries(['accountId','websiteId','attachmentId','changes','reason','role','enrolled','live','purchased','enabled','revision'].filter(key=>input[key]!==undefined).map(key=>[key,input[key]]));
  try{await this.batch([g.statement,...statements,this.statement('INSERT INTO operations VALUES(?,?,?,?,?)',[input.operationId,actor.account_id,hash,JSON.stringify(result),Date.now()]),this.statement('INSERT INTO audit VALUES(?,?,?,?,?,?)',[crypto.randomUUID(),actor.account_id,input.action||'change',offeringId||'GLOBAL',Date.now(),JSON.stringify(details)]),g.cleanup]);}
  catch(error){const replay=await this.replay(actor.account_id,input.operationId,hash);if(replay)return replay;throw fail('Your permissions or this record changed. Reopen and retry.',409,'CHANGE_CONFLICT');}return result;
 }
}
