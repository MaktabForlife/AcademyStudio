import {checkedProgrammes} from './navigation.mjs';
import {accessStatements,fenceAccess} from './access.mjs';
import {bodyJSON,bytes,verify,envelopePurpose,fail,id,text,integer,flag,sha256,safeToken,httpsURL} from './protocol.mjs';
export async function signedInput(request,env){
 const payload=new TextDecoder().decode(await bytes(request.body,262144));
 if(!await verify(env.ACADEMY_TO_WEBSITE_SECRET,envelopePurpose(request.method,new URL(request.url).pathname),payload,request.headers.get('X-Maktab-Signature')))throw fail('Invalid Academy delivery.',401);
 let data;try{data=JSON.parse(payload);}catch{throw fail('Invalid Academy delivery.');}
 if(!data||Math.abs(Date.now()-integer(data.issuedAt))>300_000)throw fail('This delivery signature has expired.',401);return data;
}
const accountStatements=(store,a,{insertOnly=false}={})=>{
 const checked=integer(a.verifiedAt);if(checked>Date.now()+30_000)throw fail('Account confirmation has a future timestamp.',409);
 return [store.statement(`INSERT INTO accounts VALUES(?,?,?,?,?,?,?) ON CONFLICT(account_id) ${insertOnly?'DO NOTHING':`DO UPDATE SET display_name=excluded.display_name,
  active=excluded.active,admitted=excluded.admitted,epoch=excluded.epoch,verified_at=excluded.verified_at,global_admin=excluded.global_admin
  WHERE excluded.epoch>=accounts.epoch`}`,[id(a.accountId),text(a.displayName),flag(a.active),flag(a.admitted),integer(a.epoch),checked,flag(a.globalAdmin||false)])];
};
export async function receive(request,env,store){
 const data=await signedInput(request,env),event=data.event;id(data.operationId);id(data.stream);integer(data.version,1);if(!event)throw fail('Missing delivery.');
 if(['access','access-scope'].includes(event.type)){const offer=id(event.offeringId||event.offering?.id),account=event.type==='access'?id(event.account?.accountId).toLowerCase():'';if(data.stream!=='access:'+await sha256(JSON.stringify([offer,account])))throw fail('Invalid authoritative access stream.');}
 const hash=await sha256(JSON.stringify({stream:data.stream,version:data.version,event}));
 const receipt=await store.replay('ACADEMY',data.operationId,hash);if(receipt){if(data.superseded===true&&event.type.startsWith('access'))await fenceAccess(store,event,data.version);return receipt;}
 const old=await store.first('SELECT version,payload_hash FROM stream_heads WHERE stream=?',[data.stream]);
 if(data.version===(old?.version||0)&&hash===old?.payload_hash)return {accepted:true,version:data.version,replayed:true};
 if(data.version!==(old?.version||0)+1)throw fail('Deliver the missing version first.',409,'DELIVERY_GAP');
 const statements=[];let extraSQL='1',extraArgs=[];
 if(data.superseded===true&&['access','access-scope'].includes(event.type)){await fenceAccess(store,event,data.version);}
 else if(['access','access-scope'].includes(event.type)){statements.push(...await accessStatements(store,event,data.version,a=>accountStatements(store,a,{insertOnly:true})));const authority=await store.first('SELECT authority FROM source_access_scopes WHERE offering_id=?',[event.offeringId||event.offering.id]);extraSQL="COALESCE((SELECT authority FROM source_access_scopes WHERE offering_id=?),'ACADEMY')=?";extraArgs=[event.offeringId||event.offering.id,authority?.authority||'ACADEMY'];}
 else if(event.type==='account'){
  if(data.stream!=='account:'+event.account.accountId)throw fail('Invalid account stream.');statements.push(...accountStatements(store,event.account));
  const a=event.account;statements.push(store.statement('DELETE FROM source_access_master_fences WHERE account_id=? AND EXISTS(SELECT 1 FROM accounts a WHERE a.account_id=source_access_master_fences.account_id AND (a.epoch>source_access_master_fences.epoch OR a.epoch=source_access_master_fences.epoch AND a.active=source_access_master_fences.active AND a.admitted=source_access_master_fences.admitted AND a.global_admin=source_access_master_fences.global_admin))',[id(a.accountId)]),store.statement('DELETE FROM circles_navigation WHERE account_id=? AND epoch<=?',[id(a.accountId),integer(a.epoch)]));
  if(event.navigation){const programmes=checkedProgrammes(event.navigation);statements.push(store.statement('INSERT INTO circles_navigation SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM accounts WHERE account_id=? AND epoch=?)',[a.accountId,a.epoch,a.verifiedAt,JSON.stringify(programmes),a.accountId,a.epoch]));}
 }else if(event.type==='navigation-invalidated'){
  if(data.stream!=='account:'+event.accountId)throw fail('Invalid navigation stream.');statements.push(store.statement('DELETE FROM circles_navigation WHERE account_id=?',[id(event.accountId)]));
 }else if(event.type==='timetable'){
  const offer=event.offering,offeringId=id(offer.id);if(data.stream!=='timetable:'+offeringId||!['COURSE','TAFSEER','ACADEMY'].includes(offer.kind)||!Array.isArray(event.sessions)||event.sessions.length>200)throw fail('Invalid timetable publication.');
  if(event.mode!==undefined&&!['snapshot','delta'].includes(event.mode))throw fail('Choose a timetable snapshot or delta.');
  const cancelled=(event.cancelledIds||[]).map(value=>id(value));if(cancelled.length>200)throw fail('Keep each cancellation batch bounded.');const ids=[...event.sessions.map(s=>id(s.id)),...cancelled];
  const existing=await store.all('SELECT session_id,offering_id FROM timetable WHERE session_id IN(SELECT value FROM json_each(?))',[JSON.stringify(ids)]);if(existing.some(row=>row.offering_id!==offeringId))throw fail('A session belongs to another offering.',409);
  extraSQL="NOT EXISTS(SELECT 1 FROM timetable WHERE session_id IN(SELECT value FROM json_each(?)) AND offering_id<>?) AND NOT EXISTS(SELECT 1 FROM offerings WHERE offering_id=? AND kind<>?)";extraArgs=[JSON.stringify(ids),offeringId,offeringId,offer.kind];
  statements.push(store.statement(`INSERT INTO offerings VALUES(?,?,?,?,?) ON CONFLICT(offering_id) DO UPDATE SET title=excluded.title,active=excluded.active,revision=excluded.revision WHERE offerings.kind=excluded.kind`,[offeringId,offer.kind,text(offer.title),Number(offer.active||((await store.first('SELECT enabled FROM source_access_scopes WHERE offering_id=?',[offeringId]))?.enabled===1&&['COURSE','TAFSEER'].includes(offer.kind))),data.version]));
  // Stable session identities preserve local attachment links through corrections and cancellation.
  if(event.mode!=='delta')statements.push(store.statement('UPDATE timetable SET cancelled=1,revision=? WHERE offering_id=? AND cancelled=0 AND session_id NOT IN(SELECT value FROM json_each(?))',[data.version,offeringId,JSON.stringify(event.sessions.map(s=>s.id))]));
  if(cancelled.length)statements.push(store.statement('UPDATE timetable SET cancelled=1,revision=? WHERE offering_id=? AND session_id IN(SELECT value FROM json_each(?))',[data.version,offeringId,JSON.stringify(cancelled)]));
  const seen=new Set(cancelled);for(const session of event.sessions){if(session.classIds!==undefined&&(!Array.isArray(session.classIds)||session.classIds.length>100)||session.teacherIds!==undefined&&(!Array.isArray(session.teacherIds)||session.teacherIds.length>100))throw fail('Invalid session audience.');const sessionId=id(session.id);if(seen.has(sessionId))throw fail('Repeated session identity.');seen.add(sessionId);
   const starts=integer(session.startsAt),ends=integer(session.endsAt,starts+1),zoom=session.zoomUrl?httpsURL(session.zoomUrl,{zoom:true}):null;
   statements.push(store.statement(`INSERT INTO timetable VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET title=excluded.title,starts_at=excluded.starts_at,ends_at=excluded.ends_at,zoom_url=excluded.zoom_url,cancelled=excluded.cancelled,revision=excluded.revision`,[sessionId,offeringId,text(session.title),starts,ends,zoom,flag(session.cancelled||false),data.version]));statements.push(store.statement('INSERT INTO source_session_audiences VALUES(?,?,?) ON CONFLICT(session_id) DO UPDATE SET class_ids_json=excluded.class_ids_json,teacher_ids_json=excluded.teacher_ids_json',[sessionId,JSON.stringify((session.classIds||[]).map(id)),JSON.stringify((session.teacherIds||[]).map(id))]));
  }
 }else if(event.type==='handoff'){
  if(data.stream!=='handoff:'+event.codeHash||!/^[a-f0-9]{64}$/.test(event.codeHash||'')||!safeToken(event.challenge)||!safeToken(event.state))throw fail('Invalid sign-in handoff.');
  const expires=integer(event.expiresAt,Date.now()+1,Date.now()+65_000),a=await store.first('SELECT epoch,active,admitted FROM accounts WHERE account_id=?',[id(event.accountId)]);
  if(!a?.active||!a.admitted||a.epoch!==event.epoch)throw fail('Refresh the Academy identity before sign-in.',403);
  statements.push(store.statement('INSERT INTO handoffs VALUES(?,?,?,?,?,?,0,?)',[event.codeHash,event.accountId,integer(event.epoch),event.challenge,event.state,expires,event.sourceRef?id(event.sourceRef):null]));
 }else if(event.type==='identity-linked'){
  if(data.stream!=='identity:'+event.operationId)throw fail('Invalid provisioning stream.');const pending=await store.first('SELECT * FROM provisioning WHERE operation_id=?',[id(event.operationId)]);if(!pending)throw fail('Unknown enrolment operation.',404);
  statements.push(...accountStatements(store,event.account,{insertOnly:true}));
  const command=JSON.parse(pending.command_json);if(command.accountId&&command.accountId!==event.account.accountId)throw fail('The linked identity does not match the requested account.',409);
  const loginPath=event.loginPath||null;if(loginPath&&!/^\/account\/[A-Za-z0-9_-]{1,160}$/.test(loginPath))throw fail('Invalid Academy account link.');
  statements.push(store.statement("UPDATE provisioning SET account_id=?,login_path=?,state='IDENTITY_LINKED',last_error=NULL WHERE operation_id=? AND state='PENDING_IDENTITY'",[event.account.accountId,loginPath,pending.operation_id]));
 }else if(event.type==='session-revoked'){
  if(data.stream!=='session:'+event.sourceRef)throw fail('Invalid session stream.');statements.push(store.statement('INSERT INTO source_session_revocations VALUES(?,?) ON CONFLICT(source_ref) DO NOTHING',[id(event.sourceRef),Date.now()]),store.statement('UPDATE sessions SET revoked=1 WHERE source_ref=?',[id(event.sourceRef)]));
 }else throw fail('Unknown Academy delivery type.');
 const guardId=crypto.randomUUID(),result={accepted:true,version:data.version,...(event.type==='timetable'?{changedOffering:event.offering.id}:{})};
 const guard=store.statement(`INSERT INTO guards VALUES(?,(COALESCE((SELECT version FROM stream_heads WHERE stream=?),0)=?) AND (${extraSQL}))`,[guardId,data.stream,data.version-1,...extraArgs]);
 try{await store.batch([guard,...statements,store.statement('INSERT INTO stream_heads VALUES(?,?,?) ON CONFLICT(stream) DO UPDATE SET version=excluded.version,payload_hash=excluded.payload_hash',[data.stream,data.version,hash]),store.statement('INSERT INTO operations VALUES(?,?,?,?,?)',[data.operationId,'ACADEMY',hash,JSON.stringify(result),Date.now()]),store.statement('DELETE FROM guards WHERE guard_id=?',[guardId])]);}
 catch(error){const saved=await store.replay('ACADEMY',data.operationId,hash);if(saved)return saved;throw fail('Delivery conflicts with a newer state.',409,'DELIVERY_CONFLICT');}return result;
}
export async function exchange(input,env,store){
 if(!safeToken(input.code)||!safeToken(input.verifier)||!safeToken(input.state))throw fail('Reopen sign-in from the homepage.',401);
 const codeHash=await sha256(input.code),handoff=await store.first('SELECT * FROM handoffs WHERE code_hash=?',[codeHash]);
 const {challenge,random,cookie,boundedAge}=await import('./protocol.mjs');
 if(!handoff||handoff.used||handoff.state!==input.state||handoff.challenge!==await challenge(input.verifier)||handoff.expires_at<=Date.now())throw fail('This sign-in link has expired or was used.',401);
 const token=random(),tokenHash=await sha256(token),now=Date.now(),guardId=crypto.randomUUID();
 try{await store.batch([
  store.statement(`INSERT INTO guards VALUES(?,EXISTS(SELECT 1 FROM handoffs h JOIN accounts a USING(account_id) WHERE h.code_hash=? AND h.used=0 AND h.expires_at>? AND h.epoch=a.epoch AND a.active=1 AND a.admitted=1 AND a.verified_at>=?))`,[guardId,codeHash,now,now-boundedAge(env)]),
  store.statement('UPDATE handoffs SET used=1 WHERE code_hash=?',[codeHash]),
  store.statement('INSERT INTO sessions VALUES(?,?,?,?,0,?)',[tokenHash,handoff.account_id,handoff.epoch,now+7*86400_000,handoff.source_ref]),store.statement('DELETE FROM guards WHERE guard_id=?',[guardId])
 ]);}catch{throw fail('This sign-in link has expired or was used.',401);}
 return {cookie:cookie(token,7*86400),accountId:handoff.account_id};
}
