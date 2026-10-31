import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {websiteServerOrigin}=await import(pathToFileURL(resolve(process.env.ACADEMY_SOURCE||'../Academy-studio-launch-109','backend/src/academy/d1/web-platform/protocol.mjs')));
test('direct server transport stays separate from browser returns and older configurations retain their origin',()=>{
 const direct='https://academy-studio-parallel.naidu-hajira.workers.dev';assert.equal(websiteServerOrigin({WEBSITE_PLATFORM_ORIGIN:'https://maktab4life.org',WEBSITE_PLATFORM_SERVER_ORIGIN:direct}).origin,direct);
 assert.equal(websiteServerOrigin({WEBSITE_PLATFORM_ORIGIN:'https://website.test'}).origin,'https://website.test');
});
test('invalid server transport cannot silently fall back to the public site or add a path, credentials or fragment',()=>{
 for(const value of ['',null,{},'not a URL','http://website.test','https://user:secret@website.test','https://website.test/path','https://website.test/','https://website.test#part','https://website.test?next=evil']){
  if(value===null)continue;assert.throws(()=>websiteServerOrigin({WEBSITE_PLATFORM_ORIGIN:'https://maktab4life.org',WEBSITE_PLATFORM_SERVER_ORIGIN:value}),e=>e.status===503,JSON.stringify(value));
 }
});
