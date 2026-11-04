# V109.15 — reviewed source cleanup

Matching Academy and Studio release from canonical GitHub studio_dev. Retire obsolete source/prototype/UI entries from Git tracking while preserving every existing local physical file and Git history. Current backend permission logic, schemas, original media, cached access rules, current modes and manual lesson attachment/publication remain. The Source public package omits the unused retired handover helper; current tools and context-preserving aliases remain.

Native reviewed-import integration passed locally, including revoked Admin, account-switch, deduplication and retained rights cases. No database migration or content import is part of deployment. Preserve43/3/17bindings,43200/43200/60 and fourSource schedules. Hifz, coordinator, front door and DNS remain unchanged. Freeze and push both exact public packages to GitHub before staging/activation; keep the complete V109.14 pair for recovery.
