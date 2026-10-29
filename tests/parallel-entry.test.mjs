import test from 'node:test';import assert from 'node:assert/strict';import {parallel} from '../src/parallel-worker.mjs';
test('real parallel entry rejects preview identities or independent authority and remains disabled without its private connection',async()=>{
 const base={ENVIRONMENT:'parallel',AUTHORITY_MODE:'ACADEMY',PLATFORM_ENABLED:'0',ACADEMY_ORIGIN:'https://academy.test',ACADEMY_API_ORIGIN:'https://api.academy.test'};
 const request=new Request('https://website.test/api/websites');
 const disabled=await parallel(request,base);assert.equal(disabled.status,503);assert.equal((await disabled.json()).code,'PARALLEL_PREPARING');assert.equal(disabled.headers.get('X-AcademyStudio-Mode'),'parallel');
 for(const patch of [{ENVIRONMENT:'isolated-preview'},{AUTHORITY_MODE:'WEBSITE'},{PREVIEW_LOGIN_ENABLED:'1'},{ACADEMY_ORIGIN:'https://academy.invalid'},{ACADEMY_API_ORIGIN:'http://api.academy.test'},{PLATFORM_ENABLED:'1'}])assert.equal((await parallel(request,{...base,...patch})).status,503,JSON.stringify(patch));
});

test('closed parallel browser gate permits only authenticated internal delivery during initial synchronisation',async()=>{
 const env={ENVIRONMENT:'parallel',AUTHORITY_MODE:'ACADEMY',PLATFORM_ENABLED:'1',PARALLEL_ACCESS_ENABLED:'0',ACADEMY_ORIGIN:'https://academy.test',ACADEMY_API_ORIGIN:'https://api.academy.test',ACADEMY_TO_WEBSITE_SECRET:'s'.repeat(48),WEBSITE_TO_ACADEMY_SECRET:'r'.repeat(48),DB:{withSession:()=>({})}};
 for(const path of ['/auth/login','/auth/exchange','/auth/refresh','/api/websites','/api/admin/offerings']){const r=await parallel(new Request('https://website.test'+path),env);assert.equal(r.status,503,path);assert.equal((await r.json()).code,'PARALLEL_PREPARING');}
 const r=await parallel(new Request('https://website.test/internal/academy/events',{method:'POST',body:'{}'}),env);assert.equal(r.status,401);assert.equal((await r.json()).error,'Invalid Academy delivery.');
});
