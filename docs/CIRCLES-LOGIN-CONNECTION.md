# Circles login connection — 30 October 2026

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

The user explicitly asked `circles` to coordinate changes. Login and backend edits stay in this integration checkout; the UI owner continues editing the public design separately. Take a fresh committed public-design snapshot after its flyer-popup handoff and retain these connection modules.

The ownership direction reported from `optimisation` is recorded for a later controlled handover: Academy retains master identities/login/status revocation; Studio owns its eventual specific access roles/entitlements. Placement of the management interface in Academy Admin is under discussion. This login change adds no administration interface, transfers no offering authority and performs no dual authoritative writes. Existing parallel `AUTHORITY_MODE=ACADEMY` and all current rights remain in force. A per-offering handover must reconcile original rights and stop old entitlement updates from overwriting Studio-owned rights while retaining master-status revocation.

The current review deliberately uses `/circles/` alongside the native Studio/reader routes. It does not replace the hosted root homepage or the standalone Sites prototype. A reviewed hosted release and remaining destination connections are separate steps. All 49 imported media attachments remain unpublished.
