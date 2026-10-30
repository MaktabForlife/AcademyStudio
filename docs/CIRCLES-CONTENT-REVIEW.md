# Circles content presentation · 30 October 2026

The primary port-8901 review now consumes the reconciled Academy-copy bundle instead of this first pass's synthetic recording rows. See [CIRCLES-RECONCILED-REVIEW.md](CIRCLES-RECONCILED-REVIEW.md) for the current source, publication boundaries, native links and remaining limitations. This document records the first styling pass.

Local styling work requested by the user: use the already built Tafseer and guidance-course content in the approved Circles design family. Different palettes are a design choice authorised for this pass. Religious teaching, summaries, source graphics, PDFs and recording references are not rewritten.

## Review surface

- Worktree: `work/AcademyStudio-circles-theme`, branch `feature/circles-content-theme`, based on `be355ec`.
- Start at `http://localhost:8901/local-start` while the owned local preview is running.
- The catalogue opens the existing content in the Circles presentation on the same local origin. It is separate from the Academy Teach/Admin preview on port 8890.
- Start command, from this worktree: `PREVIEW_PORT=8901 node tools/serve-circles-content-review.mjs <project-root> <private-evidence-directory>`.
- Local fixture imports use the existing independent website renderer, per-website content service and protected media handlers. Synthetic preview identities and disposable D1/R2 are used. There are no hosted queries, resource changes, deployments or pushes.

## Design decisions

Warm cream, Libre Caslon Display headings, DM Sans controls, fine rules, rounded navigation and subtle circular/arched details connect the readers to the approved website. The public review catalogue carries the equal overlapping circles, straight labels, translucent side fills and the Academy logo behind the middle circle. Its entrance animation settles once and respects reduced-motion preferences. The circles remain decorative.

Each existing series retains its authored colour identity: rose, terracotta, ocean, charcoal/copper, sage, forest, sand, burgundy or plum. Guidance courses retain their clay/olive choices and original artwork, including Tawakkul's complete floral title frame. Artwork is contained rather than clipped into a circle. The smaller standard cover and full-width introduction keep phone headers compact; source title frames retain their proportions.

Existing readers default to the already supported podcast recording layout when no recording-layout preference has been saved. Explicit saved preferences are respected. This is a displayed copy of the home settings, not a saved document migration. The existing play, topic, reading, download, editing and permission handlers are reused. No teaching features or material were added.

## Sources and publication boundaries

The nine recording websites come from `outputs/all-course-recording-review-20261029/private/all-nine-review-config.json`, using the prepared seed plan at `outputs/academy-studio-nine-site-preview-20261028/seed-plan.json`. The nine reviewed documents round-trip through normal Save/Publish in the disposable local fixture without any value changing. Their 45 recording companions and 1,193 topic starts are retained. Eleven distinct PDF byte objects are checksum-verified and reused in local memory. Each selected fixture publication leaves all eight peer websites unchanged.

The six guidance sources are the existing prepared local previews for Tawakkul, Resilience, Qana’ah, Salaah, Imra’tun Mu’minah and Spending under the project `outputs/` directory. They contain 53 web lessons in total; Tawakkul's seven entries include its recorded workshop and six companion readings. A read-only adapter adds the same style layer and navigation shell at response time. Original preview files and their draft JSON are not modified or copied into tracked public assets. Their existing author-review tools and draft notices remain available.

These guidance previews are not imported paid offerings and are not evidence of native course/access mapping. The adapter must remain local. The primary review uses the Circles UI, but full content reconciliation belongs to the separate migration work. No newer draft is overwritten, and no local draft is made a hosted publication.

## Verification

- 8 podcast/content-shape and recording-companion tests passed.
- 15 content-package, website-content and website-isolation tests passed using disposable local fixtures, including independent Save/Publish, both editor modes and storage-failure preservation. Recorded database reads remained bounded with 100 unrelated websites.
- Syntax/configuration check passed for 79 modules; deployment stays disabled and bindings remain local.
- Native browser review: all nine recording websites and six guidance courses at 390px fit without horizontal scrolling or observed broken images. Catalogue, Yaseen and Tawakkul were additionally checked at 320, 768 and 1440px.
- The actual Yaseen video player visibly played at 19:05 after its timestamp link was selected. The mobile iframe carried the unchanged source and `start=1145`; its panel fitted the phone viewport. Audio was not audited.
- Yaseen's first companion reading opened with the original authored passages and Arabic. The Files page retained the existing handout download. All fixture PDFs passed protected byte-range checks; browser PDF viewer rendering was not verified.
- Evidence: `outputs/academy-circles-content-20261030/`, with source/status and preservation manifests in its `private/` subdirectory. Teaching/media content stays outside Git.

## Decisions still open for the next review

- Confirm final palettes after visual review; no content decision is needed to change them.
- Reconcile the latest migration inventory before claiming a complete Academy transfer. This preview covers the nine reviewed packages and six existing guidance drafts, not every later migration candidate.
- Fatir's native/access mapping remains pending; it has not been invented or granted access in this older nine-site fixture. Its agreed place is immediately before Yaseen once its approved source mapping is supplied.
- Tawakkul remains separate until its native course/access mapping is confirmed. It is not attached to Kahf or another paid offering to make navigation work.
- Foundations' existing public policy remains a backend responsibility and is not changed by this presentation layer. This fixture review uses a synthetic administrator; it does not establish the final anonymous Foundations flow.
- Mothers of the Ummah remains separate in Academy. Its built page and draft were not changed or folded into Tafseer/Courses. Tafseer/Courses remain outside Learn/Teach.
- Production entitlement histories, real account switching, physical-device/audio testing and final publication remain separate checks. This styling pass does not authorise a release or change any access policy.
