# Reconnect existing Global Admin course access — local only

Global Admin already passes the protected website/catalogue access checks without a purchase. Do not change access.mjs, store ownership checks, course policies, roles, participation or purchase records for this dashboard correction. The owner explicitly pointed out that this authority already exists.

The new dashboard's My courses presentation was limited to purchasedCourses. Navigation now also returns adminCourses: existing published Course cards whose already-computed local rights allow opening and whose current Course policy is PAID, only for the current Global Admin. Ordinary accounts receive an empty adminCourses array. This reuses the one catalogueAccess lookup and adds no database or Academy request. Actual purchasedCourses semantics and ordering are unchanged.

Frontend integration for the UI owner:

- Import learnCourses from shared/circles-learn-courses.mjs in the current course row renderer.
- Pass dashboard.mode as the third renderCourses argument from circles-login.mjs. Include that mode and navigation.adminCourses in the render signature so switching Learn/Teach/Admin redraws correctly.
- In Learn, select learnCourses(navigation,mode) before the existing six-item coursePreview. Purchases remain first; other currently permitted paid Admin courses are appended without duplicate hrefs. Other perspectives retain their original purchased row.
- Display course.accessLabel when present; otherwise keep “Your paid course”. Admin-only cards say “Admin access”. Do not invent purchases, dates, completion or progress.
- Show all remains /studio/?view=collections&collection=courses; that existing reader checks current authority independently. Preserve the UI owner's current compact placement, public restoration, accessible labels and draft state.
- Add the one genuine shared module to the reviewed composition and preview connected-file allowlist. Do not deploy preview adapters. Local preview may use explicit synthetic role-aware adminCourses data; it must never be mistaken for real purchase records.

Validation: five paired local navigation/handed-over purchase tests pass, zero skips. They verify actual Global Admin reader access with no purchase, empty Admin presentation for normal learners, current invalidation/suspension, staff authority not becoming a purchase, unchanged native Library handoff and zero Academy queries for normal navigation. Measured local Target navigation after handover: 15 rows; cached dashboard: 4 rows. One selector test and four dashboard view tests pass. This is local evidence, not hosted acceptance or deployment.
