import test from 'node:test';
import assert from 'node:assert/strict';
import {openAcademyFromCircles} from '../public/shared/circles-sign-in.mjs';
test('warm dashboard return reuses the checked original window without another account/navigation/dashboard request',async()=>{
 const listeners=new Set(),sent=[],child={closed:false,postMessage:(...v)=>sent.push(v)},requests=[];let restored=0,current=true;
 const window={open:()=>child,addEventListener:(k,v)=>listeners.add(v),removeEventListener:(k,v)=>listeners.delete(v),setTimeout:()=>1,setInterval:()=>2,clearTimeout(){},clearInterval(){}};
 const continuation=openAcademyFromCircles({window,academyOrigin:'https://academy.test',dashboard:{mode:'learn',tool:'library'},request:async(...v)=>(requests.push(v),{code:'one-use'}),onReturn:()=>current?(restored++,true):false});
 const emit=async e=>{for(const fn of [...listeners])await fn(e);};
 await emit({source:child,origin:'https://academy.test',data:{type:'ACADEMY_WEBSITE_CHALLENGE',state:'a'.repeat(43),challenge:'b'.repeat(43)}});
 assert.equal(requests.length,1);assert.equal(listeners.size,1);
 const returned={source:child,origin:'https://academy.test',data:{type:'ACADEMY_CIRCLES_RETURN',mode:'learn',requestId:'12345678-1234-1234-1234-123456789abc'}};
 await emit({...returned,origin:'https://evil.test'});await emit({...returned,source:{}});await emit({...returned,data:{...returned.data,mode:'admin'}});assert.equal(restored,0);
 current=false;await emit(returned);assert.equal(restored,0);assert.equal(sent.length,1);
 current=true;await emit(returned);assert.equal(restored,1);assert.equal(requests.length,1);assert.equal(sent[1][0].type,'CIRCLES_DASHBOARD_RETURNED');assert.equal(listeners.size,0);continuation.close();
});
