# Private nine-website testing

The human authorised the existing nine websites and builder in the isolated Cloudflare preview, preserving permissions and leaving live Academy unchanged. The current homepage styling is the approved AcademyStudio baseline. This work stays on `feature/academy-studio-private-preview` and deploys only to `academy-studio-preview` in account `2b01ca929611669e032703ff19f7098f`.

## Content and rights

The saved nine-site inventory contains 91 lessons, 17 distinct exact draft/published JSON objects and 38 deduplicated artwork objects. Content/IDs and both editions are preserved in private R2; D1 holds their operational pointers and test rights. No teaching files, invitations or secrets enter Git or public static assets. Real accounts, payments, answers, PDF/recording inventories, Zoom links and source Library/timetable are not imported. Foundations is admin-accessible in the preview while its live public access and eventual location remain unchanged.

Temporary synthetic test roles use the existing gates: Global Admin sees/edits nine sites; Course Admin edits only Al Kahf; Learner has Al Kahf purchase plus a synthetic paid month covering seven Tafseer websites; a Surah Grantee has only Yaseen website access, with no recording grant; an unenrolled account sees no private websites. These fixtures do not represent actual payments or learner entitlements.

## Private access

Only the preview entrypoint imports `preview-identity.mjs`. A private HMAC invitation is bound to one of five known synthetic IDs and a seven-day deadline. Its secret is supplied through a Worker secret, never configuration or browser assets. A valid login uses the existing one-use handoff/session exchange, Secure HttpOnly cookie, current active/admitted/epoch guard and standard server permission checks. Login and refresh update only identity freshness; they never restore roles, grants, purchase, admission or active status. Invalid invitations require no D1 reads. Expiry closes every private API even if a session cookie remains.

The private access page removes the invitation fragment from history immediately and never stores it in browser/device storage. Account switching broadcasts session invalidation. The website chooser clears its contents on account/session change and loads one bounded metadata page, without lesson text, participants or the Academy database. Builder links reflect administration scope; backend checks remain authoritative. Existing Save, explicit Publish, history, media and revision checks are unchanged. All preview edits remain in preview storage.

Real Academy sign-in, integration events, account provisioning/resume, Library navigation and the Academy popup stay disconnected. Normal `src/worker.mjs`, disabled/local `wrangler.jsonc`, source Academy and DNS remain unchanged. Access instructions and role links are in the private project output `outputs/academy-studio-nine-site-preview-20261028/ACCESS.md`; do not publish that file or paste its codes into logs.

## Import and local verification

`prepare-private-preview.mjs` verifies the reviewed source checksums and builds a private upload plan plus a parameter-escaped SQL seed. R2 writes are deduplicated and resumable. A completion marker prevents a repeated import from overwriting later drafts or restoring revoked rights; a failed first import can be resumed before invitations are deployed. This is a one-time controlled preview import, not a migration/synchronisation job.

The complete local regression suite passed 48 tests. The all-nine native preview rehearsal additionally verified exact editions/91 lessons, visible site counts 9/1/8/1/0, private Save, explicit Publish, unchanged peer sites, immediate grant removal and a blocked repeat import. Browser checks confirmed the directory, original Al Kahf artwork/draft and manual Save; changing to the learner account cleared the other tab's builder and exposed no editing links.

Two source-integration tests initially failed because the separately developed local source connector now requires additive schema 0012. Only the disposable test fixture was updated to apply that schema when present. Both checks then passed (and the full suite passed); no source worktree, live schema or Academy data was changed.

Keep hosted checks small: upload 55 prepared R2 objects and apply the initial preview seed once; deploy the preview entrypoint/secret; verify a bounded anonymous/admin/learner smoke batch plus one browser view. Do not exercise live Academy or repeat full acceptance remotely. Actual deployed version and smoke evidence belong in the private project outputs.
