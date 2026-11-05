# Proposed shared-browser contract — for review, not implemented

The owner asks why Studio/Hifz must confirm when Academy controls sign-in and sign-out. Academy makes that decision. A child acknowledgement is a durable delivery receipt; it is not permission to sign in.

The existing independent-session/outage design can leave a child accepting an old local session when it has not received cancellation. The owner's actual response asks for an explanation, and does not select the earlier wait-for-ACK versus allow-during-outage choice. Do not silently implement either policy.

## Alternative to review

Use a separate Academy-signed, root-domain browser-session marker with the original seven-day deadline. The 15-minute Academy access cookie cannot serve this role: its expiry must not force routine Academy calls or terminate otherwise eligible local child sessions.

The marker would carry only browser/account/parent-session generation bindings, original sign-in/deadline and active/signed-out state, with a distinct token purpose/audience and preprovisioned verification keys. It grants no app access by itself. Academy is the sole configured writer; child access/refresh cookies remain host-only.

Every protected request, local refresh, unlock/admission callback and media Range request must require a valid current marker whose account, browser generation, parent session and deadline agree with the app's own token/family. Missing, expired, mismatched or signed-out marker fails closed before private results or writes. Each app's local cancellation/credential/unlock/version gates and independent 90-minute lock still apply.

Academy would change or clear this marker at sign-out/account switch. A correctly enforced shared marker could let this browser obey Academy immediately without waiting for a child database notification. Durable signed retries/ACKs are still required for server-side state and other devices. During an Academy outage an unchanged eligible active marker/local session can continue to original expiry, subject to local lock/known cancellation. This is not an unconditional immediate remote-revocation promise.

## Required proof before selecting it

1. Pin the actual cookie, purpose, signing-key and origin grammar. No Host/Origin-derived trust; no child/public-static response may overwrite the shared marker. Test provider/public host transitions and parent access-cookie expiry separately.
2. Serialize all Academy browser-state-changing responses across tabs. Ordinary access renewal and app PIN unlock must not rewrite an old browser marker. Prove lost/aborted responses, tab crash, duplicate operations and a delayed old Set-Cookie cannot restore an old account after a new sign-in. A shared HttpOnly cookie alone does not prove this.
3. Mask/clear private UI/media on blur, suspension, pagehide and account change; revalidate through the app's own endpoint before showing private state on focus/pageshow. Discard late old-account results. Any readable UI hint is non-authorizing and may only trigger locking/revalidation.
4. Test real multiple-tab/window Chromium behaviour, suspended/BFCache pages, live media/PDF Range requests, parent-cookie expiry, lost refresh cookies and bounded re-admission during an Academy outage. Browser privacy must cover already rendered material as well as server authorization.
5. Prove old-cookie/marker replay and notification delay against the precise threat model and current local browser-generation floors. If the marker approach cannot close those races without a current Academy call, state that clearly and return the concrete policy/cost tradeoff for owner decision.

No admission, switching, logout barrier, browser cookie or PIN route is changed by this proposal. Optimisation must review the mechanism and evidence before it replaces an ACK-dependent contract.


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


## Isolated display-memory component — review fixes proved on GitHub, review pending

An unimported component at `src/auth/v110/browser-display-state.mjs` develops the agreed temporary UI-display policy without changing real app entrypoints or database/config/deployment state. It holds only an exact versioned navigation/display DTO in app memory. It never stores credentials, private journals or protected media, and is not a server-side material-permission cache or authorisation decision.

The consumer must provide a fresh authoritative `verifySession` response binding the native account, app/parent family, browser generation, credential/security/unlock versions, original sign-in/deadline and last acknowledged same-app qualifying foreground refresh. Initial display views can piggyback on that response. **The actual producing HTTP endpoint and trusted global browser-context mechanism remain unimplemented**: the lab provides a synthetic loopback stub, not evidence of current Master identity, actual app authorization or outage-aware source freshness.

A monotonic request-start deadline conservatively clips the display at the earlier of the original seven-day end and own-app last qualifying foreground refresh plus90minutes. Cache hits and background rechecks cannot extend it. A new acknowledged own-app foreground time can move the local deadline only within the original end. Server authorization remains authoritative.

The component masks and drops its internal display state before rendering hooks, aborts pending requests and advances a local epoch. Old completions are discarded even if a loader ignores abort; a per-key sequence also rejects an older response/failure after a newer display response. DTOs are cloned on input/output. Unknown credential-shaped properties, foreign context and unsafe links are rejected. The optional memory budget evicts display entries; valid oversized data may be returned once without truncation/caching and does not cap material access.

Lifecycle integration clears on hidden/pagehide and starts verification while masked on visible/pageshow. Expiry, logout, switch and known cancellation clear memory. Optional app-specific BroadcastChannel messages contain only a clear signal/reason and coordinate same-origin tabs. A real same-app/different-origin negative control deliberately remains unaffected: **cross-origin Academy/Studio/Hifz clearing is not solved**. No shared marker has been selected.

Consumer hooks must actually remove/mask the private DOM, stop and detach media, revoke transient URLs and clear other app-owned references. This helper cannot erase copies retained elsewhere or retroactively remove a rendered frame. Its epoch does not stop a delayed HTTP Set-Cookie from reinstalling old credentials. Same-origin messaging, actual global switch/logout enforcement, suspension/BFCache/media/Range behavior in integrated apps, session-bound CSRF, qualifying foreground refresh and all remaining source/writer/recovery/activation gates still require separate proof.

Tests are restricted to disposable GitHub runners. Node fixtures cover local mechanics and independent app clocks. The Chromium harness uses loopback servers, synthetic accounts and actual DOM/tabs/history; it records whether that run used BFCache instead of claiming all Back navigation is BFCache. Persistent-storage calls are instrumented in the synthetic page. No real cookies, native database, Worker, media or app build is used, and no Worker-cost or full privacy result can be inferred. The isolated workflow requires no application dependencies and does not rerun unrelated accepted auth suites. Immutable results are recorded below for optimisation review.


### Completed isolated display-memory results

Source/test commit `a9458b24f27e6f5c2fcb27c58487af21fa1c4498`, [GitHub run42034115062](https://github.com/MaktabForlife/AcademyStudio/actions/runs/42034115062), job127267683575: **16 top-level executions,0failure/cancel/skip**. This consists of14behavior unit tests,1scope-diagnostic test and1real-Chromium test; these are separate targeted results, not a repeat or expansion of the accepted330auth/paired executions.

The disposable runner used Node24.18.0 and Google Chrome156.0.8078.79. Synthetic tests cover cache cloning/hits, own-app acknowledged foreground clocks, absolute original expiry, delayed verification, logout/switch and late responses ignoring abort, latest same-key response/failure, invalid/unverifiable context, same-origin and different-origin boundaries, hidden/pagehide/restore, oversized replacements and unsafe links. An oversized replacement now retires any older cached entry before deciding whether to cache the new value. Earlier source7af9cd54/run42033905189 also passed but did not assert that replacement case; a9458b24 is the corrected source/evidence.

The real browser made no additional loopback request for two hot display hits, removed actual personal DOM text in the active same-origin second tab, rejected the old person's delayed response after switching the synthetic stub to another person, and recorded0old-account visible animation frames after the test's switch boundary. Back navigation actually used BFCache in this run and stayed masked/empty when fresh stub verification denied the context. The same-app other-origin negative control retained its own display, explicitly demonstrating that this channel does not provide cross-origin clearing.

Instrumented Storage.setItem, IndexedDB.open and CacheStorage.open calls were0in the synthetic page. This records those instrumented calls plus source review of the helper's memory-only design, not a universal browser-storage/media/privacy audit. No real app entrypoint imports the component; no actual cookies, trusted Master-context endpoint, source DB, hosted SQL, Worker, media, live config or deployment were used or changed. The global switch/late-Set-Cookie and integrated app/media/Range/CSRF/foreground/cancellation gates remain open.

Artifact13416998197 API-reported ZIP SHA256: `ec289ca87197dbf76cb193cfc2eb50ab907c2b6d7d09f22f58a41d7e485cd485`. It contains synthetic browser.json, source.json and TAP log only. No complete app/browser authorization, cross-origin/offline purge, cost saving beyond these display-hit requests, or deployment clearance is claimed.


### Review corrections — notification failure and early expiry timer

Optimisation verified the exact a9458b24 artifact/evidence but returned two source issues; it did not accept automatic local masking/expiry. A throwing/closed BroadcastChannel could skip onClear/onState because broadcasting preceded those hooks. An early expiry callback could leave a ready display with no timer armed. The previous16-case evidence remains historical and does not prove these failure paths.

The corrected helper invokes the local mask/clear and state hooks before best-effort tab notification, catches transport failure independently, and makes no peer-delivery guarantee. A current ready expiry callback that fires before the original deadline now re-arms for the remaining time; older epoch callbacks cannot alter a newer timer. The original deadline and own-app acknowledged foreground rules remain unchanged.

New failure-injection units require local clearing/state notification despite throwing transport on both logout and timer lock, and require an early callback to leave a new timer armed followed by autonomous deadline clearing without any state/peek/load call. The Chromium fixture closes its actual native BroadcastChannel, requires the failed post to be recorded only after the actual private DOM is masked/emptied, and then verifies the local page remains usable for recheck/history tests. It does not infer peer clearing from failed delivery. Completed targeted results for this correction are recorded below; optimisation review remains pending. All real-app/cross-origin/auth/media/source/DB/config/deployment gates remain unchanged.


### Completed review-fix proof

Corrected source/test commit `d24b1f9dbae08a8f5f0c262f86cf72e37b2373ca`, [run42035878516](https://github.com/MaktabForlife/AcademyStudio/actions/runs/42035878516), job127273771659: **18top-level executions,0failure/cancel/skip** =16behavior unit tests,1scope diagnostic and1real-Chromium test. This replaces a9458b24/run42034115062 for the current helper's scoped masking/expiry evidence; neither run is a330-auth-suite rerun.

The throwing-transport fixture confirms local mask and masked-state hooks complete before attempted notification on both logout and autonomous timer lock. The early-callback fixture observes a replacement timer still armed and then observes the clear hook at its original deadline without invoking state/peek/load to discover expiry. The timer retains the same session/deadline and ignores callbacks from an older epoch.

Chrome156.0.8078.79 closes the actual native BroadcastChannel. The next logout records1failed native post, with the actual private DOM already hidden/empty before that failure; no exception prevents local clear, state notification or subsequent local recheck. This is local behavior only and does not establish delivery or clearing in a peer tab. The retained late-response, same-origin DOM, cross-origin negative control and denied Back/BFCache checks also pass; actualBFCacheRestore=true in this run. The same synthetic storage instrumentation still records0calls. Node24.18.0 and all execution/temp files remain exclusive to the disposable GitHub runner.

Artifact13418042615 API-reported ZIP SHA256: `ce92b6dc4b31efc5a09bca43dea251a90a1147c69f89016130c60f34b3c1a762`. The prior18/16 counts are top-level executions, not distinct authorization scenarios or production guarantees. Actual fresh authoritative context/global browser coordination, real app DOM/media/retained references, delayed cookies, integrated suspension/Range/CSRF/foreground/source/lifecycle and all activation gates remain unimplemented/unproved. No real frontend import, database/data/copies/IDs/sync, hosted SQL, live config, canonical source or deployment changed.
