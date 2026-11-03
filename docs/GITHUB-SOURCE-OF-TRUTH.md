# GitHub release baseline V109.14

The `studio_dev` branch is the canonical source baseline. It preserves the deployed V109.14 source and exact frozen public package without merging another branch or deploying anything. See `release/v109.14/manifest.json` for the original deployed commit and SHA-256 file inventory.

Run `node tools/verify-github-source.mjs` before release. It checks the clean local branch against its exact GitHub ref and the complete frozen public package. Network access to GitHub is required; no Cloudflare API, SQL or app request is made.

Source edits must be committed and pushed before an authorised paired Academy/Studio deployment. Update the public release package and manifest for a new version; never release untracked private preview trees. Current database schemas are already applied: Core0023, Admin0003 and Studio0016. Do not replay migrations. Media attachment/publication remains manual.

GitHub source synchronisation does not migrate the application data. User records, entitlements and private R2 media/site content remain in their existing Cloudflare services and are intentionally excluded from Git. Credentials remain in the existing secure local/hosted stores.

For Academy, the preserved Pages package is `release/v109.14/public`; the Source API/configuration remains under `backend/`. For Studio, `wrangler.github-10914.jsonc` is identical to the recorded release config except that its asset directory points to the committed frozen package. Do not run deployment commands without approval.

No local files or branches are removed, no existing GitHub branches are merged or overwritten, and Hifz is outside this change.
