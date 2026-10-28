# AcademyStudio isolated preview

The human authorised a hosted preview on 28 October 2026, using the new account's Cloudflare address and leaving live Academy unchanged. This supersedes the local-only hold solely for this isolated preview. Production migration, Academy connector activation, DNS changes and production data import remain unauthorised.

- Source: reviewed `d238d7f` on `feature/academy-studio-integration-review`, plus this preview-only entrypoint and configuration.
- Target account: `2b01ca929611669e032703ff19f7098f` (`naidu.hajira@gmail.com`).
- Worker: `academy-studio-preview`; expected address `https://academy-studio-preview.naidu-hajira.workers.dev` (confirm from deployment output).
- Isolated resources: D1 `academy-studio-preview`, private R2 `academy-studio-preview-content` and `academy-studio-preview-media`. Never substitute Academy bindings or credentials.
- Authentication is now verified: named Wrangler profile `academy-studio`, email `naidu.hajira@gmail.com`, target account present. It is activated only for this review worktree. The global default still belongs to the existing Academy account. Pin `CLOUDFLARE_ACCOUNT_ID=2b01ca929611669e032703ff19f7098f` for hosted commands as well as `--config wrangler.preview.jsonc`; some resource-management commands do not select the account from configuration. Never rely on the default profile or account selection.
- `wrangler.preview.jsonc` is separate from the disabled/local `wrangler.jsonc`. Add only the newly created preview database ID before applying migrations/deploying.
- Preview uses sample public content only. No real accounts, access grants, Academy data exports, Zoom links, PDFs, recordings or private website drafts are imported.
- Academy authentication and signed integration deliveries fail closed in `src/preview-worker.mjs`; there are no integration secrets. Sign-in inputs are disabled and every HTML page has a visible preview notice. Search indexing is discouraged with `X-Robots-Tag`.
- This first deployment permits public page inspection. It does not provide a hosted signed-in reader/editor rehearsal; those remain covered by the local tests until separately connected to an isolated identity fixture or an approved integration rollout.

Keep live checks small: one initial schema application to this empty preview database; one public homepage object upload; one bounded HTTP smoke batch (page, home snapshot, disconnected sign-in, protected route). Never run hosted SQL or acceptance tests against live Academy. Record actual created IDs, deployed version and smoke results in the project outputs. An expected URL or packaging dry run is not deployment evidence.

## Setup and activation status

The official Cloudflare agent setup instructions were fetched and applied for Codex. Nine missing official skills were installed, preserving the existing skills. The Cloudflare MCP server is registered in the user Codex configuration and its OAuth login succeeded with requested Workers, R2 and D1 scopes. The optional `cf` CLI was declined; keep Wrangler. New skills are available on the next turn; restart Codex to load the new MCP connection.

The current deployment blocker is R2 activation in the new account (Cloudflare API code `10042`). The dashboard explicitly requires accepting a usage-billed R2 subscription. This is a human activation step. No hosted preview resources, production data import, hosted schema application, deployment or DNS change has occurred. Do not repeatedly retry the API while activation is pending; resume only after the human confirms it is complete.
