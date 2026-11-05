# V110 compact Studio token — selected contract and independent proof

## Current Studio decision — 5 November 2026

The owner explicitly selected **one compact Studio access JWT**. This supersedes embedding every Studio grant and the proposed separate Tafseer/MOU/Course-cookie experiment. The split experiment was stopped before any remote commit or test run; there are no split-cookie results to report.

Studio keeps its own signing key, issuer/audience and access/opaque-refresh family. Existing Academy programme/role claims and Hifz's independent identity/live native checks are unchanged by this Studio choice. No live database, identity link, copied profile field, sync, authority, config or deployment change is authorised. The database/deployment holds remain controlling.

The access token contains existing user/family/parent/browser bindings, credential/unlock/policy versions, original sign-in/deadline, issued/expiry times and token ID, plus an exact identity-format marker. It contains **no Tafseer, Surah, MOU or Course grant list**. Studio uses the requested resource's current indexed native rights and metadata in the same Studio Worker flow. Existing Course FREE policy permits eligible signed-in readers without a paid grant; private/unpublished/admin/Source/class/Join checks retain their own rules.

Access remains at most15minutes; refresh ends at the original absolute7days; only that app's qualifying foreground refresh advances its independent90-minute lock. Logout/switch, reset/suspicious cancellation, versioned durable notifications and separate keys keep their agreed semantics. Compact selection does not approve a browser-switch mechanism or storage migration.


## What the prototype does

`src/auth/v110/compact-studio.mjs` composes the existing strict JOSE/configured-cookie engine with an exact compact marker. It rejects full-rights input/format, wrong app/key, unexpected claims and excessive/expired lifetimes. Its account-bound refresh derives identity/version/family fields from current local records; callers submit only an opaque refresh and foreground flag. It does not read or export material-grant lists.

The accepted prepare-before-CAS order is retained: current identity read, validate/sign/cookie/result preparation, then the final primary CAS/audit against the full selected family tuple, exact policy version, native account flags/epoch and current cancellation/expiry/idle gates. Bounded churn emits no cookies/writes; known failures before commitment preserve the original secret. Entirely lost successful responses retain the known unknown-outcome limitation.

`authenticateCompactStudio` verifies the compact JWT and reads current native account plus family/browser/credential/policy/parent/idle floors in one indexed identity query. It returns a trusted server-side actor; no material permission is inferred from that identity. Existing resource handlers enforce their current grants/publication/source/ownership/window/role rules. Low-level token/actor helpers are server-internal; HTTP adapters must allowlist output and keep private/auth responses uncached.

No new DDL, numbered migration, native grant writer, config or real handler import is introduced. Existing full-rights modules remain unimported historical proof. This is source-only work on the retained V109.23 feature base; future integration must preserve V109.24 or any later reviewed canonical pair.

## Independent test scope

Tests run only on disposable GitHub runners. The job modes execute the suites; direct Node tests and setup() fixtures still include the older Miniflare imported by tests/fixture.mjs. The bundled matched-route/refresh Worker uses the selected production compatibility-date runtime. A passing production-date job does not mean every fixture ran on that workerd:

- Strict compact shape and app/key/purpose/expiry checks, including rejection of the historical full-rights token format.
- Normal and maximum-supported identity lengths; exact Studio access/refresh and coexisting Academy-cookie header sizes, plus1024bytes reserved for unresolved browser/CSRF cookies. The parent cookie is tested with0and16 own-programme scopes; its separate capacity remains an Academy obligation. Byte calculation is not a full real-browser/privacy proof.
- One compact identity read and fixed token size with2000 additional native Course rows for the same synthetic person (1000PAID/1000FREE). This shows no grant export/scan during refresh; it does not remove per-resource permission reads.
- Matched retained full-rights versus compact issuance metrics, preserving row/statement/write distinctions and making no whole-flow or CPU savings claim.
- Policy-version re-prepare, credential cancellation, size/signer failures before CAS, independent90-minute equality, original7-day clipping and stale native Admin rejection despite a freshly signed identity token.
- An actual Worker-local refresh response issues only Studio's access/refresh cookies and no Academy cookie.
- Matched native versus compact GETs execute the same native website route, current material queries and published R2 response on synthetic local-owner data. Purchase revocation, another user's lack of paid access, FREE policy and withdrawal are checked with the same unchanged compact identity token. A known parent cancellation is denied before content.

The matched route test uses a **test-only source bridge**: it exports the current private route and moves its existing checkedActor branch ahead of legacy-cookie parsing, then supplies an actor only after compact signature and current-floor checks. The native business route body is unchanged. This bridge is compiled in memory on GitHub; production `src/worker.mjs` is untouched. It covers GET website reads in `AUTHORITY_MODE=WEBSITE`, not all routes, Source mode, writes, conditional304 recovery, media Range, browser CSRF/UI or provider-host transitions. GET/R2 metrics are measured separately from refresh/audit writes. The lab counts D1 round trips/statements/rows and R2 get/head calls, with blocked/zero Academy calls; observed harness wall time is not billed Worker CPU. These are not hosted-account measurements.

## Remaining authority and age mapping

The compact gate replaces the ordinary legacy account-status age checkpoint with the agreed local token/session/cancellation/idle checks. It does not write a newly verified native timestamp. Actual native fresh-Admin guards continue reading the existing `verified_at`; a newly minted JWT cannot turn stale Master authority into fresh authority.

Source-mode `accessGate` age/readiness behavior remains a separate integration gate. Map ordinary authentication-age refresh to eligible local original7-day/90-minute sessions without globally disabling Source readiness, generation, authority/COMMITTED, master-account fences, timed class/audience rules, fresh Admin or the exact Join window. Do not globally lengthen `boundedAge` or flip `AUTHORITY_MODE`. This proof's local-owner GETs do not establish the Source-mode/outage policy across all routes.

Material grants now remain current native decisions. Do not add per-person grant-version fanout merely to support the abandoned full-rights export. Identify which remaining security/identity/policy claims require a version fence. The owner's earlier subscription-triggered silent-replacement policy must be mapped explicitly to the chosen compact design; no writer/outbox effect for it is installed here. Credential/reset/browser/parent cancellation still needs durable, idempotent security receipts/floors and the agreed PIN behavior.

The accepted writer map and exact predicates in `JWT-V110-EXISTING-DATA-CONTRACT.md` still control MOU last-cohort/kind cleanup, conditional credential-write success, profile count versus cancellation receipts, existing counter domains and permanent ID links. No grant, copy, role owner or journal record is rewritten by compact selection.

## Activation hold

Complete the actual writer/security event map, remaining native route/Source/lifecycle/browser/CSRF/privacy integration, matched full-flow costs, hostname readiness, and concrete live storage/config/cutover/rollback effects. The owner must approve those concrete live DB effects before execution. This contract and isolated tests are not activation clearance. No V110 deployment is requested or performed.


## Completed isolated results — code915253dc, run42015598431

[GitHub run42015598431](https://github.com/MaktabForlife/AcademyStudio/actions/runs/42015598431) passed59cases in each CI job mode plus212named paired regressions: **330case executions, zero failure/cancel/skip**. These are not330distinct tests. No live app, hosted SQL, real identity/journal/media, Mac source/build/test or production config/deployment was used.

Production-date measurements for synthetic36-character identity bindings:

| Measurement | Result |
| --- | ---: |
| Compact Studio JWT |804bytes |
| Studio access Set-Cookie |870bytes |
| Studio refresh Set-Cookie |112bytes |
| Coexisting Academy16-own-programme-scope Set-Cookie |1977bytes |
| Combined known Cookie request header |2773bytes |
| Combined plus1024-byte future-cookie allowance |3797bytes |
| Access Set-Cookie at maximum180-character identity bindings |1638bytes |
| Combined maximum-identity case plus allowance |5331bytes |

The experiment budgets are3600token bytes,3800Set-Cookie bytes and8192combined request-header bytes. Those are engineering budgets, not a claim about every browser/proxy limit. Parent data is independently bounded; these0/16-scope scenarios do not prove every Academy account fits. Synthetic UUID contents can change compressed parent sizes slightly between runs.

Adding2000Course rows for the same person (1000PAID/1000FREE) increased compact token size by **zero bytes**. Refresh performed4statements/14rows read/5written over3D1round trips:3rotation/audit statements plus1current identity read. The retained full-rights refresh comparison used10statements/22rows read/5written. This is an issuance-only comparison, not overall application savings.

The actual Worker refresh returned2Studio Set-Cookie headers in1top-level request with0Academy calls. Matched fresh website GETs used1Worker request,4D1statements/round trips and2R2gets in both modes; native legacy read12rows and compact read14. Denials after purchase removal/withdrawal used2statements, and a known parent cancellation stopped the compact request after1statement and beforeR2. Validity of the unchanged identity token did not preserve revoked material access. Harness wall time is not billed CPU.

Legacy job127205237084/artifact13408923683 has API-reported SHA256 `7e9893336f4551b6c357c64403a3e291ea8563d97c8046da147d93c3c77497a5`. Production-date job127205237505/artifact13408603812 has API-reported SHA256 `0b3c929c2ce138b2834d83cd4f9c80a53e4da33b657d74a25ec7d90677e7588f`. Results belong to immutable code `915253dc50ec9a1c4f2b54aaebff00be2e4e4431`; later documentation-only edits do not extend those runtime claims.


## Optional access-data caching — assessment only

The owner asked whether the first compact-authenticated request can load all access information and cache it for subsequent requests. Yes: compact identity tokens and a separately stored derived access summary are compatible. **No caching backend or implementation is selected by that question**, and no live cache/resource/config change is made.

The current matched compact test proves a native purchase can change while the same identity JWT remains valid. Therefore the JWT's validity, its `pv` alone, or a cache TTL cannot establish that a grant summary is current. A derived cache needs a current authoritative permissions basis with complete invalidating-writer coverage, plus the independent current session/native resource/security guards.

A candidate safe design is:

1. Key derived facts by environment/app, exact native account, requested offering/scope, authority generation and the appropriate existing native permission revision/basis. Do not assume all relevant writers already change one counter; prove coverage, including Course policy, scoped/global roles and MOU last-cohort/kind/date semantics.
2. Check that current basis from Studio's authoritative local data as part of the resource flow. Reuse a correctly bound cached facts object only for that exact basis; mismatches/misses reload the native facts under a consistent revision and use a new immutable cache key.
3. Continue checking current account/family/browser/credential/parent/idle, publication/withdrawal, source readiness/master fences and time/class/Join/Admin rules. Cache facts, not an unconditional final allow decision. A cache outage/miss falls back to the current native reader; an unavailable authoritative security/version check must not become stale-cache authorisation.
4. Preserve the existing DBs/copies/ID links and retain no raw credentials or private journal content in this cache. Browser copies can speed interface rendering and must be cleared/masked on logout, switching or lock; they cannot authorise server requests.

[Workers KV](https://developers.cloudflare.com/kv/concepts/how-kv-works/) is eventually consistent: updates, including a formerly missing key, may take60seconds or more to become visible in other locations. KV can hold immutable version-keyed derived data with a current authoritative version gate; it cannot be the sole current-version/revocation authority. Stale/missing KV data is a cache miss, not permission to accept an old grant.

The [Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) is local to each data centre, and local delete does not globally purge copies. It does not remove the need for an authoritative version check and explicit account isolation. This assessment does not authorise caching actual private HTTP responses or changing their no-store policy.

[Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/) offer their own strongly consistent transactional storage and reusable in-memory state. They add coordination/storage/operation choices; that consistency does not by itself make a copied D1 permissions view current or atomic with a D1 writer. No new Durable Object namespace or security authority is proposed for installation here.

The matched fresh local-owner website GET currently performs4D1statements/roundtrips (14rows read,0written) and2R2gets behind the compact gate. Its native deployed-code counterpart performs4statements/roundtrips (12rows read,0written) and2R2gets. Both take1top-level Worker request with0Academy calls in this synthetic scenario. A KV lookup may add an operation without eliminating a necessary metadata query. Loading every grant on first access also increases cold-request work. These measurements justify comparing a narrower per-account/offering cache against the existing indexed queries before choosing all-account caching. They do not prove caching is faster/cheaper, or that those numbers cover Source mode, browser preflights, Range, writes, refresh/outbox or billed CPU.

No routine Academy checkpoint is added by this candidate pattern: the current version check would be owner-local in Studio within the same Worker flow. Existing legitimate cross-app business/fresh-Admin/PIN interactions remain separate. Cache implementation, exact versions/invalidation/retention/privacy and matched cost tests remain a reviewable option, not a deployed design.


## Agreed browser-cache policy — 5 November 2026

The owner agreed to the browser-cache recommendation after reviewing refresh and clearing options. This selects the following policy for Academy, Studio and Hifz; it does not select a KV/R2/Durable Object permissions cache or authorise database/config/deployment changes.

| Data / event | Agreed behaviour |
| --- | --- |
| Public app code, styles, icons and other genuinely public assets | Cache for reuse with versioned filenames/URLs so a release loads the right version. Keep useful public assets when a person signs out. |
| Personal access/menu display information | Temporary app memory, bound to the current native account, app session and browser context. Use it to avoid repeated interface-loading requests. No persistent personal access copy in localStorage, IndexedDB, service-worker caches or public/shared HTTP caches is selected. |
| Private/auth API responses and protected content | Preserve the existing private/no-store policy. A UI memory copy is display state, never server authorisation. Hifz journal data retains its live native read/write behaviour. |
| Logout / account switching / known session cancellation | Immediately mask private UI and explicitly clear personal memory/display state for the old context. Discard late asynchronous results from that context. Coordinate other tabs/apps; do not wait for a cache TTL to protect an account switch. |
| Independent90-minute inactivity lock | Mask and clear that app's personal display memory when its agreed lock deadline is reached. Cache hits, pointer activity, another app's activity and background refresh do not advance the server clock. Only that app's acknowledged qualifying foreground refresh does. |
| Return from suspension, Back/forward restoration or a restored page | Keep private UI masked until the current account/session/browser context and applicable lock/cancellation status are rechecked. An unverifiable context must not redisplay the previous person's information. Existing eligible local-child outage semantics remain; this does not add routine Academy checkpoints. |
| Updated access / native policy | Server decisions continue using current native permissions. Refresh/replace the memory display after a relevant successful change or when an existing response reports a newer view/version. Exact UI freshness intervals are not selected here and do not redefine the15-minute JWT or90-minute lock. |
| Manual refresh / app-controlled reset | Clear the app's selected display data and load it again as needed. Local clearing itself requires no Worker call; fetching replacement data can. Clearing browser data is not server-side logout or revocation. |

Each app can clear only its own origin's app state directly. Same-origin tab communication can coordinate that app's active tabs; ordinary BroadcastChannel/localStorage does not cross Academy/Studio/Hifz origins. A shared root-domain cookie does not automatically clear sibling app memory/storage. The global browser-context/switch mechanism remains a separate unimplemented review gate; agreement to this cache policy does not approve the previously proposed signed marker or prove cross-origin/offline clearing.

Implementation must bind cached displays and in-flight requests to an exact account/session/browser generation, clear/mask before switching context, and reject old responses even if their request began before logout or lock. Suspended/Back-forward tabs need real browser tests; expiry/no-store alone is not proof that rendered private UI disappeared. Do not store raw access/refresh credentials or private journal content in this display cache.

Targeted clearing is the default policy. A broad Clear-Site-Data response is a separate compatibility/cookie-scope choice, not a selected replacement for session cancellation or per-app coordination. Its cache/storage directives and cookie removal have different scopes; no broad wipe/header/cookie behavior is installed by this agreement.

The existing optional server-side access-cache assessment remains **unselected and unimplemented**. The compact JWT identity/policy version alone cannot validate a material-grant cache. Any future server-side cache still requires a current authoritative native permissions basis, account isolation, invalidating-writer coverage, current resource/security guards and a measured benefit over indexed native reads.

Sources: [browser caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control), [origin-bound tab messaging](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API), [clearing site data](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Clear-Site-Data).

This records an agreed policy, not a completed implementation/browser proof. No runtime source, database/schema/data/copy/ID/sync, live cache namespace, hosting/config or deployment change is made by this documentation update.

## HTTP privacy follow-up after independent review

Optimisation accepted the selected compact source proof at915253dc/run42015598431 within its stated scope and independently verified both artifacts. It explicitly found that the lab's Response.json errors lacked no-store headers. This follow-up changes only the synthetic adapter/tests and this document, not a live handler or database.

Every lab private/auth response now passes through one finishing path that sets private,no-store and nosniff, including success, resource denial, parent cancellation, malformed/missing/duplicate cookies, method rejection, configured-host mismatch, disabled-platform response and unexpected configuration failure. Errors expose an allowlisted code only; successful refresh exposes kind/metrics and two separate bounded Studio Set-Cookie headers. All non-refresh/failed responses must release no cookies; early errors perform no D1 or R2 work.

The background refresh test now reads __Host-uas_r from the request Cookie header rather than a fixture environment secret, validates the exact configured Origin and exercises duplicate/missing/partial cookies and a previous-raw in_progress response. It remains a BACKGROUND refresh with foreground=false; session-bound CSRF and qualifying-foreground admission are still unimplemented integration gates. Exact public/provider hostname transition behavior is not proved by a synthetic configured-host check.

The outer PLATFORM_ENABLED gate is tested at503 before identity/resource work. Unexpected binding/config failures are caught inside the privacy wrapper and return a sanitized, uncached503. Source writes remain unsupported and fail closed at405 before native Store.guard/mutate; no legacy token_hash is manufactured for a compact actor.

These tests do not establish late/mixed/lost cookie recovery, browser clearing/paint/BFCache/privacy,304/Range, actual security event hooks, Source mode or complete HTTP entry parity. The agreed memory-cache policy remains a policy, not implemented client code. The database/deployment holds remain controlling. New source results will be attached to the next immutable test run; existing330executions remain evidence only for915253dc.
