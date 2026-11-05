# V109.25 — media-management origins and release labels

Fix the Academy management and artwork requests rejected from the configured Academy portal, preserving current login, workspace, scoped Admin, authority and action guards. Navigation and Course-management labels use packaged release metadata without another version request.

Academy includes tested fix 904de26a6f1c63144db0b38de2714e91f2f9c6e8. Studio retains its application code and includes test-fixture origin correction e443db75b81549dc1896aaaa0878c501d74d5ae1. Prior GitHub run 42020467326 passed 88 targeted cases and 212 paired case executions (overlapping groups). The pre-existing navigation assertion mismatch is recorded separately. Final packaging and release checks must pass on the exact V109.25 pair before activation.

No schema, data, rights, identity, sync, hosting/DNS, Hifz or JWT activation change. No media attachment/publication. Rollback uses the retained compatible V109.24 code/Pages pair; no database rollback is needed.
