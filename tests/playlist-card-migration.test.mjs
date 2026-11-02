import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
test('0014 backfills published/withdrawn cards without changing content or acquired rights; private Courses retain a persistent image gate',()=>{
 const db=new DatabaseSync(':memory:');try{
  const root=new URL('../migrations/',import.meta.url);for(const name of readdirSync(root).filter(n=>/^\d{4}_.*\.sql$/.test(n)&&n<'0014').sort())db.exec(readFileSync(new URL(name,root),'utf8'));
  db.exec("INSERT INTO accounts VALUES('holder','Original holder',1,1,1,1,0); INSERT INTO offerings VALUES('course','COURSE','Original course',1,1); INSERT INTO participation VALUES('holder','course',0,0,1,'original');");
  for(const [id,key,enabled] of [['published','original-published',1],['withdrawn','retained-published',0],['private',null,0]]){
   db.prepare('INSERT INTO websites(website_id,offering_id,title,draft_key,published_key,enabled,revision) VALUES(?,?,?,?,?,?,?)').run(id,'course','Original '+id,'original-draft-'+id,key,enabled,7);
   db.prepare('INSERT INTO mou_playlists VALUES(?,?,?,?,?,?,?)').run('playlist-'+id,'course',id,3,0,0,0);
  }
  const websites=db.prepare('SELECT * FROM websites ORDER BY website_id').all(),rights=db.prepare('SELECT * FROM participation').all();db.exec(readFileSync(new URL('0014_playlist_cards.sql',root),'utf8'));
  assert.deepEqual(db.prepare('SELECT * FROM websites ORDER BY website_id').all(),websites);assert.deepEqual(db.prepare('SELECT * FROM participation').all(),rights);
  const cards=db.prepare('SELECT * FROM playlist_card_designs ORDER BY playlist_id').all();assert.equal(cards.length,3);
  for(const row of cards){assert.equal(JSON.parse(row.draft_json).style,'default');if(row.playlist_id==='playlist-private'){assert.equal(row.published_json,null);assert.equal(row.first_published_at,null);assert.equal(row.image_required,1);}else{assert.equal(row.first_published_at,0);assert.equal(row.image_required,0);assert.equal(row.published_title,'Original '+row.playlist_id.slice(9));}}
  db.exec("UPDATE websites SET title='Private replacement' WHERE website_id='published'");assert.equal(db.prepare("SELECT published_title FROM playlist_card_designs WHERE playlist_id='playlist-published'").get().published_title,'Original published');
  db.exec("UPDATE websites SET enabled=1 WHERE website_id='withdrawn'");assert.throws(()=>db.exec("UPDATE websites SET enabled=1,published_key=draft_key WHERE website_id='private'"),/COURSE_CARD_IMAGE_REQUIRED/);
  const image={assetId:'checked-art',sha256:'a'.repeat(64),type:'image/png',size:10,alt:''},card={version:1,style:'image',colour:'#759786',gradient:null,image,teacher:null};db.prepare('INSERT INTO playlist_cover_assets VALUES(?,?,?,?,?,?,?)').run(image.assetId,'course','playlist-private',image.sha256,image.type,image.size,'private/checked-art');
  const publish=value=>{db.exec('BEGIN');try{db.prepare("UPDATE playlist_card_designs SET published_json=? WHERE playlist_id='playlist-private'").run(JSON.stringify(value));db.exec("UPDATE websites SET enabled=1,published_key=draft_key WHERE website_id='private'");db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}};
  assert.throws(()=>publish({...card,style:'colour'}),/COURSE_CARD_IMAGE_REQUIRED/);publish(card);assert.equal(db.prepare("SELECT image_required FROM playlist_card_designs WHERE playlist_id='playlist-private'").get().image_required,1);
  for(const value of [{...card,style:'colour'},{...card,image:null},{...card,image:{...image,type:'image/jpeg'}},{...card,image:{...image,size:11}}]){assert.throws(()=>publish(value),/COURSE_CARD_IMAGE_REQUIRED/);assert.equal(db.prepare("SELECT published_json FROM playlist_card_designs WHERE playlist_id='playlist-private'").get().published_json,JSON.stringify(card),'A failed later publication rolls back to the image card');}

 }finally{db.close();}
});
