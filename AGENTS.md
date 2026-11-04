# AcademyStudio working rules

GitHub is the source of truth: MaktabForlife/AcademyStudio, primary branch studio_dev.

## Current authorised scope

The owner authorised repository housekeeping and asked that it be applied directly to studio_dev, with rollback/studio-before-housekeeping-20261104 preserved. This authorises source organisation, GitHub-run build/tests and reviewed GitHub commits only. No deployment, DNS, hosted SQL/data/rights/media changes or Hifz changes are authorised.

The proposed hosting migration remains a plan: Academy will own the homepage/shared dashboard at maktab4life.org; Studio Pages and its existing backend/storage will be in the Studio account at studio.maktab4life.org; Studio keeps its secure cookie and Hifz remains unchanged. Do not build or deploy that migration under the housekeeping approval.

## Local files and privacy

Never delete any file, local branch or worktree from the owner's Mac. New local writes require explicit permission. Run builds/tests in GitHub, not on the Mac. Recovery belongs in GitHub and Cloudflare, not local backup/media folders.

Repositories are public. Never commit credentials, session tokens, private R2 teaching content, account exports or private review material. Approved public website assets and infrastructure identifiers are not credentials. Keep credential scans and exact reviewed manifests in release checks.

## Application and release rules

Preserve master identity/session/credential-version checks, scoped Admin authority, acquired Course/month/cohort/Surah/playlist rights, account-switch guards and the exact five-minute Join opening rule.

Ordinary verification is 43200 seconds, live-access verification is 43200 seconds, and sensitive Admin freshness is 60 seconds. Cookie lifetime is separate. Do not weaken permissions to reduce reads.

All real media attachment and publication remain manual. Use synthetic test data; avoid production app loads, table scans and hosted SQL. Keep any separately approved live checks small.

Academy and Studio are one tested release. No merge, force-push, history replacement, independent automatic deployment or deployment without current approval. Start synchronisation commit messages with [CF-Pages-Skip] [skip ci].

## Source and packaging

public/ contains the complete current public website. src/ contains the backend. Keep migrations and meaningful tests.

Build directly from source. Generated release/v*/ website packages are ignored; retain only current manifest/source metadata in release/. wrangler.production.jsonc is the current production config; wrangler.jsonc is local-only and disabled. Historical configurations and authorisations remain available through the rollback branch and Git history, not as current operating instructions.

The deployed release's cache address may be retained only while every generated public filename and byte matches release/manifest.json. New website changes require a new reviewed version. Preserve licences and verify generated packages before any future release.
