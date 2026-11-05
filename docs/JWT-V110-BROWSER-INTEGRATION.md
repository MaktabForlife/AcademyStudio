# V110 real-app browser integration — feature preparation

The owner authorised real-app integration and cross-app clearing, review with optimisation, GitHub feature branches and use of Academy's existing feature_worker. No database change or production deployment is authorised. All source/test work stays in GitHub; no Mac source/temp writes or local builds/tests.

This branch starts from Studio4874ecf7, preserving the separate old-baseline JWT proof branch. Later release composition must re-pin the latest Academy/Studio/Hifz heads and retain the independent management bug fix. This branch is not a promotion tree.

## Current protocol draft, not integration acceptance

The accepted display-memory helper fromd24b1f9d is copied unchanged. New modules develop an Academy-origin static iframe UI control relay, strict configured origins/window-source/document nonce/request matching, opaque shared parent/browser binding hashes, serialized revision compare-and-set and local-first clearing. Only an Academy-origin consumer can establish a display binding. A child can request clearing but cannot choose a Master identity.

Broker state is deliberately non-authorizing control metadata: version, random revision, active/blocked, opaque parent/browser hash and original deadline. It contains no token, refresh fingerprint, native account ID/name, role, material access, private journal or media. It is a separate same-origin control latch, not a persistent personal display cache or a selected signed root authorization cookie. It cannot grant any server permission.

All content requests retain native current authorization. The client must mask on unverifiable/missing/broken coordination, require fresh app-owned V110 family context before reveal, and prevent late responses or old sign-in completion from reviving a superseded context. Native IDs may differ between apps: cross-app binding uses the shared parent/browser generation, never equality of native Academy and Hifz student IDs.

The consumer's actual fresh context producer and genuine qualifying foreground time are required. Legacy verifiedAt/profile/session timestamps cannot be renamed into the V110 DTO. Feature context must fail closed when actual family authority is unavailable; no fake Admin freshness, source age extension or material permission cache is implied.

Master establishment must occur only after the real Academy sign-in/handover response and the exact preceding clear revision; ordinary access renewal or child input cannot rewrite it. The protocol is not a proof against delayed Set-Cookie reinstallations or server-side old-cookie replay. Those remain separate release gates, along with source ownership/outbox/current cancellation, PIN/admission/unlock/CSRF/foreground, actual storage/rollback and full app costs.

The final same-site Academy app subdomains are the target. Cross-site provider addresses are not equivalent: storage partitioning may isolate an embedded relay. Disabled/corrupt storage, missing Web Locks, partitioned state and unreachable transport must remain masked; do not use an unknown broker as a new valid-session baseline or claim guaranteed offline/global purging.

The first workflow runs only new protocol units/syntax, not native apps, real Chromium, full JWT auth, live stores or the prior330suite. Native API/root/media integration and real three-origin positive/negative/failure browser evidence are still in progress. Completed results will identify immutable sources and their exact scope.

## Feature Worker boundary

Read-only inspection of the owner's existing Academy Cloudflare dashboard confirmed feature_worker shares dev-academy-core, dev-academy-admin, private R2 and live coordinator bindings. It is not an isolated database environment. No hosted login, JWT family installation, migrations, writes, mutation routes, scheduled jobs or private upstream calls may be exercised under this hold.

Any hosted preview must use a tested static/read-only boundary with no reference to these bindings or upstream private services. It may display public source and synthetic, clearly identified fixtures only. Actual auth/session/notification writes and all database changes remain confined to disposable GitHub fixtures until a specific storage plan is approved. Preserve the existing Worker settings/bindings and recovery version; do not activate production routes or new domains.

## Native hooks and read-only producer follow-on

The feature branches now connect actual native bootstrap/profile/account/screen-clearing code, with explicit disabled public config. The new GET context routes are wired through each native outer entrypoint and validate genuine signed app cookies/current family/native identity in a primary SELECT without renewal or writes. Missing keys/schema/session/context stays unavailable; legacy timestamps are never invented into the DTO. Current native content authorization is retained. This is not full JWT issuer/admission/refresh/PIN/CSRF/native-write or server-cancellation cutover.

Shared source hashes, default-mode regressions and actual native context route tests are in the new workflow. The first8protocol tests passed at a0472dfe/run42065970725; that is not native/browser acceptance. The new context/native-hook run and real three-origin browser evidence are pending. The Academy extra accountId is supplied only by the checked native session response; it does not change copied profiles/IDs. Existing ordinary/native/Source/Admin clocks are untouched. No live database or feature/production Worker has been changed.
