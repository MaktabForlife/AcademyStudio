# Existing data migration — 30 October 2026

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

These are migration operations, not a new-data entry path. The hosted launcher and fresh source/target preflight are still required before a real import. The current local restriction deliberately prevents these tests or copied snapshots from becoming hosted authority.

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

## Before the live import

A bounded live source preflight confirmed that both accepted scopes still match the copied head, source write version, generation, offering/kind, reviewed policy and all six component ids/digests. It read 42 source D1 rows and wrote none. Component scope-key comparison follows the source database's case-insensitive identity semantics; complete component identities/digests still match exactly. The existing source operator sign-in was refreshed without collecting a user's Academy PIN. Evidence: parent `outputs/circles-existing-data-migration-20261030/source-preflight-verified.json`.

Automatic approval review initially rejected the target preflight because sending the copied identifiers to the website Cloudflare account needed explicit approval. You then approved that read-only preflight. It completed with 122 target rows read and zero written: all nine saved draft/publication pointers match, both Academy-authoritative scopes remain enabled, and none of the 49 proposed asset or attachment identifiers is present. Evidence: parent `outputs/circles-existing-data-migration-20261030/target-preflight.json`. Combined source/target preflight use was 164 rows read and zero written. This does not include object-byte verification or authorise an import.

The concrete proposal is parent `outputs/circles-existing-data-migration-20261030/private-import-proposal.json`: copy/verify the eleven PDFs and admit the 49 original media/ownership/audience records as private, unpublished attachments. It changes no teaching editions or rights. The current adapter remains local-only; separately authorised live execution must preserve all of its guards. The approved read-only preflight does not authorise this hosted write.

At that import window, reconcile any intervening source/target changes and preserve the approved consistency/withdrawal handoff. A source preflight plus a target transaction is not a distributed transaction. Keep Academy serving and retain recovery copies; verify bounded real access before activation. No hosted write, deployment, DNS change, source deletion or retirement occurred in this continuation.
