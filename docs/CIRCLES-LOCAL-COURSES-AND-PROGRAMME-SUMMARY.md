# Local-only course links and Global Admin programme summary

Latest owner instruction: **do not deploy**. All work here is a review delta on V109.1.1 commit cd71a91; no hosted requests, rights/media/data changes, Source changes, DNS or Git push.

## Five reactivated cards

The owner explicitly reactivated the five free Course cards in Screenshot 2026-10-31 at 21.12.33.png, superseding their earlier inactive hold. The first commit changes only their homepage presentation/link handling. Unknown, unbuilt and other unrequested cards remain inactive, including during the existing featured rotation. Paid courses and purchase-only My courses are unchanged.

| Card key | Existing published native website ID |
| --- | --- |
| imratun-muminah | 1c6ff3cd-0b32-491d-86d9-4d19eac16569 |
| resilience | 369167cc-07ac-4db2-a39c-278f6b54ca09 |
| living-with-mindfulness | 820c085f-b658-4a59-b2b6-2c8461e18bb5 |
| my-role-as-a-muslim-friend | 71b0afac-0a41-46fa-ae8a-69539e1cf5ae |
| my-salaah-my-joy | d922fe72-b1b7-4dda-a4ef-76b13ff25e1f |

Verified against saved outputs/academy-release-1088-20261031/catalogue/catalogue.json, preserved exactly through V109/V109.1. Each card opens its canonical /circles/free-learning.html?course=KEY bookmark. The existing connected podcast module resolves the current credential-free public native Course mapping, redirects to /studio/?website=ID and leaves access/media checks to that reader. No hardcoded native ID, author package or media URL is added to production code. If the public mapping cannot load, the existing guarded error remains; there is no private-source fallback. No new per-card permission call or homepage fetch is introduced.

Integration: overlay public/shared/circles-course-row.mjs and public/shared/homepage-free-courses.mjs on the verified V109.1.1 prepared tree; apply only activateHomepageFreeCourseCards(source) from tools/circles-ui-adaptation.mjs to its circles/app.js. Do not re-run the broad original-design composition. The delta is idempotent and retains inactive rendering for other keys. The signed-in course row keeps these active free cards below purchase-only My courses and removes the obsolete blanket “Inactive for now” description.

## Global Admin summary

The owner's latest instruction is one entry per programme with an info icon revealing all sessions. In the Global Admin Admin view, this supersedes programme/date grouping: identity is kind plus activity ID, and sessions on different dates now share one entry. The details retain every session returned for the displayed week, with its date, time, subject/module and cancellation status. Coming up next still chooses the next three programmes by the earliest upcoming scheduled session and retains all their returned sessions inside details. This week includes all returned programme groups. Other role views keep their individual entries and native contexts. No extra fetch, query, timetable publication or new session is created.

Overlay public/shared/circles-dashboard-view.mjs for this separate delta. Native details/summary provides keyboard-accessible expansion; the visible ⓘ has the accessible “Show session details” label. Existing styles are retained for the UI owner's subsequent compact-layout polish.

## Validation and review build

- Eight focused course/link checks pass, none skipped, using the actual frozen V109.1.1 app and course catalogue. Covers first render/rotation, unknown cards, exact native mappings/aliases, denied conflicting/hostile mappings, public credential-free metadata and no rights/media injection.
- Three dashboard checks pass: multiple dates grouped without losing/mutating sessions, stable identities/kinds and cancelled/earlier session details, and unchanged non-Global-Admin role views.
- tools/prepare-homepage-course-review.mjs produces local-content/homepage-course-review/public. Add --dashboard for the combined local-content/homepage-dashboard-review/public. Both start with the exact162-file frozen109.1.1 tree, add only the reviewed module and explicit deltas, and exclude private payloads/editor/preview adapters. The combined build is163files,159baseline unchanged and4changed paths.

No browser or hosted acceptance is claimed by these Node checks. Circles owns integrating/reviewing this delta in its local9031 preview along with the existing public-home reference, current V109.1.1 label and compact CSS. Preview fixture adapters/editors must not be deployed. The signed-in dashboard's separated columns remain distinct from the public18:42 artwork reference. Preserve owner drafts. A later release requires current owner approval; this instruction is a local-only hold.
