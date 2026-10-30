# Private media migration continuation — 30 October 2026

Migration takes priority over UI changes, as requested. The deferred homepage, visitor-choice and destination requests are recorded in the parent `outputs/circles-ui-request-queue-20261030.json`. Their unfinished implementation is saved on `feature/circles-home-requests-20261030` at `3121af1`; its separate Academy entry helper is at `01e1dfba` on `feature/circles-home-entry`. This migration branch continues from the tested connection checkpoint `1f428f9` and does not include those UI changes.

## Prepared copied material

The offline transfer preparation verifies the copied Academy inventory against the checksum-bound reconciliation report, its accepted source snapshots, complete page/checkpoint sequence and exact native lesson/asset identity. A website association now supports an exact source asset as well as the older whole-lesson association. Selecting a PDF or recording cannot silently associate another asset from the same lesson. Conflicting associations fail.

The actual private package is in the parent `outputs/circles-media-migration-20261030/`:

- 43 planned objects: eleven PDFs and 32 original YouTube references, with 43 separate historical attachments. All planned attachments remain `RECORDING,published=0`.
- Eleven PDF copies staged privately, with size, signature and SHA-256 checks on both original and copied bytes: 42,636,883 bytes. Original filenames, dates and source identities are preserved. No video bytes were downloaded.
- Six unassigned source references held. Thirteen unmatched recording companions remain unresolved. The six guidance courses and Mothers retain their separate pending mappings; no course purchase is reused for them.
- Original published, existing-draft and review-draft hashes retained separately. Recording guide candidates contain proposed asset identities marked `PENDING`; accepted target mappings remain empty.

The original bundle remains unchanged. Neither the package nor its source/object keys may be served publicly. No account, entitlement, teaching edition or hosted resource was changed. The preparation uses no network, D1 or R2 calls.

## Reproduce or resume locally

Prepare into a new private directory:

```text
node tools/prepare-circles-media.mjs <private-academy-copy-directory> <new-private-output-directory>
```

Resume a partial stage, or verify an exact retry:

```text
node tools/stage-media-transfer.mjs <private-media-plan.json> <private-circles-bundle-directory> <private-stage-directory>
```

The stage keeps immutable per-object receipts and a plan-bound checkpoint. It checks existing bytes on resume and does not replace them. Incomplete temporary copies never become final objects. A different plan, changed bytes, unexpected path or non-private checkpoint is refused. Output directories are 0700 and files 0600. Source files stay untouched. A completed transfer receipt still says `readyToAdmit=false`, `readyToPublish=false`, `sourceRevalidation=REQUIRED`.

## Native local verification

Seven focused checks pass against the deployed V108 Academy code, using synthetic accounts and disposable native Core/Admin D1 and target D1/R2. Four test private reconciliation/staging, two retain the source inventory/planner checks, and one rehearses the proposed admission contract with the existing `Store.mutate` transaction guard. There is no new operational importer or authority-write exception.

The admission rehearsal proves that administrator removal or a changed target edition rejects the entire transaction. An exact retry is idempotent. Admission stays unpublished; explicit publication is separate. Original historical class rights allow the PDF range; a website-only grant and a different class are denied. Local withdrawal blocks immediately while keeping original bytes and website editions. Purchased rights are unchanged.

| Operation in synthetic fixture | Queries | D1 rows read | D1 rows written |
| --- | ---: | ---: | ---: |
| Admission of three assets and six audience attachments | 17 | 8 | 91 |
| Protected PDF range | request metadata | 9 | 0 |
| Academy during target admission/media/withdrawal | 0 | 0 | 0 |
| Source inventory, before/after 4,000 unrelated records | 8 | 70 | 0 |

The admission figures include the operation/audit/guard and index costs reported by local D1; they exclude initial sign-in/access synchronisation, rejected rehearsals, staged filesystem verification and R2 work. They are not an aggregate migration or production traffic budget. No scheduled work is added. Syntax/configuration checks pass on 118 modules; deployment remains disabled and bindings remain local. Detailed evidence is in the private output's `focused-tests.txt` and `verification.json`.

## Remaining migration work

The next stage is the operational, resumable admission/delta adapter: revalidate the current accepted Academy source; reconcile exact target ownership, existing objects and edition pointers; atomically guard target changes; apply source media withdrawal/removal without reopening old checkpoints; retain auditable recovery and rollback. A fresh source preflight and a target transaction do not form a distributed source/target transaction. The local contract rehearsal does not claim that problem is solved.

Before real admission, target IDs must be accepted through that adapter and the guide sidecars prepared for the exact admitted edition. Resolve the thirteen companion associations, six unassigned references and standalone Course mappings without title/date guesses. Multiple-class display deduplication, Teacher-note version policy, full journey/read budgets and bounded real learner/media acceptance remain open. Hosted transfer, publication or deployment needs its own authorisation; Academy continues serving throughout.
