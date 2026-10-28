import {fail,id} from './protocol.mjs';
import {referencedAssets} from '../public/shared/model.mjs';
const fields='x.attachment_id,x.asset_id,x.lesson_id,o.filename name,o.mime_type type,o.byte_size size,x.title';
const urls=rows=>rows.map(row=>({...row,url:'/api/media/'+row.attachment_id}));

export async function editionAssets(store,websiteId,document,{draft=false}={}){
 const refs=document?referencedAssets(document):[];
 if(refs.length>100)throw fail('This edition needs an asset-reference review.',503,'EDITION_ASSET_LIMIT');
 refs.forEach(id);if(!refs.length)return [];
 // Start from the edition's bounded references. One indexed attachment per
 // asset prevents historical or duplicate attachments crowding out current ones.
 const rows=await store.all(`SELECT ${fields} FROM json_each(?) r CROSS JOIN attachments x
  ON x.attachment_id=(SELECT a.attachment_id FROM attachments a WHERE a.website_id=? AND a.asset_id=r.value AND a.audience='WEBSITE'
   ${draft?'':"AND a.published=1 AND EXISTS(SELECT 1 FROM published_assets p WHERE p.website_id=a.website_id AND p.asset_id=a.asset_id)"}
   ORDER BY a.published DESC,a.attachment_id LIMIT 1)
  JOIN objects o USING(asset_id) ORDER BY x.asset_id`,[JSON.stringify(refs),websiteId]);
 return urls(rows);
}

export async function attachedWebsiteAssets(store,websiteId,{assetId,after=''}={}){
 if(assetId){const rows=await store.all(`SELECT ${fields} FROM attachments x JOIN objects o USING(asset_id)
   WHERE x.website_id=? AND x.asset_id=? AND x.audience='WEBSITE' ORDER BY x.published DESC,x.attachment_id LIMIT 1`,[websiteId,id(assetId)]);return {assets:urls(rows),more:false,nextCursor:null};}
 if(after)id(after);
 const rows=await store.all(`SELECT ${fields} FROM attachments x JOIN objects o USING(asset_id)
  WHERE x.website_id=? AND x.audience='WEBSITE' AND x.attachment_id>? ORDER BY x.attachment_id LIMIT 51`,[websiteId,after]);
 const page=rows.slice(0,50),more=rows.length>50;return {assets:urls(page),more,nextCursor:more?page.at(-1).attachment_id:null};
}
