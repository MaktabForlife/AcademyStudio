# V110 stage 2 follow-up for review

This isolated candidate starts from deployed Studio V109.21 source `606f8d65605c8c4b4bc85a56d5292d35b092fb8c`. It replays only the approved independent JWT prototype, its pinned JOSE dependency, synthetic tests and evidence workflow. Release metadata, production configuration, hosting wrapper, homepage and all live routes remain the V109.21 baseline. No route imports `src/auth/v110/`; `schema.sql` is not a production migration.

The preceding proof is commit `126c82c259d58a9395c99ea56956658abcc026cd`, run [41970002496](https://github.com/MaktabForlife/AcademyStudio/actions/runs/41970002496): 16 tests passed. Optimisation accepted that independent crypto/storage proof and required further gates before activation.

## Addressed in this follow-up

- Academy access-cookie scope requires explicit reviewed `academyIssuer` and `academyCookieDomain` configuration. The issuer must be the exact HTTPS origin of that domain, without port, path or credentials. Cookie domains must have valid lowercase ASCII DNS labels. There is no default root domain and no derivation from request Host or Origin. A second configured domain is tested. Studio/Hifz access and all refresh cookies retain host-only `__Host-` scope.
- Synthetic transaction tests insert a parent tombstone or change credential epoch, account activity, browser generation, family revocation or unlock generation after lookup and before refresh compare-and-swap. Each must return no successor and perform no refresh or audit write.
- An injected audit-statement failure must roll back the entire refresh batch, including its fingerprint, generation and foreground timestamp. After the test trigger is removed, the original refresh must still work. Failed-batch billing is not inferred from absent error metadata.
- A permission-version change between lookup and commit must silently use the committed current version without extending foreground activity.
- GitHub runs the complete Studio test suite, including this isolated prototype. No Mac build or test, hosted SQL, media publication or deployment is involved.

## Rights representation remains unresolved

The existing `validRights` function and `rights(n)` data in the prototype are synthetic capacity fixtures, not native production permission validation. The 16-scope fitting example is not an account or product limit. The 64-scope failure remains an explicit failure; there is no truncation, omitted permission or per-request full-rights snapshot fallback.

Native Academy source at `0af01b90b715b95fa272fae639b90200e006924c` exposes account/global authority, effective and explicitly mapped activity roles, Course subscription identities, substitute grants, monthly subscription/class mappings, Surah grants, context flags and feature/policy state. See `backend/src/academy/d1/repository.js`, `monthly-media-policy.js` and `surah-grants.js`. Payment months, class memberships and additional Surah access must remain distinct.

Native Studio source at this candidate's V109.21 base retains acquired participation/purchase/cohort rights, paid months by cohort, website months, separate Surah grants, staff authority and current source generation/fences, as well as programme, playlist, recording and publication policy. See `src/access.mjs`, `src/studio-access.mjs`, `src/access-tables.mjs`, `src/course-policy.mjs` and the native migrations. Those sources must define a complete, versioned lossless adapter and reference decisions before a production codec is selected. The shared parent token carries Academy-owned rights; it must not duplicate all Studio-owned media grants.

Required next proof: synthetic native rows covering Global/scoped Admin, acquired/historical Courses, non-contiguous cohort/month/class rights, Surah/website/playlist/recording rights, revoked/disabled mappings, current publication and exact Join boundaries. Compare full native decisions before/after representation, including denial cases. Measure every cookie sent together, including actual browser-generation, CSRF and legacy-transition state. Do not adopt a capacity workaround silently.

## Remaining activation gates

1. Native full-rights representation and realistic worst-case size, with no loss of acquired rights or server-snapshot substitution.
2. Real multiple-tab browser tests: concurrent renewal, late Set-Cookie, fully lost response/cookie, suspended tabs, parent-cookie expiry, logout/account switching and recovery. The owner's switch-during-outage policy remains unanswered; no dependent admission/switch implementation is included.
3. Academy-origin PIN entry and one-use app-bound handover, independent per-app 90-minute foreground-refresh enforcement, fresh scoped Admin and existing mutation guards.
4. Durable database-local change/outbox ownership and acknowledgement/retry tests. Preserve revocation floors across rollback; define retention/cleanup costs. Core/Admin split changes must use the existing reviewed coordinator, not a fictitious cross-database transaction.
5. Matched complete-request cost evidence, including Worker invocations, local D1 gates, HTTP/CSRF/PIN and media recovery. Current counts are isolated synthetic D1 measurements, not production savings.
6. Runtime parity. The pinned Miniflare/workerd simulation supports `2026-09-28`; production currently uses a later compatibility date. Passing this simulator is not proof of production runtime parity.
7. Reviewed paired Academy/Studio integration on current canonical heads; scoped Hifz ownership/live-data tests; verified SaaS hostname/static/API routing; a release and compatible rollback plan.

During an Academy outage, eligible child sessions may continue to the original seven-day deadline, subject to their local 90-minute gate, local rights and received cancellation. Missing cancellation can remain unknown until delivery or original expiry. A completely lost random refresh successor cannot be reconstructed from stored fingerprints: re-admission may require Academy, so an outage can delay that recovery. There are no routine Academy checkpoints.

V110 is not activated by this candidate. Real content attachment/publication stays manual and separate.
