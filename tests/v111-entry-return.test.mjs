import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';import{allowedReturn,defaultReturnPaths}from'../../Academy/security/v2/return-routes.mjs';
import{studioSignInReturnPath}from'../public/shared/circles-routes.mjs';
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
