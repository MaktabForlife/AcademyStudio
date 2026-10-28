# AcademyStudio isolated preview

The human subsequently authorised private testing of all nine existing websites and the builder. The current implementation and permission boundaries are documented in [PRIVATE-PREVIEW.md](PRIVATE-PREVIEW.md), on `feature/academy-studio-private-preview`. The records below describe the initial public-sample deployment; its sample-only/no-test-identity limitation is superseded by that explicit private-preview authorisation. Live Academy integration and production cutover remain unapproved.

The human authorised a hosted preview on 28 October 2026, using the new account's Cloudflare address and leaving live Academy unchanged. This supersedes the local-only hold solely for this isolated preview. Production migration, Academy connector activation, DNS changes and production data import remain unauthorised.

- Source: reviewed `d238d7f` on `feature/academy-studio-integration-review`, plus this preview-only entrypoint and configuration.
- Target account: `2b01ca929611669e032703ff19f7098f` (`naidu.hajira@gmail.com`).
- Worker: `academy-studio-preview`; expected address `https://academy-studio-preview.naidu-hajira.workers.dev` (confirm from deployment output).
- Deployed and verified: **https://academy-studio-preview.naidu-hajira.workers.dev**. Cloudflare version `a457b155-c146-4892-89b5-7b2ee89223a7`, deployment tag `preview-20261028-eeb6771`, deployed source commit `eeb677110676bad7cc949879ed14f775a1e94b20`. Worker startup reported 2 ms. This is the isolated preview, not a production cutover.
- Isolated resources: D1 `academy-studio-preview`, private R2 `academy-studio-preview-content` and `academy-studio-preview-media`. Never substitute Academy bindings or credentials.
- Authentication is now verified: named Wrangler profile `academy-studio`, email `naidu.hajira@gmail.com`, target account present. It is activated only for this review worktree. The global default still belongs to the existing Academy account. Pin `CLOUDFLARE_ACCOUNT_ID=2b01ca929611669e032703ff19f7098f` for hosted commands as well as `--config wrangler.preview.jsonc`; some resource-management commands do not select the account from configuration. Never rely on the default profile or account selection.
- `wrangler.preview.jsonc` is separate from the disabled/local `wrangler.jsonc`. The newly created preview database ID is `32b77898-0481-478f-aba7-a097e7de161d`; only its tested `0001_platform.sql` schema has been applied. The content and media buckets were created privately with Standard storage. Only the small sample `public/home.json` was uploaded; there are no learner accounts or private media imports.
- Preview uses sample public content only. No real accounts, access grants, Academy data exports, Zoom links, PDFs, recordings or private website drafts are imported.
- Academy authentication and signed integration deliveries fail closed in `src/preview-worker.mjs`; there are no integration secrets. Sign-in inputs are disabled and every HTML page has a visible preview notice. Search indexing is discouraged with `X-Robots-Tag`.
- This first deployment permits public page inspection. It does not provide a hosted signed-in reader/editor rehearsal; those remain covered by the local tests until separately connected to an isolated identity fixture or an approved integration rollout.

Keep live checks small: one initial schema application to this empty preview database; one public homepage object upload; one bounded HTTP smoke batch (page, home snapshot, disconnected sign-in, protected route). Never run hosted SQL or acceptance tests against live Academy. Record actual created IDs, deployed version and smoke results in the project outputs. An expected URL or packaging dry run is not deployment evidence.

## Setup and activation status

The official Cloudflare agent setup instructions were fetched and applied for Codex. Nine missing official skills were installed, preserving the existing skills. The Cloudflare MCP server is registered in the user Codex configuration and its OAuth login succeeded with requested Workers, R2 and D1 scopes. The optional `cf` CLI was declined; keep Wrangler. New skills are available on the next turn; restart Codex to load the new MCP connection.

R2 initially required human subscription activation (Cloudflare API code `10042`). The human completed activation, then a single management check confirmed R2 was available. The dedicated preview database/buckets were created and initialised on 28 October 2026. Production data import, Academy connector activation, production deployment and DNS changes remain outside this preview's scope. Actual Worker deployment evidence belongs in the project outputs, separate from dry-run evidence.

## Hosted verification

A single four-request smoke batch passed: labelled HTML with sign-in disabled (200); the sample homepage snapshot with two preview-only cards (200); unauthenticated protected website access (401); disconnected login without issuing a cookie (503, `PREVIEW_DISCONNECTED`). Every response discourages search indexing. One browser load confirmed both sample cards and the isolation notice; its screenshot is saved with the smoke report in `outputs/academy-studio-isolated-preview-20261028` under the parent project. There were no production Academy requests, schema changes, data imports, logins, republishing or DNS changes. D1 was used only to initialise the new empty preview schema; these public/denied HTTP paths require no SQL queries, as tested locally.

The hosted preview intentionally does not provide sign-in, a protected reader/editor rehearsal, real teaching material or live timetable integration. Local integration evidence remains in `INTEGRATION-REVIEW.md`. Connecting any live Academy service or importing real material/rights needs a separately approved rollout.

## Public card layout review — recordings first

The human requested the eight Tafseer cards and Al Kahf on the preview homepage, with Foundations first, then clarified that recordings are the main learning content and websites are supporting reading. `preview/home.json` contains only approved public titles/summaries and synthetic card IDs. The isolated-preview-only renderer gives recordings the prominent play button and companion reading the secondary book button. Foundations remains first with its open-to-all introduction. No recording counts or availability have been invented.

Card buttons open demonstration messages only; they do not call enrolment, media or live website APIs. This homepage change preserves the private nine-website preview, its invitation secret, configuration and stored editions. It does not connect the sample cards to private websites, alter grants or migrate teaching media. Normal production rendering stays unchanged behind `config.isolatedPreview`.

Local checks: four preview isolation/authentication tests passed; syntax/configuration check passed; preview deployment dry run targets only the existing dedicated preview bindings. Browser checks confirmed all nine cards, correct ordering, prominent recording buttons, a working demonstration popup, single-column mobile layout at 390px and no horizontal overflow at 320px (minimum action height 50px). Deployment evidence and screenshots are recorded separately under the parent project outputs.
