import {fail,sha256} from './protocol.mjs';
// Ordered signed deliveries own the transaction. These derived heads describe
// native permissions, excluding proof refresh clocks and Studio Course policy.
export async function dashboardContextStatements(store,event){
 const scope=event.type==='access-scope',offer=event.offering?.id||event.offeringId;
 const facts=scope?{offering:event.offering,generation:event.generation,enabled:event.enabled,liveEnabled:event.liveEnabled,timezone:event.timezone,classes:event.classes.slice().sort(),programmeKey:event.programmeKey||null,completedCourse:event.completedCourse||null,...(event.offering.kind==='COURSE'?{}:{accessModel:event.accessModel||null})}:{generation:event.generation,blocked:Boolean(event.blocked),account:{accountId:event.account.accountId,epoch:event.account.epoch,active:event.account.active,admitted:event.account.admitted,globalAdmin:event.account.globalAdmin},role:event.role||null,participation:event.participation};
 const key=scope?'dashboard-scope:'+offer:'dashboard-person:'+JSON.stringify([offer,event.account.accountId]),hash=await sha256(JSON.stringify(facts));
 const statements=[store.statement('INSERT INTO stream_heads VALUES(?,1,?) ON CONFLICT(stream) DO UPDATE SET version=stream_heads.version+1,payload_hash=excluded.payload_hash WHERE stream_heads.payload_hash<>excluded.payload_hash',[key,hash])];
 if(scope&&event.offering.kind==='COURSE')statements.push(store.statement('INSERT INTO stream_heads VALUES(?,1,?) ON CONFLICT(stream) DO UPDATE SET version=stream_heads.version+1,payload_hash=excluded.payload_hash WHERE stream_heads.payload_hash<>excluded.payload_hash',['dashboard-policy:'+offer,await sha256(JSON.stringify(event.accessModel||null))]));
 return statements;
}
export async function dashboardHeads(store,actor){
 const mine=actor.global_admin?'':`AND (s.offering_id IN(SELECT offering_id FROM source_access_people WHERE account_id=? UNION SELECT offering_id FROM staff WHERE account_id=? UNION SELECT offering_id FROM participation WHERE account_id=?) OR o.kind='COURSE')`;
 const rows=await store.all(`SELECT s.offering_id,s.authority,s.generation,s.live_enabled,s.timezone,s.classes_json,p.generation person_generation,p.ready,COALESCE(sh.version,s.version) scope_version,COALESCE(ph.version,p.version) person_version,COALESCE(h.version,0) timetable_version,CASE WHEN s.authority='ACADEMY' AND o.kind='COURSE' THEN COALESCE(mh.version,s.version) ELSE 0 END source_policy_version,COALESCE(r.revision,0) access_revision
 FROM source_access_scopes s JOIN offerings o USING(offering_id) LEFT JOIN source_access_people p ON p.offering_id=s.offering_id AND p.account_id=? LEFT JOIN stream_heads h ON h.stream='timetable:'||s.offering_id LEFT JOIN access_revisions r ON r.offering_id=s.offering_id LEFT JOIN stream_heads sh ON sh.stream='dashboard-scope:'||s.offering_id LEFT JOIN stream_heads mh ON mh.stream='dashboard-policy:'||s.offering_id LEFT JOIN stream_heads ph ON ph.stream='dashboard-person:'||json_array(s.offering_id,?)
 WHERE s.enabled=1 ${mine} ORDER BY s.offering_id LIMIT 33`,[actor.account_id,actor.account_id,...(actor.global_admin?[]:Array(3).fill(actor.account_id))]);
 if(rows.length>32)throw fail('Choose a narrower dashboard scope.',409,'DASHBOARD_SCOPE_LIMIT');
 return {native:JSON.stringify(rows.map(({access_revision,...native})=>native)),access:JSON.stringify(rows.map(r=>[r.offering_id,r.access_revision]))};
}
