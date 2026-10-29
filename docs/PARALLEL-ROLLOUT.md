# Parallel rollout — 29 October 2026

The human has authorised starting deployment and clarified: start with parallel systems, then move to separation. Academy remains available with its existing learner/admin routes, homepage, Library and schedules. Do not redirect users, retire screens, change DNS or delete recovery data during this stage.

## Deployment being released

Branch `feature/academy-studio-rollout-20261029` combines the deployed private nine-website preview with platform commit `eda36b915cdeeb365706df102926325b38b255e8`. The combined native suite passes 53 tests and syntax/configuration checks cover 74 modules. The target session listing excludes cancelled/history rows through the cancellation-first index. The source timetable exporter and authenticated Library return have local regression coverage. The preview still blocks all real Academy connections; its Library control reports that limitation without opening a disconnected origin.

This runtime update uses the existing preview Worker/D1/R2, preserves saved preview drafts/publications and the approved styling, and performs no SQL seed, content import, hosted Save/Publish, source deployment or DNS change. Preview invitations remain synthetic and temporary. It is not the real-user parallel activation.

## Authority while both systems run

Academy must remain the sole enrolment/access authority until an explicit per-offering handover. Website access is an enforced local projection of Academy state, not an independent set of purchases or grants. Mirror exact stable account/offering/website/media IDs and preserve paid-month/cohort, website-only Surah and recording boundaries. Retained material rights and current live-session rights are separate. Website-only grants cannot acquire recordings.

Before real-user activation, implement and verify:

1. A bounded, checkpointed initial import of the actual offering, identity, participation, purchases, paid months/cohorts, staff, Surah grants, withdrawal and media relationships. Capture source versions so changes during import cannot be overwritten by an older snapshot. Never promote synthetic preview rights.
2. Ordered, idempotent updates for every later rights/status change, including removals and withdrawals. Current source code delivers identity/session and timetable changes, but does not yet deliver purchase/month/Surah rights. Verify stale or failed delivery cannot restore a removed right or leave Join open.
3. Server-enforced restrictions on website-side enrolment, identity provisioning, staff/purchase/month/grant/completion changes during Academy authority. Provide a clear path to the existing Academy management flow. UI restrictions alone are insufficient. Resolve independent content-authoring authority explicitly; never periodically overwrite newer website drafts with old Academy copies.
4. An audited PDF/video/shared-asset mapping preserving publication, cohort, withdrawal and permissions, using existing files without per-lesson duplication. Current imported preview objects are teaching JSON and artwork only. Academy Library stays on Academy.
5. Exact origins, separate scoped secrets and production resources, activation/rollback switches, approved freshness/outage semantics and a current Academy release baseline. Deploy the source connector disabled first; prepare the real target separately from synthetic preview storage; import/reconcile and enable narrowly. Test the full path with bounded necessary checks.

The current absent importer/rights deltas are implementation gaps. Do not enable real access by granting blanket rights or querying Academy on every page/file/Join. Keep routine website reading independent of Academy D1. Public snapshots remain R2-backed with zero D1 reads; changes prepare small snapshots once.

## Rollback and eventual separation

A failed parallel activation returns users to the unchanged Academy paths and disables new sign-in/delivery. Keep new R2 versions and operational data for recovery; do not automatically replay website edits into Academy. Reconcile in-flight updates before resuming.

After per-offering content, users, historical rights, media, timetable changes, revocations and Library return are verified, freeze the old ownership briefly, deliver the final delta, verify counters/versions and switch that offering's management authority to the website. Retire old routes/bookmarks and background reads only as a subsequent cutover. Master credentials and scheduling remain Academy-owned. No destructive cleanup is part of deployment.

Local/hosted release evidence is in the parent project's private `outputs/academy-studio-rollout-20261029/` directory. Previous preview rollback version: `594fe414-8f0c-4334-a648-a15d4070b2b3`.
