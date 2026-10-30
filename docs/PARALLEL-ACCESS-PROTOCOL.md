# Parallel access protocol — tested local checkpoint, 29 October 2026

Source checkpoint: `68fff58d` in `../Academy-website-studio`. Apply additive Core `0011`, `0012`, then `0013_website_parallel_access.sql` against the accepted V107.120 split schema. Target `0002_parallel_access.sql` follows platform `0001`. Migrations seed no real identities, mappings or rights. The deployment owner reconciles release markers to V108.0 and owns all hosted work.

## Configuration and ownership

Target `AUTHORITY_MODE=ACADEMY` enforces parallel source authority; `WEBSITE` retains the later independent administration model. Target `ACADEMY_ORIGIN` is the browser/Pages origin and `ACADEMY_API_ORIGIN` is the Worker API origin. Only local/compatible fixtures may rely on the API-origin fallback. Source `WEBSITE_PLATFORM_ACADEMY_ORIGIN` remains the exact Pages origin; browser CORS stays scoped to the Academy origins. Signed server commands do not require adding the target browser origin to source CORS.

The deployed V108.0 pilot uses learner status 300 seconds, staff 60 seconds and live access at most 300 seconds. The local feature branch now implements the requested **12-hour learner account/access verification interval**, including live Join; `ACCOUNT_MAX_AGE_SECONDS` and `LIVE_ACCESS_MAX_AGE_SECONDS` are both `43200` in the parallel release configuration. Staff-sensitive verification remains 60 seconds. This change is not deployed.

The interval controls renewal of Academy proofs, not the validity of local rights or sessions. Every protected request still checks current local account/session and exact entitlements, publication and live-session gates. Signed changes, generation fences, suspension, session revocation and withdrawals continue to take effect on receipt; a delayed/missing source event can leave the previous proof usable up to the 12-hour bound. Outdated proofs require a successful renewal before protected access continues. The live Join opening time remains five minutes before the lesson; this is separate from proof renewal.

Public requests read no D1. Ordinary website/material/Join requests read local projection/authority only. `/auth/access` and existing status refresh coalesce current-account renewal; they never sweep all accounts or ask Academy for every file. Status/sign-in drain the current account's required source access before handoff. Master tokens stay on Academy origin.

Source offering mappings require explicit reviewed activity/target IDs, PAID/CONFIRMED subscription decisions for Courses, the enabled Tafseer policy, exact source Surah → website IDs and original dates/classes. No title inference, current-class substitution or synthetic preview grants. The real target must remain separate from synthetic invited preview storage. Academy continues to serve existing screens, routes, enrolment, rights, Library and private media.

## Ordered projection

`access-scope` carries an offering's generation/availability, active classes/timezone and mapped Surah completion metadata. It never overwrites content JSON or draft/publication pointers. `access` carries one account/offering snapshot: scoped roles, separate live participation/purchase, relevant dated allocations, website-only month proof, original month/cohort recording rights and website-only Surah grants. Empty recording audiences remain empty; paid website access is stored separately in `website_months`. Sessions carry private class/teacher associations, enforced on Join; an added class cannot broaden the single-class fallback.

Streams are `access:` plus SHA-256 of `[offeringId, lowerCaseAccountId]`; an empty account is scope metadata. The receiver verifies that stream, exact versions, generations, payload receipts and mapping ownership. A snapshot replaces only that account's scoped projection atomically. Access events only INSERT missing identities; current master flags/epoch/global authority/freshness remain account-stream owned. Inconsistent or superseded authority is fenced, including a retry of an older accepted snapshot; newer versions cannot be fenced by an older retry.

Source transaction triggers dirty keys before baseline extraction. Indexed dataset pages checkpoint account keys and queue current projection; they do not copy stale grants from a long-running export. Newer dirty edits survive baseline retries. Default recovery advances one 25-row dataset page, projects at most four dirty keys and sends a capped batch. Explicit activation changes the generation and restarts keyset reconciliation, without a daily population sweep. Reserved indexed metadata/master candidates and dependency guards stop a full person backlog hiding prerequisites. The reviewed direct-recovery and pending-account regressions pass without earlier sign-in or delivery failures.

Bounds: 32 configured scopes per sign-in, 240 paid month rows, 512 month/cohort rights, 128 Surah grants, 100 relevant live allocations, 200 mapped Surahs/classes, 220 KB per access event, and a 40-event/230-KB status page with bounded continuations. Overflow fails closed with an operational diagnostic, not truncated or widened access.

## Parallel write restrictions

The server rejects website-side participant/purchase/live, paid-month, Surah/staff grant, completion-date/month, enrolment request/decision, account provisioning/completion, website creation and generic lesson-attachment authority changes during Academy ownership. The admin UI hides those actions and links to Academy management. Existing approved website text/artwork editions can still use guarded Save/Publish; source access refreshes never overwrite them. Original recording/PDF relationship changes remain Academy managed. Later handover needs a reviewed final delta and explicit ownership switch; do not retire old paths during parallel testing.

## Bounded live review plan (deployment owner only)

1. Reuse the saved small scope/policy inventory: the two reviewed paid scopes, eight exact Surah identities/dates, and the current Tafseer class/timezone. Do not repeat population/schema scans or use synthetic preview data as authority.
2. Keep the real browser gate closed while the normal HMAC receiver accepts events. Apply/verify exact additive schema/index names, target API/browser origins, separate secrets, source control and reviewed mappings. Start transactional capture before the first baseline page.
3. Use the deployment owner's restricted operator adapter to invoke actual `recoverWebsite`, without a learner PIN or public privileged import endpoint. Begin with a small fixed step/row/write budget and one dataset page; inspect aggregate costs, phase cursor, dirty/exported generation, ACK state and diagnostics. Resume checkpoints within explicit budgets. Log counts/versions, not credential values or exported account payloads.
4. Verify initial metadata/master prerequisites and pending deltas are acknowledged, with no delivery errors. Reconcile approved pilot rights against source, separating disabled/unadmitted accounts from deliverable people. Never restore a seed marker, reset stream heads or overwrite newer content to force matching totals.
5. Run one controlled pilot: current/former retained sign-in; own paid website; website-only grant denied recordings; matching class Join allowed/wrong class denied; source withdrawal/staff removal; Library return; safe retry. Check local-only permission gates and conservative freshness. Expand only after those exact results and read costs are recorded. No DNS change or old-screen retirement.

Rollback: close the real browser/API gate, disable source database control/capture and connector runtime as appropriate, keep D1/R2/outbox/history and legitimate master identities, then reconcile generations before resuming. Do not erase rights/history or reset versions. Already downloaded files and disclosed meeting URLs cannot be recalled.

## Evidence and limits

The complete platform suite passed 59 native tests; the final 11 access/import/dependency cases passed after the reviewed recovery correction. Syntax/config checks and a packaging dry-run passed; the deployment owner runs the larger combined release suite independently. The pending-backlog regression reads 257 source rows initially and 379 after 4,000 unrelated pending events/rights, including source proof refresh; no statement reads 250 rows. The importer uses forced scoped/account-first indexes. Reports: `outputs/parallel-access-reads.json`, `tests/parallel-access.test.mjs`, `tests/parallel-initial-import.test.mjs` and `tests/academy-origins.test.mjs`.

These changes import access metadata, not original recording/PDF bytes or their audited migration manifest. Keep Academy media available. Full media migration, final separation/retirement and real compatibility/date/browser acceptance remain separate from local access-sync evidence. This thread performed no hosted query or deployment.
