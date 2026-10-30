# V108.4 deployed

The owner-approved release completed at 30 Oct 2026, 15:42 Riyadh on 30 October 2026. Source Worker `6b58c57b-ec48-48d0-bd37-07eaccb8d912`, target Worker `d1b846ae-535c-48e9-b9f6-34eac3aab51e`, and Academy Pages `6bd1bf8f-5a76-4c53-afd6-c64cccc37862` are active. Existing bindings, 43200/43200/60 settings, approved homepage layout and all 49 original media attachments are preserved. Nine bounded live checks and the real login form passed; user PIN acceptance was not exercised. Mothers materials remain pending. Private final receipt: parent outputs/circles-permission-navigation-20261030/release-1084-verification.json.

The earlier local preparation and authorisation notes below are historical. This release approval is fulfilled; future deployments need fresh approval.

## V108.4 deployment authorised

The owner approved the reviewed navigation release on 30 October 2026. The local layout and Mothers author-draft holds remain. Record actual deployed versions and verification after completion.

# Circles permission navigation — local preparation

The owner specified the homepage circle blocks as navigation and confirmed that Mothers of the Ummah follows its existing programme membership. No hosted deployment, SQL, permission or publication change has been performed for this work.

| Block | Signed-in destination |
| --- | --- |
| Tafseer | Existing Circles/Studio Tafseer catalogue, preserving each website/month/media gate |
| Hifz | Existing Academy PKCE connector, followed by the verified Hifz subdomain and its native handoff |
| Islamic Academia | Only permitted Aalimiyah, Reboot Your Maktab and Arabic Intensive choices; the source rechecks the chosen native context at issuance and exchange |
| Classrooms to nurture minds | Mothers for existing programme members, plus independently entitled published short Course websites |
| Arabic Adventures | Existing generic account/enquiry behavior, with no invented Course identity |

Mothers currently opens a membership-gated Studio landing that explicitly says its materials are still being connected. The separate Mothers author draft is not promoted, mapped to a Course purchase or added to the published catalogue. Only already published and accessible short Course websites appear; unmapped drafts remain excluded.

## Permission and session behavior

Academy signs a small programme-key snapshot at PIN sign-in and active proof renewal, using a single SQL snapshot in the ordered account event. Reviewed exact native IDs are held in private operator configuration, never inferred from titles or placed in tracked source. Existing effective roles, explicitly reviewed legacy mappings and Global Admin inheritance determine the choices.

Circles stores presentation metadata separately from content rights. Ordinary navigation uses the twelve-hour proof age, including staff menu presentation. Destination content/media and sensitive Admin gates remain independent and retain their current freshness requirements. Navigation cannot grant purchases, paid months, Surah grants, recordings or programme roles. Current account, admission, epoch and session checks remain in force.

Source role, subscription, class membership and programme activation changes invalidate affected signed-in accounts through the existing ordered outbox. A source-session account index avoids scanning the session population. Only actual account authority events block protected-access deliveries: menu invalidations cannot delay a revocation. Missing, invalidated or expired navigation asks for one coalesced active-account renewal, with no idle polling or per-page/per-file Academy calls.

## Validation and local preview

Synthetic tests use the actual Academy source runtime from the isolated `Academy-circles-permission-navigation` worktree. They cover role filtering, Global Admin inheritance, separate purchases, current Student/Teacher/Admin context handoffs, one-use codes, revocation between issuance and exchange, session/epoch invalidation, ordinary staff navigation, sensitive Admin freshness, historical Tafseer access and bounded reads beside 4,000 unrelated records.

The composed local assets retain approved UI `e68d0b7` and the V108.3 runtime baseline. Compact layout and local layout-editor trials are excluded. The preparer strips local layout-editor tags and assets from later compositions. The browser review uses disposable synthetic accounts; it confirms native sign-in, the Classrooms menu, its Mothers landing and the direct Tafseer catalogue route. Private evidence is in the parent `outputs/circles-permission-navigation-20261030` directory.

## Future coordinated release

Fresh deployment approval is still required by the repository release hold. Assign the next release only after approval, then prepare matching version markers and exact asset hashes.

1. Apply target additive `0003_circles_navigation.sql`, then release the target receiver/runtime and complete composed assets. Never deploy raw native `public/` or the UI owner's current trial build.
2. Apply source additive `0014_website_navigation.sql`, then release the matching Academy Worker and connector frontend with the five reviewed private `WEBSITE_PLATFORM_NAVIGATION` mappings. Preserve every existing environment binding and secret.
3. Use a few targeted schema/version/static checks and user acceptance. Do not rerun media admission/publication, copy grants, reset STUDENT access, change DNS or publish held teaching drafts.

Recovery must preserve event compatibility: do not roll the target receiver back to a version that rejects `navigation-invalidated` while the new source triggers remain active. Restore the source sender/connector and disable only the new invalidation triggers under an approved recovery plan and drain all already queued navigation invalidations through the new receiver before rolling back the target runtime; retain additive tables/indexes, existing rights and all 49 enabled original attachments. No data-reset rollback is part of this preparation.
