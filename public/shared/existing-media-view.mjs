import {esc} from './model.mjs';

// Protected Studio links only. Project PDFs are supplied exclusively by the
// loopback review harness, never bundled into the production catalogue.
export function existingMaterialLinks({websiteId,websiteLabel='Reading website',websitePublished=false,unassigned=false,pdfs=[],projectPdfs=[]},{origin=''}={}){
 const files=[...new Map(pdfs.map(file=>[file.assetId||file.attachmentId,file])).values()];
 const local=projectPdfs.filter(file=>/^\/review-files\/[a-f0-9]{64}\.pdf$/.test(file.href||''));
 return '<div class="existing-media-materials">'+(!unassigned&&websiteId?'<section><h4>'+esc(websiteLabel)+'</h4><p><span class="existing-media-status">'+(websitePublished?'Published':'Private draft')+'</span></p><p>'+(websitePublished?'<a href="'+esc(origin)+'/studio/?website='+encodeURIComponent(websiteId)+'" target="_blank" rel="noopener">Read website</a> · ':'')+'<a href="'+esc(origin)+'/builder/?website='+encodeURIComponent(websiteId)+'" target="_blank" rel="noopener">Edit website</a></p></section>':'')+'<section><h4>PDFs</h4>'+files.map(file=>'<p><a href="'+esc(origin)+'/api/media/'+encodeURIComponent(file.attachmentId)+'?draft=1" target="_blank" rel="noopener">'+esc(file.title)+'</a> <span class="existing-media-status">'+(file.published?'Published':'Private draft')+'</span></p>').join('')+local.map(file=>'<p><a href="'+esc(file.href)+'" target="_blank" rel="noopener">'+esc(file.title)+'</a> <span class="existing-media-status">Project copy · local review only</span></p>').join('')+(!files.length&&!local.length?'<p>No PDF attached in Studio.</p>':'')+(local.length?'<p class="existing-media-note">Project PDFs have not been uploaded or published to Studio.</p>':'')+'</section></div>';
}

// Scoped Admin navigation metadata only. Reading still goes through the source
// website's current permission/publication gate; private sources get an editor.
export function existingSourceWebsiteLinks(rows=[],{origin=''}={}){
 if(!rows.length)return '';
 return '<section class="existing-source-websites"><h4>Original reading websites</h4>'+rows.map(row=>'<p><strong>'+esc(row.title)+'</strong> · '+(row.websitePublished?'Published':'Private draft')+'<br>'+(row.websitePublished?'<a href="'+esc(origin)+'/studio/?website='+encodeURIComponent(row.websiteId)+'" target="_blank" rel="noopener">Read original website</a> · ':'')+'<a href="'+esc(origin)+'/builder/?website='+encodeURIComponent(row.websiteId)+'" target="_blank" rel="noopener">Edit original website</a></p>').join('')+'</section>';
}

export function existingRecordingRows(rows,{action='review',attribute='data-cmw'}={}){
 return '<div class="existing-media-recordings">'+rows.map(row=>'<article class="existing-media-recording'+(row.quote?.text?' has-quote':'')+'"><div><p>'+esc(row.recordedDate||row.lesson_date||'Date not supplied')+' · <span class="existing-media-status">'+(row.published?'Published':'Private draft')+'</span></p><h4>'+esc(row.title)+'</h4><p class="existing-media-summary">'+esc(row.summary||'A recording summary has not been attached yet.')+'</p><button type="button" '+attribute+'="'+action+'" data-id="'+esc(row.attachmentId||row.attachment_id)+'">Review recording</button></div>'+(row.quote?.text?'<blockquote>'+esc(row.quote.text)+'<cite>'+esc(row.quote.attribution||'')+'</cite></blockquote>':'')+'</article>').join('')+'</div>';
}
