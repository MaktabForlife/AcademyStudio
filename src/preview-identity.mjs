// Temporary synthetic identities only. This module is not imported by worker.mjs.
import {Store} from './database.mjs';
import {exchange} from './integration.mjs';
import {bodyJSON,challenge,fail,json,originCheck,parseCookie,random,sha256,sign,verify} from './protocol.mjs';

export const PREVIEW_ACCOUNTS=Object.freeze([
 {id:'preview-admin',name:'Preview Administrator',globalAdmin:1},
 {id:'preview-course-admin',name:'Preview Course Administrator',globalAdmin:0},
 {id:'preview-learner',name:'Preview Learner',globalAdmin:0},
 {id:'preview-surah',name:'Preview Surah Grantee',globalAdmin:0},
 {id:'preview-outsider',name:'Preview Without Enrolment',globalAdmin:0}
]);
const known=id=>PREVIEW_ACCOUNTS.some(account=>account.id===id);
const purpose='academy-studio-isolated-preview-access-v1';
export function previewDeadline(env){
 if(env.ENVIRONMENT!=='isolated-preview'||env.ACADEMY_ORIGIN!=='https://academy.invalid'||env.PREVIEW_LOGIN_ENABLED!=='1'||typeof env.PREVIEW_INVITE_SECRET!=='string'||env.PREVIEW_INVITE_SECRET.length<32)throw fail('Private preview access is not configured.',503,'PREVIEW_DISCONNECTED');
 const deadline=Number(env.PREVIEW_ACCESS_EXPIRES_AT);
 if(!Number.isSafeInteger(deadline)||deadline>Date.now()+8*86400_000)throw fail('Private preview access is not configured.',503,'PREVIEW_DISCONNECTED');
 if(deadline<=Date.now())throw fail('This testing period has ended. Request a renewed private preview link.',401,'PREVIEW_ACCESS_EXPIRED');
 return deadline;
}
export async function previewAccessCode(secret,accountId,deadline){
 if(!known(accountId))throw Error('Choose a synthetic preview identity.');
 return accountId+'.'+await sign(secret,purpose,JSON.stringify({accountId,deadline}));
}
export async function previewLogin(request,env){
 const deadline=previewDeadline(env);originCheck(request,env);
 const input=await bodyJSON(request.body,4096),match=typeof input.accessCode==='string'&&input.accessCode.match(/^(preview-[a-z-]+)\.([a-f0-9]{64})$/);
 if(!match||!known(match[1])||!await verify(env.PREVIEW_INVITE_SECRET,purpose,JSON.stringify({accountId:match[1],deadline}),match[2]))throw fail('Use a valid private preview access link.',401,'PREVIEW_ACCESS_INVALID');
 const store=new Store(env),account=await store.first('SELECT account_id,epoch,active,admitted FROM accounts WHERE account_id=?',[match[1]]);
 if(!account?.active||!account.admitted)throw fail('This preview account is unavailable.',401,'SIGN_IN_REQUIRED');
 const code=random(),verifier=random(),state=random(),codeHash=await sha256(code),proof=await challenge(verifier),now=Date.now(),guard=crypto.randomUUID();
 // Refresh only synthetic identity freshness. Never restore roles, purchases,
 // grants, admission, active state or an old epoch during login or refresh.
 try{await store.batch([
  store.statement('INSERT INTO guards VALUES(?,EXISTS(SELECT 1 FROM accounts WHERE account_id=? AND epoch=? AND active=1 AND admitted=1))',[guard,account.account_id,account.epoch]),
  store.statement('UPDATE accounts SET verified_at=? WHERE account_id=?',[now,account.account_id]),
  store.statement('INSERT INTO handoffs VALUES(?,?,?,?,?,?,0,NULL)',[codeHash,account.account_id,account.epoch,proof,state,Math.min(now+60_000,deadline)]),
  store.statement('DELETE FROM guards WHERE guard_id=?',[guard])
 ]);}catch{throw fail('This preview account changed. Reopen your private test link.',401,'SIGN_IN_REQUIRED');}
 const result=await exchange({code,verifier,state},env,store);
 return json({signedIn:true,accountId:result.accountId},200,{'Set-Cookie':result.cookie});
}
export async function previewRefresh(request,env){
 previewDeadline(env);originCheck(request,env);
 const token=parseCookie(request);if(!token)throw fail('Open your private preview link to sign in.',401,'SIGN_IN_REQUIRED');
 const store=new Store(env),actor=await store.actor(await sha256(token),Date.now(),{allowExpiredStatus:true});
 if(!known(actor.account_id))throw fail('Use a synthetic preview account.',401,'SIGN_IN_REQUIRED');
 const now=Date.now(),result=await store.run('UPDATE accounts SET verified_at=? WHERE account_id=? AND epoch=? AND active=1 AND admitted=1 AND EXISTS(SELECT 1 FROM sessions WHERE token_hash=? AND account_id=? AND revoked=0 AND epoch=? AND expires_at>?)',[now,actor.account_id,actor.epoch,actor.token_hash,actor.account_id,actor.epoch,now]);
 if(!result.meta?.changes)throw fail('This preview session changed. Sign in again.',401,'SIGN_IN_REQUIRED');
 return json({verifiedAt:now});
}
