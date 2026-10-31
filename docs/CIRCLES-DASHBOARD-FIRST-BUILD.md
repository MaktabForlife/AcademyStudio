# Dashboard first-build deadline — V109.2 local correction

Existing production evidence, inspected by the release owner without an application call, records Source `/internal/website/dashboard` canceled at7994ms with no response status. Target's command timeout was8000ms and its corresponding response was503. See parent outputs/academy-release-1092-20261031/source-dashboard-existing-log.json. This identifies a likely caller deadline cancellation; it does not identify a slow Source query or establish a hosted fix.

## Narrow changes

- Only the dashboard command receives a20000ms deadline. All other command deadlines remain8000ms; acknowledgement remains5000ms. Direct Source transport, signed payloads, bounded response parsing and continuation guards remain. There is no automatic timeout retry.
- The browser dashboard controller coalesces identical pending requests within that controller, keyed by account, identity generation, perspective and explicit-refresh intent. Clear/account/policy fences discard pending reuse. Known401/403/409 authority failures also clear older private client snapshots and pending reuse, so a later explicit return cannot restore an older permission view. Late completions cannot remove a newer request. Perspectives and explicit refresh requests stay separate.
- No Worker-global private data or cross-request I/O promise is introduced. Coalescing is within one browser controller, not across tabs, accounts or isolates. Existing private R2 dashboard reuse remains the server-side mechanism.
- Source runtime and SQL are unchanged. No schema, configuration, bindings, credentials, permissions, acquired rights or media change is required.

## Source cost inspection

Source dashboard assembly makes one required native entrance read followed by up to four optional native readers (assessments, class notes when sessions exist, messages when enabled, and Admin enrolment requests). Optional reads run concurrently after the entrance. Every reader keeps native authentication, workspace and accepted-data gates. Existing Source permission/private timetable snapshots remain in use; known401/403 denials remain fatal. This patch does not bypass repeated native authority checks or claim to optimise their underlying query graph.

The synthetic native cold build measured186 Source queries/2628 rows read/0 D1 rows written and19 Target rows read. A repeated private Target cache hit measured0 Source queries/rows and4 Target rows. These are this disposable fixture's actual counts, not production totals or a growth/daily-cost estimate. The correction introduces no new SQL/read path; identical concurrent browser calls issue one request rather than duplicating the cold build.

## Validation

- `tests/dashboard-branded-default.test.mjs`: actual paired local native handlers with a9000ms delayed Source response succeeded after9159ms, retaining default Global Admin mode and branded browser/direct server separation. The delay adapter checks the request's AbortSignal, so the former8000ms deadline cannot succeed through this fixture. The next request reused the private cache without another Source query. Receipt: outputs/dashboard-first-build.json.
- `tests/dashboard-deadline.test.mjs`: exact command-specific deadline; other commands/acknowledgement unchanged; one failed attempt with no timeout retry; delayed actor epoch, sign-out, programme proof and Course policy changes prevent any cache write; Source403 denial propagates.
- `tests/dashboard-load.test.mjs`: identical first loads and identical explicit refreshes coalesce; perspective/refresh intent remains isolated; account/policy/clear fences discard stale replies; rejected work is not retained and requires an explicit new request; authority-denied refreshes invalidate older private client snapshots.
- Existing paired dashboard test still passes native modes, current scopes, private cache, one-use continuation and forged-workspace denial. Nine focused/paired tests plus three existing active-account/scope-renewal tests pass, zero skips. No hosted request or deployment was used for validation.

## Integration and remaining verification

Compose the small controller patch on the UI owner's frozen Target3549d68 tree, preserving its My courses insertion and rendering layout. The existing circles-dashboard.mjs asset changes; no new deployable asset is required by this correction. Bundle src/academy-client.mjs in the combined V109.2 Worker. Tests/fixture delay adapters are never deployment assets. Do not modify frozen109.1.1 assets or the UI owner's frozen164-file handoff in place; the release coordinator prepares the combined tree.

The production Source request's underlying latency remains unmeasured. Treat this as a bounded mitigation of the observed deadline and duplicate-load risk. The release owner should perform only the separately authorised, minimal signed-in dashboard verification after the full release, and stop if the failure persists. No new broad diagnostics, Source telemetry access or permission expansion is requested.
