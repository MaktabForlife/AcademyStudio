# Existing collection references

Older Course, Tafseer and MOU websites can be reviewed and referenced by a private native playlist without uploading their recordings or PDFs again. The administrator chooses an existing source website and an already saved private target. Nothing runs automatically on page opening.

## Contract

- Ordinary scoped Admin review: `existing-playlist-review` through the signed Academy proxy, or native `GET /api/admin/:offering/existing-collection?reference=1&website=:source`.
- Fresh scoped Admin save: `existing-playlist-save`, with `operationId`, `playlistId`, `websiteId`, the server-produced `reviewHash`, and the current offering/playlist/website revisions.
- The source and target must belong to the same offering. Unassigned media is excluded. Private source websites are allowed for Admin review; they do not become published.
- Review is bounded to fifty recordings and ten PDF attachment rows, with exact source identities, existing saved summaries/reading bindings and original PDF metadata. PDF size/existence and asset ownership are checked before saving. No Teacher is inferred from text, titles, dates or filenames.
- The save reconstructs the review, compares its hash, and commits all references and its retry receipt in one guarded D1 transaction. The final guard rechecks current identity/session/epoch/authority, source and target versions, full source attachment/object metadata, companion index and source membership. Row-value `IS` keeps null-safe comparisons below D1's expression-depth limit.

## Publication and ownership

Source attachments, asset objects, website publication, subscriptions and grants are unchanged. Monthly playlists receive existing recording memberships and private website-PDF references. Course playlists receive ordered `DRAFT` content entries only, with original summary/source metadata retained in their private snapshots. They do not acquire published memberships.

The existing Course recording publication checks are deliberately preserved. Older Course entries without native recording attribution/companions remain private until their recording metadata is manually reviewed and Save draft succeeds through the existing workflow. The new view keeps Publish content disabled for those reference snapshots. This feature does not make incomplete recordings publishable or fabricate Teacher metadata. Original published websites remain usable throughout.

PDF-only Surahs are valid collections. Truly empty sources are rejected. The feature never creates a target playlist automatically, moves an original attachment, changes an access date, or assigns unrelated/unassigned recordings.

## Cost and tests

A whole collection uses one private reference-save request instead of one save per recording. Its transaction still performs the real indexed guard, membership and audit work; it is not claimed to be one billed row. There is no PDF/MP4 byte copy, new asset object or account-wide scan. Monthly PDF linking may write one new version of the small private target website JSON.

The synthetic 26-recording/one-PDF fixture measured 89 rows read in nine queries for review and 422 rows read in 48 statements/queries for the private save. Adding 2,000 unrelated recordings left review at exactly 89 rows/nine queries. These are local fixture measurements, not a production daily-use estimate.

Focused native, paired Academy/Studio and DOM tests cover exact source preservation, private and PDF-only sources, duplicate/lost acknowledgements, denied/scoped users, twelve-hour review versus fresh writes, missing/foreign assets, stale source versions, unchanged unassigned material and publication blocking. Existing Course and MOU collection regressions also pass. Tests use the no-deletion preload; output is retained.

Local migration 0017_existing_playlist_sources.sql adds an indexed Admin-only source-website relation, including PDF-only monthly sources. No hosted schema update has run during implementation. The local work starts from the verified V109.16 Academy/Studio pair and requires the corresponding Academy proxy/UI changes. Prepared for the approved paired V109.17 release. Applying the additive Studio0017 relation is required before activating this runtime. Actual attachment, conversion and publication remain separate manual actions; the code release changes no acquired rights or source publication. Local deletion is prohibited.
