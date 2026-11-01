import {accessGate} from './access.mjs';
import {fail,id} from './protocol.mjs';
import {websiteAccess} from './content.mjs';
import {recordedAssetAccess} from './recorded-support.mjs';
import {playlistMediaAccess} from './mou-playlists.mjs';
export async function mediaGate(store,actor,attachmentId,{admin=false}={}){
 const row=await store.first(`SELECT x.*,o.object_key,o.mime_type,o.filename,o.byte_size,o.youtube_id,f.kind,f.active,p.purchased,s.role,(SELECT programme_key FROM programme_offerings WHERE offering_id=x.offering_id) programme_key,EXISTS(SELECT 1 FROM mou_playlist_only_media WHERE attachment_id=x.attachment_id) playlist_only,(SELECT access_model FROM course_access_models m WHERE m.offering_id=f.offering_id) access_model,
  EXISTS(SELECT 1 FROM paid_months m WHERE m.account_id=? AND m.offering_id=x.offering_id AND m.month=substr(x.lesson_date,1,7) AND m.cohort=x.cohort) paid
  FROM attachments x JOIN objects o USING(asset_id) JOIN offerings f USING(offering_id)
  LEFT JOIN participation p ON p.account_id=? AND p.offering_id=x.offering_id
  LEFT JOIN staff s ON s.account_id=? AND s.offering_id=x.offering_id WHERE x.attachment_id=?`,[actor.account_id,actor.account_id,actor.account_id,id(attachmentId)]);
 if(!row||!row.active)throw fail('This attachment is unavailable.',404);await accessGate(store,actor,row.offering_id,{admin:Boolean(row.role)});
 if(admin){await store.scope(actor,row.offering_id,{admin:true});return row;}
 if(!row.published)throw fail('This attachment is not published.',404);
 const staff=actor.global_admin||row.role==='ADMIN'||row.role==='TEACHER';
 if(row.audience==='WEBSITE'){const website=await websiteAccess(store,actor,row.website_id);if(!await store.first('SELECT asset_id FROM published_assets WHERE website_id=? AND asset_id=?',[row.website_id,row.asset_id]))throw fail('This file is not in the published website.',404);await recordedAssetAccess(store.env,store,actor,website,row.asset_id);}
 else if(!staff&&!(row.kind==='COURSE'&&(row.purchased||row.access_model==='FREE')||row.kind==='TAFSEER'&&(!row.playlist_only&&row.paid||row.programme_key==='mothers'&&await playlistMediaAccess(store,actor,row))))throw fail('This lesson requires its own material rights.',403);
 return row;
}
export async function streamMedia(env,row,request){
 if(row.youtube_id)return Response.json({videoId:row.youtube_id},{headers:{'Cache-Control':'private, no-store'}});
 const range=request.headers.get('Range');let offset=0,length=row.byte_size,status=200;
 if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||!match[1]&&!match[2])throw fail('Choose a single valid byte range.',416);
  if(!match[1]){length=Math.min(Number(match[2]),row.byte_size);offset=row.byte_size-length;}else{offset=Number(match[1]);const end=match[2]?Math.min(Number(match[2]),row.byte_size-1):row.byte_size-1;length=end-offset+1;}
  if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||offset>=row.byte_size||length<1)throw fail('This byte range is outside the file.',416);status=206;
 }
 const object=request.method==='HEAD'?await env.MEDIA.head(row.object_key):await env.MEDIA.get(row.object_key,range?{range:{offset,length}}:{});if(!object)throw fail('This file needs to be restored from its recovery source.',503,'FILE_MISSING');
 const headers={'Content-Type':row.mime_type,'Cache-Control':'private, no-store','Accept-Ranges':'bytes','Content-Length':String(length),'X-Content-Type-Options':'nosniff','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`};
 if(status===206)headers['Content-Range']=`bytes ${offset}-${offset+length-1}/${row.byte_size}`;
 return new Response(request.method==='HEAD'?null:object.body,{status,headers});
}
