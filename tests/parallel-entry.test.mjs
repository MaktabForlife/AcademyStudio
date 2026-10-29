import test from 'node:test';import assert from 'node:assert/strict';import {parallel} from '../src/parallel-worker.mjs';
test('real parallel entry rejects preview identities or independent authority and remains disabled without its private connection',async()=>{
 const base={ENVIRONMENT:'parallel',AUTHORITY_MODE:'ACADEMY',PLATFORM_ENABLED:'0',ACADEMY_ORIGIN:'https://academy.test',ACADEMY_API_ORIGIN:'https://api.academy.test'};
 const request=new Request('https://website.test/api/websites');
 const disabled=await parallel(request,base);assert.equal(disabled.status,503);assert.equal(disabled.headers.get('X-AcademyStudio-Mode'),'parallel');
 for(const patch of [{ENVIRONMENT:'isolated-preview'},{AUTHORITY_MODE:'WEBSITE'},{PREVIEW_LOGIN_ENABLED:'1'},{ACADEMY_ORIGIN:'https://academy.invalid'},{ACADEMY_API_ORIGIN:'http://api.academy.test'},{PLATFORM_ENABLED:'1'}])assert.equal((await parallel(request,{...base,...patch})).status,503,JSON.stringify(patch));
});
