import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {Store} from '../src/database.mjs';
import {bindV2Store} from '../src/v111-native-context.mjs';
export function nativeMemory({globalAdmin=false,sensitiveAge=0}={}){
 const raw=new DatabaseSync(':memory:');for(const n of readdirSync(new URL('../migrations/',import.meta.url)).filter(n=>/^\d{4}_.*\.sql$/.test(n)).sort())raw.exec(readFileSync(new URL('../migrations/'+n,import.meta.url),'utf8'));
 raw.exec('CREATE TABLE synthetic_runtime_guard(id TEXT PRIMARY KEY,accepted INTEGER CHECK(accepted=1));CREATE TABLE synthetic_live_context(sid TEXT PRIMARY KEY,live INTEGER NOT NULL);');
 const db={
  withSession(mode){if(mode!=='first-primary')throw Error('primary required');return this;},
  prepare(sql){
   let args=[];const stmt={sql,bind(...values){args=values;return stmt;},
    execute(mode){const query=raw.prepare(sql);if(mode==='first')return query.get(...args)||null;if(mode==='all'||query.columns().length)return {success:true,results:query.all(...args),meta:{}};const result=query.run(...args);return {success:true,results:[],meta:{changes:Number(result.changes)}};},
    async first(){return stmt.execute('first');},async all(){return stmt.execute('all');},async run(){return stmt.execute('run');}
   };return stmt;
  },
  async batch(list){raw.exec('BEGIN IMMEDIATE');try{const result=list.map(s=>s.execute('run'));raw.exec('COMMIT');return result;}catch(e){raw.exec('ROLLBACK');throw e;}}
 };
 const now=Math.floor(Date.now()/1000),binding={iss:'https://worshipuponbaseera.ummabbadacademy.app',sub:'synthetic-user',sid:crypto.randomUUID(),ce:3,vat:now-sensitiveAge,s_exp:now+604800,sv:1,ue:0},caps=new WeakSet();let cap=null;
 raw.prepare('INSERT INTO synthetic_live_context VALUES(?,1)').run(binding.sid);raw.prepare('INSERT INTO accounts VALUES(?, ?,1,1,3,1,?)').run(binding.sub,'Synthetic native account',Number(globalAdmin));
 const env={DB:db,PLATFORM_ENABLED:'1',ENVIRONMENT:'parallel',WEBSITE_ORIGIN:'https://worshipuponbaseera.ummabbadacademy.app',WEBSITE_ALIAS_ORIGINS:'[]',STUDIO_BACKEND_ORIGIN:'https://academy-studio-parallel.naidu-hajira.workers.dev',ACADEMY_ORIGIN:'https://ummabbadacademy.app',ACADEMY_PORTAL_ORIGIN:'https://ummabbadacademy.app',PUBLIC_ASSET_SOURCE:'worker',STUDIO_PROVIDER_ORIGIN:'https://ummabbadacademy.maktab4life.org',STUDIO_REDIRECT_ORIGINS:'[]',UAA_V2_ENABLED:'1',AUTHORITY_MODE:'ACADEMY',ACCOUNT_MAX_AGE_SECONDS:'43200',ADMIN_MAX_AGE_SECONDS:'60'},store=new Store(env);
 const runtime={assertCapability(candidate){if(!caps.has(candidate))throw Object.assign(Error('untrusted capability'),{code:'UNTRUSTED_CAPABILITY'});},writeGuard(candidate,{sensitive}){this.assertCapability(candidate);const id=crypto.randomUUID();return {sql:'EXISTS(SELECT 1 FROM synthetic_live_context WHERE sid=? AND live=1)',args:[candidate.binding.sid],before:[store.statement('INSERT INTO synthetic_runtime_guard SELECT ?,EXISTS(SELECT 1 FROM synthetic_live_context WHERE sid=? AND live=1)',[id,candidate.binding.sid])],after:[store.statement('DELETE FROM synthetic_runtime_guard WHERE id=?',[id])]};}};
 const tables=['participation','staff','paid_months','website_months','surah_grants','mou_playlist_retained','source_access_people','source_access_master_fences','circles_navigation','source_access_scopes','source_access_websites','access_handovers','programme_offerings','programme_subjects','course_access_models','completed_course_registrations'];
 function revalidate(){
  if(cap)caps.delete(cap);const account=raw.prepare('SELECT * FROM accounts WHERE account_id=?').get(binding.sub),nativeAuthority={schema:1,identity:{account_id:account.account_id,active:account.active,admitted:account.admitted,global_admin:account.global_admin},tables:{}};
  for(const table of tables)nativeAuthority.tables[table]={columns:raw.prepare('PRAGMA table_info("'+table+'")').all().map(c=>c.name),rows:raw.prepare('SELECT * FROM "'+table+'"').all().map(row=>({...row}))};
  const scopes=raw.prepare('SELECT o.offering_id,s.role FROM offerings o LEFT JOIN staff s ON s.offering_id=o.offering_id AND s.account_id=? WHERE o.active=1').all(binding.sub).map(row=>({...row}));
  cap=Object.freeze({binding:Object.freeze({...binding,sv:(cap?.binding.sv||0)+1}),rights:Object.freeze({globalAdmin:Boolean(account.global_admin),sourceCredentialEpoch:account.epoch,scopes,nativeAuthority}),deadline:now+900});caps.add(cap);bindV2Store(store,runtime,cap);return cap;
 }
 revalidate();return {raw,db,store,env,runtime,get cap(){return cap;},revalidate,now};
}
export function seedOffer(f,{kind='TAFSEER',role=null,paid=false,cohort='cohort-A',month='2026-11',authority='ACADEMY'}={}){
 const r=f.raw;r.prepare('INSERT INTO offerings VALUES(?,?,?,1,0)').run('synthetic-offer',kind,'Synthetic offering');
 r.prepare('INSERT INTO participation VALUES(?,?,1,0,0,?)').run(f.cap.binding.sub,'synthetic-offer',cohort);
 if(role)r.prepare('INSERT INTO staff VALUES(?,?,?,0)').run(f.cap.binding.sub,'synthetic-offer',role);
 if(paid)r.prepare('INSERT INTO paid_months VALUES(?,?,?,?,?)').run(f.cap.binding.sub,'synthetic-offer',month,cohort,'synthetic');
 r.prepare("INSERT INTO source_access_scopes(offering_id,generation,version,enabled,live_enabled,timezone,classes_json,authority) VALUES(?,1,1,1,0,'UTC','[]',?)").run('synthetic-offer',authority);
 r.prepare("INSERT INTO source_access_people VALUES(?,?,1,1,1,1,'[]',0,0)").run(f.cap.binding.sub,'synthetic-offer');f.revalidate();
}
