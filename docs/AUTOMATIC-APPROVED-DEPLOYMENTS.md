# Deploy after optimisation approval and PR merge

The owner selected a recorded `optimisation/approval` commit status under the shared GitHub account `MaktabForlife`. Both repositories require a PR, that exact-head status, an up-to-date branch and resolved conversations. Direct/force pushes to `studio_dev` remain blocked. GitHub does not distinguish Codex chats using the shared account.

## Release preparation and approval

Every release PR changes `deployment/release-plan.json`. Optimisation reviews the exact PR head, the pinned prepared application commits, the relevant paired tests, database effects, target and verification budget. It records a PR comment in this form, including the full reviewed head SHA:

```text
Optimisation approval
head: FULL_REVIEWED_PR_HEAD_SHA
target: production
db-changes: none
Evidence: links to exact GitHub runs and reviewed scope.
```

Use `target: feature` for JWT releases or `target: none` for automation/documentation-only setup. Optimisation then posts `state=success`, `context=optimisation/approval` on that exact head, with `target_url` pointing to the comment and `description` equal to `optimisation-record-sha256:` followed by the SHA256 of the exact comment body read back from GitHub. The comment revision must not be later than status issuance. Exact lines and one head/target/no-DB field are required; edited or ambiguous records are rejected. It rechecks the PR head/base before merging. New commits need new approval. Do not approve through Deployment or copy an old status to a new commit.

After merge, the router verifies the merged PR, MaktabForlife merger/status/comment, approval before merge, identical reviewed/merged trees, current canonical merge, immutable plan and no-DB declaration. Withdrawal or editing of the approval record stops remaining writes. A stale/newer canonical commit stops promotion. No PR label, title or branch name chooses production.

## Credential homes and paired releases

Production credentials stay in AcademyStudio's existing `production` environment. Feature credentials stay in Academy's existing `feature` environment, still restricted to `feature-preview`. No token is copied or broadened.

The final target-owning release PR drives deployment: AcademyStudio for the paired non-JWT production release; Academy for the isolated Feature/JWT release. Component changes in the other repository are reviewed through component PRs, followed by the prepared paired release PR. A component PR is not itself an application release; the final approved release-plan merge starts deployment without a manual deploy click. This preserves pairing without introducing a cross-repository credential.

A production plan pins both prepared application commits. They may be separate production compositions, rather than the whole integration/Feature tree. Future non-JWT releases must not accidentally include already-merged JWT runtime code or isolated test configuration. Root review and native resource, permission and hosting gates remain controlling.

## Production plan

```json
{
  "schema": 1,
  "request": "production-v10926",
  "kind": "release",
  "target": "production",
  "contains_jwt": false,
  "database_changes": false,
  "version": "109.26",
  "source_sha": "EXACT_PREPARED_ACADEMY_40_HEX_COMMIT",
  "studio_sha": "EXACT_PREPARED_STUDIO_40_HEX_COMMIT"
}
```

The prepared pair must include the current approval-aware release tools and reproduce its frozen release package. Automatic checks run locally in GitHub before the existing production metadata/staging/binding/health/rollback/public verification sequence. Current approval, canonical head and frozen local source are rechecked immediately before every physical candidate Wrangler attempt, including explicit retries after waits. Recovery attempts renew their original-version ownership checks separately and do not depend on continuing candidate approval. The entire Feature tree is never promoted to production. Conservative checks cover the actual source and publisher roots, including Academy root auth/js/functions and the selected frozen public tree, while excluding inactive historical releases and explicit CI/deployment control files. Known V110 runtime paths/references, runtime DDL, old AND new database/migration/seed/backfill paths on renames, and storage/activation-variable changes stop production. These static guards supplement the exact-source review; they are not a semantic proof that arbitrary application code has no data effects. No D1 SQL, migration, seed, cleanup or secret rotation is run.

The latest published paired receipt is the baseline. A version-specific historical recovery record is used only when preparing a different version for that matching receipt. A same-version CI check does not reuse an obsolete recovery record; activation still refuses an already-deployed version.

## Feature plan

```json
{
  "schema": 1,
  "request": "jwt-v110-feature",
  "kind": "release",
  "target": "feature",
  "contains_jwt": true,
  "database_changes": false,
  "version": "110.0",
  "feature_base_sha": "CURRENT_FEATURE_PREVIEW_40_HEX_COMMIT",
  "feature_sha": "EXACT_REVIEWED_ISOLATED_FEATURE_40_HEX_COMMIT"
}
```

Academy's router promotes the reviewed isolated composition to `feature-preview` by fast-forward only, then explicitly dispatches the existing Feature workflow using its repository-scoped token. That dispatch is necessary because a normal push made by `GITHUB_TOKEN` does not trigger another push workflow. It deduplicates an already dispatched successful/running release. No new cross-repository credentials are used.

Feature validation and approval checks precede access to the existing Feature environment. A plain Feature push performs local checks and cannot deploy. The deployment tool independently requires the approved merged PR and rechecks approval and the Feature head before writes, preserving exact installed D1/R2/DO/secret/rate-limit/host/schedule isolation. Legacy first-install/seed/activation jobs are retired from the routine workflow. Native baseline storage and schema receipts remain unchanged. Marker and health attempts are counted in the receipt; all broad tests remain local.

First JWT Feature deployment must be V110. This pipeline does not install JWT session/floor/outbox schema, provision Studio/Hifz Feature resources, relax native permissions/Source/lock/lifecycle/browser gates, or authorise production JWT. Any such unresolved prerequisite remains a readiness blocker. No database changes are authorised by a release plan.

## Automation setup and reports

A `kind: configuration`, `target: none` plan is allowed only for automation/tools/tests/docs files. It does not redeploy an unchanged application. Academy may pin a separately reviewed Feature workflow-only update using `feature_base_sha`/`feature_sha`; its dispatch is `check_only=true` and has no hosted deployment. A `kind: component` plan records the eventual target and waits for the target-owning paired release PR.

Required synthetic and growth tests stay in disposable GitHub/local databases. Reports and exact receipts go to the approved Drive report, without credentials or credential hashes. Hosted verification remains small and bounded; health reads and Pages/Worker requests are not misreported as zero D1 work or a complete billing measurement.
