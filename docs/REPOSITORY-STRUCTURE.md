# Studio repository structure

The November 2026 housekeeping establishes a complete public source tree and a source-only package build. The live release, backend, database migrations, permissions, media, origins and DNS do not change.

Previously, release preparation copied an older frozen package and overlaid changes. Four full packages and twenty version-specific root configurations accumulated. Sixty-two files used by the current package existed only in release copies. Those files are now represented in public/; their published asset addresses are regenerated during packaging.

The recovery branch rollback/studio-before-housekeeping-20261104 retains the exact previous tree. Historical release notes are under docs/history/releases/; historical source/configuration bytes remain in Git history. No history is rewritten and no Mac files are touched.

Current release metadata:
- release/current.json selects the reviewed version.
- release/manifest.json records every reviewed public filename and hash.
- release/source.json records source version-stamping metadata.
- wrangler.production.jsonc is the single current deployment configuration.

GitHub builds recreate release/v<version>/public as ignored output. Comparison builds verify every public byte against the reviewed manifest. New release packaging records a new manifest and updates the same production config; it does not commit another website copy.

The hosted Studio backend, routing and all migrations must retain their exact pre-cleanup source bytes. The proof includes public-asset equivalence, synthetic Academy/Studio permission/media tests, static-route checks, bundle compilation and configuration parity. Housekeeping is not deployment approval.
