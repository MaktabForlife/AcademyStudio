# V108.7 — Coordinated Academy handover operation

This Studio release updates only its version markers to match the Academy Global Admin handover control. Use the exact unchanged 154-file prepared website artifact from V108.6, copied to `local-content/release-1087/public`. Do not replace it with raw `public/` assets or include held editorial/UI work.

The user approved handing over the currently mapped Tafseer and Surah Al Kahf offerings in development, and deploying when ready. The existing signed per-offering protocol, current Global Admin proof, source freeze, reconciliation, exact participant checkpoints and atomic target commit remain required. Do not change global `AUTHORITY_MODE=ACADEMY`; the existing parallel runtime supports per-offering `WEBSITE` ownership. Preserve 43200/43200/60, current bindings, all original media and later metadata. No new schema, content publication, R2 writes, DNS, screen retirement or push is needed.

Academy retains master account/security, staff, class/timetable and Zoom authority. Studio owns only transferred participation and material rights. Five unmapped Course records stay in Academy. Keep live checks small and use saved scoped backups under parent `outputs/academy-studio-handover-20261031`. Deployment and actual ownership transfer must be reported separately.
