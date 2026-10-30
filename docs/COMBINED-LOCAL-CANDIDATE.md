# Combined Academy / Circles local candidate — 30 October 2026

This is a local integration, not deployment or live ownership approval. It preserves Studio V108.5 / Academy V108.4, the 49 enabled original media references, and the 43,200 / 43,200 / 60-second verification policy. No hosted check, SQL/resource/content write, publication, live authority activation, DNS change, screen retirement or Git push is part of this work.

## Exact inputs and isolation

- Reviewed access: target `20e080daccb9afd39227192a20758e63ac3244b7`; source `1e08f791c269fcaef22fcf4f5f03433b176bf810`.
- Held completed Circles: target `14012c8f95d23b2aeb7dbb0ab34983d372f75692`; source `eb8a7fdd59ca6c945085805bf302c334ae2904e2`.
- Frozen design: `71dbd4f15433642787501162c216e87fe8a0a451`. Later Kahf `890d994` is not included.
- New worktrees: `work/AcademyStudio-combined-candidate` and `work/Academy-combined-candidate`, each on `feature/academy-studio-combined-20261030`. The original four input branches/worktrees are preserved.

Both histories are merged rather than replacing either input. The latest Circles public UI is retained byte for byte. Shared conflict resolution keeps the new header/date route beside the signed Studio-access route, current source identity/session/epoch guards beside the Library return metadata, and the source-test schema/service bindings required by the access bridge. The tests default to the paired combined source checkout, including additive schema0015. Tests/fixtures are synthetic and block external source network calls.

## Behavior retained

Academy remains master for identity/PIN/security, admission/suspension, staff, class allocations and timetable/Zoom. Studio rights become authoritative only through an explicitly approved, reconciled per-offering transfer. The additive target0004/source0015 schemas seed no transfer. Both durable cancellation records and atomic guards from the independently reviewed fix are unchanged: abort-before-checkpoint, delayed begin, old operation replay, commit-versus-abort and recovery by another current Global Admin remain fenced.

Whole-Course purchase rights survive former participation; original paid month/cohort recording rights remain separate from website-only months and Surah grants. Source proofs and late deliveries cannot overwrite Studio rights after transfer. Identity-first enrolment keeps successful master-account creation recoverable without creating a duplicate or an implicit purchase.

The combined UI retains the approved held placement: no short-Course links on the circle; confirmed purchased current/completed courses in My courses; staff-only authority is not a purchase; free-course cards are visible but inactive from first render and rotation. Global Admin has Learn/Teach/Admin. Daily Admin programme entries expand Info with all supplied lessons. Native Library/PDF/Home returns preserve the selected workspace and account-bound connector context. Course Home/Refresh keeps existing draft guards. Gregorian dates use Africa/Johannesburg; unavailable Hijri data remains explicitly unavailable.

Mothers/Baqarah stays a separate Academy programme; its private teaching draft is not connected or published. Future five-minute free-programme links, queued Kahf editorial work, new recording adapters/media linking, and later placement/phone redesign work remain outside this candidate. Nothing planned is represented as implemented.

## Build and verification

The prepared connected public artifact is ignored `local-content/combined-71dbd4f-review/public`, created with `tools/prepare-circles-login.mjs` from the frozen input. Do not deploy a raw design dist or native public directory over it. The design index SHA256 and build report are recorded in `local-content/combined-71dbd4f-review/build.json`.

Run the combined native suite with:

```sh
ACADEMY_SOURCE=../Academy-combined-candidate CIRCLES_UI_BUILD=local-content/combined-71dbd4f-review/public npm test
```

The additional combined workflow verifies retained purchases in My courses after handover and source refresh, staff purchase separation, cached dashboard reuse, an actual Teach Library exchange, and received master suspension. Native tests also cover scoped permissions, PIN/account switching, Library return validation, date/header behavior, content/media boundaries, cancellation races and twelve-hour/sixty-second freshness. Source Course/monthly/Admin UI management checks are run separately.

Measured synthetic workflow rows: an Admin exact-account view reads115 source /61 target rows; beside4000 unrelated records the first proof-refresh view reads226 source /120 target rows. Empty cache reuse reads31 target rows versus121 for the full empty view. A20-person batched Save reads115 source /200 target rows with39 target queries. After a synthetic handover, My courses navigation reads12 target rows and a cached dashboard reads3, with0 Academy queries for either. Ordinary protected reading makes0 Academy queries. These are workflow measurements, not a daily production estimate or a claim of zero local Studio reads.

Browser review uses separate local ports8984/8985 and synthetic identities only. It verifies Global Admin modes/daily Info, native Teach and Learn Library/PDF/Home return, a learner-only workspace after account switching, and purchased-course opening/Home. The retained Circles preview8944/8945 is untouched. Final commits, test totals, immutable build/evidence hashes, screenshots and limitations are recorded in the parent `outputs/academy-studio-combined-20261030/VERIFICATION.json`.

A release still requires the separate reviewer to assess this combined candidate and the human to approve deployment/schema changes. Any later live transfer requires current exact source/target reconciliation and backup. The optional same-offering revision-trigger write optimisation is deferred; no new access semantics were introduced for it.
