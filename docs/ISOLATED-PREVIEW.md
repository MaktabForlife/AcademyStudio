# AcademyStudio isolated preview

The human authorised a hosted preview on 28 October 2026, using the new account's Cloudflare address and leaving live Academy unchanged. This supersedes the local-only hold solely for this isolated preview. Production migration, Academy connector activation, DNS changes and production data import remain unauthorised.

- Source: reviewed `d238d7f` on `feature/academy-studio-integration-review`, plus this preview-only entrypoint and configuration.
- Target account: `2b01ca929611669e032703ff19f7098f` (`naidu.hajira@gmail.com`).
- Worker: `academy-studio-preview`; expected address `https://academy-studio-preview.naidu-hajira.workers.dev` (confirm from deployment output).
- Isolated resources: D1 `academy-studio-preview`, private R2 `academy-studio-preview-content` and `academy-studio-preview-media`. Never substitute Academy bindings or credentials.
- `wrangler.preview.jsonc` is separate from the disabled/local `wrangler.jsonc`. Add only the newly created preview database ID before applying migrations/deploying.
- Preview uses sample public content only. No real accounts, access grants, Academy data exports, Zoom links, PDFs, recordings or private website drafts are imported.
- Academy authentication and signed integration deliveries fail closed in `src/preview-worker.mjs`; there are no integration secrets. Sign-in inputs are disabled and every HTML page has a visible preview notice. Search indexing is discouraged with `X-Robots-Tag`.
- This first deployment permits public page inspection. It does not provide a hosted signed-in reader/editor rehearsal; those remain covered by the local tests until separately connected to an isolated identity fixture or an approved integration rollout.

Keep live checks small: one initial schema application to this empty preview database; one public homepage object upload; one bounded HTTP smoke batch (page, home snapshot, disconnected sign-in, protected route). Never run hosted SQL or acceptance tests against live Academy. Record actual created IDs, deployed version and smoke results in the project outputs. An expected URL or packaging dry run is not deployment evidence.
