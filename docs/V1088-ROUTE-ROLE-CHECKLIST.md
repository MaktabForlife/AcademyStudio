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
| Ten built free Courses | Exact completed-Course registration and trusted server FREE policy | Exact returned native website IDs now route the catalogue to the protected reader. Metadata is not access: final FREE/PAID policy DTO, actual published content and protected lesson acceptance remain pending. |
| Parenting/Names forthcoming notices | No operational identity or action | Exact Coming soon إن شاء الله, zero actions, excluded from rotation/purchases. |
| MOU `/studio/?classroom=mothers` | MOU's own monthly policy and native current account | Strict MOU_CLASSROOM_V1 view/controller is wired; real paired API compatibility and native browser sign-in/Home/MOU return pass. Final monthly/media/Join acceptance remains with the composed backend. Legacy membership-only JSON fails closed. |
| MOU timetable/Join | Academy published facts; current live/class/date/publication/cancellation/time gates | Separate eligibleToJoin, proof expiry, five-minute local timers, source timezone/classes, exact protected POST/destination and account/route guards are wired. No old Academy media migration; prepared Baqarah sources are separately approved. |
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

## Incremental MOU/Course verification

The new incremental checkpoint after da779b7 passes40 focused composition, route, notice, MOU, Course-link and recording tests, plus1 separate real paired MOU API compatibility test across four native roles. All176 module syntax checks pass. This reruns several earlier view cases; do not add these numbers to the older43 as an independent total.

The paired compatibility fixture measured266–267target rows/11queries with up to50published sessions, zero additional Academy queries per classroom GET and no repeat GET on cached active-view entry. Native synthetic browser QA also confirms student sign-in, MOU access/subject/source-timezone display and Home→Circles→MOU round trip. Layout-only desktop/390px and navigation-only Course screenshots are labelled separately; they do not prove real content publication or playback.

## Remaining release boundaries

- The backend implementation now supplies eligibleToJoin/proof expiry, audience-filtered sessions, source timezone/class labels, actual builder URLs and scoped MOU management metadata. Frontend strict fixtures and real paired DTO reads accept these. The backend owner's final monthly/cohort, publication, cancellation, Join and media tests are still required on the frozen combined candidate.
- Protected Join uses destination and only the returned offering-bound path/sessionId. Local timers create no rights or requests; known account/epoch/route changes and denials remove stale actions.
- Native FREE media/Join policy remains the backend owner's scope. Do not override class/run/withdrawal gates or manufacture grants in the browser. General classification display still needs an explicit trusted FREE/PAID DTO, never staff canOpen.
- Ready Course cards now use an additive frozen-podcast delta and the protected native reader. Root must supply and verify actual published Course identities/content/media and remove the generated public Imra’tun JSON duplicate, keeping the deliberately public Ulumul files. No title-based mapping or private-author playback fallback is permitted.
- Recordings have zero/one/many supporting readings, independently of live timetable sessions. All associated reading IDs remain attached to the one native recording; recording-only lessons are playable when authorised. Text-only website grants retain a Read entry without granting recordings.
- General native /api/me still lacks a scoped canManage capability for global header visibility. The new MOU view uses its genuine management DTO; existing server enforcement remains intact.
- Two unbuilt notices and standalone Qana’ah remain excluded from operational linking. The latest direct user instruction keeps homepage free-course cards and timed free-programme links inactive for later UI placement.
