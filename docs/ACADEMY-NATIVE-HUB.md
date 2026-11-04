# Native Academy hub bridge (source preparation)

The existing Academy server authenticates its current native Bearer session, admission, epoch and authority before signing every hub request and rechecks the account/session after awaiting the reply. No browser may sign or supply trusted actor facts. Only ACADEMY_TO_WEBSITE_SECRET and the existing envelopePurpose('POST', exact path) signature is accepted. No new secret, grants, media publication or production data migration is introduced.

## Read summary

POST /internal/studio/hub-summary uses proof {issuedAt,accountId,epoch,globalAdmin,sessionId,action,websiteIds?}. sessionId is the exact current native Source session, not a Studio cookie/source_ref. issuedAt must be within60 seconds. actions are bootstrap, navigation or access; only access accepts websiteIds (at most50 unique IDs). IDs must belong to the deliberately published public catalogue; the catalogue must contain at most50 ready website IDs.

Returns {navigation,rights,websites,coursePolicyEpoch,checkedAt}. websites contains permitted published {websiteId,offeringId,kind} mappings. All local active/admitted/epoch/globalAdmin/12h master checks, current programme proof, source scope/fence/generation and paid/month/cohort/grant/playlist rules remain in place. Reads do not create a Studio session or write a grant. Published catalogue rights are loaded once per bootstrap and reused for navigation. An internal request-local WeakSet capability substitutes only for the absence of a browser Studio source_ref; JSON fields cannot manufacture it. This summary is display data, never a bearer authority.

## Join

POST /internal/studio/hub-join uses the same proof fields plus offeringId and lessonSessionId. Proof sessionId remains the native Source session; lessonSessionId is the published timetable session (mapped from the browser's existing sessionId field). Returns the existing {destination}. The original cookie route and hub route share offeringJoin and retain scope, live paid/free/class/date/audience/cancellation and exact five-minute checks. Sensitive freshness rules are unchanged; a stale proof must be synchronized by Source, never promoted to fresh by the bridge. No Zoom URL is cached by this interface.

## Browser handover

/academy-connect.html accepts only a bounded local /studio/ or /circles/free-learning.html target. It stores one60-second verifier/state transaction in its own tab, then navigates to the configured ACADEMY_PORTAL_ORIGIN + /academy/studio-authorize/ with challenge/state/target only. Source returns a one-use code/state fragment to the configured Studio connector. Studio clears that fragment immediately, verifies original tab state and configured origins, exchanges through existing /auth/exchange and opens the saved local target. No master token or verifier is put into a URL. Server host-only HttpOnly cookies remain unchanged.

ACADEMY_PORTAL_ORIGIN is returned by /api/config. Its default remains the current Studio WEBSITE_ORIGIN, which deliberately leaves the new connector closed until an explicit distinct native portal origin is configured in the reviewed paired release.

This source preparation does not update the existing release manifest. Both packages must be rebuilt and checked together before deployment.

The saved `/circles/academy/mothers/surah-al-baqarah/` reader (including exact `index.html` spelling) is an additional explicit connection target. No broader Academy reader path is accepted, and its existing media/access gates remain in force.
