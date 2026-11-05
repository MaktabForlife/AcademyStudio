# JWT V110 native browser integration — review candidate

This is a source-only, default-disabled feature stage for Academy, Studio and Hifz. The owner authorised GitHub feature branches, optimisation review and optional use of the Feature Worker. The hold on database changes and production deployment remains in force. No Worker, live database, DNS, route, key or cookie configuration was changed by this work. Source changes and test execution used GitHub; no Mac source or temporary files were written.

## Sources and release boundary

All three repositories use `feature/jwt-v110-browser-integration-20261105`.

| Repository | Tested source |
| --- | --- |
| Academy | `97fee6a673a8afdca62e5423d28b44e6579c2485` |
| Studio | `02f2f782c89e642c52a8223ad50c94fffa2efcad` |
| Hifz | `0f383f0b67171b87180ae4a9b523c3343ec647b6` |

The branches started from Academy `78736645`, Studio `4874ecf7` and Hifz `ba0ea53f`. These are review branches, not promotion trees. Later release composition must re-pin current canonical sources and preserve the independent management fix and Feature isolation work.

The agreed 15-minute access lifetime, original seven-day refresh deadline, each app's own 90-minute foreground-refresh lock, separate app keys/families and native ownership rules are retained. This stage does not implement the complete credential issuer or replace native resource authorization.

## Implemented in this stage

Each app has explicit disabled browser configuration and native bootstrap/profile/API hooks. A checked native account ID must match fresh, app-owned V110 context before the private display is revealed. Hifz's permanent student ID can differ from the Academy/Studio ID; cross-app UI binding uses the shared parent/browser generation.

An Academy-origin static iframe coordinates a browser UI fence using exact configured origins, window source, document nonce and request ID. Persisted control metadata contains only version, random revision, active/blocked state, an opaque parent/browser binding hash and the original expiry. It contains no credential, refresh fingerprint, account name, role, material permission or journal. Only an Academy-origin consumer may complete a display binding after the exact preceding clear intent. Children may request clearing.

This fence cannot grant or revoke server permissions. A received change masks the local display and invalidates pending private work. Every guarded response body checks the current generation and fence again. A previously displayed native document cannot be revealed again after clearing: resumption or a known browser change loads a fresh document. Existing native identity/DOM references can remain masked until that reload; this is not a claim of universal memory or offline purging.

That conservative reload has a cost: resuming a previously displayed tab re-reads its own context and native bootstrap data. Routine Hifz data queries do not re-read Academy authentication. Public asset reuse and hosted Worker accounting were not measured by the fixture.

Native Academy sign-out and the Studio/Hifz sign-out/switch paths request cross-app clearing. Local Hifz credentials and switch intent clear before waiting for the notification. Studio's completed private response/sessionStorage cache is bypassed in feature mode; in-flight deduplication remains. Hifz journal reads stay live and are not added to a private display cache.

A genuine read-only `GET /auth/v110/context` is wired through each native outer Worker. It is disabled unless `JWT_V110_BROWSER=1` and exact origin/key configuration is supplied. It verifies the intended app/key/purpose and current local family, native account, credentials, browser, security/policy versions, original deadline, parent cancellation and genuine `last_fg_refresh_s` in one primary SELECT. Academy retains its exact native Master account_sessions gate. Hifz uses local students.id/credential_epoch, not a login alias or Academy source revision. Responses are private/no-store/nosniff with no cookies or writes. Legacy verifiedAt/profile timestamps are never substituted.

The initial relay pageshow can arrive before CONNECT replies. The client now ignores that unadopted initial hint and still requires fresh READ/ASSERT results. Once a baseline is established, a changed revision invalidates the display. A focused regression and the real browser test cover this ordering.

## Evidence

| Evidence | Result and limits |
| --- | --- |
| [Native context/default regressions, run 42078727303](https://github.com/MaktabForlife/AcademyStudio/actions/runs/42078727303) | 13/13 protocol/context cases, 47/47 Studio regressions, 49/49 Academy regressions and Hifz syntax 40/0 passed. Overall job FAILED because Hifz root jsdom installation was omitted; this run is not reported as a green pipeline. |
| [Completed native browser/Hifz run 42084470647](https://github.com/MaktabForlife/AcademyStudio/actions/runs/42084470647) | SUCCESS, job 127445751421. Shared source/default-off check; 9/9 protocol cases; Hifz identity 99/0, handoff 34/0 and account separation 50/0; one real Chromium browser case, zero failed/cancelled/skipped cases. |
| [Completed browser evidence artifact](https://github.com/MaktabForlife/AcademyStudio/actions/runs/42084470647/artifacts/13442940246) | Artifact 13442940246, SHA-256 `5f071d6af971f34b35a625a77943ea603ae57ec48953c2ad69c293ceb0e910c7`. Contains source pins, shared hashes and synthetic logs/results. |

The context producer tests used actual pinned signatures and the native Academy feature outer runtime, Studio handle and Hifz index with isolated synthetic D1/native identity columns. They covered invalid/expired/foreign/duplicate/wrong-name credentials, origin/method/default-off/configuration, native activation/credential checks, family/browser/policy/parent cancellation, own 90-minute/future clocks, native Master session cancellation and absence of rotation/foreground/audit writes. Context runtime was selected production compatibility date 2026-10-28 using Miniflare 5.20261103.0-beta / workerd 1.20261103.1. These were context tests, not the full business schema or native resource cutover.

Positive context costs were one primary SELECT each: Academy six rows, Studio four, Hifz four; zero writes or remote Master calls. These are context-only fixture costs, not complete-flow savings.

The browser used Google Chrome 156.0.8078.79, three same-site loopback origins, actual Studio reader and Hifz frontend/API scripts, and Academy's real workspace markup/sign-in controller. Other Academy workspace controllers were excluded. HTTP native/context responses were explicitly synthetic; Master setup represented an already completed sign-in. This browser test does not prove the credential issuer, PIN, signed cookies or actual hosted domains.

It verified positive display in all three apps; two Hifz queries with distinct returned revisions and zero additional context/Academy API reads; native Academy sign-out clearing active Studio; a late old Studio response not being accepted; frozen Hifz returning masked after missing a notification; history return remaining masked; forged messages unable to reveal; a positive control followed by disabled-storage masking; and a cross-site provider frame having an empty independent Academy storage partition and staying masked. The cross-site frame was inspected through its separate DevTools target without disabling browser isolation. This is one selected Chromium environment, not a browser-support guarantee.

Development failures remain visible in Actions: missing root test dependencies, the obsolete switch-listener shape assertion (replaced with real callback checks), the initial relay ordering bug and a cross-process frame inspection assumption. No failing run was relabelled successful.

## Remaining gates

The full JWT cutover still needs the issuer and native Master admission binding; per-app refresh rotation/PIN/unlock/qualifying foreground writers; versioned outbox/retry/committed-ACK delivery and current cancellation writers; native JWT-only resource/write authorization; CSRF and late Set-Cookie/session replay fences; real media/object URL integration; storage migration/rollback approval; and hosted origin/cookie/cache/accounting checks.

Existing legacy credential storage and native resource authorization remain for compatibility while this feature is disabled. Browser clearing evidence cannot substitute for server logout/revocation or promise immediate global revocation during an outage. The agreed no-routine-checkpoint/original-seven-day child outage policy remains unchanged. No signed root authorization marker or server permission cache was selected.

The owner-open Academy dashboard was inspected read-only. At that inspection, feature_worker shared live Core/Admin, coordinator and bucket bindings. This chat has not deployed to it or used those stores for authentication. Its isolation is separate work; any future preview must first verify the isolated bindings or use a reviewed static/read-only boundary with no live-store/private-upstream use. No live tables were installed, seeded or altered.
