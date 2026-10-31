# Compact dashboard — local review only

Current deployed website is V109.1.1. The owner requested styling the dashboard content below the circles, then hiding everything from announcements down in that dashboard. Do not deploy this draft.

The circle and programme-button columns retain their existing presentation. Working panels now put programmes and the weekly summary first, followed by attention, upcoming sessions, messages, calendar and compact tools. Panel headings, spacing, buttons and role labels use the Circles visual style. Semantic classes and DOM order keep keyboard reading order aligned with the visual layout. Public homepage sections are hidden only while the signed-in dashboard class is present; switching to the public website restores them.

Incorporates migration’s reviewed local commits 12b9546/466cf0f as d4b8388/2ab3e87: five selected canonical free-course bookmarks and one Global Admin weekly entry per programme with every returned session inside native info details. No extra data request, new role, rights/media write or fabricated session. Course/grouping logic is otherwise unchanged by presentation work.

Preparation: run tools/prepare-homepage-course-review.mjs --dashboard once on the verified V109.1.1 frozen tree; then tools/prepare-dashboard-style-review.mjs for the explicit style overlay. The resulting local-content/dashboard-style-review/public is a local review artifact, not a release config. It retains one current V109.1.1 header label. Source’s owned workspace preview on9031 uses this tree and its existing local transport and public-reference editor. All frozen release trees and browser drafts remain intact.

Validation: 11 Target course/grouping/route checks and five Source preview/transport checks passed without skips. Browser review covers Global Admin, Teacher and Student, 14 session details across seven days under one programme entry, the public-view restoration with bilingual links and active course bookmarks, and a390px single-column layout without overflow.

Separate live incident: after the owner signed in, the hosted dashboard showed its generic data-loading error. One manual retry reproduced it; migration identified the already-recorded503 and is investigating separately. No further hosted refreshes, SQL, deployment or access changes were performed. Local presentation review uses synthetic accounts.

Review evidence is in project outputs/academy-dashboard-compact-review-20261031. A subsequent release needs fresh owner approval.

## Owner corrections incorporated locally

My courses now appears immediately after the circle and before the working dashboard panels. It previews up to six entries from the existing purchasedCourses order, with Show all linking to `/studio/?view=collections&collection=courses`. No current/completed state, progress, date or entitlement is inferred from latestClass; undated order is preserved and the full list remains reachable. The existing access contract supplies the owned current/historical courses. Authoritative status grouping remains a data-contract follow-up. The separate free/public template returns in website view; it is not cloned into My courses.

The real local paired sign-in rehearsal used a synthetic learner with one actual fixture purchase. Browser checks confirmed the live local owned-course card, exact Show all query, immediate circle → My courses → dashboard order, and in-place website/dashboard switching without duplicate sections or labels. Existing completed-purchase/access tests passed. The composition test loader was updated to include the new inactive-card helper when evaluating the frozen app; unrequested cards still assert inactive.

The four programme buttons also share a two-line-capable height. Actual rendered checks showed all four at100px in the585px two-column viewport and96px at390px, without text or horizontal overflow. Neither circle placement nor the public reference layout was changed by this height adjustment.

The separate Podcast lessons and attachments chat owns new recording UI/lesson attachments. This review does not duplicate that implementation.
