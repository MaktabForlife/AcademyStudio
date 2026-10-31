# MOU classroom V1 — paired local interface

This interface is implemented on `feature/mou-studio-migration`. Five native paired MOU scenarios pass, including scoped Admin/editor, audience filtering, independent monthly/cohort rights, recording-only content, suspension, actual Source cancellation, protected Join and ongoing mixed-month/cohort support isolation. The final affected content/media regression run passes25tests. Frontend may connect against this V1 interface; combined release acceptance is still pending. The prior Course-publication commits are preserved separately. The existing notices/subject UI checkpoints dc2989d/e2ce49d are owned by Circles migration and should be reused, not rebuilt.

MOU is an independent programme with its own MONTHLY policy, current enrolment/live flags, month/original-cohort material rights and website-only grants. Academy owns master identity/admission/suspension/session/epoch, current scoped staff, classes and published timetable/Zoom. Studio access ownership changes only after the existing guarded handover. Registration never infers months from Student roles and never copies Tafseer rights. Keep43200/43200/60 freshness. Old Academy MOU media, PDFs/video references and attachment IDs stay untouched and excluded. The explicitly approved prepared Baqarah recording package is a different source: its 26 recording lessons and supporting readings may be linked through native protected media after exact actual website/lesson/asset/month/cohort review. Its local preview website/offering IDs are never operational IDs.

## Existing entry and identity

Keep `/studio/?classroom=mothers` and one `GET /api/circles/classrooms/mothers` request for the account-bound classroom view. The backend resolves the exact reviewed native programme from server registration/configuration. The browser never supplies an account, role, programme/offering ID or guessed website ID to establish permission. Use returned operational IDs only. Subject `key` values below are display keys, not native identities or grants.

## Planned versioned response

```json
{
  "schema": "MOU_CLASSROOM_V1",
  "title": "Mothers of the Ummah",
  "context": { "accountId": "synthetic-member", "epoch": 1 },
  "programme": {
    "key": "mothers", "kind": "PROGRAMME", "accessModel": "MONTHLY",
    "offeringId": null, "authority": null, "state": "PENDING_CONNECTION"
  },
  "management": { "canManage": false, "requiresAuthorityRefresh": false, "authority": "ACADEMY_PROXY", "offeringId": null },
  "monthly": { "state": "NOT_CONNECTED", "month": null, "hasCurrentMonth": false, "hasRetainedMonths": false },
  "materialsConnected": false,
  "subjects": [
    { "key": "surah-al-baqarah", "title": "Tadabbur: Surah al-Baqarah", "state": "PREPARING", "availabilityLabel": null, "website": null },
    { "key": "riyadus-saaliheen", "title": "Riyadus Saaliheen", "state": "COMING_SOON", "availabilityLabel": "Coming soon إن شاء الله", "website": null }
  ],
  "timetable": { "state": "NOT_CONNECTED", "serverTime": 0, "sessions": [] }
}
```

The real `subjects` list has exactly10 entries: Baqarah first/once, then Riyadus Saaliheen; Arba’een of Imam Nawawi; Murshidul Qaari; Madaarijus Saalikeen; Al-Adab al-Mufrad; Ihya Ulumid Deen; Taarikh: History of Islam; Kitabul Adhkar; Shamail of Nabi ﷺ. The latter9 always show exactly `Coming soon إن شاء الله`, with null website metadata, no content/enrolment/media actions and no entitlement queries for nonexistent websites.

Before programme registration/sync, a genuine current native MOU member or inherited Global Admin receives the safe pending response. Once connected, `offeringId` comes from the reviewed server registry, `authority` is `ACADEMY` or `STUDIO`, and state is `ACTIVE` or `MATERIALS_ONLY` according to current live/material facts. Normal navigation never grants material access. After handover, Studio enrolment/retained monthly or website-only rights drive MOU visibility; stale native Student records must not restore withdrawn Studio access. Existing native Academy media rights remain unchanged.

Connected `monthly.state` is `CONNECTED`; `month` is the programme-local YYYY-MM and the two booleans describe only this account's MOU month records. Staff authority is separate and does not become a purchase/month. Monthly material rights do not grant live access on their own: preserve Tafseer's separate enrolment/live, class/date, staff and publication/time checks.

Baqarah is ONGOING. It stays `PREPARING` until an exact registered MOU website exists; binding does not require a completion/access date. Leave `completionMonth` null for the ongoing subject rather than inventing a date from its recordings. An explicitly bound published website may return `state: PUBLISHED` and `website: {id,title,href,completionMonth,canOpen:true,canEdit:false}` only when this actor passes the existing protected website gate. Locked or held/unpublished content never returns a learner href. A fresh authorised Admin may receive an editor action for an actual registered draft; a display key alone cannot create or authorise one. The prepared Baqarah package still needs an actual operational website binding and reviewed recording cohorts. Recording dates are not website completion dates. No old Academy MOU media is promoted. An editor link is exactly `/builder/?website=<returned actual ID>`; query strings in JSON are ordinary strings, never HTML-escaped.

`management.canManage` is trusted current Global Admin or this offering’s scoped Admin authority, independent of material access. It permits presentation of the native signed Academy Studio-management controls. `requiresAuthorityRefresh` indicates stale sensitive authority; all mutations still check current authority. Do not infer management from `canOpen`, public catalogue labels, or actor name. Pending registration has no management offering ID.

## Published sessions and Join

Connected timetable state is `PENDING`, `NO_UPCOMING_SESSIONS` or `PUBLISHED`; sessions come only from the received Academy publication snapshot, never a draft timetable. Return a bounded, audience-filtered list with `{id,title,startsAt,endsAt,timezone,classIds,classes,teacherLabels,joinOpensAt,eligibleToJoin,eligibilityExpiresAt,canJoin,joinPath}`. `timezone` is the signed session source zone, falling back only to the signed offering zone for older publications. `classes` contains exact signed IDs with safe native `label` or null when unavailable; never make up a class label. Learners see only their applicable class/date audience; Teachers see only their actual assigned sessions. Scoped/Global Admins see the programme scope. Unrelated classes are omitted, rather than merely showing a disabled Join button. `joinPath` is the existing protected `/api/offerings/<returned offeringId>/join`; POST `{sessionId: <returned id>}` on the user's click. No raw Zoom URL appears in classroom/public timetable JSON. Join opens five minutes before startsAt and closes at endsAt; the POST rechecks current account/scope, live/class/date/teacher audience, cancellation, publication and time before returning its protected destination. The existing success result remains `{destination: <protected URL>}`.

`eligibleToJoin` reports current non-clock eligibility, after current master/session, live/enrolment, publication/cancellation and audience checks. `canJoin` additionally requires `serverTime >= joinOpensAt && serverTime < endsAt`. A single browser clock may enable a session only if its returned eligibility is already true, the context still matches, and its clock is before `eligibilityExpiresAt`; it cannot promote false eligibility or revive an expired proof. Expiry is bounded by actual session expiry, account/access verification ages and session end. POST always rechecks; known received revocations win immediately. No polling or extra D1 read is needed to open the five-minute window.

Treat401/403 as unavailable/sign-in or denied access. An ACCESS_REFRESH_REQUIRED409 uses the existing coalesced active-account renewal, with the supplied offeringId when present. `/api/me` does not expose an epoch. Match `context.accountId` with the authenticated identity and identity.generation, pin the first authenticated V1 epoch, and clear response/subject/session state on account, generation or returned epoch change. Do not poll or fetch Academy per page/file/card. Refresh only through the existing explicit/active renewal path; upcoming subject notices need no backend request of their own.

## Remaining review boundaries

The same monthly gate family is reused internally; MOU has a separate programme discriminator and offering identity and is never included in Tafseer or free standalone Course collections. Source's native MOU monthly-media policy must not be switched on as a side effect: the bridge's monthly policy is separate, preserving old Academy permissions. No real monthly data or Baqarah website mapping is invented; the ongoing subject needs no completion/access date. Those actual rows/bindings require bounded current review before any later activation. This candidate performs no hosted operation. V108.8 deployment is owned by optimisation after combined readiness, including content and rights review. No DNS/cutover/retirement/deletion/push is included here.

## Recorded lessons and supporting readings

A recording lesson is independent of a live timetable session. Existing native attachment `lesson_id` is its stable parent identity; there is no timetable/session foreign key. A recording lesson may have zero, one or multiple supporting readings. Preserve original reading IDs and exact source associations in immutable website content and exact guide bindings; never fabricate a timetable session or republish a timetable to attach recordings. Permission filtering runs on the lesson/media list before presentation, not once per reading. Recording-only prepared Baqarah lessons remain visible through the protected offering media list when authorised.

Prepared content source: `outputs/mothers-baqarah-recording-extension-20261030/private/mothers-baqarah-expanded-package.json` and sibling `recording-sources.json`. Source dates range from2026-02-17 to2026-10-27. These verify recording dates only. Actual MOU cohort IDs and website access/completion dates must be reviewed separately.

## Native MOU website and recording operations

All following endpoints use a real current Academy-backed Studio browser session, current scoped or Global Admin authority (60seconds), normal origin protections, operation receipts and atomic mutation guards. Do not use a Cloudflare operator token as application identity. First register/handover the reviewed MOU offering through native Source operations. Actual content IDs below must be newly allocated operational IDs, never the prepared package’s local preview offering/website IDs. Root owns hosted approval, backup and application of these inputs; this candidate performs local tests only.

1. `POST /api/admin/<actualMouOfferingId>` with `{operationId,action:"website-create",websiteId,title,document}`. Omit `completionDate` and `completionMonth` for ongoing Baqarah. This creates a private draft, with no timetable session or payment.
2. Bind that exact real website through Source `POST /api/admin/platform/studio-access`, `{activityKey:<reviewed native MOU key>,command:{action:"save",revision:<fresh read revision>,change:{operationId,action:"mou-subject",displayKey:"surah-al-baqarah",websiteId,enabled:true}}}`. Use Source `command:{action:"read"}` for its exact access revision. Bind before opening the new website editor.
3. Upload original PDF/images through `PUT /api/admin/<offer>/files?assetId=<actual>&filename=<encoded>&operationId=<UUID>`. Existing content-hash storage deduplicates bytes. Add WEBSITE attachments with the native `attachment` action before saving document asset references. Full PDF material is TEXT-only; an ongoing partial-month reader is not automatically entitled to a combined full PDF.
4. For each exact reviewed prepared YouTube reference, native Admin `POST /api/admin/<offer>` uses `{operationId,action:"youtube",assetId,videoId,title}` followed by `{operationId,action:"attachment",attachmentId,websiteId,assetId,lessonId,lessonDate,cohort,title,audience:"RECORDING",published:<explicit reviewed publication>}`. Each recording lesson gets its own stable actual `lessonId`. Its date is the verified recording date; cohort must be reviewed, never inferred from date, label or a current class. Recording-only lessons need no support binding. No timetable/session ID is supplied or created.
5. Save final actual content via `POST /api/websites/<websiteId>/edit`, `{operationId,action:"save",revision,document}`. Original content/readings remain in immutable editions. Resolve document PDF/image IDs to their actual attached asset IDs without inventing a recording-to-timetable link.
6. Save the exact support index with the new native editor action below, then publish using the returned new website revision and existing `{operationId,action:"publish",revision}`. Publication is distinct from timetable publication.

### Recording support index

`POST /api/websites/<websiteId>/edit`:

```json
{
  "operationId": "<UUID>",
  "action": "recording-support",
  "revision": 2,
  "bindings": [
    {"editorialLessonId":"<original guide sourceKey suffix>","nativeLessonId":"<actual recorded lesson>","assetId":"<actual recording asset>"}
  ],
  "sections": [
    {"readingId":"<original reading ID>","sectionId":"<original section ID>","lessonIds":["<actual recorded lesson>"],"access":"ALL"}
  ]
}
```

Returns `{websiteId,revision,action:"recording-support",edition}`; exact retries return the same receipt. Empty `bindings`/`sections` are valid for a recording-only edition. Multiple reading sections may share one recorded lesson. Every indexed section must exist in the actual saved draft; every parent lesson and guide asset must already be an exact recording attachment in that same website/offering. This is an immutable private R2 index selected by a current native guarded D1 pointer, not a public manifest or unguarded R2 overwrite. At most200bindings/1000sections, one bounded native attachment lookup, no per-paragraph DB query.

For ongoing MOU without a deliberate whole-website text grant, GET `/api/websites/<websiteId>` returns `contentAccess:{mode:"RECORDING_SCOPED",supportConnected:<bool>}`. By default sections appear only when ALL their indexed recorded lesson parents pass this account’s rights. Actual `paid_months` must match the recording’s exact month AND original cohort. A bare `website_months` row cannot bypass this recording/cohort gate for ongoing recorded-lesson support; a deliberate whole-website text grant remains separate. Missing support index/unassigned sections are withheld. A mixed-month section therefore cannot leak another month’s transcript. An explicitly reviewed SHARED PDF source section may set `access:"ANY"` to allow any listed parent; this requires real `sourcePages` and no recording-specific guide blocks. Default `access:"ALL"` remains required for mixed recording summaries. No shared-versus-mixed choice is inferred from the reading container. Preserve exact source association: do not label an entire mixed reading/container with a single month. Recording-only lessons are still returned by the protected media feed.

Unassigned global material/full-PDF references, home teaching summaries and reading summaries are withheld from this partial response; image/file delivery also rechecks the filtered published references. A deliberate whole-website grant retains its existing wider TEXT-only behavior and returns `contentAccess:{mode:"FULL_TEXT"}`; it never grants recordings. Current staff has separate authority. Content changes produce a different edition and require a new reviewed support index; an old index is not automatically applied to changed text.

GET `/api/offerings/<offer>/media?website=<actualWebsiteId>` retains its existing protected response plus exact `mediaBindings`; approved support-index bindings replace preview aliases and still require the exact permitted native lesson AND recording asset. Multiple readings can refer to one lesson; absent guides do not hide a recording-only lesson.
