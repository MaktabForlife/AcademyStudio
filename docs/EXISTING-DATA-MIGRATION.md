# Existing data migration — 30 October 2026

Later authorised connection: the 49 copied originals are now enabled through their existing protected media routes, with 43 exact website attachments and six retained programme-only recordings. No new media, teaching edition or access policy was added. See [EXISTING-MEDIA-PUBLICATION.md](EXISTING-MEDIA-PUBLICATION.md) for current source/byte checks, the activation receipt, recovery and remaining account-specific acceptance. The private-import sections below retain the earlier unpublished-stage evidence.

This phase moves existing Academy data. New course/content creation, review-draft promotion and UI changes are deferred, as requested. The migration does not create accounts, change purchases/grants or replace saved teaching editions.

## Existing data covered

The private package covers the nine existing websites and all 49 accepted references in the supplied source copy: eleven original PDFs (42,636,883 bytes) and 38 original YouTube references. Videos remain references; their bytes are not downloaded.

Thirty-two recordings have exact website associations. The six other existing Tafseer recordings now have explicit programme-only associations with `website_id=NULL`. They keep their original offering, lesson, date and historical class audiences. They require recording rights; a website-only Surah grant cannot open them. No Surah association or recording guide is guessed. The general planner still holds media when no explicit association is supplied; programme-only selection must name an exact lesson and asset.

The thirteen unmatched reader companions remain unlinked. They do not prevent preserving the 38 native Academy recordings. Seven standalone drafts, the richer review-draft editions and new course creation are excluded from operational admission in this phase. Mothers remains at Academy. Saved published and private-draft pointers, original artwork and existing Foundation public access remain intact.

Final private package: parent `outputs/circles-existing-data-migration-20261030/prepared-final/`. It contains `private-media-plan.json`, `summary.json` and a private resumable `staged/` package. Source bundle SHA-256 remains `0089e4215af31005f065e4b385bf5a31939dd5f9163102b3b2aef57414fadd52`. Never serve this directory publicly.

```text
node tools/prepare-existing-data-migration.mjs <private-academy-copy-directory> <new-private-output-directory>
```

## Admission and recovery

`tools/migrate-existing-media.mjs` implements admission, activation and retirement for existing target websites/offering scopes. It is restricted to local Academy-authoritative bindings, has no HTTP route/hosted launcher and uses the existing `Store.mutate` authority/transaction guard. No new runtime table, application workflow or scheduled job is added.

Before admission it verifies private PDF bytes and reuses exact target objects. An immutable conditional put never overwrites a conflicting object; target bytes are read back and checked by SHA-256. Recording identities remain unchanged. [R2 conditional operations](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/#conditional-operations) supply the non-overwrite primitive. PDF memory use is bounded to the existing 16 MB limit, one object at a time.

The adapter reopens the current source inventory and compares the accepted snapshot, asset identities, dates, original audiences, publication, visibility and links. It checks existing target ownership and the exact published document bytes. The target transaction then guards observed website revisions/pointers, object/attachment metadata, ownership, offering kind, source access version and current administrator authority. Changed or missing target/source data rejects the import. An imported attachment initially remains unpublished.

Activation repeats source/target/byte verification before opening the already-published source material. Exact retries use the existing operation journal without duplicating records or rereading Academy. Rollback retires the run, closes only availability introduced by that run, and retains original bytes, metadata, editions and rights. A publication that existed before the migration stays published during rollback. Explicit withdrawal can close all selected source attachments. A retirement receipt permanently blocks a delayed activation from reopening the retired run. Fresh Global Admin recovery remains available if the source offering closes.

These are migration operations, not a new-data entry path. This application-session adapter stays local-only. The separately approved account-owner import below uses a distinct control-plane transaction; synthetic sessions and copied snapshots never become hosted application authority.

## Verification

Thirteen focused checks pass. Native tests use the deployed V108 Academy runtime with synthetic identities and disposable Core/Admin and target databases. They cover interrupted copy/retry, source changes, conflicting ownership, concurrent target edits, hidden/removed media, website-only denial, original month/class rights, rollback, programme-only recordings and refusal to create a website or run against hosted bindings. Syntax/configuration checks pass on 124 modules with deployment disabled and local bindings.

The actual copied-data rehearsal loads the nine original target websites/drafts/publications and artwork, then imports and opens all eleven PDF ranges and all 38 recording references. It verifies that accounts, purchases/grants, website/history pointers, offerings and original artwork remain unchanged. It rolls the import back and confirms that all introduced recording availability closes while every original PDF remains recoverable. It creates no course or teaching content and promotes no review draft.

This copied-data rehearsal replays the archived source pages as explicit fixture data. It is not a current production-source attestation. Its synthetic access records are not exported or imported into a real account. Evidence: parent `outputs/circles-existing-data-migration-20261030/final-rehearsal/existing-data-rehearsal.json` and `focused-tests.txt`.

| Local operation | Queries | D1 rows read | D1 rows written |
| --- | ---: | ---: | ---: |
| Actual-copy admission of 49 media objects/attachments, including exact retries | 175 | 309 | 798 |
| Synthetic existing-object admission, before/after 4,000 unrelated objects/attachments | 13 | 50 | 7 |
| Synthetic current source revalidation for one four-lesson fixture | 8 | 70 | 0 |
| Protected PDF range in native tests | request metadata | 9 | 0 |

The actual-copy totals are measured target admission work, including guards, operation/audit receipts and indexes. They exclude fixture setup, later activation/rollback, filesystem/R2 verification and a real source preflight. Its archive replay makes no source database calls. Routine target media never calls Academy. These numbers are not a complete migration/production traffic forecast.

## Read-only preflight and approval

A bounded live source preflight confirmed that both accepted scopes still match the copied head, source write version, generation, offering/kind, reviewed policy and all six component ids/digests. It read 42 source D1 rows and wrote none. Component scope-key comparison follows the source database's case-insensitive identity semantics; complete component identities/digests still match exactly. The existing source operator sign-in was refreshed without collecting a user's Academy PIN. Evidence: parent `outputs/circles-existing-data-migration-20261030/source-preflight-verified.json`.

Automatic approval review initially rejected the target preflight because sending the copied identifiers to the website Cloudflare account needed explicit approval. You then approved that read-only preflight. It completed with 122 target rows read and zero written: all nine saved draft/publication pointers match, both Academy-authoritative scopes remain enabled, and none of the 49 proposed asset or attachment identifiers is present. Evidence: parent `outputs/circles-existing-data-migration-20261030/target-preflight.json`. Combined source/target preflight use was 164 rows read and zero written. This does not include object-byte verification or authorise an import.

The concrete proposal is parent `outputs/circles-existing-data-migration-20261030/private-import-proposal.json`: copy/verify the eleven PDFs and admit the 49 original media/ownership/audience records as private, unpublished attachments. You then replied **continue** to this exact hosted-import approval request. That separate approval authorises the completed import below. It does not authorise publication, new teaching data or a UI deployment.

## Approved private import completed

The real parallel site now contains all 49 existing native media objects, their exact offering ownership and all 49 original recording attachments. Eleven PDF objects were copied (42,636,883 bytes); all were read back and verified against the staged/source SHA-256 values. Thirty-eight original YouTube ids remain reference-only. All attachments have `published=0`, including the six programme-only recordings. No learner availability was opened.

`tools/existing-media-control-plane.mjs` builds a seven-statement account-owner transaction. Its approved private launcher and resource identifiers remain outside tracked source in the parent evidence directory. The existing named AcademyStudio OAuth profile authenticated the target operator; the default Academy profile was retained for read-only source checks. No application identity/session was invented, account promoted, Worker route added or runtime deployed. Account-owner authority is recorded explicitly in the operation and audit receipts.

The launcher checked both source scopes with the native current inventory before copying and immediately before admission. It compared source head/write version, accepted component identities/digests, exact selected assets/attachments and current lesson visibility/links. It checked all nine target published JSON byte hashes and original draft/publication pointers. The transaction rechecked website revisions/pointers, offering kinds, Academy scope authority/generation/version/enabled state and absence of every planned media/attachment id. Concurrent conflicts reject the entire batch. [D1 batches roll back on failure](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).

PDFs use a private namespace containing the full plan hash. The operator reads and hashes an existing destination before any upload; mismatched bytes abort. An interrupted/unknown upload resumes by reading and hashing the destination. The upload also sends `If-None-Match: *`; REST documentation does not promise that PUT precondition, so isolation relies on the dedicated plan namespace and exact bytes rather than assuming REST conditional-put support. All source and staged bytes are retained.

After admission, bounded primary-key queries compared all 49 objects, 49 owners, 49 attachments, the nine original website pointers and the operation receipt. All match; published attachments total zero. The SQL touches only objects, owners, attachments and operation/audit/guard metadata, so accounts, purchases/months/classes, website-only grants, timetable, editions, artwork and source data are untouched. The target transaction is atomic; source and target are separate systems. Publication still requires fresh source/target checks and bounded real-access acceptance. The local session adapter cannot activate this distinct control-plane receipt.

| This hosted import window | Queries | D1 rows read | D1 rows written |
| --- | ---: | ---: | ---: |
| Two native source revalidations | 42 | 974 | 0 |
| Target preflight, admission and post-verification | 17 | 756 | 791 |

The target write total includes indexes, operation/audit receipts and insertion/removal of the transient guard. R2 operations: 31 reads (nine published documents, eleven absence checks and eleven PDF readbacks), eleven PDF writes. These totals exclude the earlier 164-row read-only preflight and local tests. No further live polling or repeat import was needed.

Two additional synthetic control-plane tests pass: exact full-size private admission; website/authority conflict rejection; late-statement failure rolling back all prior inserts; duplicate rejection; and refusal of edited plans, publication or missing PDF proof. The prior thirteen focused tests remain passing evidence; 126 modules pass current syntax/configuration checks. Live learner playback/range acceptance is not claimed while all imported attachments remain unpublished.

Private evidence in parent `outputs/circles-existing-data-migration-20261030/`: `live-source-revalidation.json`, `live-byte-receipts.json`, `live-admission-request.json`, `live-admission-response.json`, `live-import-verification.json` and `control-plane-tests.txt`. The receipt is recoverable without repeating the import. A retry checks the deterministic operation id and exact admitted records before doing any new writes. No UI deployment, public publication, DNS change, source deletion, new course/content or retirement occurred.
