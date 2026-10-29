import assert from 'node:assert/strict';import {seedTimetables} from './timetable-fixture.mjs';import {random,challenge} from '../src/protocol.mjs';
export const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
export async function signIn(f,who='studentA'){
 const verifier=random(),state=random(),login=ok(await f.request('/auth/login',{method:'POST',body:{uniqueid:'separation-'+who,pin:'1234',challenge:await challenge(verifier),state}})),x=await f.request('/auth/exchange',{method:'POST',body:{code:login.code,verifier,state}});ok(x);return x.response.headers.get('Set-Cookie').split(';')[0];
}
export async function accessFixture(f){
 const x=await seedTimetables(f),{db,courseA,programA}=x,global=f.source.f.actors.global,student=f.source.f.actors.studentA,grant=f.source.f.actors.studentB,run=(sql,...v)=>db.prepare(sql).bind(...v).run();
 await run('INSERT INTO actor_refs VALUES(?) ON CONFLICT DO NOTHING',global);
 await run("INSERT INTO classes(activity_key,class_id,name,active) VALUES(?,'historic-cohort','Historic 2024 audience',0)",programA);
 await run("INSERT INTO program_monthly_media_policies(activity_key,enabled,updated_at,updated_by_account_id) VALUES(?,1,'2026-10-29',?)",programA,global);
 await run("INSERT INTO program_monthly_subscriptions(activity_key,account_id,lesson_month,active,class_ids_json,updated_at,updated_by_account_id) VALUES(?,?,'2024-01',1,'[\"historic-cohort\"]','2026-10-29',?)",programA,student,global);
 await run("INSERT INTO program_surahs(surah_id,activity_key,name,completion_date,active,updated_at,updated_by_account_id) VALUES('source-surah',?,'Source Surah','2024-01-23',1,'2026-10-29',?)",programA,global);
 await run("INSERT INTO program_surah_grants(activity_key,account_id,surah_id,active,updated_at,updated_by_account_id) VALUES(?,?,'source-surah',1,'2026-10-29',?)",programA,grant,global);
 await run("INSERT INTO course_subscription_decisions(account_id,activity_key,active,updated_at,updated_by_account_id) VALUES(?,?,1,'2026-10-29',?)",student,courseA,global);
 for(const scope of [courseA,programA]){await run('INSERT INTO website_platform_access_scopes(activity_key,purchase_model) VALUES(?,?)',scope,scope===courseA?'CONFIRMED_SUBSCRIPTION':'UNREVIEWED');if(scope===programA)await run("INSERT INTO website_platform_surah_maps VALUES(?,'source-surah','site-surah')",scope);await run('UPDATE website_platform_access_scopes SET enabled=1 WHERE activity_key=?',scope);}
 return {...x,student,grant,run,async recover(count=1){for(let i=0;i<count;i++){const r=await f.runtime.dispatchFetch('https://academy.test/__local/recover');assert.equal(r.status,200,await r.text());}}};
}
