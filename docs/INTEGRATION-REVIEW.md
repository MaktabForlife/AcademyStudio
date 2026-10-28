# Combined website platform and editor review

Reviewed locally on 28 October 2026 on `feature/academy-studio-integration-review`. The combined baseline includes the platform/editor integration through `4f35c8a`, with the verified AcademyStudio remote and Cloudflare account pinned. No code was pushed, hosted resources created, live data queried, content published or service deployed during this review.

## Repairs

| Area | Result |
| --- | --- |
| New uploads and reused files | The builder merges the exact authorised file metadata rather than expecting an unused attachment in the current-edition response. Unsaved teaching stays intact and file selection no longer reloads the draft. |
| Existing published PDFs | Reuse preserves an existing attachment and its publication state. Selecting an already published file no longer makes it private while the draft is being edited. |
| Reusable-file selection and import | A dedicated scoped WEBSITE-file picker and exact lookup replace full participant/payment/enrolment-register reads and first-page-only searches. Recording attachments remain excluded. |
| Session ending and media | Expiry clears the client identity and broadcasts the change. Logout, account changes and website navigation close protected media; delayed media responses cannot reopen a stale view. |
| Image requests | Concurrent timetable/reader redraws share one in-flight image request within the current account/website view. There is no shared permission cache across accounts. |
| Public timetable | Snapshot preparation selects upcoming non-cancelled sessions through a cancellation-first index. Historical sessions cannot crowd out future lessons, including lessons more than a month ahead. Public fallback snapshots also enforce visible offering cards. |
| Draft validation and enrolment | The merged platform checkpoint validates creation through the common schema, preserves Global Admin-only master-account linking, and retains current source authority/admission checks. |

The added indexes belong to the initial local schema; no hosted schema has been applied. Full-builder and on-page editing continue to use the same private draft, optimistic revision and explicit publication service. History and original files are retained.

## Local evidence

- The complete combined native suite passes 44 tests, covering sign-in/handoffs, scoped authority and late revocation, provisioning/recovery, independent content publication, failed object writes, exact retries, media ranges, grants and growth.
- The scoped reusable-file picker reads 5 rows before and after adding 4,000 recordings in the same offering. Exact file lookup also reads 5 rows. It returns no participant/payment/request register.
- The public timetable delta reads 20 rows before and 26 after adding 4,000 historical and 4,000 cancelled sessions. Public homepage requests read zero D1 rows. These are synthetic local measurements, not a daily production forecast.
- The nine-site native rehearsal preserves all 91 lessons, exact draft and published content/IDs, private Save/Restore, explicit publication and unchanged peer websites. Learner metadata for the eight in-scope sample sites reads 5–10 rows for saved publications and 10–50 after publishing their revised image-rich editions. An artwork range reads 9–10 rows separately. These exclude an entire browser journey and the unmapped original recording/PDF inventory.
- Local syntax/configuration checks, generated binding types and Worker packaging are checked separately. The bundled native test runtime uses compatibility date 2026-09-28; the intended deployment date is 2026-10-28. Actual hosted behavior still needs a bounded approved preview.

Project-workspace evidence is under `outputs/academy-studio-integration-review-20261028/`. Browser checks exercise upload/reuse while teaching is unsaved, shared drafts/publication across both editors, coalesced images, cross-tab sign-out and server session expiry. External traffic is blocked; the video provider frame is a local synthetic response.

## Deployment boundary

The account and repository are verified targets, not proof of production readiness. The next deployment should be an isolated preview using its own target resources and bounded synthetic acceptance, once authorised. Keep the existing Academy and public entry points unchanged during that preview.

Before live replacement, finish the Academy timetable/Zoom exporter and replay checks; reconcile the actual participant, material and historical access inventory; verify Library return and deploy the source-side device-state export; settle Foundations page placement and the account-status/outage policy; and rehearse migration/rollback, retention/backups and aggregate usage budgets. These are explicit remaining acceptance items, not implied by the passing content/editor tests.

Wrangler authentication was expired when the account was verified. Target resource IDs, shared secrets, real origins and domain routing are still unprovisioned placeholders. Do not activate the local configuration or apply DNS changes as part of this review.

## Domain choice

A separate subdomain is optional. The eventual platform can own `maktab4life.org` for the migrated homepage, with independent website paths; `learn.maktab4life.org` is an option for an initial rollout alongside the existing site. Individual Surahs/Courses do not need individual subdomains. An approved preview can use a Cloudflare-provided address before branded DNS is connected.

The cross-account DNS/zone arrangement must be checked before selecting a Workers custom domain. No DNS ownership or routing migration was verified or changed here. References: [Workers custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [Workers development addresses](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/), and [Pages subdomains](https://developers.cloudflare.com/pages/configuration/custom-domains/).
