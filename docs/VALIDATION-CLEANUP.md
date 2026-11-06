# Daily validation-branch housekeeping

This is GitHub-only repository housekeeping. It does not build or deploy the applications, contact Cloudflare, read hosted databases, change data or merge code.

## Daily operation
The workflow runs once daily at **06:17 UTC / 09:17 Asia/Riyadh** in each repository, from the protected default branch `studio_dev`. GitHub scheduling can be delayed; it is not an exact-time guarantee. Codex need not stay open. GitHub may disable schedules after prolonged inactivity in public repositories.

Manual workflow_dispatch defaults to dry_run=true. The feature/PR test job has read-only permissions, uses synthetic responses and disposable local Git repositories, and cannot execute cleanup. Only schedule/default-branch dispatch can run the writer. All action versions are pinned. No Cloudflare, Google, PAT or account secrets are required; the writer uses only its own short-lived GITHUB_TOKEN.

Each daily run:
1. Checks an existing immutable cleanup proposal for dedicated approval.
2. Rechecks exact heads, source preservation, runs/artifacts, active uses and approval.
3. Claims the batch durably before one atomic Git deletion attempt.
4. Records a receipt and closes the batch. Unknown outcomes are not retried.
5. Otherwise creates one proposal and waits for optimisation. It does not create a branch for proposals.

## What remains protected
Only validation/* names are eligible. Default/main, feature-preview, feature/*, release/*, rollback/*, preserve/* and review/* refs can never be deleted by this workflow.

The policy also holds validation/approved-deployment-* and validation refs whose head equals a current active JWT, Feature or Deployment tip. Open PR dependencies, protected refs, active paired workflow runs and active deployments block execution. The current trusted cleanup run (and another default-branch copy of this same housekeeping workflow) is excluded from its own busy check. Static exact branch references in current workflow/release tooling block cleanup.

Each candidate needs at least one evidenced non-skipped terminal current-head validation run with available digest-bearing artifacts. All current-head runs must be terminal; skipped workflows retain their metadata and may have no artifacts because they executed no validation. Every non-skipped run still requires available evidence. Failed or cancelled superseded runs are not treated as passing tests; optimisation must separately attest that their validation work is completed and not active. Commits must be positively reachable from a retained non-candidate policy anchor. Fast-forward advancement of that anchor is allowed; loss/rewrite/removal is rejected.

## Independent optimisation approval
The shared MaktabForlife account is the owner's selected coordination identity; this is not a separate cryptographic identity for optimisation. The fixed reviewer account ID is 285054382. GITHUB_TOKEN has statuses:read, never statuses:write, and cannot grant its own approval.

A proposal is a canonical, unedited github-actions[bot] comment with a unique nonce, exact entries, executor/policy/workflow integrity digest and evidence. Its issue must remain open and never have been closed/reopened. Changes in implementation, policy, proposal, candidate or approval stop the batch. A generic optimisation/approval code-PR gate is NOT cleanup approval.

Optimisation must:
- Independently review the entire exact proposal, active-use exclusions, source anchors and evidence.
- Record that review/manifest in the approved Drive ledger:
  https://docs.google.com/document/d/1RTO3PTqq7Ic8P99fkmAHclWbzkGeInrsHDiw_tEgoZ0/edit?usp=drivesdk
- Post an unedited approval comment on that same issue, with this marker followed by one canonical JSON line:

```text
<!-- validation-cleanup-approval:v1 -->
{"manifest":"FULL_64_HEX_MANIFEST_DIGEST","proposalId":IMMUTABLE_PROPOSAL_COMMENT_ID,"completedValidation":true,"notActiveWork":true,"evidencePreserved":true,"driveReport":"https://docs.google.com/document/d/REVIEW_DOCUMENT_ID/edit"}
```

- Set a success commit status on EACH unique candidate SHA:
  context: optimisation/validation-cleanup
  description: approve:FULL_64_HEX_MANIFEST_DIGEST
  target_url: the exact approval-comment permalink
  Creator: MaktabForlife.
- Use the latest status in that specific context. A later failure/pending status, edited/deleted approval, changed proposal or closed issue blocks execution.

Posting a comment without all matching dedicated statuses does not execute anything. A moved candidate or different subset requires a new proposal/approval. Do not post those statuses from this workflow. Do not reinterpret the previously consumed 75-branch audit as approval for any new batch.

## Concurrency and failures
The writer is serialised per repository, across schedule and dispatch. Before mutation it writes a durable claim bound to manifest, approval, run and exact heads; then rechecks approval and dependencies. It sends one Git receive-pack transaction with exact old SHA -> zero SHA deletion commands, atomic and report-status, and no packfile. GitHub rejects a moved candidate. Each repository is independent; no cross-repository transaction is claimed.

Approval reads and the Git transaction are separate services. A revocation after the last read can race the in-flight transaction; there is no false claim of atomic approval revocation. There is no automatic mutation retry. A crash/unknown HTTP outcome leaves the durable claim, preventing replay even if a branch is recreated at the same SHA. Investigate GitHub refs and the manifest before requesting a fresh batch.

Closing/reopening an old proposal never reactivates it. To reconsider a closed/claimed proposal's remaining heads, use manual workflow_dispatch with retry_issue set to its number and dry_run=false. That creates a NEW nonce/manifest and still needs NEW independent approval. It does not reuse old statuses.

## Evidence and reports
Source/test history, retained anchors, all tags/releases and existing workflow run/artifact records remain. Artifact expiry/retention is unchanged; branch deletion is not indefinite artifact archival. Lost/expired/changed required evidence blocks cleanup.

GitHub issues hold durable proposal/claim/receipt records; Actions also retains read-only test logs and execution receipts. No credentials or raw test logs are copied into public issues. The approval links to the independent Drive report, created during optimisation review. GitHub has no Google Drive credentials: offline execution receipts stay on GitHub and can be reconciled into Drive on the next review. This does not claim automatic Drive writes while Codex is closed.

## Installation and rollback
This setup changes only housekeeping tools, policy, tests, documentation, workflow and a fresh configuration/target:none deployment plan. It must be reviewed through the existing protected PR process. The automatic release router must choose none; no Feature/production runtime deploy is required.

The old hourly Codex automation clean-approved-validation-branches is paused and must remain disabled. The daily schedule becomes available only after this workflow reaches studio_dev. To stop future housekeeping, disable this GitHub workflow; do not delete evidence. Existing unapproved proposals confer no deletion authority.

References:
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
- https://docs.github.com/en/rest/commits/statuses
- https://git-scm.com/docs/gitprotocol-pack
- https://git-scm.com/docs/gitprotocol-capabilities
