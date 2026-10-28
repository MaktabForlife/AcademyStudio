# Academy website platform migration and Studio prototype

## Active local implementation baseline

The human subsequently authorised continuing the build locally. The independent repository is `work/Maktab-web-platform`, on feature branch `feature/website-platform`. Its first coherent local baseline is commit `653c0e64c07d8f9734aeecb620ca2a81505b13c6` (11 passing native local tests plus syntax/configuration checks). This is a local commit, not a push or deployment. Content/editor work should branch from that baseline, keep the nine preserved packages separate from source authentication/entitlement work, and use [CONTENT-API.md](CONTENT-API.md). See [STATUS.md](STATUS.md) for remaining integration/acceptance items; the prototype sections below remain historical evidence.

Local implementation on `feature/academy-website-studio`, based on V107.120 (`4cbb787c`). Deployment, pushing, hosted migrations, resource creation and live content changes require the human's approval. Release markers and active deployment configuration remain unchanged. Keep live checks small: use the saved packages and synthetic local fixtures first.

All further migration work must remain on a dedicated feature branch, including integration, configuration and tests; do not work directly on development/main. No deployments tonight (28 October 2026, Riyadh), and no automatic deployment afterward: the approval hold remains in force. Do not deploy APIs/Workers/frontends, apply hosted schema/resource changes, publish content or cut over production as part of this handoff.

## Confirmed review decisions — 28 October 2026

The human supplied these decisions after reviewing the expanded migration handoff. They supersede the narrower prototype's account, repository, sign-in and media-retention assumptions below. This is a local planning update, not implementation, remote repository creation, resource creation or deployment approval.

| Topic | Confirmed direction |
| --- | --- |
| Cloudflare placement | A separate Cloudflare account from Academy. The specific account and hosted identifiers are not selected here. |
| Repository | A separate repository for the website/learning platform. No remote repository has been created or pushed. |
| Offering scope | Tafseer and all paid Courses. Rehearse and cut over offerings individually; all paid Courses are in scope, rather than only a pilot subset. |
| Sign-in | The website owns the public homepage and offers the existing Academy sign-in there. One user sign-in must admit the user to authorised Academy/website destinations; do not introduce another website login or independent website credentials. A private website session may be established through the Academy authentication flow without asking the user to sign in again. |
| Course purchases | Each Course is purchased as a whole, with rights to its recordings and PDFs. A different Course requires a separate purchase. Course access is not a monthly subscription. Preserve separate live-session eligibility and staff permissions. |
| Recording retention | Tafseer and paid-Course recordings do not expire automatically. The 14-day recording policy remains for other programmes. Preserve Tafseer's existing paid-month, historical-cohort and individual-Surah grant boundaries; a website-only grant still does not grant recording access. |
| Public homepage | The entire existing public homepage, including public cards for programmes remaining in Academy and public announcements, belongs to the website platform. Their Academy scheduling and other retained programme functionality remain in Academy. |

The human suggested a 24-hour maximum delay for Academy suspension/status propagation and explicitly invited advice. Treat the number as provisional, not a final staff-authority or outage policy. The proposed design is prompt signed status delivery with durable retry/acknowledgement and a bounded learner fallback of at most 24 hours from verified current Academy status. Local page views cannot renew that age; a known suspension blocks immediately on receipt. If freshness cannot be renewed, protected delivery stops at the bound. Website-local entitlement revocation, staff-role removal and content withdrawal take effect locally without waiting for Academy. Sensitive administrator operations should require fresher Academy account/admission confirmation rather than silently inheriting the learner fallback. These proposed distinctions still need confirmation; timetable cancellations and Zoom changes must not be intentionally delayed for 24 hours.

Cross-account communication must replace the prototype's same-account private service bindings with authenticated server-to-server endpoints and a scoped browser sign-in handoff. Keep credentials, bearer tokens and Zoom links out of public snapshots. Retry using operation IDs and monotonic versions; duplicate, missing or out-of-order deliveries must not restore older status, entitlements or timetable facts. Routine website reading/media/Join checks use website-owned data and current locally enforced rights, not Academy queries on every request. Operational database choice/schema, repository name, domain, backup and publication-history retention remain design work; the prototype's three Core tables are not the final ownership model.

One scope clarification remains: whether the free public Foundations learning pages also move. Their existing public access must be preserved regardless of the eventual location; migration of the public homepage alone does not settle this question.

No personal journals exist to migrate. Separately, the existing reader stores completion progress and reflection answers in browser-local storage (`academy/course-websites/reader.mjs`, `remember`/`restore`). A new origin cannot simply read that storage. Plan an account-bound transfer or explicit export path that preserves stable course/lesson/reflection IDs without creating or publishing a personal journal service. This device-held state was not included in the nine saved-content rehearsal packages.

## D1 read usage — mandatory design and acceptance requirement

The human explicitly requires all processes to be optimised because D1 reads are limited. This applies to the website and its Academy integration, including authentication, status delivery, enrolment, administration, timetable publication, content publication, media delivery, retries, scheduled work, migration, backups and verification. A separate account does not remove the need to reduce the combined work. This requirement does not approve the provisional 24-hour policy, implementation or hosted changes.

Measure rows read, not just HTTP requests or SQL statement count. D1 counts rows scanned; a small response, narrow column selection or batch of queries does not by itself reduce scanned rows. Include triggers, reference/permission checks, retry/conflict paths and index maintenance when assessing reads and writes. Verify query plans and row metrics using representative synthetic local datasets; do not assume a LIMIT avoids a scan or that putting a body in R2 makes its admission/metadata reads free. References: [D1 pricing and row accounting](https://developers.cloudflare.com/d1/platform/pricing/) and [index use](https://developers.cloudflare.com/d1/best-practices/use-indexes/).

| Process | Required design direction |
| --- | --- |
| Public homepage, public cards and announcements | Serve published R2/static representations with shared caching. Target zero D1 reads per public view, including cold content retrieval; public requests must not enter Academy's database-backed dashboard/setup path. |
| Academy sign-in and website session establishment | Reuse the verified identity result through the scoped one-use handoff. Keep necessary Academy credential/session checks bounded; avoid repeating them in the callback, each component and each asset request. Never replicate independent website credentials. |
| Protected websites, PDFs, recordings and Join | Target zero Academy D1 reads during routine website use. Use website-owned participation/material rights and stored timetable facts. Use compact, indexed local authority lookups with safely reusable account/offering/version proofs; content bodies and media bytes remain in private object storage. Repeated images, PDF requests and video ranges must not rebuild the entire user/grant/timetable state. Every protected delivery still passes the appropriate local gate. |
| Account changes and reconciliation | Capture the required change in a durable outbox alongside the authorised source transaction where possible, rather than rereading the whole account population. Deliver small versioned deltas, acknowledge them and retry only outstanding operations with bounded backoff. Receipt/version checks must make duplicate or reordered delivery safe. No periodic full-account scans or browser polling. |
| Freshness renewal and administrator authority | Reuse a bounded verified authority result and coalesce refresh work for the same account/scope. Refresh only active users or an operation requiring fresher authority; a 24-hour bound must not become a daily sweep over every account or a renewal per tab/asset. Sensitive admin freshness does not imply an Academy query per field edit, checkbox or request. Preserve atomic current local authority checks at write time. |
| Enrolment, purchases, paid months and grants | Apply indexed account/offering deltas in bounded operations. Resume the same incomplete workflow on retry without resyncing full rosters, recreating accounts or reapplying grants. Page/search large registers; preserve durable acquired rights without reconstructing all payment history on every read. |
| Timetable and Zoom publication | Validate and prepare each changed publication once, preserving required guarded acceptance checks. Deliver only the changed offering/session facts or a bounded scoped snapshot, and reuse it for all readers. No per-learner rebuild, minute-based database refresh for card clocks or repeated full-Academy snapshot. Corrections, cancellations and link changes still propagate promptly. |
| Website/media editing and publication | Store bodies and immutable history per website in R2. Use small indexed pointer, entitlement, reference, audit and receipt records. Save only changed data; do not rebuild shared Academy setup publications or publish on every keystroke. Reuse asset identities and byte objects. Preserve explicit Save/Publish and the existing transaction, conflict, private-draft and revocation guards. |
| Scheduled jobs, recovery and migration | Use indexed pending work, checkpoints and bounded batches; avoid idle loops and repeated scans of history. Reuse approved recovery evidence and rehearsal inputs. Plan and count the necessary coordinated source snapshot/backups rather than repeatedly exporting live stores. Retire the corresponding legacy background reads at each verified offering cutover. |
| Measurement and live verification | Record per-operation query plans and row metrics in local fixtures, including warm/cold reads, expired authority, revocation, retries, bulk changes and media ranges. Reuse request metrics and saved evidence; no new per-page analytics write or database polling just to measure savings. Keep later approved hosted checks small under ../AGENTS.md. |

Before implementation is accepted, define and verify a numeric read/write budget for each workflow and an aggregate daily estimate for both accounts, including background work and recovery/retry headroom. Protected-operation budgets remain to be measured; no current savings or universal zero-read protected path is claimed. Verify that routine costs remain bounded as the number of unrelated Courses, learners, paid months, media items and historical publications grows. Separate account/repository placement is not proof of this result.

Cache design must specify account/scope/version keys, maximum age, revocation/withdrawal invalidation and outage behaviour. A stale cache cannot reopen withdrawn content, restore revoked local staff/grants or extend the last verified Academy status indefinitely. Optimisation must retain all required permission and integrity checks; choice of D1/R2/other coordination storage should be justified against the total storage/request/compute cost rather than merely moving unmeasured work elsewhere.

## Revised target and retirement boundary — 28 October 2026

The subsequent discussion expands the desired scope from an editor to an independent Tafseer and Courses learning platform. The current code is the Studio prototype; the broader migration is not implemented or deployed. The prototype's same-account/Core-only infrastructure below is not a final commitment for the larger platform.

| Owner | Responsibilities |
| --- | --- |
| Academy | Master accounts, account status and admission; timetable authoring; master programme/course Zoom links. |
| Website/learning platform | Tafseer and migrated paid-course content, local participation/content rights, persistent media and grants, websites, lesson-media management, private session cards and joining. Public homepage editing, timetable-card presentation and public announcements also move here. |
| Published connection | Versioned timetable facts and private effective Zoom settings; website presentation and locally owned media are combined there. Link changes and timetable corrections must trigger delivery. Routine website page views and Join checks should use the target's stored publication and current local authority. |
| Library navigation | Academy Library remains in Academy with approved return navigation to the originating website/course/lesson; no duplicate Library store. |

Persistent content access is distinct from current subscription/live-session access and staff privileges. Historic paid material and explicit grants must survive subscription expiry; Academy admission must still allow those former participants. Master-account suspension and staff revocation must remain enforceable. Retention/backups must match the material-access promise, and existing website-only Surah grants must not silently gain recording rights.

The human confirmed that no personal journals currently exist to migrate. The existing-data migration covers materials, their relationships and access rights. Future Journal development is separate and is not a dependency for this migration; optional journal hooks in the prototype are not evidence of a deployed journal service.

### Administration sections moving to the website

The Course screenshot and the later Tafseer Program screenshot identify the same four sections:

| Current Academy section | Website responsibility after migration |
| --- | --- |
| Participants | Manage participation, scoped local staff roles, paid months and additional content grants, preserving existing rights and permissions. Reuse the Academy master account ID. |
| Public card | Edit website/homepage card wording, display-time labels, appearance and visibility using Academy's published scheduling facts. |
| Media / Lesson media | Upload, attach, manage and publish lesson PDFs, videos and notes, preserving existing file identities, relationships and access gates. Inventory shared Library/media references before moving storage. |
| Enrolment requests | Receive and manage course/Tafseer requests; coordinate authorised Academy account creation/linking with website enrolment. |

Academy retains timetable preparation, validation and review/publication, plus the scheduling-owned parts of Details, Classes and Sessions. A website content publication remains separate from an Academy timetable publication. The participant/media/enrolment moves apply to Tafseer and courses actually migrating; they do not remove those tools from programmes remaining in Academy. Homepage public-card authoring follows the separately agreed website ownership above.

### Coordinated enrolment

Provide one administrator workflow across the two services:

1. A website request identifies the desired offering. For an existing learner, explicitly select/link the existing Academy account; do not merge identities by name or phone alone.
2. For a new learner, an authorised operation creates the master Academy user using the current account-creation and scope permissions. Academy retains sign-in credentials and returns a stable account ID.
3. The website enrols that ID into the selected offering and applies only the participation/material rights approved under the existing policy. Creating an Academy account alone does not grant course access; a request's self-reported payment is not verification of payment.
4. Persist pending/acknowledged completion and reuse operation IDs on retries. If Academy account creation succeeds but website enrolment fails, retain the account and resume the outstanding enrolment without creating a duplicate or reporting false completion. Account/PIN credentials are not copied through the browser.
5. Course withdrawal changes local participation/live rights while retaining the Academy account and any previously acquired material rights under the agreed policy. Master account suspension still applies.

The current public enrolment endpoint requires an existing signed-in Academy account; it is not an anonymous new-user registration flow. Any future public new-user request flow needs its own defined approval/provisioning path. Preserve the actual existing authority boundaries: generic account registration/linking is Global Admin-only, while the scoped course participant-create operation currently has its own authorised account-creation path. The split must not widen either permission.

### Retire Academy Learn and Teach for migrated offerings

The human requested removal of these delivery screens for Tafseer and Courses. This is a retirement of the migrated offerings' Academy interface, not deletion of the shared Academy Learn/Teach system or their data.

1. Identify migrated offerings by stable IDs. The scope is Tafseer and courses actually moved to the new platform, not every activity sharing a Learn/Teach component.
2. Verify the replacement learner/staff website, access and historical rights, media/notes, coordinated enrolment, published timetable corrections, joining, account revocation and Library round-trip before retiring the corresponding Academy route. There is no existing journal migration to verify.
3. Replace their Learn/Teach entrances and saved destinations with verified website entry/handoff links. Keep old bookmarked URLs as scoped redirects. Preserve the existing Academy destinations for other programmes.
4. Remove the migrated offerings' duplicated background reads, prefetches and media/session-card assembly from Academy's delivery responses. Do not remove the authoritative timetable data/export, master-user/admission information or shared permission code.
5. Transfer media and attachment relationships using stable IDs; inventory shared files first. Retain read-only recovery sources and history until separate cleanup approval. Do not delete users, paid-month records, grants, files or notes merely because their old screen is removed.

No product-code removal, live migration, resource creation or deployment has been performed for this revised scope. The existing local validation below proves the narrower Studio prototype only; it does not validate this future cutover.

## Infrastructure of the current Studio prototype

| Component | Requirement |
| --- | --- |
| Repository | Reuse this repository; independently built `website-studio/` application. A second repository is optional. |
| New compute | One Cloudflare Worker with static assets and a small API. Static files route directly; only `/api/*` runs the Studio Worker. A separate Pages project is optional, not required alongside this configuration. |
| New storage | One private R2 bucket: drafts, immutable published JSON versions, shared images and opaque sign-in records. No public bucket or public media URL. |
| Database | Three small operational tables in the existing Core D1: current pointers/revisions, asset references and retry results. No new D1 database and no website bodies in these tables. |
| Existing services | Academy accounts, current sessions, scoped Admin authority, paid months, additional Surah grants, native media, timetable, assessments and optional journal remain Academy services. |
| Private links | Studio `ACADEMY` → Academy `WebsiteStudioAcademy`; Academy `WEBSITE_STUDIO_CONTENT` → Studio `StudioContent`. Private service bindings require no new external API key. |
| Address | One separate Studio origin, configured consistently in both applications. A Worker address or a custom subdomain may be selected at deployment. The committed placeholder is deliberately not a working production address. |

A new Worker separates code and releases; it does not provide another account allowance. Academy reader requests still need their current access checks. Website traffic is not being converted into anonymous public downloads.

## Behaviour and permissions

Existing app links launch Studio in a separate tab through a one-use, 60-second PKCE handoff. Academy bearer tokens stay in private server storage; browser messages carry only a token hash used to detect account changes. Studio uses a Secure HttpOnly cookie, exact-origin checks for all mutations and a bounded session. Each API operation checks current Academy session and scope. Metadata commits recheck current account, credentials, session and actual Admin authority inside their atomic write guard; a client-selected workspace never grants authority.

Browser-only account-continuity messages make no API/database requests. Account switching clears the editor, buffers and object URLs; a cookie/account mismatch also prevents an old tab acting under a replacement session. The Academy opener should remain available. If continuity cannot be confirmed, Studio closes its private view and asks to reopen from Academy. A blocked popup leaves a clickable fallback link. No draft or bearer token is written into browser storage; existing account-keyed editor preview preferences contain only local preview state.

The full builder, on-page text editing, manual Save, review/Publish, withdrawal, course-copy import/export and prepared teaching copies run in Studio. Course copies retain native Academy references rather than embedding PDF/video bytes. Import checks those references again under the current account and selected website. Images remain portable in course copies.

PDFs and videos are selected from published Academy Lesson media. The picker loads one bounded page and fetches earlier materials only when requested; it does not load the timetable. A new media item is uploaded/published in Academy first, then attached by its lesson/file identity. PDFs appear under Course materials; additional recording links can be removed in the editor. Existing automatic recording/timetable feeds continue. The native media services enforce current publication, class, paid-month, retention/expiry and withdrawal gates. A website grant does not create new recording rights.

Learner URLs and the shared reader renderer stay in Academy. Migrated website JSON/images are loaded through the private Studio binding after the existing website access gate. Public Foundations remains public, other Surah access still follows paid months/additional grants, and protected native media still requires sign-in. Student progress, reflections and optional journal paths are unchanged. Studio previews do not write to a student's journal.

## Publication and storage

Studio validates the existing course model and same-website references. Text is bounded to 500 KB, a complete immutable version to 1.2 MB and website references to 100. Image uploads are verified by actual bytes, type and SHA-256, bounded to 5 MB each, and shared once by hash. Native PDFs/videos retain their existing Academy size limits/storage; Studio stores no copy of their bytes.

R2 content is written before the small guarded Core pointer transaction. Failed object writes cannot advance publication, a failed transaction leaves only private unreferenced objects, stale saves conflict, and exact actor/payload-bound retries reuse their result. The current published edition stays readable while a private draft changes. Withdrawal is a live pointer gate. Older pending Academy publications cannot replace the Studio publication switch.

Studio save/publish never rebuilds the Academy shared setup head or adds body components to Core/Admin. Future website body/history growth moves to R2 per website/Surah. The old D1 bodies and history are retained; this change does not immediately reclaim their storage. Publishing still writes a few pointer, availability, audit and retry rows. Each Studio action also incurs R2/service requests and current-access checks; moving code alone does not make those free of work. Static editor assets and account-continuity messages require no D1 query.

No version-retention policy or history deletion has been introduced. A previous discussion of three versions was not approval to discard history. Before enabling hosted storage, configure lifecycle cleanup only for expired sign-in records: `auth/handoffs/` after one day and `auth/sessions/` after eight days. Runtime expiry is enforced immediately (60-second tickets; sessions no later than the original Academy token or seven days), independently of cleanup. Do not apply those lifecycle rules to website versions or images. Old failed-operation objects and retry/audit history should be pruned only under a separately reviewed retention policy.

## Migration, cutover and recovery — after approval only

1. Choose the Studio origin; create the private bucket; configure the two auth-prefix lifecycle rules and include Studio R2 plus Core metadata in recovery backups. Existing media backups remain necessary. The new Core schema migration is `backend/migrations/academy-core/0010_website_studio.sql`.
2. Update Academy with its new private entrypoint while the feature remains disabled. Deploy Studio with its private binding to Academy. Merge the reverse binding using `backend/wrangler.website-studio-bindings.example.jsonc`, still with the flag disabled. This ordering avoids a circular first-deploy dependency.
3. Configure the actual Studio origin, Worker route/domain and API vars. `website-studio/wrangler.jsonc` currently has `workers_dev:false` and a placeholder origin; an address must be explicitly configured before deployment. Keep the bucket private. Do not copy the Studio origin into `ALLOWED_ORIGINS`: browser API calls remain on each application's own existing origin, and the cross-service calls use private bindings.
4. Enable `ACADEMY_WEBSITE_STUDIO=1` only after bindings, schema and both builds are ready. Legacy editor mutations are then rejected; existing readers fall back to their unchanged legacy edition until their website is migrated. Save/upload/attach performs that website's migration, or an authorised Studio client may explicitly POST `/api/migrate` for one selected website. No bulk scan is required.
5. Migration brackets the separate legacy draft and accepted published edition with the Core source version, preserves them separately, verifies/copies image bytes by hash, writes private R2 versions, then commits their pointers atomically. Conflicting source work requires a fresh retry. It preserves withdrawn states. Legacy direct website PDFs need an explicit Academy Lesson media mapping; migration stops with a clear error instead of silently copying/exposing them. The nine saved website packages used for rehearsal contained images but no direct website PDF assets.
6. Verify one selected website, one entitled learner, one denied learner and one attachment after approval; do not crawl dashboards or all tables. Keep production checks bounded. Confirm that the saved draft and accepted edition match the intended current live source; saved local packages alone cannot prove that nobody edited live content later.
7. Rollback: disable the feature to restore the retained legacy editor/reader sources. **This shows the old legacy edition, not Studio edits published since migration.** Before a rollback that must preserve those newer edits, export the current Studio website copies and restore them through the authorised legacy workflow with native media mappings; test the restore and review publication before changing the switch. Never delete R2 versions/metadata during rollback. For Studio-specific failures, prefer repairing the binding/object or temporarily withdrawing only the affected website over changing unrelated live content.

## Local validation and limitations

- Native Miniflare integration tests exercise the actual private entrypoints, Workers, D1 transactions and R2 objects: one-use handoff, scope/CSRF/session checks, account-cookie binding, migration, shared images, retries, competing saves, withdrawal, native PDF/video access, paid-month/additional-grant boundaries and simulated R2 failures. A separate atomic-write test revokes Admin authority after planning but before the guard executes.
- Existing editor, inline text, website, native-media, publication, grant/cache and release-integrity regressions cover the disabled legacy path and shared renderer. The course-copy test verifies that native PDF references survive export/import without uploading PDF bytes. An older pending-publication test verifies the new Studio switch guard.
- Browser acceptance blocks all external origins and serves only synthetic `academy.test` / `studio.test`. It checks secure launch, manual Save/Publish, learner content, visible images, desktop/phone controls with no horizontal overflow, on-page editing, account-switch clearing and blocked-popup fallback. Screenshots and reports live outside the shipped tree.
- `backend/tools/academy-website-studio-rehearsal.mjs` accepts a saved measurements JSON and an output JSON. It imports the nine saved packages into synthetic local Academy storage, migrates them through the real private API and compares both editions. It never calls the live app or hosted SQL. These packages are a saved-content rehearsal, not a current-live-content inventory.
- Both Worker packages are checked with Wrangler `deploy --dry-run`; no resource is deployed. Studio runtime bindings are generated by Wrangler. The bundled native test runtime supports compatibility date 2026-09-28; the intended Studio configuration is 2026-10-28. Build packaging accepts it, but production-date runtime behaviour and real DNS/service bindings remain to be verified after approval.

Evidence directory: project-level `outputs/academy-website-studio-20261028/`; test/build logs: project-level `outputs/academy-studio-*.log`. No production requests, hosted database queries, pushes or deployment were used for this implementation.
