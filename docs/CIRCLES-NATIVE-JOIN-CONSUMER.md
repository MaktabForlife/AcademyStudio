# Checked dashboard Join consumer

Local Target feature from Root `a859821`, paired with reviewed Source
`0755eb9d` (native Join feature `10b83fdc`). No schema, binding, grant, session
duration, meeting or hosted change.

## Contract and authority

`POST /api/circles/lesson-join` takes exactly `{mode, joinKey, date}`. Mode is
`learn`, `teach` or `admin`; key is nonempty and at most1200 characters; date is a
real ISO calendar day. The normal Worker enforces Origin and the authenticated
current account before dispatch. A caller cannot supply another `sourceRef`.

The handler reads the current account-bound navigation proof, then sends one
signed `/internal/website/lesson-join` request with the server session's own
Source reference. Source retains its current native audience, publication,
calendar, cancellation, exact five-minute/end and Academy/Studio ownership gates.
No Target projected `ws-*` Join rule or Studio paid/live rule is widened.

After Source responds, Target rechecks the current session, account identity,
epoch, Source reference, Global Admin flag and navigation proof. Sign-out,
revocation, admission withdrawal or a known permission change cannot return the
earlier URL. A successful response is `{joinUrl}` with `private, no-store`; an
invalid/non-HTTPS response fails closed. The handler makes no Target writes and
never persists the URL.

The circle UI belongs to Circles. It must synchronously create its placeholder
window only for the explicit click, capture account generation and selected
mode, and recheck both after the await before opening the checked URL. Close the
placeholder on failure or a changed account/view. Server mode validation is
native authority validation; the selected UI mode remains an account-bound view
hint and is not newly persisted on the server. Do not send returned URLs to
dashboard caches, history receipts or logs.

Only Academy-owned rows use `nativeJoin`. Studio-owned/frozen sessions must keep
their existing Studio resolver and paid/live controls. Do not retry a Studio
rights denial through this native endpoint. Public-free joining remains on its
existing native public pathway.

## Cache transition

The existing private dashboard cache now requires `nativeJoinVersion:1` and,
when requested explicitly, the matching mode. Old snapshots rebuild once on
active navigation, then follow the existing account/epoch/permission-bound
12-hour policy. No timer polls Source; the circle can display activation from
`joinAvailableAt` and `endsAt` and resolve fresh authority on the click.

New Target dashboard responses require the marker, so final rollout must activate
the additive compatible Source contract first. Old Target ignores the new Source
fields. Root owns the complete paired transition/rollback and final versioning.

## Verification

`tests/circles-native-join.test.mjs` uses actual local Target Workers/D1 and a
signed synthetic Source response for Origin/authentication, spoofed principal,
strict input, post-await account/session/proof changes, native denials, HTTPS,
no-write/no-cache and one-time cache upgrade checks. The read-growth case adds
4000 unrelated accounts, sessions and navigation proofs and measures only Target
HTTP reads; it is not a full Source growth or hosted-billing claim.

`tests/circles-native-join-paired.test.mjs` uses the actual reviewed Source and
Target Workers with split Core/Admin/coordinator fixtures. Its opt-in
`nativeJoinTest` creates a **new synthetic weekly publication** inside the real
clock's Join window before producing the accepted fixture. It never rewrites an
immutable existing publication or modifies a real timetable. The test obtains a
real native dashboard reference, resolves Join, upgrades an old snapshot once,
checks warm returns without Source queries, then checks wrong audience/mode,
Studio handover and Source session revocation. It resolves sample URLs without
opening a meeting.

Run the focused suite with `ACADEMY_SOURCE=../Academy-complete-1094`, not the
fixture's historical default Source. Source's separately reviewed tests cover the
exact boundary milliseconds and native calendar/cancellation rules. Parent
receipt/logs are in `outputs/circles-native-join-20261101/`.

Circles UI/browser/mobile, full release composition, all other register items,
matching versions/assets/schema/read budgets and final bounded readiness checks
remain required. This component alone is not release readiness.
