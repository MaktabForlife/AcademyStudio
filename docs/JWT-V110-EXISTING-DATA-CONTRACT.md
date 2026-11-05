# V110: existing databases and identity links — read-only contract

## Current owner instruction

On 5 November the owner clarified that the remembered name/ID/WhatsApp/role copies explain how the same person is linked across apps. They are not an instruction to restructure databases, remove existing copies, move data ownership or change identity links.

**All live database changes are on hold.** Preserve existing data, schemas, IDs, authority handovers, profile/access sync and acquired rights. Continue isolated JWT code, synthetic GitHub tests and review against the existing design. No hosted SQL, migration, backfill, deletion or configuration that triggers a data change is included. Any actual database work needed for V110 must have its exact effects, tests and rollback identified separately before proceeding.

The prototype `src/auth/v110/schema.sql` is used only in disposable synthetic tests. It is not a numbered migration or approved live storage installation.

## Source baselines

- Current deployed Academy V109.24: `7873664525a3e58a613056f5a7c061c1ac17162f`.
- Current deployed Studio V109.24: `4874ecf7d6b0efa61174e6a5f2f5c8bc1bff6773`.
- Hifz reference: `ba0ea53f23b933b0c175c87fe41788df74afbb2f`.
- This independent proof's source base is the retained, never-deployed V109.23 Studio `33af7a5a20f7dd90ebd745d223e9398cc0c185c3`, with Academy `9b197fafbdd80859ceb9028203c48480455c843f` fixtures. It is not a promotion/deployment tree. Later integration must replay reviewed additions linearly on the actual latest deployed pair.

## Existing ownership and links

| Area | Existing owning rules / concrete tables | JWT integration constraint |
| --- | --- | --- |
| Master identity/PIN/session | Academy accounts, account_credentials, account_sessions and current role/admission authority; existing repository and actor-proof gate | Academy remains the PIN/master identity authority. Bind existing immutable IDs; do not create a second identity or infer a new role from an app label. |
| Academy Core/Admin split | separation/ownership.js fieldOwner/liveColumns, setup-schema.js and sourceLayout; client.js/federation.js and the existing split coordinator | Ownership is per field. Published timetable/publication/current-access facts listed in coreSetupTables are Core-owned; remaining setup fields follow liveColumns and Admin ownership. Use the existing federated reader and reviewed coordinator; no imagined cross-D1 transaction or blanket table reassignment. |
| Studio identity link | Studio accounts.account_id references the Academy account; account streams preserve source epoch, admission, authority and freshness | Preserve the existing identity/role projection and its cancellation checks. A copied row does not by itself confer fresh Master/Admin authority. |
| Studio participation/material rights | participation, staff, paid_months, website_months, surah_grants, source_access_scopes and access_handovers | Existing authority mode and per-offering committed handover select ownership. Keep scoped staff roles Academy-owned; acquired material rights are Studio-owned only through the existing guarded handover. Do not flip authority or reinterpret current rows. |
| Studio retained/public media | mou_playlists, mou_playlist_retained, published_assets, websites, attachments, course policy and current publication/lifecycle tables | Preserve purchase/history, exact month/cohort, text-only versus recording, Surah and retained-playlist distinctions. Current publication, source/live gates and five-minute Join still apply. |
| Hifz identity link | academy_profile_links.academy_user_id → student_id, students.id / login_id / academy_managed | Tokens use the existing permanent journal owner. Preserve existing links and aliases; no rekey, merge, remap or journal-reference update. |
| Hifz local business data | Existing student/Teacher role checks, groups, settings, journal and author/owner foreign keys | Keep live data and current local authorization. An identity token does not replace journal-owner or current-role checks. |
| Local JWT/security state | Proposed independent families, fingerprints, browser/credential/version floors and audit proof | This is app-local security metadata, separate from business-data replication. No live table/storage installation or backfill is approved under the DB hold. |

The complete Core/Admin rule is source-defined: `coreSetupTables`, `adminTables`, `liveColumns`, `settingOwner`, `fieldOwner` and `localMetadata` in `backend/src/academy/separation/ownership.js`. It must not be replaced with an assumption based on an application's screen or name.

The Studio handover protocol is described in `docs/STUDIO-ACCESS-MANAGEMENT.md` and implemented by `src/studio-access.mjs`, `src/access.mjs` and the native guards. Source freezes writes before reconciliation, target records COMMITTED atomically, and source records STUDIO only after acknowledgement. Raw flips and automatic reverse migration are forbidden. This task has not read hosted per-offering status or changed one.

## Existing copied context is deliberate

The current bridge carries more than display fields: account state/security versions, scoped role/class/live facts, explicit material authority snapshots during parallel Academy ownership, timetable data and ordered stream/receipt metadata. These support linked identity, guarded ownership and local checks. They remain in place.

Concrete source/receiver contracts are `backend/src/academy/d1/web-platform/access.mjs`, `bridge.mjs`, Studio `src/integration.mjs` and `src/access.mjs`. After a committed Studio handover, the existing receiver preserves Studio-owned rights while continuing required source staff/class/live metadata. The old parallel-mode and later ownership modes must not be conflated.

Hifz's current V5 profile/handover code supports name, login/stable ID, WhatsApp, role, activation and ordered security/reset metadata; its existing shared-credential compatibility path also has an optional PIN-hash field. This document records code, not live profile values or clearance to remove it. The final Academy-origin PIN/JWT cutover needs a separately reviewed compatibility/rollback decision while this hold remains. No credential value is read, logged or published by this review.

## Claim partition and capacity

Academy supplies its current programme/role authority; Studio supplies its own material access under existing authority rules; Hifz uses identity with local live authorization. Claims are derived from the correct authoritative reader/version, not by copying every app's material grants into the parent cookie or by treating an imported snapshot as newly verified authority.

The current native codec is a complete-input/decision-equivalence prototype. Its stress profiles include the existing native Academy permission basis and are not a final approved claim partition. The owner's examples must not be turned into a data-removal policy or a claim that all historical material authority is already transferred.

All personal rights selected for an app token must remain lossless. The measured over-capacity cases remain open: no truncation, arbitrary scope limit or quiet full-rights database/R2 fallback is implemented. Any compact resource-directory encoding is a separate proposal requiring ownership, completeness, failure and full-cost review; none is adopted here.

## Review and activation gates

The code proof `788b6aa47730d52fd15d11c62653c9a45bf3729a`, [run41978845857](https://github.com/MaktabForlife/AcademyStudio/actions/runs/41978845857), passes 31 JWT/native cases on each runtime and 212 named regression cases: 274 executions, zero failure/skip. Its code closes selected-floor CAS/rebinding and issuer/cookie composition findings without any live route import. Historical failing fixtures remain in GitHub evidence.

Remaining work includes realistic app-owned claim capacity; current native rights/version issuance; real browser generation, delayed-cookie, suspended-tab and media recovery; Academy-origin PIN/unlock/admission; owning-DB outbox/ACK/retry and rollback floors; complete-app runtime and matched whole-request cost; hostname readiness and reviewed staged cutover.

The owner's question about child ACKs is an explanation/redesign request, not selection of an outage-admission policy. The signed-browser-marker proposal remains unimplemented and must pass replay/late-response/UI/media privacy review.

No V110 activation or live DB work is cleared by these isolated passing tests. Deployment remains conditional on the full technical review/checks and the current DB hold.
