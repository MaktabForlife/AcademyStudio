import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';import{allowedReturn,defaultReturnPaths}from'../../Academy/security/v2/return-routes.mjs';
import{studioDashboardEntry,studioSignInReturnPath}from'../public/shared/circles-routes.mjs';
import{navigateStudioAdmission}from'../public/v111-session.mjs';
const handler=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8').match(/^function openSignIn\(\)\{.*\}$/m)?.[0];assert(handler);
test('actual native collections Sign in uses clean reviewed entry despite display-only query/fragment and never opens child PIN',async()=>{let cleared=0,chosen=null;const session={},sandbox={pins:{clear(){cleared++;}},config:{authVersion:2},studioSession:()=>session,document:{querySelector:()=>({content:'2'})},location:{pathname:'/studio/',search:'?view=collections&returnTo=https%3A%2F%2Fevil.invalid',hash:'#private-lesson'},studioSignInReturnPath,Promise,configureStudioAuth:async()=>{},navigateStudioAdmission:async(s,value)=>{assert.equal(s,session);chosen=value.returnTo;},api:()=>{throw Error('Native login must not use V1 endpoint');},status:message=>{throw Error(message);},$:()=>({showModal(){throw Error('Native child PIN form must not open');}})};vm.runInNewContext(handler+';openSignIn();',sandbox);await new Promise(resolve=>setImmediate(resolve));assert.equal(cleared,1);assert.equal(chosen,'/studio/');});
test('exact server return guard retains reviewed builder selection and refuses arbitrary collections queries/fragments',()=>{const origin='https://worshipuponbaseera.ummabbadacademy.app',registry={studio:{origin,returns:[origin+'/studio/',origin+'/builder/']}};assert(allowedReturn(registry,'studio',origin+'/studio/'));assert(allowedReturn(registry,'studio',origin+'/builder/?website=actual-native-site'));for(const value of [origin+'/studio/?view=collections',origin+'/studio/#private',origin+'/studio/?returnTo=https://evil.invalid',origin+'/builder/?website=actual-native-site&redirect=https://evil.invalid','https://evil.invalid/studio/'])assert.equal(allowedReturn(registry,'studio',value),false,value);});

test('dashboard programme returns preserve each reviewed selection with default runtime settings',()=>{
 const origin='https://worshipuponbaseera.ummabbadacademy.app';
 const registry={studio:{origin,returns:defaultReturnPaths('studio').map(path=>origin+path)}};
 for(const query of ['?view=collections&collection=tafseer','?classroom=mothers','?view=collections&collection=courses']){
  const path=studioSignInReturnPath(query);
  assert.equal(path,'/studio/'+query);
  assert.equal(allowedReturn(registry,'studio',origin+path),true);
 }
 assert.equal(studioSignInReturnPath('?view=collections&collection=tafseer&manage=1'),'/studio/');
 assert.equal(allowedReturn(registry,'studio',origin+'/studio/?view=collections&collection=other'),false);
 assert.deepEqual(defaultReturnPaths('academy'),['/']);
 assert.deepEqual(defaultReturnPaths('hifz'),['/']);
});

test('Academy launch marks only the supported programmes and Studio removes the marker before sign-in',async()=>{
 const source=readFileSync(new URL('../../Academy/portal/studio-enter.mjs',import.meta.url),'utf8');
 const routes=['/studio/?view=collections&collection=tafseer','/studio/?classroom=mothers','/studio/?view=collections&collection=courses'];
 for(const target of [...routes,'/studio/?manage=1','/studio/?view=collections&collection=tafseer&manage=1']){
  let destination;
  const scope={URL,location:{href:'https://ummabbadacademy.app'+target},
   document:{querySelector:()=>({content:'2'})},
   window:{M4L_ACADEMY_AUTH:{navigate:async href=>{destination=new URL(href);}}}};
  await vm.runInNewContext('(async()=>{'+source+'})()',scope);
  assert.equal(destination.origin,'https://worshipuponbaseera.ummabbadacademy.app');
  assert.equal(studioDashboardEntry(destination.search),routes.includes(target)?target:null);
  assert.equal(destination.searchParams.has('academy-entry'),routes.includes(target));
 }
 assert.equal(studioDashboardEntry('?view=collections&collection=tafseer&academy-entry=1&returnTo=/'),null);
});

test('Studio uses admission for a new session and unlock for an independently locked one',async()=>{
 const destination='https://ummabbadacademy.app/auth/v2/admission?tx=fixture';
 const returnTo='/studio/?view=collections&collection=tafseer';
 for(const state of ['SIGNED_OUT','LOCKED','ADMITTED_LOCKED']){
  let called,assigned;
  const start=kind=>async options=>{called=kind;assert.deepEqual(options,{returnTo});return {navigateUrl:destination};};
  await navigateStudioAdmission({getState:()=>({state}),beginAdmission:start('admission'),beginUnlock:start('unlock')},
    {returnTo,win:{location:{assign:href=>{assigned=href;}}}});
  assert.equal(called,state==='SIGNED_OUT'?'admission':'unlock');
  assert.equal(assigned,destination);
 }
});
