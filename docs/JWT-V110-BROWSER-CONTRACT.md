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
