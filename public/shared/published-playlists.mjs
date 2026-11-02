import {playlistCardHTML,ensurePlaylistCardStyles} from './playlist-card.mjs';
import {tafseerCover} from './tafseer-cover.mjs';
import {esc} from './model.mjs';
const nativeId=value=>typeof value==='string'&&/^[-A-Za-z0-9_:]{1,160}$/.test(value);
export function playlistMediaQuery(websiteId,{after='',playlist=null}={}){
 const query=new URLSearchParams({website:websiteId});if(after){query.set('after',after);if(playlist){if(!Number.isSafeInteger(playlist.revision)||playlist.revision<1)throw Error('Reopen this playlist to load its saved order.');query.set('playlistRevision',String(playlist.revision));}}return query;
}
export function mergePlaylistMediaPage(bound,response,{more=false}={}){
 const playlist=response.playlist||null;
 if(more&&bound.playlist&&(!playlist||playlist.id!==bound.playlist.id||playlist.revision!==bound.playlist.revision))throw Error('This playlist changed. Reopen it to load its saved order.');
 if(playlist&&(!nativeId(playlist.id)||!Number.isSafeInteger(playlist.revision)||playlist.revision<1||response.media.some(row=>!Number.isSafeInteger(row.playlistPosition)||row.playlistPosition<1)))throw Error('The saved playlist order could not be checked. Reopen it.');
 return {playlist,media:[...new Map([...(more?bound.media:[]),...response.media].map(row=>[row.attachment_id,row])).values()]};
}
export function publishedPlaylistRows(value){
 if(!Array.isArray(value))throw Error('The published playlist list is unavailable.');
 const ids=new Set();return value.map(row=>{
  if(!nativeId(row.id)||!nativeId(row.websiteId)||!nativeId(row.offeringId)||row.published!==true||!['COURSE','TAFSEER'].includes(row.kind)||!Number.isSafeInteger(row.recordings)||row.recordings<0||typeof row.canListen!=='boolean'||typeof row.canRead!=='boolean'||!row.canListen&&!row.canRead||row.href!=='/studio/?website='+encodeURIComponent(row.websiteId)||ids.has(row.id))throw Error('Refresh the published playlist list.');
  ids.add(row.id);return {...row};
 });
}
export function publishedPlaylistTable(rows,{legacy=false}={}){
 if(!rows.length)return '';
 if(!legacy){if(globalThis.document)ensurePlaylistCardStyles(globalThis.document,'/shared/playlist-card.css');return '<section class="published-playlists"><h2>Your recording playlists</h2><div class="playlist-card-grid" aria-label="Published recording playlists">'+rows.map(row=>playlistCardHTML(row,{href:row.href,websiteId:row.websiteId,kind:row.kind,defaultArtwork:tafseerCover(row),accessLabel:row.coursePolicy?.model==='FREE'?'Free':'Open'})).join('')+'</div></section>';}
 return `<section class="published-playlists"><h2>${legacy?'Other learning material':'Your recording playlists'}</h2><div class="recording-playlist-scroll" tabindex="0" role="region" aria-label="Published recording playlists"><table class="recording-playlist-table"><thead><tr><th scope="col">${legacy?'Learning material':'Playlist / Surah'}</th><th scope="col">Programme / Course</th><th scope="col">Recordings</th><th scope="col">Access</th><th scope="col">Open</th></tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${esc(row.title)}</th><td>${esc(row.offeringTitle||'—')}</td><td>${Number.isSafeInteger(row.recordings)?row.recordings:'—'}</td><td>${legacy?'Available':row.canListen?(row.canRead?'Listen and read':'Listen'):'Reading materials'}</td><td><a href="${esc(row.href)}" data-circles-website="${esc(row.websiteId)}" aria-label="${esc('Open playlist: '+row.title)}">Open playlist →</a></td></tr>`).join('')}</tbody></table></div></section>`;
}
export function presentPublishedPlaylists(root,{playlists=[],websites=[],known=[],more=false,onMore=()=>{}}){
 for(const section of root.querySelectorAll('[data-published-playlists]'))section.remove();
 const knownIds=new Set(known.map(row=>row.websiteId)),registered=new Set(playlists.map(row=>row.websiteId));
 for(const kind of ['TAFSEER','COURSE']){
  const section=root.querySelector('[data-circles-section="'+kind+'"]');if(!section)continue;
  const rows=playlists.filter(row=>row.kind===kind&&row.programmeKey!=='mothers'),host=root.ownerDocument.createElement('div');host.dataset.publishedPlaylists=kind;host.innerHTML=publishedPlaylistTable(rows);
  // Historical sites retain their existing opening gate and an unknown count.
  const legacy=websites.filter(row=>row.kind===kind&&row.programmeKey!=='mothers'&&!knownIds.has(row.website_id)&&!registered.has(row.website_id)&&nativeId(row.website_id)).map(row=>({websiteId:row.website_id,title:row.title,offeringTitle:row.offeringTitle,href:'/studio/?website='+encodeURIComponent(row.website_id)}));
  host.insertAdjacentHTML('beforeend',publishedPlaylistTable(legacy,{legacy:true}));section.append(host);
 }
 if(more){const host=root.ownerDocument.createElement('div');host.dataset.publishedPlaylists='more';const button=root.ownerDocument.createElement('button');button.type='button';button.textContent='Load more playlists';button.onclick=onMore;host.append(button);root.append(host);}
}
