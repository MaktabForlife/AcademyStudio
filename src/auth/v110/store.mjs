// Independent D1 prototype; no production database binding or route is changed.
import {base64url} from 'jose';
import {AuthContractError,IDLE_SECONDS} from './claims.mjs';
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const guard=code=>{throw new AuthContractError(code);};
export function randomRefresh(){return base64url.encode(crypto.getRandomValues(new Uint8Array(32)));}
export async function fingerprint(app,raw){
 if(!['academy','studio','hifz'].includes(app)||typeof raw!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(raw)||base64url.encode(base64url.decode(raw))!==raw)guard('INVALID_REFRESH');
 return base64url.encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('uaa-refresh-v1\0'+app+'\0'+raw))));
}
const current='f.revoked=0 AND a.active=1 AND a.credential_epoch=f.credential_epoch AND b.generation=f.browser_generation AND f.original_expires_at_s>? AND NOT EXISTS(SELECT 1 FROM jwt_v110_parent_tombstones t WHERE t.parent_session_id=f.parent_session_id)';
const join='FROM jwt_v110_families f JOIN jwt_v110_accounts a USING(account_id) JOIN jwt_v110_browser_heads b USING(browser_id)';
export function createPrototypeStore(binding,{app}){
 const db=binding.withSession('first-primary');
 const metrics={statements:0,rowsRead:0,rowsWritten:0};
 const count=rs=>{for(const r of Array.isArray(rs)?rs:[rs]){metrics.statements++;metrics.rowsRead+=r.meta?.rows_read||0;metrics.rowsWritten+=r.meta?.rows_written||0;}return rs;};
 const all=async(sql,args)=>count(await db.prepare(sql).bind(...args).all()).results;
 const time=now=>{if(!integer(now))guard('INVALID_TIME');};
 const check=row=>{if(!row)guard('SESSION_ENDED');};
 const idle=(row,now)=>{if(now-row.last_fg_refresh_s>=IDLE_SECONDS)guard('PIN_REQUIRED');};
 return {
  metrics,
  async authorize(claims,now){
   time(now);if(!integer(claims.exp)||claims.exp<=now||!integer(claims.s_exp)||!integer(claims.s_iat)||claims.s_exp-claims.s_iat>604800||claims.exp>claims.s_exp)guard('ACCESS_EXPIRED');
   const sql='SELECT f.*,a.permission_version current_permission_version '+join+' WHERE f.family_id=? AND f.account_id=? AND f.parent_session_id=? AND f.browser_id=? AND f.browser_generation=? AND f.credential_epoch=? AND f.unlock_generation=? AND f.original_signed_in_at_s=? AND f.original_expires_at_s=? AND '+current;
   const row=(await all(sql,[claims.sid,claims.sub,claims.psid,claims.bsid,claims.bv,claims.ce,claims.ue,claims.s_iat,claims.s_exp,now]))[0];
   check(row);idle(row,now);if(claims.pv!==row.current_permission_version)guard('TOKEN_UPDATE_REQUIRED');return row;
  },
  async refresh(raw,{now,foreground=false}){
   time(now);if(typeof foreground!=='boolean')guard('INVALID_REFRESH_MODE');
   const oldFp=await fingerprint(app,raw);
   const row=(await all('SELECT f.*,a.permission_version current_permission_version '+join+' WHERE (f.refresh_fp=? OR f.previous_fp=?) AND '+current,[oldFp,oldFp,now]))[0];
   check(row);idle(row,now);
   if(row.refresh_fp!==oldFp)return {kind:now-row.rotated_at_s<=30?'in_progress':'readmit_required'};
   const next=randomRefresh(),nextFp=await fingerprint(app,next),op=crypto.randomUUID();
   const sql='UPDATE jwt_v110_families AS f SET previous_fp=refresh_fp,refresh_fp=?,refresh_generation=refresh_generation+1,permission_version=(SELECT permission_version FROM jwt_v110_accounts WHERE account_id=f.account_id),last_fg_refresh_s=CASE WHEN ?=1 THEN ? ELSE last_fg_refresh_s END,rotated_at_s=?,rotation_operation_id=? WHERE family_id=? AND refresh_fp=? AND refresh_generation=? AND unlock_generation=? AND f.account_id=? AND f.parent_session_id=? AND f.browser_id=? AND f.browser_generation=? AND f.credential_epoch=? AND f.original_signed_in_at_s=? AND f.original_expires_at_s=? AND revoked=0 AND original_expires_at_s>? AND ?-last_fg_refresh_s<? AND EXISTS(SELECT 1 FROM jwt_v110_accounts a WHERE a.account_id=f.account_id AND a.active=1 AND a.credential_epoch=f.credential_epoch) AND EXISTS(SELECT 1 FROM jwt_v110_browser_heads b WHERE b.browser_id=f.browser_id AND b.generation=f.browser_generation) AND NOT EXISTS(SELECT 1 FROM jwt_v110_parent_tombstones t WHERE t.parent_session_id=f.parent_session_id) RETURNING family_id,permission_version,original_signed_in_at_s,original_expires_at_s,refresh_generation';
   const statement=db.prepare(sql).bind(nextFp,Number(foreground),now,now,op,row.family_id,oldFp,row.refresh_generation,row.unlock_generation,row.account_id,row.parent_session_id,row.browser_id,row.browser_generation,row.credential_epoch,row.original_signed_in_at_s,row.original_expires_at_s,now,now,IDLE_SECONDS);
   const audit=db.prepare('INSERT INTO jwt_v110_security_audit(operation_id,family_id,event_type,occurred_at_s) SELECT ?,family_id,?,? FROM jwt_v110_families WHERE family_id=? AND refresh_fp=? AND refresh_generation=? AND rotation_operation_id=?').bind(op,'refresh',now,row.family_id,nextFp,row.refresh_generation+1,op);
   const result=count(await db.batch([statement,audit]));
   if(result[0].results.length!==1)return {kind:'in_progress'};
   const committed=result[0].results[0];
   return {kind:'rotated',rawSuccessor:next,familyId:committed.family_id,originalSignedAt:committed.original_signed_in_at_s,originalExpiry:committed.original_expires_at_s,generation:committed.refresh_generation,permissionVersion:committed.permission_version};
  }
 };
}
