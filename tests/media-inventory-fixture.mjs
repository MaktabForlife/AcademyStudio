import {createHash} from 'node:crypto';

export const pdf=Buffer.from('%PDF-1.4\nSynthetic private original\n%%EOF'),checksum=createHash('sha256').update(pdf).digest('hex');

export async function seedInventory(db,scope){
 const run=(sql,...v)=>db.prepare(sql).bind(...v).run(),head=await db.prepare('SELECT head_id FROM setup_head_state WHERE singleton=1').first('head_id'),batch='media-inventory-batch',next='media-inventory-head';
 const lessons=['a-published','b-hidden','c-draft','d-removed','e-unaccepted'].map(lesson_id=>({lesson_id,activity_key:scope,class_id:'historic-cohort',lesson_date:'2024-01-12',title:'Original historical lesson',start_time:'09:00',end_time:'10:00',teacher_id:null,teacher_name:'Original teacher',summary:'',state:lesson_id==='c-draft'?'DRAFT':'PUBLISHED',comments_closed:1,revision:1,source_publication_id:'original-publication',source_lessons_json:JSON.stringify([{classIds:['second-original-class']},{classIds:['ignored-later-class']}]),updated_at:'2026-10-29',session_key:JSON.stringify(['PROGRAM','2024-01-12',lesson_id]),run_id:'',teacher_ids_json:'[]',media_scope:'SESSION'}));
 const assets=[{asset_id:'original-pdf',activity_key:scope,kind:'PDF',youtube_id:null,object_key:'local/lesson-pdf-refs/11111111-1111-1111-1111-111111111111/'+checksum+'.pdf',filename:'Original.pdf',byte_size:pdf.length,created_at:'2024-01-12T10:00:00Z',display_name:'Original notes'},
  {asset_id:'original-video',activity_key:scope,kind:'YOUTUBE',youtube_id:'a1b2c3d4e5F',object_key:null,filename:'Recording',byte_size:null,created_at:'2024-01-12T10:00:00Z',display_name:'Original recording'}];
 const links=lessons.filter(l=>l.lesson_id!=='e-unaccepted').flatMap(l=>assets.map(a=>({lesson_id:l.lesson_id,asset_id:a.asset_id})));
 for(const [table,rows] of [['lesson_media_lessons',lessons],['lesson_media_assets',assets],['lesson_media_links',links]])for(const row of rows)await run(`INSERT INTO ${table}(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(()=>'?').join(',')})`,...Object.values(row));
 await run("INSERT INTO lesson_media_visibility(lesson_id,visible,updated_at) VALUES('b-hidden',0,'2026-10-29')");
 await run("DELETE FROM lesson_media_links WHERE lesson_id='d-removed'");
 await run("INSERT INTO setup_batches VALUES(?,'sep-global',?,1,?,'synthetic','{}','2026-10-29',?)",batch,JSON.stringify([scope]),head,next);
 await run("INSERT INTO setup_heads VALUES(?,?,?,'2026-10-29','sep-global')",next,head,batch);
 await run('INSERT INTO setup_head_components SELECT ?,table_name,scope_key,component_id FROM setup_head_components WHERE head_id=?',next,head);
 for(const [table,rows] of [['lesson_media_lessons',lessons.slice(0,4)],['lesson_media_assets',assets],['lesson_media_links',links]]){
  const component='inventory-'+table;
  await run('INSERT INTO setup_components VALUES(?,?,?,?,?,?,?)',component,batch,table,scope,JSON.stringify(rows),rows.length,'synthetic');
  await run('INSERT INTO setup_head_components VALUES(?,?,?,?)',next,table,scope,component);
 }
 await run('UPDATE setup_head_state SET head_id=? WHERE singleton=1',next);await run('UPDATE academy_write_state SET version=version+1 WHERE singleton=1');
 return {run,lessons,assets,next};
}
