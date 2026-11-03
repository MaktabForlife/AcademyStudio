import {esc} from './model.mjs';

// The local adapter supplies this only after normal administrator authorisation.
// It carries no media URLs and cannot grant a recording entitlement.
export function localReviewStatus(record) {
 if(!record?.canEdit||!record.localReview)return '';
 const count=record.localReview.unmappedEditorialLessonIds?.length||0;
 const published=record.localReview.edition==='published';
 return `<aside class="sp-local-review-status"><strong>${published?'Published edition':'Private review draft'}</strong><span>The published edition is unchanged.${!published&&count?` ${count} recording ${count===1?'link still needs':'links still need'} confirming.`:''}</span><a href="/?website=${encodeURIComponent(record.websiteId)}${published?'':'&amp;edition=published'}">${published?'Return to review draft':'View published edition'} →</a></aside>`;
}

export function pendingRecordingReview(record,guides=[]) {
 if(!record?.canEdit||!record.localReview||record.localReview.edition==='published')return '';
 const pending=new Set(record.localReview.unmappedEditorialLessonIds||[]),items=guides.filter(g=>pending.has(g.editorialLessonId||g.lessonId));
 if(!items.length)return '';
 return `<section class="sp-pending-recordings" aria-label="Recordings awaiting their links"><header><span class="sp-eyebrow">REVIEW COMPANIONS</span><h2>Recordings awaiting their links</h2><p>The companion readings are available for review. Playback will be added when the Academy links are confirmed.</p></header>${items.map(g=>`<article class="sp-pending-recording"><span class="sp-file-tag">Recording link pending</span><h3>${esc(g.title)}</h3><p class="sp-recorded-summary">${esc(g.summary)}</p>${g.readingId?`<button data-sp="lesson" data-id="${esc(g.readingId)}">Read alongside this lesson →</button>`:''}</article>`).join('')}</section>`;
}
