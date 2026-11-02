import {sha256} from '../src/protocol.mjs';
import {defaultCard} from '../src/playlist-cards.mjs';
// Disposable fixture artwork for existing rights/Teacher tests. Production
// first-publication behavior is exercised separately in playlist-cards.test.
export async function seedPlaylistArtwork(f,playlistId,{published=false}={}){
 const p=await f.db.prepare('SELECT p.offering_id,w.title FROM mou_playlists p JOIN websites w USING(website_id) WHERE p.playlist_id=?').bind(playlistId).first();
 const data=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')),hash=await sha256(data),assetId='fixture-card:'+playlistId,key='private/test-playlist-cards/'+playlistId+'/'+hash;
 await f.content.put(key,data,{httpMetadata:{contentType:'image/png'}});
 await f.run('INSERT INTO playlist_cover_assets VALUES(?,?,?,?,?,?,?) ON CONFLICT DO NOTHING',assetId,p.offering_id,playlistId,hash,'image/png',data.length,key);
 const card=JSON.stringify({...defaultCard(),style:'image',image:{assetId,sha256:hash,type:'image/png',size:data.length,alt:'Disposable fixture artwork'}});
 await f.run('UPDATE playlist_card_designs SET draft_json=? WHERE playlist_id=?',card,playlistId);
 if(published){await f.run('UPDATE playlist_card_designs SET published_json=draft_json,published_title=? WHERE playlist_id=?',p.title,playlistId);await f.content.put('public/circles/covers/'+hash,data,{httpMetadata:{contentType:'image/png'}});}
}
