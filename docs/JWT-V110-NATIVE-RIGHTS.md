# V110 native-rights and runtime proof — proposed contract

This independent candidate starts from Studio `33af7a5a20f7dd90ebd745d223e9398cc0c185c3` and uses Academy `9b197fafbdd80859ceb9028203c48480455c843f` for paired fixtures. These are the canonical V109.23 recovery sources selected by optimisation. The separate release owns their activation and receipt. This candidate does not change a live route, numbered migration, configuration, public asset, canonical branch or deployed app.

The previous accepted crypto/storage proof and its follow-up remain in `docs/JWT-V110-STAGE2-REVIEW.md`. The new modules are independent representation tests, not production authentication integration.

## Native authority basis

| App | Embedded personal authority | Kept current in owning application |
| --- | --- | --- |
| Academy | Global Admin flag; every effective/mapped activity role; Course subscriptions; substitute assignment IDs/activity mappings; monthly subscription month/revision/class mappings; Surah/revision grants; explicit website admission and personal-library flags | Current account/session/credential/browser floors; timed substitute validity; activity/class lifecycle; workspace projection; operational ownership; publication; fresh scoped Admin and atomic mutation guards |
| Studio | Global Admin flag; participation/enrolment/live/purchase/cohort rows; scoped staff and account-creation flag; paid months with exact cohort; text-only website months; separate Surah website grants; retained playlist/source-month/kind rows | Current source fences/generation/readiness and committed authority; offering lifecycle and FREE/PAID policy; website/attachment publication; playlist membership/current effective month; five-minute Join window; current Master/Admin freshness and atomic mutation guards |
| Hifz | Identity/session tokens only; no Academy or Studio rights projection | Current local student/Teacher/owner checks and live journal data |

The Academy representation never duplicates Studio-owned playlist/recording grants. Website admission must come from its native authority row, not inferred UI context. Names, credentials, PIN hashes, refresh tokens, journal content and media bytes are excluded.

Studio fields come directly from its native schema/policy: `participation`, `staff`, `paid_months`, `website_months`, `surah_grants`, `mou_playlist_retained`. Paid recording rights keep cohort and month; a website/Surah/text-only month must not become recording permission. Acquired/historical Course purchases are retained even when current enrolment is false. Retained playlist rights still require the original paid or website month to exist.

Academy's projection follows `repository.js`, `permission-state.js`, `monthly-media-policy.js`, `surah-grants.js`, and workspace policy. Current timed-grant checks remain mandatory; embedding an assignment ID does not extend its time window. All required collections are explicit, including empty ones. Missing collections, unknown rights fields, invalid types, unexpected roles and duplicate keys are rejected.

## Proposed lossless wire representation

`r` is a versioned `native-zjson-1` envelope carrying the complete validated native tuple snapshot as UTF-8 JSON compressed with standard DEFLATE and canonical base64url. It is inside the ES256-signed JWT. This is a proposed application claim format, not a JOSE `zip` header or encryption.

Signature, pinned key, intended app/purpose, token size and expiry are verified before any decompression. The decoded native schema is then validated again. Compressed bytes are bounded at 65,536; expanded bytes at 2 MiB, matching the existing Academy permission-cache ceiling. The normal token/cookie/header design budgets still apply, and can reject a smaller payload first. This protects parsing; it is not a product/account limit.

Compression does not make JWTs confidential. No secrets or attacker-supplied display labels enter the compression context. Do not add encryption or mixed secret inputs without a new review of [RFC 8725 section 3.6](https://www.rfc-editor.org/rfc/rfc8725.html#section-3.6). Workers support the standard [Compression Streams APIs](https://developers.cloudflare.com/workers/runtime-apis/web-standards/).

There is no truncation, omitted-rights success, quiet full-rights database/R2 fallback or fixed 16-scope limit. Synthetic structured and random-ID profiles at 1/16/64/256 scopes measure both complete native app snapshots and every simultaneous cookie. Over-capacity remains an explicit release/design gate. Those profiles are stress data, not a verified native maximum. Root browser-state/CSRF/transition bytes are reserved pending the browser contract; their final exact bytes must replace the reservation.

## Meaningful proof and its limits

The new tests rebuild six synthetic accounts' personal native rows from the decoded representation and compare 48 decisions made by unchanged native website, cohort recording and retained-playlist policy functions. They cover Global/scoped staff, acquired Course access, historical cohort rights, additional Surah access, text-only months and outsiders. A subsequent publication withdrawal must still deny access. This is representation/decision equivalence, not a claim that production routes already consume the JWT.

Academy checks compare unchanged native role/Admin decisions and preserve non-contiguous monthly/class and Surah grants. The JWT wrapper checks app isolation, malformed data, strict types, signature-before-decompression and bounded expansion. The codec and JOSE also run bundled inside workerd.

The existing root test dependency remains Miniflare `5.20260921.0-alpha`/workerd `1.20260921.1`, date `2026-09-28`. An independent job uses the already lockfile-pinned Wrangler-owned Miniflare `5.20261103.0-beta`/workerd `1.20261103.1` at production date `2026-10-28`. It repeats the isolated V110 crypto/storage and native-codec proofs. This does not claim full production app parity: the unchanged native business fixture still uses its established older simulator, and final integrated routes/browser/media flows require production-date proof.

The standard named paired regression groups remain in the workflow. All tests/builds run only in disposable GitHub runners. No Mac source files, hosted SQL, real accounts/journals/media or live app requests are used.

## Before integration or deployment

- Review the full native representation and measured worst cases. Resolve real full-rights capacity before activation.
- Load rights under one current, account-bound permission version and bind that exact version to the JWT; prove rights/version cancellation races. The pure projector is not a new authoritative loader.
- Review the proposed browser-session marker in `JWT-V110-BROWSER-CONTRACT.md`; no outage-admission choice is inferred from the owner's request for an explanation.
- Implement Academy-origin PIN/handover, independent app locks and safe refresh/media recovery; preserve current Admin freshness.
- Prove owning-database outbox atomicity, acknowledgements/retries, replay floors through rollback, and bounded retention/cleanup costs.
- Compare matched full requests/costs and run exact paired Academy/Studio plus scoped Hifz and real browser checks on the latest canonical baseline.
- Review concrete staged schema/config/key/hostname cutover and rollback, then deploy the first JWT release as V110.

## Follow-up from optimisation's next-stage review

The source refresh CAS now independently binds the selected account, parent session, browser identity/generation, credential epoch and original sign-in/deadline. A schema trigger forbids rebinding those fields in an existing family: migrations and credential/browser changes must revoke/create a new family and random secret. Tests simulate an older schema by dropping only the isolated fixture trigger and changing both sides before CAS, and separately prove the production-proposed trigger rolls back attempted in-place migration. PIN unlock/admission must not retain an old refresh secret; their adapters are still unimplemented.

The first native run41977691734 passed27of28cases on both runtimes. The remaining test exposed a harness mistake: direct native Store calls were missing their test D1 binding. The next fixture supplies that binding and rethrows unexpected harness errors; no access expectation is relaxed. Historical failed artifacts remain available.

## Configured production-facing facade

`createConfiguredAccessEngine` derives token issuer, verifier and cookie scope from one reviewed config. Academy's cookie-domain relationship is checked against that exact issuer; children reject Domain configuration. Issuance returns the bounded Set-Cookie header together with the token, so callers do not separately choose a cookie issuer/domain. `createNativeCookieEngine` composes native rights through the same facade. Hifz uses the identity-only configured facade. The lower-level native engine is retained for explicit over-capacity profiling and is not the integration entry point.

Tests cover both Academy roots, mismatch rejection and all three apps' cookie scopes. Real browser cookie acceptance/public-suffix/duplicate/host-transition proof remains separate.

## Account-bound replacement/refresh proof

The next independent module takes an opaque refresh secret and a foreground flag only. It does not accept a caller-supplied subject, permission version or rights object. After the existing synthetic refresh CAS, it reads native rights and the exact committed family/account/version in one owner-local transaction, checks every row's account binding, signs, and checks the current family/version again. A permission downgrade causes a bounded fresh read; a credential/session cancellation returns no access cookie. Repeated permission churn can return only the already-committed refresh cookie for a local retry, without publishing stale access claims. This is not recovery of a wholly lost unknown secret.

Tests inject a wrong-account native row and changes between read/signing, verify the current downgraded rights/version, preserve the original deadline and exercise the real module inside the selected Worker/D1 runtime. Account-first native indexes and the existing retained-revocation index are used; 4,000 unrelated native retained rows must not grow the read scan. No new index or table is installed, even in the proposed schema file.

This is a Studio issuance-composition proof, not a complete app route/admission/privacy integration. Existing Source ownership/readiness/generation/fresh Admin/Join guards remain integration obligations. Native mutation/version increments must be composed atomically by the actual owning adapters; test failure injection does not prove those production hooks exist. The experimental full-rights format and capacity issue remain unselected. The owner has a pending explicit choice about compact tokens with current local indexed rights checks versus full rights in the token; neither is adopted by these tests.

Each native snapshot and final signing guard now starts a fresh `first-primary` D1 session. A reusable issuer captures only its binding/config, not a database session or bookmark across requests. This matters because subsequent reads in one first-primary session may use replicas satisfying only that session's bookmark. The test checks fresh primary anchoring on both the first and later calls; it does not claim the simulator reproduces a distributed replica race.
