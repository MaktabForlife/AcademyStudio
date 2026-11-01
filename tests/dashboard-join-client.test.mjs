import test from 'node:test';
import assert from 'node:assert/strict';
import {createDashboardJoin} from '../public/shared/dashboard-join.mjs';
const native=()=>({kind:'PROGRAM',activityId:'native-program',date:'2026-11-01',status:'SCHEDULED',startsAt:1_000_000,endsAt:2_000_000,nativeJoin:{joinKey:'checked-native-key',date:'2026-11-01'}});
function fixture(row=native()){
 let clock=700_000,resolve,reject;const events=[],calls=[],popup={opener:'parent',closed:false,location:{replace(value){events.push(['navigate',value]);}},close(){this.closed=true;events.push(['close']);}};
 const state={account:{accountId:'native-account',globalAdmin:false},generation:1,mode:'learn',pending:false,visible:true,data:{mode:'learn',timetable:[row]}};
 const controller=createDashboardJoin({context:()=>state,request:(path,options)=>{calls.push({path,...options});events.push(['request']);return new Promise((a,b)=>{resolve=a;reject=b;});},openWindow:()=>{events.push(['open']);return popup;},now:()=>clock,onMessage:value=>events.push(['message',value])});
 return {row,state,controller,calls,events,popup,resolve:value=>resolve(value),reject:value=>reject(value),time:value=>{clock=value;}};
}
test('native Join opens synchronously and resolves the checked native endpoint once without retaining a URL',async()=>{
 const f=fixture(),promise=f.controller.join(f.row);assert.equal(f.events[0][0],'open');assert.equal(f.popup.opener,null);assert.equal(f.calls.length,1);assert.equal(f.controller.join(f.row),promise);
 assert.deepEqual(f.calls[0],{path:'/api/circles/lesson-join',body:{mode:'learn',joinKey:'checked-native-key',date:'2026-11-01'}});f.resolve({joinUrl:'https://zoom.test/checked-native'});assert.equal(await promise,true);assert(f.events.some(row=>row[0]==='navigate'));assert.equal(f.controller.pending,false);assert.equal(Object.keys(f.controller).includes('joinUrl'),false);
});
test('exact Studio references use only the existing Studio paid/live resolver and never fall back after a native denial',async()=>{
 const row={...native(),nativeJoin:undefined,studioJoin:{offeringId:'mou-program',sessionId:'ws-exact-session'}},f=fixture(row),promise=f.controller.join(row);
 assert.deepEqual(f.calls[0],{path:'/api/offerings/mou-program/join',body:{sessionId:'ws-exact-session'}});f.resolve({destination:'https://zoom.test/checked-studio'});assert.equal(await promise,true);
 const n=fixture(),denied=n.controller.join(n.row);n.reject(Object.assign(Error('Studio owned'),{status:409,code:'STUDIO_JOIN_REQUIRED'}));assert.equal(await denied,false);assert.equal(n.calls.length,1);assert(n.popup.closed);
});
test('the presentation boundary is exactly five minutes and invalid, cancelled, ended or ambiguous rows issue no request',async()=>{
 for(const edit of [f=>f.time(699_999),f=>f.time(2_000_000),f=>{f.row.status='CANCELLED';},f=>{f.row.nativeJoin=null;},f=>{f.row.studioJoin={offeringId:'mou',sessionId:'ws-exact'};},f=>{f.row.nativeJoin.date='2026-10-31';},f=>{f.state.mode='teach';},f=>{f.state.pending=true;},f=>{f.state.visible=false;},f=>{f.state.data.timetable=[];}]){
  const f=fixture();edit(f);assert.equal(await f.controller.join(f.row),false);assert.equal(f.calls.length,0);assert.equal(f.events.length,0);
 }
 const f=fixture(),promise=f.controller.join(f.row);assert.equal(f.calls.length,1,'At exact -5min one resolver starts');f.resolve({joinUrl:'https://zoom.test/accepted'});assert.equal(await promise,true);
});
test('delayed results cannot navigate after account, selected mode, row, refresh, public view or clock changes',async()=>{
 for(const change of [f=>f.state.generation++,f=>f.state.account={accountId:'other'},f=>{f.state.mode='teach';},f=>{f.state.data={...f.state.data};},f=>{f.row.status='CANCELLED';},f=>{f.row.nativeJoin.joinKey='different';},f=>{f.state.pending=true;},f=>{f.state.visible=false;},f=>f.time(2_000_000),f=>f.controller.clear(),f=>f.popup.close()]){
  const f=fixture(),promise=f.controller.join(f.row);change(f);f.resolve({joinUrl:'https://zoom.test/old-result'});assert.equal(await promise,false);assert(f.popup.closed);assert(!f.events.some(row=>row[0]==='navigate'));
 }
});
test('blocked windows and malformed destinations fail closed with no unprotected navigation',async()=>{
 let requests=0;const row=native(),context={account:{accountId:'a'},generation:0,mode:'learn',data:{mode:'learn',timetable:[row]}};
 const blocked=createDashboardJoin({context:()=>context,request:()=>{requests++;},openWindow:()=>null,now:()=>700_000});assert.equal(await blocked.join(row),false);assert.equal(requests,0);
 for(const value of ['http://zoom.test','javascript:alert(1)','https://name:password@zoom.test','https://zoom.test:444/room',null]){
  const f=fixture(),promise=f.controller.join(f.row);f.resolve({joinUrl:value});assert.equal(await promise,false);assert(f.popup.closed);assert(!f.events.some(row=>row[0]==='navigate'));
 }
});
