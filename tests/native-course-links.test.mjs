import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {nativeCourseIndex,loadNativeCourseIndex,withNativeCourseLink} from '../public/shared/native-course-links.mjs';
import {connectedNativeCourseNavigation} from '../tools/circles-ui-adaptation.mjs';
const native=(key,extra={})=>({key,kind:'COURSE',title:'Native '+key,websiteId:'native-'+key,...extra});

test('ready catalogue uses exact registered Course IDs and explicit display-key aliases without granting rights',()=>{
 const index=nativeCourseIndex([native('salaah'),native('tawakkul'),native('kahf'),native('resilience'),native('unpublished',{pending:true}),native('tafseer',{kind:'TAFSEER'}),native('notice',{websiteId:null})]);
 for(const [key,expected]of [['stillness-in-my-salah','salaah'],['tawakkul-mindset','tawakkul'],['surah-al-kahf','kahf'],['resilience','resilience']]){
  const input={key,access:key==='resilience'?'free':'paid',recordingCount:1},before=structuredClone(input),linked=withNativeCourseLink(input,index);
  assert.equal(linked.href,'/studio/?website=native-'+expected);assert.equal(linked.title,'Native '+expected);assert.equal(linked.access,input.access);assert.equal(linked.nativeWebsiteId,'native-'+expected);assert.equal(linked.canOpen,undefined);assert.equal(linked.recordingCount,null,'Only the native authorised feed can count recorded lessons');assert.deepEqual(input,before);
 }
 for(const key of ['unpublished','tafseer','notice','guessed'])assert.equal(withNativeCourseLink({key,href:'original'},index).nativeWebsiteId,undefined);
});
test('conflicting aliases, malformed IDs and hostile catalogues cannot supply a native destination',()=>{
 assert.throws(()=>nativeCourseIndex([native('x'),native('x')]));assert.throws(()=>nativeCourseIndex([native('x',{websiteId:'../elsewhere'})]));assert.throws(()=>nativeCourseIndex({items:[]}));
 assert.throws(()=>withNativeCourseLink({key:'tawakkul-mindset'},nativeCourseIndex([native('tawakkul'),native('tawakkul-mindset')])));
 const linked=withNativeCourseLink({key:'x'},nativeCourseIndex([native('x',{href:'https://evil.test/',videoId:'abcdefghijk',canOpen:true})]));assert.equal(linked.href,'/studio/?website=native-x');assert.equal(linked.canOpen,undefined);assert.equal(linked.videoId,undefined);
});
test('one credential-free public snapshot supplies all Course links without permission or media calls',async()=>{
 const calls=[],index=await loadNativeCourseIndex({fetcher:async(path,options)=>{calls.push({path,options});return {ok:true,json:async()=>({items:[native('one'),native('two')]})};}});
 assert.equal(index.size,2);assert.deepEqual(calls,[{path:'/api/public/circles',options:{credentials:'omit',cache:'no-store'}}]);
 await assert.rejects(()=>loadNativeCourseIndex({fetcher:async()=>({ok:false})}));
});
test('the additive frozen podcast delta bypasses prototype loading for ready native Courses',{skip:!process.env.CIRCLES_UI_BUILD},async()=>{
 const source=await readFile(resolve(process.env.CIRCLES_UI_BUILD,'circles/podcast-view.mjs'),'utf8'),updated=connectedNativeCourseNavigation(source);
 assert.match(updated,/loadNativeCourseIndex/);assert.match(updated,/item.access==='paid'&&!item.nativeWebsiteId/);assert.match(updated,/if\(selected\?\.nativeWebsiteId\).*location.replace\(selected.href\)/);
 assert.equal(connectedNativeCourseNavigation(updated),updated,'Root can safely apply the additive delta once to frozen connected assets');
 assert.match(updated,/else if\(!selected\)/);assert.match(updated,/AcademyConnectedCirclesUI/);assert.match(updated,/Materials coming soon/);
 assert.match(updated,/if\(nativeCourseIssue\)throw Error\(nativeCourseIssue\)/);
});

test('the thirteen newly prepared Course keys plus existing Kahf all keep native routes in the frozen free/paid catalogue',{skip:!process.env.CIRCLES_UI_BUILD},async()=>{
 const {runInNewContext}=await import('node:vm'),context={};runInNewContext(await readFile(resolve(process.env.CIRCLES_UI_BUILD,'circles/free-learning-catalogue.js'),'utf8'),context);
 const items=[...context.AcademyApprovedFreeCourses,...context.AcademyPaidCourses];assert.equal(items.length,14);
 const canonical=key=>({'stillness-in-my-salah':'salaah','tawakkul-mindset':'tawakkul','surah-al-kahf':'kahf'}[key]||key),index=nativeCourseIndex(items.map(item=>native(canonical(item.key))));
 const links=items.map(item=>withNativeCourseLink(item,index));assert.equal(new Set(links.map(item=>item.nativeWebsiteId)).size,14);assert(links.every(item=>item.href.startsWith('/studio/?website=')));assert.equal(links.filter(item=>item.access==='paid').length,4);assert.equal(links.filter(item=>item.access==='free').length,10);
});
