import {v2Context} from './v111-native-context.mjs';
import {fail} from './protocol.mjs';
const known=new Set(['studio_course_publication_holds','studio_source_projection_problems','participation','staff','paid_months','website_months','surah_grants','mou_playlist_retained','source_access_people','source_access_master_fences','circles_navigation','source_access_scopes','source_access_websites','access_handovers','programme_offerings','programme_subjects','course_access_models','completed_course_registrations']);
const encoded=new WeakMap();
export function authorityQuery(store,sql,args=[]){
 const local=v2Context(store);if(!local)return {sql,args,snapshot:false};
 const snapshot=local.cap.rights.nativeAuthority;
 if(snapshot?.schema!==1||!snapshot.tables)throw fail('Refresh the native Studio authority snapshot.',503,'NATIVE_AUTHORITY_SNAPSHOT_REQUIRED');
 let memo=encoded.get(snapshot);if(!memo){memo=new Map();encoded.set(snapshot,memo);}
 const used=[...new Set([...sql.matchAll(/\b(?:FROM|JOIN)\s+["`\[]?([a-z_][a-z0-9_]*)/gi)].map(m=>m[1].toLowerCase()).filter(t=>known.has(t)))].sort();
 if(!used.length)return {sql,args,snapshot:false};
 const views=[],bindings=[];for(const table of used){
  const value=snapshot.tables[table];if(!value||!Array.isArray(value.columns)||!value.columns.length||!value.columns.every(c=>/^[a-z_][a-z0-9_]*$/i.test(c))||!Array.isArray(value.rows))throw fail('Studio authority coverage is unavailable.',503,'NATIVE_AUTHORITY_SNAPSHOT_REQUIRED');
  if(!memo.has(table))memo.set(table,JSON.stringify(value.rows));
  views.push('"'+table+'" AS (SELECT '+value.columns.map(c=>'json_extract(j.value,\'$."'+c+'"\') AS "'+c+'"').join(',')+' FROM json_each(?) j)');bindings.push(memo.get(table));
 }
 let body=sql.trimStart(),recursive=/^WITH\s+RECURSIVE\b/i.test(body);if(/^WITH\b/i.test(body))body=body.replace(/^WITH\s+(?:RECURSIVE\s+)?/i,'');else body=' '+body;
 const join=/^\s*SELECT\b/i.test(body)?' ':',';
 return {sql:'WITH '+(recursive?'RECURSIVE ':'')+views.join(',')+join+body,args:[...bindings,...args],snapshot:true};
}
