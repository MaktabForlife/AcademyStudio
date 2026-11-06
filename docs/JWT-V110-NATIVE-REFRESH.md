# Native Studio JWT refresh transport — disabled review candidate

This next source stage starts from the accepted native-browser branch at 9447ae286506d091b4478128934e4c96e4de630a. It adds actual native HTTP routes for Studio's own opaque refresh family, with session-bound CSRF and current native identity checks. No Master call or Studio grant export is introduced. This is not full JWT sign-in/admission/native resource/browser activation.

GET /auth/v110/csrf reads current refresh ownership and returns a purpose/app/issuer/family/account/parent/browser/epoch/unlock/original-deadline-bound HMAC request proof. It requires the exact configured same-origin URL/Fetch Metadata (and matching Origin when present), valid own refresh and current local/native gates. It does not rotate, unlock or advance activity. A new tab can obtain its own proof without a still-valid access cookie or Academy call. The proof remains in the requesting browser's memory; no readable credential cookie is introduced.

POST /auth/v110/refresh requires exact Origin, same-origin Fetch Metadata, bounded JSON and the session-bound proof. It calls the accepted prepared compact issuer through an optional pre-rotation authorization hook. HMAC validation and signing/cookie construction precede the local CAS. One concurrent winner can emit a host-only access/refresh pair; losers emit no cookies. Database state stores fingerprints only; no successor recovery secret is stored. The original seven-day deadline does not move. Background is the default; only an explicit foreground request can update last_fg_refresh_s, and a 90-minute-locked family cannot be refreshed or unlocked here.

A true human/foreground browser-action adapter is not implemented by this transport flag. Server receipt of a same-origin boolean is not proof of human activity. Native Academy-only PIN, full local cancellation/outbox/writer ownership, browser/late-Set-Cookie fencing, streaming/media/permissions and hosted origin/cache/cost gates remain. In particular native resource handlers still use their existing authorization. Do not turn this on as a complete JWT deployment.

All responses are private/no-store/nosniff. Public JSON allowlists omit tokens/claims/internal prepared cookies. A required request-rate binding is keyed with a one-way HMAC of edge-provided IP metadata; it is rate protection, not identity/origin authority.

Activation requires JWT_V110_REFRESH=1 plus exact JWT_V110_REQUEST_ORIGIN when previewing a different reviewed origin, pinned JWT_V110_PUBLIC_KEYS_JSON, matching app-private JWT_V110_PRIVATE_KEY_JSON / JWT_V110_SIGNING_KID, separate random32-byte base64url JWT_V110_CSRF_SECRET, and JWT_V110_RATE_LIMITER. No secrets/config/bindings are installed by this commit. Disabled and missing-config paths stay unavailable. Keys are independent of Academy/Hifz. No unknown-key network retrieval occurs.

The owner has now authorised liaison with optimisation for isolated Feature databases and feature deployment when tested/reviewed/ready. Existing app databases remain untouched; optimisation owns the separate Feature isolation/setup. This source does not install schema or activate a Worker. All execution/temporary files are confined to disposable GitHub runners; no Mac writes/builds/tests. Synthetic fixture tables are not a migration or a complete native database.

Focused workflow uses the real Studio outer handle with a local D1 metrics wrapper, generated in-memory CI keys/refresh secrets and synthetic native identity rows. Results will be recorded by exact source/run/artifact after completion. It does not rerun the already accepted earlier browser/context/crypto/regression suites or infer complete-flow savings from refresh-only measurements.

## Completed native transport proof

Source `3d547d6970148cebabfb9e0f6dbf2dd19c1e126d`, [run42141085233](https://github.com/MaktabForlife/AcademyStudio/actions/runs/42141085233), job127641270649: SUCCESS, 36 case executions (10 top-level including grouped parents and26 nested cases), zero failures/cancellations/skips. Runtime selected compatibility date2026-10-28, Miniflare5.20261103.0-beta / workerd1.20261103.1. This is a selected native refresh transport fixture, not complete application/runtime/browser parity.

Actual outer Studio handle was bundled without source transformations. The only wrapper supplies isolated D1 counters/race injection and a synthetic rate-limiter. It has no hosted binding. Generated signing/CSRF keys and raw refresh values remain in CI memory, not artifacts. A real rotated cookie is accepted by the separate genuine native display-context endpoint.

Checks include exact Origin/Fetch Metadata, missing/cross-family request proof, bounded/malformed input, own cookie name/duplicates/foreign refresh, disabled/missing config/rate limits, active/admitted/native epoch, browser/parent/revoked family, own90-minute/future activity, native epoch race, bounded policy re-preparation, failed-audit atomic rollback,12 concurrent requests with exactly one cookie winner, and clipping to original expiry. No Master call occurs. A foreground boolean here is still a transport contract, not human-activity proof or a completed UI adapter.

Measured refresh-only fixture costs:
| Operation | Worker requests in the fixture | D1 statements | D1 rows read | D1 rows written |
| --- | --- | --- | --- | --- |
| Initial own CSRF bootstrap | 1 local dispatch | 1 | not recorded in this result | 0 |
| Background native refresh | 1 local dispatch | 4 | 14 | 5 |

These counts include the local family/identity/CAS/audit path. Initial proof acquisition is a separate own-app request; the same proof remains valid for that fixed family across ordinary rotations. There are zero remote Academy calls and zero hosted requests/SQL. These are not total-page, complete-flow or hosted billing measurements.

[Artifact13467104395](https://github.com/MaktabForlife/AcademyStudio/actions/runs/42141085233/artifacts/13467104395), SHA-256 `253347fcdba02e1052a650ccf401d09ec622f11c77a128eb2d509e896d04ee51`, was downloaded/hash-verified entirely in RAM. It contains scoped source/result/TAP evidence only. Initial run42140890926 at19eaa7d6 FAILED before CSRF bootstrap because ArrayBuffer results needed explicit Uint8Array conversion for base64url encoding. The correction was tested by the successful follow-up; the failed run is retained.

The optional pre-rotation callback addition is copied identically to Academy `a589130f205b962f0151a6064b9bb40fcc19b6a0` and Hifz `a0aebe7c6de9c328c05a06b7e23acabeec788672`. The shared compact module Git blob is `a3f7e18ea2facd9de2ad2ceec944979acf38e9d2` in all three repositories. Neither app gains a refresh route or changes its current native authorization in this stage. These branches remain independent from current canonical management/Feature work and need deliberate composition before activation.

Optimisation is coordinating the new isolated Feature databases. Its owner-approved testing approach uses disposable GitHub databases and a dedicated Drive fixture/report folder, no hosted synthetic/concurrency/growth suite. A final hosted check needs a concrete small Worker/read budget beforehand. Credentials stay in the approved GitHub environment; none belong in Drive or artifacts.
