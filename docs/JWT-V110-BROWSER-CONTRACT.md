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
