# V108.0 parallel access rollout — 29 October 2026

You authorised parallel testing before separation. Existing Academy routes, homepage, Library, learning/admin screens and data remain available. Academy owns enrolment/access throughout this stage; the website holds a versioned local projection and rejects direct enrolment, purchase, staff, paid-month, Surah-grant and completion-policy authority changes. Scoped website content editing remains available. No DNS change, screen retirement, Git push or destructive cleanup is included.

## Release and resources

The feature branch `feature/academy-studio-rollout-20261029` integrates the nine-website preview/editor with the tested platform and additive access protocol. Matching source release: `feature/academy-parallel-access-release`, based on deployed V107.120 plus the connector, labelled V108.0 throughout.

Real parallel URL: https://academy-studio-parallel.naidu-hajira.workers.dev . This uses a separate real Worker and D1 (`c261eb73-7145-4f73-940c-5816db287612`) with private R2 `academy-studio-parallel-content` and `academy-studio-parallel-media` in account `2b01ca929611669e032703ff19f7098f`. Synthetic private preview identities/resources stay separate and unchanged.

The real target received nine independently versioned teaching JSON copies and artwork only. Draft and published editions remain separate; importing access never overwrites website drafts. PDF/recording inventory and byte migration are a separate stage: absent private material stays unavailable. Existing Academy material and public Foundations access remain available.

## Access and database usage

Actual PIN sign-in uses the Academy API origin, with a one-use browser handoff bound to the approved Academy Pages origin. Initial extraction is indexed, checkpointed and restricted to the two reviewed source offerings: Al Kahf and Tafseer, with eight exact Surah mappings. Trigger capture starts before extraction. Each account/offering projection atomically replaces separate current-live, purchased-course, historical paid-month/cohort and website-only rights; a Surah grant does not acquire recordings. Removals, master suspension and credential/role changes retain their own monotonic authority.

Recovery reserves bounded indexed candidates for scope/master prerequisites, prevents dependent access snapshots arriving first, and rejects obsolete generations. Active sessions renew only their own cached authority. Freshness is 300 seconds for learners and 60 seconds for staff; an outage or oversized/invalid authority closes protected operations instead of retaining old grants indefinitely. Routine website reading/media/Join does not query Academy; public R2 snapshots use zero D1 reads.

## Activation and recovery

Apply source additive schemas 0011–0013 with control disabled and target 0002. Deploy the matching source and receiver with target browser access still closed. Configure exact mappings, activate dirty capture, complete the bounded import/catch-up, verify versions/checkpoints and only then open real browser access. Connection secrets remain private encrypted bindings.

On failure, close target browser access, disable source database control, then disable/revert the source connector if necessary. Preserve additive schemas, ordered outbox/receipts, legitimate synced accounts/rights, drafts/publications and recovery evidence. Do not reset versions, reseed permissions or restore a whole database as a rollback shortcut.

Private release evidence and final deployment IDs: parent `outputs/academy-parallel-access-20261029/`. The earlier synthetic preview runtime is `db0ad6f` / Cloudflare `3dfe5378-a31f-4016-b754-ba2b6ecf8ced`; that preview update did not activate real access. V108.0 deployment evidence must explicitly distinguish closed preparation from completed activation.

## V108.0 active release

The real parallel site is active at https://academy-studio-parallel.naidu-hajira.workers.dev . Runtime commit `5183846b17f60d242665943c5ff3042a663c5e40`, Cloudflare version `5e2bbc0e-d402-4d91-b4d1-a2d651e331ee`. Academy API/frontend also report V108.0; old screens remain available. Source implementation is `313b6100`, Worker `2bd1b45d-e577-45a0-bdb8-77617095b020`, Pages deployment `29722737`.

All 68 combined local tests and five small hosted checks passed. Initial access sync finished with 17 deliveries, zero failures and no unfinished import phases, dirty projections or pending events. Its measured source usage was 886 rows read and 470 written; these are operator totals rather than aggregate daily usage. A single target metadata check confirmed nine websites, two enabled Academy-authoritative scopes, eight Surah maps, eight real accounts and thirteen ready projections. PIN/revocation acceptance was local; live checks did not use a real login or dashboard.

Private final record: parent `outputs/academy-parallel-access-20261029/release-verification.json`. PDF/recording byte migration remains separate, and existing Academy material stays available. Synthetic preview identities remain isolated. This release authorisation is fulfilled; future deployments need fresh approval.
