# V108.8 route and role checklist — local preparation

**Not a complete V108.8 readiness claim.** Root owns the approved deploy-when-ready release. Current live code remainsV108.7. This frontend branch contains completed noticesdc2989d, subject displaye2ce49d and the incremental navigation corrections below. The paired MOU/FREE policy contracts and actual ready-Course registrations still need joint acceptance. No version marker, hosted resource, rights record or media has changed here.

## Implemented corrections

Studio's Open Academy management now uses the existing origin/source-bound one-use continuation with exact `{mode:admin,tool:home}`. Source verifies the current native Admin context at issuance and exchange; account/session changes or page departure close the pending continuation. The old bare cross-origin management link is removed. The notice directs management through Academy Admin without falsely claiming that Academy owns all rights after the per-offering Tafseer/Kahf handover. Existing source/target write guards are unchanged.

Builder brand/All websites returns go directly to `/studio/?manage=1`, preserving the current unsaved-change guard. No reader/builder save/publish operation was performed in browser QA.

## Bounded checklist

| Route or function | Required authority | Local evidence / remaining boundary |
|---|---|---|
| Public Circles `/` and Visit website | Visitor; no private state | Composed UI checked; signed-in public view retains session. |
| Login, remembered IDs, Switch user, Sign out | Existing Academy PIN/session; hints never credentials | Native sign-in, tamper, switch/replaced-session, PIN and history checks pass. |
| Learn `/?workspace=learn` | Current account and native learning context | Dashboard and native continuations tested; no enrolment inferred from a selector. |
| Teach `/?workspace=teach` | Native Teacher scope or inherited Global Admin mode | Global Teach and exact native Teacher contexts tested; learner-forged mode denied. |
| Admin `/?workspace=admin` | Global/scoped native Admin | Global/scoped context checks; learner denied. Browser current Global Admin and return mode verified. |
| Aalimiyah/Reboot/Arabic programme blocks | Exact reviewed native programme mapping and current role | Generic fixed-destination native continuation is tested; root must retain/reconcile the live exact programme mappings, not prototype IDs. |
| Hifz | Existing Hifz mapping and native membership | Fixed allowed subdomain and source context checked locally. No live Hifz sign-in/playback claim. |
| Tafseer catalogue and websites | Independent monthly/website-only rights, publication and original cohort | Existing local access/timing/editor checks pass; website-only rights are not recording rights. |
| Al-Kahf / purchased My courses | Confirmed Course purchase; retained materials independent of current live participation | Handed-over retained purchase and staff-not-purchase tests pass. |
| Spending/Salaah/Barakah aliases | Owner-confirmed exact native IDs and PAID policy | Mapping decision now confirmed in canonical inventory; registration/import/rename execution and paired published links still pending backend/release owner. Hidden Spending duplicate stays intact. |
| Ten built free Courses | Exact completed-Course registration and trusted server FREE policy | Metadata is not access. New policy DTO, published mapping/content and protected lesson acceptance remain pending; do not count waiting prototype pages as connected. |
| Parenting/Names forthcoming notices | No operational identity or action | Exact Coming soon إن شاء الله, zero actions, excluded from rotation/purchases. |
| MOU `/studio/?classroom=mothers` | MOU's own monthly policy and native current account | Ten-subject view is prepared; versioned MOU_CLASSROOM_V1 wiring/paired monthly tests are in progress. Old membership-only response must not imply months. |
| MOU timetable/Join | Academy published facts; current live/class/date/publication/cancellation/time gates | Versioned backend contract now supplied; future button eligibility/timezone/editor-link details must align with actual routes. No old media migration. |
| Studio management `/studio/?manage=1` | Current Global/scoped Studio Admin | Read-only Global Admin browser load verified, learner server denial tested. Profile lacks a general canManage capability; native header Manage visibility needs exact server metadata rather than a global-only guess. |
| Native Academy management | Current exact native Admin context; sensitive mutations retain60s | Corrected one-use browser handoff and matching return verified; learner-forged request denied. |
| Builder `/builder/?website=<id>` | Actual registered website and current editor/Admin scope | Real synthetic builder opens, direct return verified, no browser edits/publication. Shared backend editor isolation tests pass. |
| On-page editor / editions | Same current server editor scope, revision and storage guards | Shared backend mode/isolation/failed-storage checks pass; no live draft publication claimed. |
| Library/PDF.js | Exact selected native mode or website/lesson return | One-use/expiry/origin/owner checks and bounded read evidence; earlier native Learn/PDF/Close/Home and Teach return verified. |
| Calendar/messages/recorder/Teach tools | Exact native mode, activity and current scoped role | Fixed destination allowlist/continuation exists. Full per-tool browser acceptance is separate from a link's existence; do not count local preview whitelist omissions as a live feature removal. |
| Header Home/Refresh and old bookmarks | Account-safe return; existing unsaved-edit guard | Home/legacy routes, first-paint and account/history checks; date cache/recovery checks pass. |
| V109 domain/session/rollback | Separate reviewed domain and origin configuration | Out of this local release correction; no DNS or implicit cross-subdomain session/retirement change. |

## Actual current-baseline evidence

Pair: this local frontend with `Academy-studio-handover-1087` source67000f23. Twenty-one navigation/role/continuation/composition tests pass. Twenty-two additional targeted timetable, cancellation, editor isolation, account switch, PIN, verification and date-cache checks pass:43 distinct current-baseline checks. The later7 composition/view checks are a repeat subset, not7 additional independent checks. All170 module syntax checks pass.

Measured synthetic workflows: handed-over navigation12target rows/0Academy queries; cached dashboard3target rows/0Academy queries. Library preparation4target rows and6source rows/3queries; exchange10source rows/6queries. Both editor modes open in5target rows before and after100unrelated sites; save13/publish15 rows in the separate disposable backend tests. No aggregate daily/production budget is claimed. User's no-publication hold applies to real data; these editor tests use synthetic local objects only.

Browser review uses isolated127.0.0.1:9002/9003 to avoid sharing the retained localhost student cookie. It confirms current synthetic Global Admin identity in native Admin, matching Admin return, Studio builder opening and direct management return. No real PIN, external Hifz visit, live Zoom join, private author payload, hosted call or browser write occurred. Root evidence: parent outputs/circles-screen-links-20261031.

## Concrete unresolved contracts

- MOU_CLASSROOM_V1 is now planned and accepted for strict local fixtures. Current source implementation has not yet returned its final joint-test receipt; never treat the old two-field membership response as V1.
- Current protected Join reply field is `destination`; POST body is only `{sessionId}` to the returned offering-bound joinPath. Account/generation/route checks must discard late responses. No public Zoom URLs.
- The draft MOU session contract has time-based canJoin but no separate future-eligibility flag/timezone. Frontend may not manufacture a later canJoin from a false capability; agree automatic opening versus an explicit refresh, source timezone and audience-filtered session metadata.
- Draft editorHref uses `/studio/?website=...&mode=builder`, while the actual builder is `/builder/?website=...`; use the actual current route with the returned registered identity/canEdit authority.
- Native FREE media support and Join's extra live/enrolment flags are a concrete backend policy conflict reported for root review. Do not silently override class/run/withdrawal gates or create per-account grants.
- The FREE access DTO must explicitly distinguish server FREE policy from staff canOpen and paid purchase. Public catalogue labels cannot supply it.
- Ready Course mappings were confirmed, but native registration, exact website identity, published availability and policy must be verified before linking. Two unbuilt notices, standalone Qana’ah and held author drafts stay outside those operations.
