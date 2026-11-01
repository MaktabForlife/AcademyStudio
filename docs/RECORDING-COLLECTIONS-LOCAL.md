# Recording collections — V109.2 integration handoff

This branch starts at the verified Target V109.1.1 `cd71a919`. It does not include Circles’ later homepage/course/dashboard edits. Optimisation owns the combined V109.2 release and current authorised native MOU execution. This chat has made no hosted application/data/schema/publication change or push.

## Native changes

MOU keeps all ten approved subject identities, Baqarah and its 26 original recordings. A single bounded subject query preserves staff, retained website-month/text admission and explicit website grants separately from paid-month/cohort recording rights. Text-only navigation does not grant recording names, counts or companions. Cards open lists; Listen opens a recording page with the player at the top, a collapsed topic guide and clear list/subject back routes. Existing Course/Surah collections use the same list/detail pattern. Optional zero-to-many readings remain available; recording-only subjects need no artificial web reading or timetable session.

The list uses the full saved summary. No shorter summary is generated or stored. MOU prose and academic bullets are retained. Optional quotations have a wide-screen side area and flow below on narrow screens; empty areas are omitted. Timestamp seeking reuses the authorised player. MP4 playback rejection provides a Play instruction, and YouTube requests never claim that playback started.

Companion content is private per-website/per-recording R2 JSON. D1 holds small pointers, revisions, duration and the exact published summary index. Save stages metadata through the current native authority/retry guard before writing its immutable object, so failed/stale guards create no untracked R2 draft. Publication selects an exact source/draft revision and preserves the previous publication through later draft edits. `learnerCompanion` explicitly projects fields and supports raw reviewed drafts AND canonical `LEARNER_COMPANION_V1` resaves. Canonical reference/quotation arrays survive; private evidence and unverified raw quotation candidates do not.

## Package and native execution

1. Apply the combined tested V109.2 runtime and Target migrations `0009_recording_companions.sql` and `0010_mou_subject_catalogue.sql`. The latter expands the subject-key constraint while copying every existing binding and retaining its triggers.
2. Open `/import/` in the current authorised scoped native Admin session, select the prepared template, and use **Export current MOU source preflight** for the narrow GET described in `outputs/academy-recording-collections-20261031/mou-source-preflight-request.json`. This reads four exact source references, current subject pointers and MOU ownership/cohort facts; it does not load the participant/month dashboard.
3. From this worktree run `node tools/native-mou-attachment-package.mjs ../.. FRESH_PREFLIGHT.json NATIVE_REQUESTS.json`. This is a pure planner; it does not authenticate, fetch, process or execute requests. The reviewed illustrative request template is **not** a fresh production preflight.
4. Select the generated file on `/import/`, review the four complete saved summaries/dates/durations and reference counts, then click **Attach and publish four reviewed MOU lessons**. The native importer checks current preflight state, account/generation fences and exact retries before running the bounded sequence. It never auto-runs when a file is selected. There are 32 requests when all four websites/assets are new; existing assets are reused and existing published subject websites are preserved. Existing source associations or unpublished subject drafts require reconciliation, not overwrite. Each request has a stable retry receipt. An operation remains manual; this package contains no processing/reprocessing command.
5. The native create-only guards prevent attachment/card races. `recording-publication` changes only the publication bit after exact asset/site/lesson/date/cohort and source/publication-pointer checks. It does not rewrite attribution, source identity, summary or access.

The MOU programme is `PRG-656bcece-4310-49c7-87d7-ee06756f66c1`. The expected cohort is the existing saved native `CLS-39751608-d213-4c66-a4d5-dccfbbeb1c57`; the fresh preflight must confirm it. Baqarah remains website `111efc1d-9c72-4105-977a-5a5ef699ee8f`. These are existing identities, not permissions created by a card.

## Six prepared outputs

| Prepared lesson | Local state | Hosted execution state |
|---|---|---|
| demo-mou — Kitabul Adhkar, 28 October | Attached and exercised through native local guards | Ready for the guarded MOU package |
| trial-u52VHy1Qnxs — Shamail, 26 October | Attached to reviewed Shamail identity; title conflict retained privately | Ready for the guarded MOU package; no automatic title matching |
| trial-jWocCuATE14 — Ihya, 22 October | Attached; three held references and the fragmentary quote excluded | Ready for the guarded MOU package |
| trial-zIraH_F2Doo — Madarij, 21 October | Attached to the approved subject key | Ready for the guarded MOU package |
| demo-mishkaat — Year 4, 27 October | Prepared original companion/MP4 reference | Aalimiyah scope confirmed; exact native class/module/historical teacher/session and successful upload time still required |
| trial-usul-20261028 — Year 4, 28 October | Prepared original companion/MP4 reference | Same scope; timetable mapping explicitly held, never inferred from 07:45 |

All six reuse the original prepared content; no AI processing occurred. All six audio-unverified selected MOU quotation candidates remain private, and zero quotations are published in this batch. Published reference counts are 25 / 16 / 11 / 3 for Kitabul Adhkar / Shamail / Ihya / Madarij. Raw source statuses and excluded material remain in the separate local private review objects.

## Exact static composition

Run `node tools/prepare-recording-release.mjs`. It copies only eight Target native paths and five Source native paths to ignored `local-content/recording-release/{target,source}` and records hashes in `overlay-manifest.json`. Apply these paths to Circles’ final combined frozen native trees; do not replace its root homepage/dashboard files or deploy raw `public/`. No prepared lesson payloads, MP4s, transcripts, review bundles, sample identities or fixture adapters are included.

The paired Source branch is `feature/academic-recording-collections-20261031` in `../Academy-recording-collections`, based on frontend `2aaba295` with backend runtime `18ed9708` unchanged at that base. Its actual split Core migration is `backend/migrations/academy-core/0020_recording_companions.sql`; `academy/0045_recording_companions.sql` is the monolithic fixture counterpart, not a second live migration. Source Worker/coordinator must use matching source metadata modules.

## Local verification and costs

Fifty native Target regressions and the two added importer/migration checks pass locally; the eight focused checks include the six attachment/payload cases plus those two new checks. The final receipt and logs are under `outputs/academy-recording-collections-20261031`. The selected-source preflight uses 5 local queries, 16 rows read and no writes. A MOU recording list uses 6 queries / 65 rows read / 0 writes; detail uses 3 / 8 / 0. Adding 1,000 unrelated recording/companion rows leaves the selected list cost unchanged. The 32-request four-MOU rehearsal uses 348 measured native queries, 440 rows read and 384 rows written, including audit/retry/guard/index/trigger work; retries are tested separately. These are synthetic local workflow measurements, not hosted/daily estimates. No per-user grant or all-site snapshot is regenerated.

Local preview: `node tools/serve-recording-collections.mjs`, then `http://localhost:9042`. It uses disposable native guards with the unchanged saved Baqarah package. Academic MP4s are streamed from the original local files without copying them. The preview adapter/identities and private academic review route are never release assets. Desktop and 390 px frame navigation were inspected; 21:44 seeks to 1,304 seconds. No production login, learner acceptance, live source full-audio verification or hosted attachment is claimed.

## Source coordinator dependency

The separately hosted `academy_split_coordinator` Worker consumes `backend/src/academy/separation/layout.js` and `columns.js`, including the new Core companion table. Deploy it from the SAME Source commit as the Academy API during optimisation’s combined V109.2 release; updating only the API is insufficient. Preserve its existing two D1 bindings and Durable Object class. The local split fixture builds both from the candidate source and therefore does not establish compatibility with an older hosted coordinator. This chat does not deploy either Worker.
