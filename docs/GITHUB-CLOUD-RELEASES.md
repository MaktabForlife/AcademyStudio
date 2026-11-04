# GitHub cloud testing and paired releases

Academy and AcademyStudio are tested and deployed together from exact reviewed GitHub commits. Hifz is excluded. Media attachment and publication remain manual.

Use GitHub feature branches and disposable GitHub runners for future work. The owner's Mac is a working area, not backup or media storage. New Mac writes need explicit permission; local files must never be deleted.

## How it works

AcademyStudio → Actions → Paired Academy and Studio release runs 39 Academy UI/permission tests, 29 paired media tests, 50 static routes, five bundle builds, a pinned credential scanner and frozen-package checks. All databases and lesson data used by the tests are synthetic. Check-only runs make no Cloudflare requests. GitHub holds the test evidence.

Code pushes run checks only. Deployment requires Run workflow on studio_dev with Deploy the tested pair selected. It rechecks both canonical GitHub heads, stages both Workers without traffic, verifies bindings and 43200/43200/60 session settings, then activates Academy API, Studio and Academy Pages. It performs bounded configuration and five unsigned public/denial checks. The existing runner restores the previous compatible pair if activation fails. A later final-verification failure requires operator review, not repeated live attempts.

The verified paired-release.json GitHub Release asset supplies the next release's baseline. Normal pushes do not deploy. Do not enable independent automatic Cloudflare deployments for these two repositories.

## One-time connection still needed

In AcademyStudio's production GitHub environment, add:

- CLOUDFLARE_SOURCE_API_TOKEN: Editor for existing devrebootworker, metadata read for academy_split_coordinator and Pages Write for Academy Pages, only in account c9a3e355b3d7a795880b1d36a1dbe123.
- CLOUDFLARE_STUDIO_API_TOKEN: Editor for existing academy-studio-parallel, only in account 2b01ca929611669e032703ff19f7098f.

Use the narrowest available resource scope and an expiry. Ordinary deployments need no Hifz, DNS, database-query, R2-object or token-management permissions. Cloudflare's existing connection cannot create these tokens: it lacks Account API Tokens Write. The account owner must complete this one-time setup. Do not paste tokens in chat or commit them.

Cloudflare: https://developers.cloudflare.com/workers/authorization/workers/
GitHub: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets

## Database gate

The ordinary pipeline has no hosted SQL permission. It detects migration changes since the last verified release and stops before staging/activation. A future database change needs its exact upgrade reviewed and explicitly integrated before using the deployment job. Do not bypass this gate.

## First run

Use Deploy unchecked to verify cloud testing. V109.17 is already live: prepare a fresh version and frozen packages for the next deployment, rather than redeploying it to test the workflow. Credentials are confined to the manual deployment job, never the check-only job or pull requests.
