# Independent MOU playlists — local composition

This implements the owner's 1 November OPEN/CLOSED clarification. It is local code, not an instruction to attach, map, publish or change hosted rights. Root owns the final same-version Academy/Studio release.

## Admin workflow

Admin dashboard → Access Management → Mothers of the Ummah provides the existing student/month matrix and a separate Playlists table. Names are arbitrary; a playlist has no Academy subject binding. Leave its close date blank while adding weekly recordings. Admin enters the close date when the playlist is complete and creates the next playlist manually. No job closes or creates playlists automatically.

An OPEN published playlist uses the **current server month in the native programme timezone**, recomputed on each protected request. A CLOSED published playlist uses its **close date's month**. Either qualifying paid month opens all published member recordings and associated supporting files, irrespective of their original recorded dates/classes. Website-only months remain text-only. Publication and live Join remain separate gates; a card or highlighted circle segment grants nothing.

Each regular/prepared lesson explicitly selects a playlist and checked registered Teacher(s). Original recording date/class/asset/lesson identities remain unchanged. Save/Attach privately and Publish this lesson are separate actions. Publishing a recording does not publish its playlist. The playlist requires a separate explicit publication action. New sources are not duplicated. Historical native recordings can be referenced with the checked `mou-playlist-add` action without moving their assets, changing their parent or withdrawing their old endpoint rights.

The older four-lesson bulk import is review/preflight only. Its execution helper cannot attach/publish; the per-lesson prepared review preserves original private partial identities and exact operation receipts. Real four-MOU and two-academic publications remain held/manual.

## Acquired rights and date corrections

Closing an OPEN playlist does not create permanent aliases for earlier open months. A later correction of an already-CLOSED qualifying month snapshots only actual current old-month holders, in the same guarded transaction as the date change. Later old-month payments do not inherit those rows. Paid and website-only retained rights are distinct. Last paid-cohort removal deletes recording retention even if text-only access remains; removal/regrant does not resurrect it. Source projections use set differences so an unchanged continuous month is not falsely revoked during refresh.

Correction previews cap at 250 distinct holders and 1,000 raw paid/cohort rows. A larger change stops without date/retention/receipt writes and requires a separately reviewed grouped workflow. Generic Surah date actions cannot bypass correction review. Tafseer continues using its existing completion-date process and original recording month/cohort rules. Short Courses retain whole-course purchase access without month grids.

Current native session, account/epoch/admission, Global/scoped Admin, offering ownership/revision, exact retry, publication and asset gates remain in force. No stored credential, idle polling, per-card Source verification or population sweep is added. Twelve-hour account/live and 60-second sensitive Admin proofs are unchanged.

## Additive schema and rollback

Target `0012_mou_playlists.sql` creates independent playlist membership, private-media markers, sparse retained rights, bounded lookup indexes, date correction fence and cached recording counts. It backfills/moves/deletes no legacy Baqarah binding, recording, right or media. Original Baqarah remains on its current path until an explicit reviewed mapping.

Apply schema before the new Target runtime. Pair Source UI/commands with the matching Target code. The initial release contains no new hosted playlist mapping or publication, so the previous pair can still serve unchanged legacy content. **After any real new playlist/private-wrapper/playlist-only recording is published, an old V109.3 Target runtime is not a compatible rollback:** it does not implement the new playlist gate. Keep a compatible Target permission runtime (and matching Source) or separately review withdrawal before an older runtime. Never drop0012, delete rights/media or silently revert the new access rule. Root's release/rollback review must check this condition and preserve the manual content hold throughout pair activation.

## Local evidence

`tests/mou-playlists.test.mjs` exercises real paired Workers/D1 for open/current vs old recording month, explicit closure, no automatic next playlist, corrections, actual-holder vs later-subscriber retention, multi-cohort revocation, whole source/summary/PDF delivery with signed native Teacher/class choices, stale/generic-date/raw-attachment denial, and bounded reads with4,000 unrelated rights. It also exercises the actual SQL gates across the SAST month boundary with an unchanged account proof.

Prepared workflow tests verify separate private/public steps, lost acknowledgements, account/draft/source/cohort guards, original partial operation receipts and unchanged Baqarah. Source UI tests cover exact retries, independent drafts and account clearing. Browser review uses disposable9080/9081 data; the user's earlier9065 unsaved matrix is preserved. Desktop1280 and phone390 have no document overflow; the table scrolls inside its own container. These are local checks, not production acceptance.
