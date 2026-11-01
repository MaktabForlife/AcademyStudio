# Studio recorded media — local review contract

This feature is local-only. Root owns the final paired Academy/Studio composition, version and release. Building it does not attach, publish, stage or deploy held recordings. The completion receipt and exact paired Source dependency are in `../../outputs/studio-media-linking-20261101/COMPLETION.json`.

## User flow

Studio Admin → named offering → Media. Tafseer uses the existing Surah website; MOU uses the existing `programme_subjects` website; Courses receive media directly, with no invented subject, recording date or timetable session. Monthly recordings keep their actual date and native class/cohort. Class and Teacher labels come from checked native choices, while all stored IDs stay behind the form.

The normal form accepts one YouTube recording link or one MP4, a reviewed processed full summary/topic guide, and optional PDFs/images. A processed `LEARNER_COMPANION_V1` file can populate the form. It does not generate content or expand the source processing/retention policy. Confirm the real duration and review the content against the source. No quote is inferred. Save and attach privately, inspect the full saved companion/current association, then explicitly publish that one lesson. Saved companions and Teacher attribution have separate private editing controls.

The four prepared MOU lessons additionally have their own protected review panel. It shows each original link, complete saved summary/topics and explicit registered Teacher choice. Existing partial Kitabul Adhkar identities/operation receipts are reconciled and reused. Each item has separate Attach privately and Publish controls. No bulk importer, reprocessing or automatic Teacher choice is used. Changed nonempty website/companion drafts, duplicate source associations, changed cohorts or source revisions remain held rather than overwritten.

## Native Teacher trust boundary

`GET /api/admin/:offering/media-options` first checks current Studio Admin scope and committed ownership. Its signed Academy command is:

```json
{
  "sourceRef": "native session reference",
  "offeringId": "exact mapped offering",
  "purpose": "ADMIN_MEDIA",
  "teacherIds": ["optional: one to ten distinct checked native account IDs"],
  "issuedAt": 0
}
```

The exact Source dependency is `c1de7561a76b3d7efbc7c194d4f7a1506117d5cc` from `../Academy-content-media-context`, including its existing scoped-read prerequisites. The existing transport supplies the actual timestamp and HMAC for `POST /internal/website/media-teachers`. The Source owner resolves the exact enabled offering map, rejects a frozen map, verifies the current native session/credential epoch/admission and scoped or Global Admin authority, and runs its native Teacher/class selector behind current actor proof. The response is `NATIVE_MEDIA_TEACHERS_V1` with `offeringId`, `activityKey`, `teachers:[{id,name}]`, `classes:[{id,name}]`, `selectedTeacherIds`, `teacherRequired:true`, `optionsRevision`, and `checkedAt`.

Studio checks response scope, age and bounds, and rechecks its local actor after the await. Explicit attach, attribution save, companion save and publication revalidate native Teacher choices; a cached picker is never write authority. Final local transactions fence session/revocation/epoch/freshness, scoped Admin role, committed ownership, exact media parent/association and relevant revisions. No learner request calls this endpoint. The Source and Target accounts have no cross-account atomic transaction; native choices are checked during the signed command, and delivered local invalidation is checked again in the Target transaction.

`recordedContext` uses `RECORDED_MEDIA_CONTEXT_V2`: `offeringId`, kind/programme key, exact `mediaIdentity`, `classIds`/snapshotted `classNames`, native subject identity, native `teacherIds`, snapshotted `teacherName`, and `attributionSource:'NATIVE_TEACHER_ACCOUNT'`. It is display/grouping metadata. It never writes staff roles, participation, purchases, paid months, grants, session audiences or enrolment. A Teacher need not have been imported as a local learner account. Historical stored IDs/labels remain in saved editions even if the current picker later omits them; a new write still requires current checked choices.

## Storage and migration

Apply additive Target migration **0011_media_attribution.sql after 0010**. It creates:

- `media_attributions(attachment_id PRIMARY KEY, revision, draft_json, published_json)`.
- `media_supporting_files(recording_attachment_id, support_attachment_id)` with a composite primary key and a unique supporting attachment ID.

There is no backfill or rewrite of existing rows. Attribution revisions are separate from the existing `recording_companions` revisions. This preserves the original four prepared companion hashes/source revisions and the earlier Kitabul Adhkar receipt payloads. Putting Teacher fields into the canonical companion instead would change those reviewed hashes and conflict with existing saved-draft/retry checks. A D1 row also permits attribution + exact companion + recording + supporting-file publication in one guarded transaction, without per-card R2 reads. No permission-bearing Teacher column is added.

Existing companion keys remain `websites/:website/recordings/:asset/companions/:sha.json`. New direct-Course companions use `offerings/:offering/recordings/:asset/companions/:sha.json`; they retain `LEARNER_COMPANION_V1` and the existing gated reader. Their source revision hashes the actual immutable asset/provider identity. Original provider data and successful-upload/retention clocks are untouched. No timer or retention policy is introduced.

Supporting files remain separate native attachments with the same exact parent, lesson, original date/cohort and RECORDING audience. New attachment IDs must be distinct and absent; saved attachments cannot be upserted by a racing retry. Publication verifies their association and publishes them with the one primary lesson. Every playback/file request still goes through the existing native media gate. Website-only grants cannot acquire these monthly recordings or their supporting files.

Rollback preserves these additive tables, immutable objects and current acquired rights. Earlier code can ignore attribution/support links; do not drop data, reset original media or reverse ownership as code rollback. The old reader can still follow published companion keys and native material gates.

## Studio routes and integration hooks

All routes below require an authenticated current scoped Admin; content writes also require Studio ownership.

| Route/action | Purpose |
| --- | --- |
| `GET /api/admin/:offering/media-review?after=...` | Bounded website/media metadata, without participant/month-roster reads |
| `GET /api/admin/:offering/media-options` | Fresh native Teacher/class labels and existing subject choices |
| `GET /api/admin/:offering/media-detail?attachment=...` | One exact saved recording, full bounded companion, attribution and supporting-file names |
| `POST media-attach` | Private native primary/support attachments and checked Teacher context; no timetable |
| `POST media-companion-save` | Exact source-associated private companion through the existing native companion contract |
| `POST media-attribution-save` | Checked Teacher correction with its own expected revision |
| `POST media-publication` | Exact saved companion/attribution/source/support publication in one guarded transaction |
| `GET /api/admin/:offering/prepared-recordings` | Protected four-item private catalogue and bounded reconciliation facts |

The prepared orchestrator preserves its original registration-before-shell-publication and exact companion/native step receipts. Regular new lesson publication accepts `companionRevision`, `companionKey` and `sourceRevision` and atomically advances the companion with its other publication state. Existing native endpoints remain compatible.

The learner media DTO adds only published, association-matching `recordedContext` and explicitly related published `supportingFiles` after the existing rights filter. Teacher grouping uses native programme/class/subject/Teacher IDs, not title/name inference. No unpermitted recording is counted or used to construct a group.

`public/shared/media-admin-panel.mjs` is the functional named form. `media-workflow.mjs` keeps hidden source/attachment/upload/retry identities and resume steps. `media-attachment.css` is scoped to `.studio-media-attachment`/`.studio-media-prepared`, using the Circles owner's quiet cream/plum form contract. `admin.mjs` exports `canLeave()` and `close()`; preserve the small `app.mjs` workspace-leave and Admin-close hooks during full UI composition. Account/session generation changes always discard private browser state. Delayed route/offering responses cannot restore a disposed panel. Cancelling a leave preserves unsaved values; uncertain saves retain their exact pending input/IDs. A saved incomplete companion can be reopened and completed without replacing its source.

The independently authorised MOU playlist/date/subscription layer is Circles-owned and follows this frozen media patch. It is not implemented here. Its explicit playlist-month contract must be composed and tested separately, without inferring access from these recording metadata fields. Current individual recording-month/cohort gates are preserved; no Tafseer rule is changed by that discussion. Any completion-date/Access table is owned separately by Circles. This patch does not edit `src/admin.mjs` or `src/mou-classroom.mjs`, invent subject completion dates, change nullable ongoing Baqarah, or implement a second Access table.

## Private catalogue staging — root release step only

The already prepared local catalogue is:

- File: `local-content/mou-manual-review/catalogue.json` (outside public assets).
- SHA-256: `1986944d879c1cea4bc63964ebab8a12126de6698e543c04f5ea8240d19c59ef`.
- Private CONTENT key: `admin/prepared-recordings/PRG-656bcece-4310-49c7-87d7-ee06756f66c1/mou-v1.json`.
- Target bucket: `academy-studio-parallel-content`, existing dedicated Studio account.

`tools/prepare-mou-review-catalogue.mjs` is a pure local validator/packager. It reads the reviewed package from `../../outputs/academy-release-1092-20261031/mou-native-guarded-package-20261101.json` and writes private JSON; it cannot upload or execute native requests. Formatting differs from the pretty original input, but the parsed reviewed package is unchanged.

After independent review and coordinated Source/schema/runtime composition, root's existing conditional release approval covers staging this exact private Admin catalogue. Stage it only to the private key, with JSON content type, through the pinned Studio account/configuration. Do not put it in public/static assets, run the old importer, attach/publish any lesson, choose a real Teacher, or reset prior partial receipts. After activation, use one small scoped Admin read to reconcile the current native state; known conflicting saved edits stay held. Actual Teacher selection, private attachment and publication remain the user's explicit per-lesson actions.

## Verification and known limits

Final logs, hashes, frozen public-asset deltas and Source-pair measurements are saved in the completion directory. The focused suite covers new Teacher/permission/retry/race checks, original Baqarah/month-vs-website rights, full companion preservation, new direct-Course keys, MP4/supporting-PDF resumes with unchanged upload time, atomic publication, stale Admin edits and bounded reads. Browser acceptance runs the actual local Worker/D1/R2 and modules at 1440/390px, plus native full-app Home/dirty-form lifecycle; all browser external traffic is blocked.

The broad legacy suite has nine failures also reproduced on the untouched starting commit `6ce40bb` with the same older default Source fixture (navigation/completed-Course contract mismatch). They are recorded separately from product failures and must be checked against the final composed Source/Target candidate by root. No all-green combined-release claim is made from that fixture. Source signed Teacher acceptance is a separate explicit dependency test, not a mocked-choice claim.

No deployment, hosted SQL/R2, attachment/publication, permission/grant edit, push, DNS, date diagnosis or production login occurs in this work.


### Measured final local checks

- Focused media suite: 37/37 pass. Actual signed Source/native split fixture plus actual Source+Target workerd pair: 2/2 pass on Source `c1de7561`.
- Final complete legacy suite: 284 checks, 264 pass, 9 baseline-proven failures, 11 skips. The explicit Source-pair tests are run separately with their pinned dependency, rather than silently using the older default Source.
- Two-workerd picker: Target 24 rows / 13 queries before and after 1,000 unrelated Source accounts/roles. Source 185 rows / 22 queries initially, 263 / 30 immediately after the source write invalidated the native account cache, then 182 / 22 on the warm repeat. The native Teacher/class selector itself stays 63 rows / 7 queries in all three cases. Per-statement native D1 metadata, including direct Core and coordinator queries, is saved; these are local scan observations, not hosted billing claims. The designation registry is a related candidate catalogue and can scan itself; no bound on arbitrary growth of that catalogue is claimed.
- Prepared private read: 40 rows / 11 queries beside 1,000 unrelated local accounts/rights. Exact attach and published-item retries perform zero D1 writes. Complete per-action guard/trigger/write totals are in the saved budget JSON.
- Browser: 1440/390px forms, full saved summary/topics, supporting PDF, one lesson publication, lost acknowledgements, dirty cancel, stale tab/account cleanup, and native full-app Home lifecycle. Syntax/configuration and local-only Worker packaging pass.
