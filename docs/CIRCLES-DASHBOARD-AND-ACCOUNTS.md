# Circles dashboard and account switching — local review, 30 October 2026

The Circles homepage remains public before login and becomes the personal Academy dashboard after login. The existing circle blocks remain the primary programme navigation. This work is local on the owned feature branches; V108.5 remains live. A coordinated release needs fresh approval and reconciliation with the separate access-management work.

## Changes

- Replace Our story / Reflections at the top with actual Learn / Teach / Admin capabilities, and add an Admin or Global Admin badge to the account pill. Signed-in unlinked blocks are hidden; permitted programme choices remain on their existing blocks.
- Add For your attention, with upcoming Imtehaan inside it, Coming up next, Messages, Continue learning/teaching or Manage, This week, Academy calendar and existing Academy tools. No separate Imtehaan panel is added. Existing Mothers membership and each Course's independent rights remain authoritative.
- Remember at most ten verified account ID/name hints on this browser. Do not store a PIN, token, permission or role in that list. Switch user verifies the entered PIN, preserves the current account on failure, revokes only the replaced browser session after success, fences pending responses and clears private state across tabs. History snapshots clear private screens and reload the current session on restoration.
- PIN controls start empty and readonly until entry, request no browser/password-manager autofill, clear on account edits, dialog close and submission, and clear browser-restored defaults. Required-field validation unlocks the control before checking it. Setup asks the person to re-enter and confirm their PIN. Remembered-account selection still opens the keyboard for PIN entry.
- Native Studio starts with its old page hidden in the HTML. An accessible loading status remains until the requested route and access checks settle. Tafseer opens directly, with no first paint of the old homepage. Errors remain visible. External account switches reload Studio too.

## Native bridge and bounds

Source adds signed POST /internal/website/dashboard and a fixed dashboard continuation object {mode, tool, activityKey?}. Source checks the current session and exact native context at both code issuance and exchange. Destination URLs are allowlisted on the Academy connector. The Messages continuation opens the existing native inbox; no messages are sent by this work.

Target adds POST /api/circles/dashboard with only mode and an explicit refresh flag. Its private R2 summaries are bounded to 230 KB and keyed by hashed account ID, mode, credential epoch and navigation proof. Current actor and proof are rechecked before storing or returning fresh results. Twelve-hour proofs are reused; known changes invalidate them. Refresh is explicit and throttled within sixty seconds. No idle polling, population sweep or per-page/per-file Academy request is added. Sensitive Admin mutation checks remain sixty seconds. No new table, hosted SQL or content grant is required.

Projection reuses real native entrance, timetable, assessment, class-note and messaging readers, plus enrolment requests only for Admin. It returns bounded display metadata, not tokens, message bodies/recipients, marks, Zoom or file URLs. Optional service failures are shown as unavailable rather than a false zero. Learn routes use only existing reviewed Mothers, Tafseer and Course mappings; other programme and tool actions continue through native one-use handoffs.

## Verification and release boundary

Private parent evidence: outputs/circles-dashboard-20261030. Local synthetic tests cover native source readers, source context denial, independent accounts, bounded private caching, known invalidation, one-use handoffs, replaced-session revocation, connector URL rejection, remembered-ID storage, history cleanup and reader first paint. Browser checks cover two-tab switching, wrong PIN, learner/teacher/Admin selectors, forgotten IDs, empty PINs, direct Tafseer routing and a 390-pixel layout without horizontal overflow. The local connector reaches the correct native inbox route; its preview deliberately does not serve the full Academy Admin UI. Full hosted user acceptance is still pending deployment and your own sign-in.

An initial local UI review used frozen homepage checkpoint 648fe05. The release review preserves the already deployed e68d0b7 homepage/course content and adds only the requested native dashboard, navigation and sign-in behavior. Local editor controls are excluded. Circles' later cd0e2cc course-content handoff and subsequent pricing/classification corrections are a separate local phase, not part of this composition. Recording-to-Studio linking remains deferred. Do not load or publish new media, reset any rights, retire Academy screens or change DNS. Preserve the existing 49 enabled attachments.

The access-management owner confirms no access code has been implemented and the dashboard can release independently. Before any coordinated release, confirm no concurrent deployment, preserve all existing source/target bindings, bump release labels coherently, and perform only bounded metadata and essential live checks. A later approved UI handoff should compose these native adapters without promoting new media. Do not deploy the raw public directory as the Circles homepage; use the reviewed composition.


## Later local UI integration

You explicitly asked to implement the UI Circles was holding. Completed checkpoint31e15f5 is now composed locally with these native adapters, superseding the old e68d0b7-only release review for the next UI review. See CIRCLES-HELD-UI-INTEGRATION.md. This does not grant deployment approval, load new media or begin deferred recording mapping. V108.5 is still live.
