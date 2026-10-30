# Circles block navigation — V108.5

The owner corrected V108.4: programme links belong on the blocks around the circle. After native Academy login the credential dialog closes and focus returns to the circle homepage. The separate account destination menu has been removed.

Tafseer is a direct Studio link. Hifz uses the existing verified domain and native one-use Academy handoff. Academia contains only the permitted programme links; Classrooms contains existing Mothers membership plus independently permitted short Courses. Signed-out public artwork and enquiries are restored immediately on logout. Replay and page rerender preserve current-account navigation without nesting links or replacing card geometry.

This corrective release uses the exact V108.4 composed homepage (approved UI e68d0b7). Only the login module, its stylesheet and two shared frontend modules differ. The target release marker becomes 108.5. No Academy deployment, database/schema write, media publication, permission edit, DNS change or local Circles layout trial is included.

Validation: nine native login/navigation/parallel-entry checks pass. Browser checks using two disposable native learner accounts confirm login closes, links are inside their respective blocks, account switching removes the other learner's choices, replay retains valid links, and the Academia block opens a connected native Academy session at the permitted programme. No real PIN was used.

Private release evidence: parent outputs/circles-block-navigation-20261030/.

Published at 12:59:22 UTC (15:59 Riyadh), 30 October 2026: Worker `18f63abd-ea89-471c-8ab7-acbc7309d4e1`, deployment `afb3fcd8-d397-4be2-9e66-609fd3768958`, 100% traffic. Seven bounded hosted checks verify the exact four changed frontend assets, unchanged circle app, V108.5 homepage and unsigned navigation denial. All 17 prior bindings, including the secret bindings and 43200/43200/60 settings, are preserved. Live browser confirms the new credential-only login form. Recovery version is V108.4 `d1b846ae-535c-48e9-b9f6-34eac3aab51e`.
