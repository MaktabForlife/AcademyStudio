import {fail,id} from './protocol.mjs';
import {referencedAssets} from '../public/shared/model.mjs';
const fields='x.attachment_id,x.asset_id,x.lesson_id,o.filename name,o.mime_type type,o.byte_size size,x.title';
const urls=rows=>rows.map(row=>({...row,url:'/api/media/'+row.attachment_id}));

export async function assertWebsiteAssets(store,websiteId,document){
 const refs=referencedAssets(document);if(refs.length>100)throw fail('Keep up to 100 website assets.');refs.forEach(id);
 if(refs.length){const missing=await store.first(`SELECT r.value FROM json_each(?) r WHERE NOT EXISTS(
   SELECT 1 FROM attachments a WHERE a.website_id=? AND a.asset_id=r.value AND a.audience='WEBSITE') LIMIT 1`,[JSON.stringify(refs),websiteId]);
  if(missing)throw fail('A website file needs an attachment to this website.');}
 return refs;
}

export async function editionAssets(store,websiteId,document,{draft=false}={}){
 const refs=document?referencedAssets(document):[];
 if(refs.length>100)throw fail('This edition needs an asset-reference review.',503,'EDITION_ASSET_LIMIT');
 refs.forEach(id);if(!refs.length)return [];
 // Start from the edition's bounded references. One indexed attachment per
 // asset prevents historical or duplicate attachments crowding out current ones.
 const rows=await store.all(`SELECT (SELECT json_object('attachment_id',x.attachment_id,'asset_id',x.asset_id,'lesson_id',x.lesson_id,
   'name',o.filename,'type',o.mime_type,'size',o.byte_size,'title',x.title)
  FROM attachments x JOIN objects o USING(asset_id) WHERE x.website_id=? AND x.asset_id=r.value AND x.audience='WEBSITE'
   ${draft?'':"AND x.published=1 AND EXISTS(SELECT 1 FROM published_assets p WHERE p.website_id=x.website_id AND p.asset_id=x.asset_id)"}
   ORDER BY x.published DESC,x.attachment_id LIMIT 1) asset
  FROM json_each(?) r ORDER BY r.value`,[websiteId,JSON.stringify(refs)]);
 return urls(rows.filter(row=>row.asset!==null).map(row=>JSON.parse(row.asset)));
}

export async function attachedWebsiteAssets(store,websiteId,{assetId,after=''}={}){
 if(assetId){const rows=await store.all(`SELECT ${fields} FROM attachments x JOIN objects o USING(asset_id)
   WHERE x.website_id=? AND x.asset_id=? AND x.audience='WEBSITE' ORDER BY x.published DESC,x.attachment_id LIMIT 1`,[websiteId,id(assetId)]);return {assets:urls(rows),more:false,nextCursor:null};}
 if(after)id(after);
 const rows=await store.all(`SELECT ${fields} FROM attachments x JOIN objects o USING(asset_id)
  WHERE x.website_id=? AND x.audience='WEBSITE' AND x.attachment_id>? ORDER BY x.attachment_id LIMIT 51`,[websiteId,after]);
 const page=rows.slice(0,50),more=rows.length>50;return {assets:urls(page),more,nextCursor:more?page.at(-1).attachment_id:null};
}
