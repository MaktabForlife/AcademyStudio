import assert from 'node:assert/strict';import test from 'node:test';
import {fixture} from './fixture.mjs';import {random,challenge,sha256} from '../src/protocol.mjs';
import {signInFromCircles} from '../public/shared/circles-sign-in.mjs';
test('a successful browser account switch revokes only the replaced website session',async()=>{
 const f=await fixture();try{
  const {cookie:old}=await f.login('learner'),{cookie:otherDevice}=await f.login('learner');
  const code=random(),verifier=random(),state=random();await f.deliver({type:'handoff',codeHash:await sha256(code),accountId:'former',epoch:1,challenge:await challenge(verifier),state,expiresAt:Date.now()+60_000});
  const bad=await f.request('/auth/exchange',{cookie:old,method:'POST',body:{code,verifier:random(),state}});assert.equal(bad.status,401);assert.equal((await f.request('/api/me',{cookie:old})).status,200,'An unsuccessful switch must preserve the current session');
  const switched=await f.request('/auth/exchange',{cookie:old,method:'POST',body:{code,verifier,state}});assert.equal(switched.status,200);const next=switched.response.headers.get('set-cookie').split(';')[0];assert.equal((await f.request('/api/me',{cookie:next})).body.accountId,'former');assert.equal((await f.request('/api/me',{cookie:old})).status,401);assert.equal((await f.request('/api/me',{cookie:otherDevice})).status,200);
 }finally{await f.close();}
});
test('an exchange that finishes after the dialog closes still fences the old account before returning',async()=>{
 let open=true,cleared=0;const calls=[];
 await assert.rejects(signInFromCircles(async path=>{calls.push(path);if(path==='/auth/login')return {code:'synthetic'};if(path==='/auth/exchange'){open=false;return {};};throw Error('No private account read should follow a cancelled dialog');},{uniqueid:'USER',pin:'1234'},{current:()=>open,onExchange:()=>cleared++}),{name:'AbortError'});
 assert.equal(cleared,1);assert.deepEqual(calls,['/auth/login','/auth/exchange']);
});
