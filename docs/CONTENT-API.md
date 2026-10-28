# Local content interface v1

This contract is for the separate website platform on `feature/website-platform`. The content/editor chat owns the nine independent content packages and both editing modes. Web migration owns identity, provisioning, operational rights, synchronization, scheduling gates and the backend. Do not edit another chat's active checkout. Branch from a committed local baseline and coordinate interface changes.

## Content and storage

- `websiteId` is the stable publication/address identity, independent of the content model's `document.id`. Do not regenerate either identity, lesson/section/reflection IDs or asset IDs during conversion.
- The initial reader/editor model is `ACADEMY_COURSE_STUDIO_V1`, reused from Studio `a639da30`. Shared validation lives in `public/shared/model.mjs`. This currently bounds the editor document to 500,000 characters and a serialized R2 edition to 1,500,000 bytes. Propose schema/size changes explicitly; do not truncate teaching.
- Drafts and accepted bodies are immutable JSON objects under `websites/<encoded websiteId>/versions/<sha256>.json`. Small D1 records hold draft/published pointers, the optimistic revision and accepted metadata/history. `src/content.mjs` is the storage boundary; editor code uses the HTTP contract, never R2/D1 directly. Each website is saved/published independently.
- `document.pages.assessments` is false for migrated offerings. No attendance/assessment or Journal implementation is introduced. Device learning state is separate from published content.
- The HTTP reader returns the model as `document`, not a wrapper embedded inside it. Legacy portable bundles (`{format,course,assets}`) are input artifacts, not API responses. Their embedded bytes/reference mappings need an explicit migration step; retain old published versus latest reviewed draft separately.
- Current and old protected asset URLs are always re-authorised against current local rights and publication. An old URL is never a revocation bypass. Do not cache private API responses or persist them in a service worker.

## Website endpoints

All mutations use the same-origin Secure HttpOnly website cookie and require exact `Origin`. Browser code must not send Academy bearer tokens. The single Academy sign-in establishes this cookie. Local error bodies are `{success:false,error,code}`. Permission loss ends the view; account switching must clear unsaved private state/object URLs. Failed saves retain the user's draft for an explicit retry.

| Request | Contract |
| --- | --- |
| `GET /api/me` | `{accountId,displayName,globalAdmin,verifiedAt}`. No credentials, payment notes or raw Zoom destination. |
| `GET /api/websites?after=<websiteId>` | Account-scoped discovery, at most 50 results, with `more`. Direct reads remain the authority gate. |
| `GET /api/websites/:websiteId` | Entitled published reader: `{websiteId,offeringId,revision,document,assets,enabled}`. No private draft. |
| `GET /api/websites/:websiteId/edit` | Scoped Admin private draft with the same shape. This is the shared source for the full builder and on-page text editor. |
| `POST /api/websites/:websiteId/edit` | `{operationId,revision,action:'save',document}`. Returns `{websiteId,revision,action}`. Save advances revision and private draft only. |
| Same POST, `action:'publish'` | `{operationId,revision,action:'publish'}` publishes the saved draft explicitly, advancing revision again. It never publishes lesson-recording drafts. Referenced website-only PDFs/images are accepted with this website edition. |
| Same POST, `action:'withdraw'` | Disables current reader and website-asset delivery, retains draft/bodies/history, and advances revision. |
| Same POST, `action:'restore'` | Also supply `historyRevision`; restores an existing edition as a new private draft. Explicit review/publish is still required. |
| `GET /api/websites/:websiteId/history?before=<revision>` | Scoped Admin bounded metadata history. No arbitrary object-key endpoint. |
| `GET /api/websites/:websiteId/export` | Current Admin draft and reference metadata. Portable-package export must retain file references rather than fetching another copy of every PDF/recording. |

Use one operation UUID for one exact actor/offering/website/payload and retain it across uncertain retries. Do not regenerate it after a timeout. A successful retry returns the original result with `replayed:true`; changed payload/scope or stale revision returns 409. The mutation's database guard rechecks current account/session/scope and revision atomically. R2 is written first, so a failed object write cannot advance pointers and a failed guard leaves only private unreferenced objects.

Reader/edit/export responses also include `canEdit`, `draftVersion` and `publishedVersion`, derived from the already-read role and object pointers. `canEdit` means Global Admin or scoped ADMIN; Teachers cannot edit. Version labels are object filename hashes, or `null` before an edition exists. Use these fields instead of extra permission/history requests. The server independently validates the content allowlist in `src/content-package.mjs`, rejects unknown/private/operational fields at every model level and rejects raw Zoom URLs in text. Propose editorial schema extensions explicitly. Referenced website files are checked in one scoped batch query.

Accepted existing editorial provenance: Course/lesson `sourceEdition:boolean`; lesson `accent:string` (100 characters), `moduleId:string` (180), `journal:boolean` (chapter flag only, never entries); section `sourceKey:string` (1,000), `sourcePages:integer[]` (up to 1,000 positive page numbers); block `sourceKey:string`, `sourcePage:integer`, `legacyNoteKey:string` (1,000). Original note keys support explicit browser-state continuity. Page numbers are 1–100,000. No personal answers or journal entries belong in these fields.

## Assets and media

- Website responses expose assets as `{attachment_id,asset_id,lesson_id,name,type,size,title,url}`; `url` is a protected attachment URL. Normalize these field names in the editor adapter, not in content IDs.
- `GET /api/media/:attachmentId` supports one byte range for PDFs/MP4s. `?draft=1` requires current scoped Admin authority. YouTube metadata contains the validated video ID; no extra recording rights are inferred.
- Upload an image/PDF with `PUT /api/admin/:offeringId/files?assetId=...&operationId=...&filename=...`. Raw file body. PDF limit 16 MiB, image limit 5 MiB; type is checked by bytes. The response is `{assetId,type,size}`. Existing IDs/objects are reused by reference; upload is not publication.
- MP4 uploads use `POST /api/admin/:offeringId/recording` with `action:'start'`, `operationId`, `assetId`, `filename`; bounded `PUT` parts with `assetId`/`partNumber` in the query; then POST `action:'complete'`, the same `assetId`, a new exact operation ID and `{partNumber,etag}` parts. Stored recordings use a retained namespace with no application expiry.
- Attach an owned file via `POST /api/admin/:offeringId` with `action:'attachment'`, `operationId`, `attachmentId`, `assetId`, optional `websiteId`, stable `lessonId`, original `lessonDate`, `cohort`, `title`, `audience` and `published`.
- `audience:'WEBSITE'` is for PDFs/images linked to that website and its accepted reference list. It cannot contain MP4/YouTube recordings. `audience:'RECORDING'` also covers original lesson-month notes/PDFs: whole-Course purchases or the original Tafseer month/cohort authorize it. Additional Surah grants do not.
- Native file metadata is scoped by `asset_owners`. Cross-offering reuse requires an explicit authorised inventory/ownership mapping. Never guess mappings by filename, teaching title or names. Embedded legacy Academy references are rejected until that mapping is provided.
- Keep full Surah completion dates through `completionDate` (`YYYY-MM-DD`) and the `completion-date` Admin action; derive the eligibility month from the date. The month-only compatibility field is for synthetic/legacy unknown-date records and cannot replace a known exact date.

## Separate operational interfaces

The four Admin sections share `GET/POST /api/admin/:offeringId`. Supported actions currently include `participant`, `paid-months`, `staff` (Global Admin only), `surah-grant`, `website-create`, `completion-date`, `card`, `attachment`, `youtube`, `enrolment-decision`. New identity work uses `/api/offerings/:offeringId/provision` and `/resume`; these interfaces are owned by web migration. Do not put participants/payments/roles into a content package.

Stored timetable cards use `GET /api/offerings/:offeringId/sessions`. `POST /api/offerings/:offeringId/join` accepts `{sessionId}` and releases the private `destination` only after local current-live entitlement and five-minutes-before/until-end checks. Session lists, public homepage facts and content packages exclude raw Zoom URLs. Corrections/cancellation use stable IDs and do not retarget attachments.

`GET /api/offerings/:offeringId/media?website=<websiteId>&after=<attachmentId>` optionally filters only explicit attachment `website_id` matches and validates the website/offering. Results include `attachment_id,asset_id,website_id,lesson_id,lesson_date,cohort,title,audience,type`. There is no inferred title/date binding. Unbound historical recordings remain available through the offering feed under their original rights; the migration inventory must supply explicit website/lesson/session mappings before claiming website-specific completeness. `lesson_id` currently represents the supplied stable lesson/session identity, not a guessed timetable association. Tafseer discovery starts with this account's indexed paid months; it never scans all unpaid recordings to find eligible rows.

`GET /api/library-return?website=...&lesson=...` builds a fixed Academy Library destination with a bounded website return address. The remaining Academy Library close/back integration must be verified before claiming a full round-trip. Free Foundations stays publicly accessible in Academy while its page-location decision is open.

## Local integration evidence

The native test fixture can run the current Academy authentication implementation and the new disabled source connector against disposable split Core/Admin stores. It does not use hosted credentials or data. `tests/academy-integration.test.mjs` proves single PIN sign-in, website cookie establishment, one-use return to Academy and queued suspension delivery. The prototype's tests and this local contract are not production acceptance or deployment approval.
