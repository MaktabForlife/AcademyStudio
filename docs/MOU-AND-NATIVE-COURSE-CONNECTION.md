# MOU classroom and native Course navigation — local frontend checkpoint

This is an incremental frontend change after da779b7. Root owns V108.8 composition and deployment. It makes no hosted, content, access, timetable, media, ownership or DNS change. The separately owned GUI rebuild remains excluded.

## MOU entry

`/studio/?classroom=mothers` now consumes its authenticated `GET /api/circles/classrooms/mothers` response rather than discarding it. The V1 parser requires the current account, pins the first authenticated epoch within the identity generation, and validates the independent MONTHLY programme, ten canonical subjects and exact returned native website/Join paths. Unknown/legacy schemas, changed epochs, mismatched subjects and cross-offering paths remove old actions. Existing API401/409 renewal remains in the shared request layer.

Monthly records describe MOU only. A website-only grant or staff capability does not manufacture a month or recording grant. Baqarah links only through the returned registered website/canOpen; fresh editor permission uses the actual `/builder/?website=<id>` route. Ongoing MOU permits a null completionMonth: no completion date or timetable relationship is invented. Nine future subjects remain inert.

Published sessions require source timezone, class labels, teacher labels and separate `eligibleToJoin`, `eligibilityExpiresAt`, `joinOpensAt` and `canJoin` fields. Local timers can open only already-eligible, unexpired sessions during the five-minute window and close them at expiry/end. They never fetch or grant access. Join POST sends only `{sessionId}` to its exact offering-bound path; the protected `destination` reply is used only while the account, route, request generation and window remain current. Denial/cancellation removes old actions and requires explicit refresh. No raw Zoom URL is rendered.

One coalesced classroom GET supplies all subjects/classes. Account/session/page/route changes clear state and timers. Library catalogue and website-list responses also have route/generation guards, so a late catalogue response cannot replace MOU. The old generic Library heading is hidden on MOU; header Home/Refresh and unsaved-editor guards remain.

## Recorded lessons and support

Each permitted native recording remains one lesson, with zero, one or multiple supporting readings. Native recording rows create entries without requiring a guide or timetable session. All reviewed guides for the same native recording contribute their distinct reading IDs and topics; supporting text alone creates no recording. The authorised document's text remains reachable from Read when its recording is unavailable, preserving deliberate website-only/text grants without adding a playback action. Source block/reading/recording IDs and text are unchanged.

## Frozen Course catalogue composition

Keep the deployed Circles root and assets. Overlay the reviewed public-file diff; any native `public/index.html` change still maps to `studio/index.html`.

After the existing notices delta, apply **only** `connectedNativeCourseNavigation(source)` from `tools/circles-ui-adaptation.mjs` to the already-connected `circles/podcast-view.mjs`. Do not run the entire raw-design adaptation again. The additive helper is idempotent and imports `/shared/native-course-links.mjs` through its relative module path. No change to the frozen `circles/course-source.mjs` is required for this interim route.

The Course page reads one credential-free `/api/public/circles` snapshot and matches COURSE keys to returned native website IDs. Existing display aliases are explicit: salaah/stillness-in-my-salah, tawakkul/tawakkul-mindset, kahf/surah-al-kahf. Everything else matches exactly; no title or guessed website identity is used. Conflicting aliases fail closed. All thirteen newly prepared Course keys plus existing Kahf can reach their registered native reader when the release snapshot supplies their actual published identities. This fixture capability is not proof that their real registrations/publications are complete.

Ready free/paid cards and old prototype Course bookmarks route to `/studio/?website=<returned id>`, bypassing prototype payload/playback and the old contact-only paid-card interceptor. An old author recording ID is not guessed into a native attachment ID: such bookmarks return to the Course's native recording list. The reader uses existing protected native content, attachment and media routes. No `AcademyCourseSource` author-bundle adapter or direct private-video fallback is installed. Static recording counts are suppressed for native-linked cards; the authorised native feed counts actual recordings.

The existing confirmed four-paid/ten-free display grouping is preserved; catalogue labels never grant access. A later editable classification display must use an explicit trusted server policy DTO, not staff canOpen or a static title. The homepage's separate free carousel stays inactive. Two unbuilt notices remain inert; Qana’ah stays within Imra’tun.

**Remove `circles/free-learning/imratun-muminah.json` from the new prepared public composition.** The local full composer now removes only that generated duplicate. Root's deployed-asset composer must do the same after copying the frozen assets. This does not delete any original author/reference source. Preserve `ulumul-quran.json` and `ulumul-quran-notes.pdf` as deliberately public resources. Composition tests now require exactly those two public payloads.

## Verification and limits

Forty focused frontend/composition/recording checks pass on `local-content/mou-course-final/public`. One separate real paired MOU API compatibility check passes using the current local backend candidate and source fixture: learner, teacher, scoped Admin and Global Admin each make one classroom GET; one wrong-programme account is denied. Recorded target reads were266–267 rows/11queries for the50-row synthetic timetable fixture, with zero Academy queries for ordinary classroom reads. This is a local bounded measurement, not a daily production usage claim. Repeated active-view entry makes no extra request.

Native browser QA using the actual paired fixture confirmed synthetic student sign-in, correct MOU month state, ten subjects, no future-subject/Admin actions for that learner, source timezone, Home to the same account's Circles dashboard and MOU-card return. Separate navigation-only browser fixtures verified14 native Course links, zero contact-only paid interceptors, two inert notices and old Spending bookmark routing. Layout-only desktop/390px checks used explicit synthetic labels. No real account, live Zoom Join, hosted playback or teaching publication was tested. Temporary review servers/tabs are closed; the original localhost8944 preview is preserved.

Remaining release dependencies: backend's final monthly/cohort/publication/cancellation/Join/media and FREE/PAID tests; verified actual Course and prepared-Baqarah registrations/content/media identities; final protected playback and account-switch journeys on the composed candidate. General native `/api/me` still lacks a scoped canManage capability for the global header; this checkpoint uses the genuine MOU management DTO for MOU's own action and leaves server enforcement intact. Do not call this full V108.8 readiness.
