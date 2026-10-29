# Private media inventory — local, 29 October 2026

This continuation prepares original PDF/recording references. The tools are operator-only: neither Worker nor scheduled recovery imports them. V108.0 remains the deployed checkpoint. No hosted query, real export, byte transfer, attachment admission or publication was performed.

## Source contract

The matching Academy branch supplies `backend/tools/website-media-inventory.mjs`. `openMediaInventory(db, {activityKey, checkpoint, objectNamespace})` requires an explicitly mapped, enabled and reviewed paid Course or monthly Tafseer scope. It reads the three scoped media components in the current immutable accepted head. Admin-only drafts outside that head are excluded. Accepted draft rows stay identified as drafts; live hidden/missing parents and removed links stay unavailable.

Source lesson/asset IDs, session identity, Course run, publication reference, date, revision and historical classes are preserved. Tafseer follows Academy's actual monthly rule: saved lesson class plus the **first** original session row's class IDs. Today's allocation, upload month, title and Surah completion date cannot manufacture recording rights. Dateless Course PDF collections stay dateless. Library, other programmes, comments and Teacher-note versions are excluded.

Shared PDF references resolve with Academy's existing resolver while preserving original attachment keys. An embedded SHA-256 is an expected checksum, not proof that the object exists. YouTube references remain unchanged. MP4 expiry/retention is reported explicitly; expired or invalid source recordings are held, never resurrected. Supply the actual source object namespace for retained paths.

Components are read once per open/resume. Each page rechecks the accepted head, source write version, scope generation/policy and current visibility/links. Concurrent changes discard the page; changed inventories cannot resume an old checkpoint. The conservative global write version can require restarting after an unrelated edit. The inventory digest is an integrity/checkpoint identifier, **not an authentication signature or permission grant**.

Limits: 1,000 accepted lessons, 4,000 rows per component, 20 assets per lesson, 100 classes, 25 lessons/240 KB per page. Existing components have a 1.5 MB bound each. Overflow fails without truncation. Component parsing is private operator work, not request-time Worker work.

The source local command opens an **already available local SQLite snapshot read-only**, with no remote adapter or backup/export action. It writes exclusive 0600 JSON files in a new 0700 `/private/tmp/academy-media-…` directory. Private object keys and recording identifiers must never enter tracked source or public assets.

## Target plan and bytes

`tools/media-import-plan.mjs` accepts one page and explicit `{sourceLessonId, websiteId}` associations. It never matches titles/dates or assumes a source media lesson is the same as a teaching-website lesson. Missing associations are held. Target website/offering existence and ownership must be checked at later admission.

Deterministic assets/attachments retain separate original class audiences. Every generated attachment is `audience=RECORDING,published=0`; website-only Surah grants cannot open it. Draft, hidden, missing, removed, expired and classless Tafseer entries are held. Plans always return `readyToPublish=false`. Their checksum detects changes but authorises no operation.

`verifyLocalMedia(object, privateFile)` streams 256 KB chunks, checks actual size and PDF/MP4 signature, computes SHA-256 and compares any expected checksum. Limits remain 16 MB/PDF and 512 MB/MP4. The receipt binds to the planned object and gives a private checksum-based destination key. Identical bytes share a key while attachments stay independent. Multipart etags are never treated as SHA-256. Verification does not copy bytes or change D1. YouTube has no byte-copy receipt.

The target local command reads a private page and association array, writes an exclusive private plan under `/private/tmp/academy-media-…`, and prints counts only. Neither command can publish or grant rights.

## Verification and read budgets

Five focused tests pass, with syntax/configuration checks on 71 target modules and both source tools. Native disposable Core/Admin D1, target D1/R2 and synthetic files exercise the actual functions. Attachment admission in the test is deliberately synthetic; no production importer exists yet.

| Local operation | Queries | Rows read | Rows written |
| --- | ---: | ---: | ---: |
| Open one scope + four-lesson page | 8 | 70 | 0 |
| Same after 4,000 unrelated component references and unaccepted lessons | 8 | 70 | 0 |
| Target protected PDF | request metadata | 9 | 0 |
| Target protected PDF range | request metadata | 9 | 0 |
| Academy during routine PDF/range/denial requests | 0 | 0 | 0 |

The growth regression caught a JSON-driven head-wide component scan. Explicit table predicates use the existing `(head_id,table_name,scope_key)` index. Fixture budgets are ≤100 source rows and ≤12 target rows per PDF/range, with unrelated growth ≤2 source rows. They are not universal real-course estimates.

An inventory session uses three setup queries plus five per page; reopening repeats setup. Component parsing, object access and checksum I/O also cost work. New scheduled daily D1 work is **zero** because no runtime/job calls these tools. One tested four-lesson inventory plus PDF/range costs 70 source + 18 target rows, excluding sign-in/access sync, setup and deliberate race mutations. Real aggregate migration/traffic/object budgets remain unmeasured.

Tests cover checkpoint/retry, concurrent source edits, private/unaccepted/withdrawn media, original classes, website-only grant denial, missing classes, dateless Course files, invalid references, changed checksum, wrong type, incomplete/oversized bytes, streamed MP4 checks and byte deduplication. Source native inventory covers PDF/YouTube; MP4 verification/expired-item planning use synthetic inputs, not a live MP4 export/playback acceptance.

## Remaining connection stage

Build the private resumable byte-transfer/admission rehearsal with source/target manifests, atomic permission/publication guards, withdrawal/delta recovery and rollback. Resolve display deduplication when one learner owns multiple original classes, and explicitly decide how accepted Teacher notes/immutable versions connect. This inventory excludes notes and Library.

Then the deployment owner can review a small real scoped inventory/transfer proposal. Real associations, object existence/checksums, final source revalidation, target ownership and account parity remain required. Keep Academy serving. Do not deploy older feature checkouts over V108.0 or infer hosted approval from local tests.
