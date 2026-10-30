# Circles login connection — 30 October 2026

## Live review now available

Subsequent media connection: at your explicit request, the copied original PDFs/recordings are now enabled under the same protected gates; no new media or UI release was added by that operation. See [EXISTING-MEDIA-PUBLICATION.md](EXISTING-MEDIA-PUBLICATION.md). References below to unpublished attachments describe the earlier homepage-release stage.

At your request to make this the homepage so you can log in, Circles V108.2 is now active at https://academy-studio-parallel.naidu-hajira.workers.dev. It uses your existing real Academy account ID/PIN. The prior local Academy page was a synthetic handoff placeholder; its browser tab now opens the real homepage and sign-in form. Root Circles and `/studio/` routes, nine existing website catalogue cards and the Fatir pending notice are deployed. Existing Academy remains available. All 49 imported media attachments remain unpublished. The flyer layout request followed by “ignore” was excluded.

The V108.1 twelve-hour verification policy and fresh sensitive Admin checks are preserved. Full local regression passed 126 tests; seven small unsigned hosted checks and the browser homepage/login view passed. A real PIN was not used by the operator. Release version, runtime, rollback and private receipts are recorded in [CIRCLES-RELEASE-1082.md](CIRCLES-RELEASE-1082.md). The preparation history below describes the earlier local stage; its deployment hold has been fulfilled by this specific release.

## Circles homepage and Tafseer connection

The user now wants Circles as the homepage and its Tafseer entry connected to Studio. The prepared local build serves the current Circles design at `/`, with `/circles/` retained as an alias. Native catalogue, reader and staff-management entry pages live at `/studio/`. This is a presentation-route change; server APIs, website identities, teaching editions, roles and media publication are unchanged.

The Tafseer card keeps the approved anonymous Log in / Apply for access choice. After the same Academy sign-in, it opens `/studio/?view=collections&collection=tafseer` with Tafseer selected. Signed-in visitors go directly there. Courses selects its own native tab. Catalogue links open the existing Studio website/Surah ids; staff editing remains separately gated by the existing APIs. The native Home action and brand link return to Circles.

Old root bookmarks containing website/edition/reading context, the collection view or management entry are routed to the corresponding Studio entry with their query and fragment preserved. Device progress/reflections continue using the same origin/account/website keys. This neither migrates nor duplicates learning records. The public homepage and login retain the same design snapshot and Academy session flow.

Fresh preparation: ignored `local-content/circles-home-tafseer-20261030/`. The current review at `http://localhost:8930/` was updated without restarting its backend or resetting sessions. Its contents and accounts remain synthetic. Ten focused route/login/permission regressions and 133-module checks pass. Chrome verifies Circles root → Tafseer choice → login → selected native Tafseer catalogue → existing Surah, preserved published-edition bookmarks, and Home → Circles. Evidence: parent `outputs/circles-login-connection-20261030/home-tafseer-build.json`, `home-tafseer-tests.txt` and `tafseer-studio-catalogue.png`.

Hosted rollout is separate. The deployment owner has now completed the verification-only Studio V108.1 release, without changing its assets or content. A future Circles release must retain that deployed twelve-hour behavior and fresh staff checks, use a later release label, prepare the approved public catalogue, and receive separate deployment approval. Do not overwrite the newer runtime with a V108.0 configuration or activate the 49 unpublished media attachments as part of this route change. No hosted call, deployment or real content publication occurred in this continuation.

The current Circles public design now has a native Academy login adapter in the local integration build. The Circles UI checkout remains owned by the `circles` chat; its original preview is untouched. The connected review is prepared under ignored `local-content/`, independently of both hosted systems and the completed private media import.

## Connected behavior

- Header and existing-member login entries use the established Academy account ID/PIN flow, through the existing same-origin `/auth/login`, one-use PKCE `/auth/exchange` and `/api/me` endpoints. The browser holds only the existing HttpOnly website session cookie. No independent credentials, master account token, role or payment register is created in Circles.
- Anonymous learning cards retain their Log in / Apply for access choice. The selected area appears on the login form. Existing contact/enquiry actions remain unchanged. Tafseer/Courses continue to the native permission-filtered learning catalogue after login. General login shows the actual account menu.
- Open Academy uses the existing connector, with an exact configured origin, the actual child window, PKCE/state and a one-use server handoff. It establishes an Academy session without asking for a second PIN. No master Academy token is sent back to Circles.
- My learning opens `/?view=collections`; Open Studio opens `/?manage=1` using the same website session. Studio still enforces real server permissions. A learner sees no administration scopes and cannot open an administrator workspace. A small discovery correction excludes retained `ACADEMY` offerings from Studio's Course/Tafseer selector; those programmes remain managed in Academy.
- Existing session changes/sign-out update the account entry. PIN fields clear after success, ordinary rejection or closing the dialog. First-PIN confirmation uses the existing Academy setup response rather than a separate credential store. No remembered-account/PIN storage is added.
- The local public-design entry disables prototype role/dashboard selection and omits its browser-only text editor. No prototype state becomes application authority. Prepared login links stay on the connected origin even before the adapter finishes loading.

Mothers, Academia and Hifz selections are retained as navigation context, but their continuation currently opens the native Academy home. Exact programme landing routes remain follow-up work; no programme identity or entitlement is guessed. The existing Academy screens and per-account Hifz connection remain available.

## Reproduce the local build

From this checkout, with the UI owner at a clean committed revision:

```text
node tools/prepare-circles-login.mjs ../../sites/academy-design-directions-20261029 local-content/<new-review-directory>
ACADEMY_SOURCE=../Academy-parallel-access-release PREVIEW_CIRCLES=1 PREVIEW_PORT=8930 PREVIEW_PUBLIC_ROOT=local-content/<new-review-directory>/public node tools/preview.mjs
```

Open `/circles/` on the local website port. The separate Academy port is 8931. The tool prints synthetic test accounts; no real credential or hosted login is used. The prepared design includes the index's declared CSS/JS dependencies so a coordinated flyer revision does not replace the login adapter. It records the exact design commit and index checksums in `build.json`. Private migration bundles are never included.

## Verification and limits

Ten focused native tests pass against the deployed V108 Academy source with disposable databases: Academy sign-in, incorrect PIN, exact verifier/state binding, one-use/replay denial, Studio account reuse, learner administration denial, sign-out, cancelled login, configured-destination allowlisting, spoofed-window/origin rejection, popup failure and existing platform permission/publication regressions. The current syntax/configuration check covers 130 modules, with remote bindings disabled.

Chrome checks confirm incorrect PIN rejection; successful Circles login; existing-session recognition; Academy session continuation without a second login; the native Studio workspace; sign-out; preserved Tafseer login/application choice; and the Tafseer label on the native login form. Native login dialogs fit 320px, 390px and 768px iframe viewports without horizontal overflow or clipped controls. This is a responsive browser check, not a physical-device test. The Academy destination uses the existing connector with a small local success page; full Academy frontend/Library acceptance was verified in the earlier V108 integration and is not repeated here.

Evidence: private parent `outputs/circles-login-connection-20261030/`, including `tests.txt`, `phone-checks.json`, `login-desktop.png` and `login-responsive.png`. The standalone viewport override did not change the Chrome viewport, so responsive conclusions use explicit-width iframes. No hosted reads/writes, real-account test, media activation, source permission change, push, deployment or new teaching data occurred in this login continuation.

## Coordination and next boundaries

The user explicitly asked `circles` to coordinate changes. Login and backend edits stay in this integration checkout; the UI owner continues editing the public design separately. The connected review now uses its final flyer-popup revision `b8527a904507c254cf51dcaef8ca4965ab074839`, superseding `c21123d`. The new `flyer-gallery.css` is included through the index's declared dependencies. Nine legacy membership links are rewritten to the connected local entry before JavaScript initialization.

The design snapshot was refreshed in the same review without restarting its server or changing sessions. The previous copied design is retained privately for recovery. Browser checks confirm all seven gallery images, correct public contact hrefs, no popup horizontal overflow, and ordinary Tafseer welcome-dialog class reset before the separate native login opens. The login still fits the three phone/tablet frames. Existing sign-in/Studio/native-connector code is unchanged by the UI refresh, so no additional login or hosted traffic was needed. Evidence: `build.json`, `flyer-connection-checks.json` and `flyer-gallery-connected.png` alongside the refreshed login screenshots. A page already open for the user's review is not automatically reloaded.

The ownership direction reported from `optimisation` is recorded for a later controlled handover: Academy retains master identities/login/status revocation; Studio owns its eventual specific access roles/entitlements. Placement of the management interface in Academy Admin is under discussion. This login change adds no administration interface, transfers no offering authority and performs no dual authoritative writes. Existing parallel `AUTHORITY_MODE=ACADEMY` and all current rights remain in force. A per-offering handover must reconcile original rights and stop old entitlement updates from overwriting Studio-owned rights while retaining master-status revocation.

The initial login review used `/circles/` alongside the native root routes. The latest prepared build now serves Circles at `/` and moves the native entry to `/studio/`, as described above. The hosted root homepage and standalone Sites prototype remain unchanged pending a reviewed release. All 49 imported media attachments remain unpublished.
