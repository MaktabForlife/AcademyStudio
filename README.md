## V109.18 — reviewed repository housekeeping

One complete public source now replaces retained release copies. Packages are built and tested on GitHub, then deployed together with Academy under explicit approval. Preserve current content, permissions, 43200/43200/60 verification and manual media attachment/publication. The hosting migration remains separate; Hifz and all Mac files stay unchanged.

# AcademyStudio

Studio delivers Courses, Tafseer and Mothers of the Ummah with the Circles interface. Academy owns master identity and published timetables; Studio owns its transferred content and material access.

## Working folders

- public/: the complete current website source and approved public artwork.
- src/: the Studio backend and permission checks.
- migrations/: the ordered database history; retain every migration.
- tests/: synthetic regression and permission tests.
- tools/: build, release and checked media-administration tools.
- config/: separate preview and historical connection environments.
- routing/: the existing Academy-account domain router.
- docs/: current guidance; historical release notes are under docs/history/releases/.
- release/: the current reviewed manifest and source metadata, without copied website builds.

wrangler.production.jsonc is the single current production configuration. wrangler.jsonc is deliberately disabled and local-only. The existing hosting remains unchanged; the Pages migration is a separate, unbuilt plan.

## Build and release

GitHub is the source of truth. Build and test on GitHub runners; no Mac writes or deletion are authorised. The website is built directly from public/, without using a previous release folder. Generated release/v*/ folders are ignored build output.

The current reviewed manifest is release/manifest.json. Rebuilding its version must reproduce every public filename and byte, including the existing immutable asset addresses. A changed website needs a new reviewed version. Future releases update the same manifest and production configuration instead of adding versioned configuration files and full website copies.

Use Actions → Build release package in GitHub for comparison or a new package. The paired Academy and Studio workflow runs synthetic checks. Deployment requires separate explicit approval; a source push does not deploy.

Keep 43200/43200/60 verification, all permissions, existing media and manual attachment/publication. Hifz is outside this repository cleanup.

## Recovery

rollback/studio-before-housekeeping-20261104 preserves the complete repository before this cleanup. Git history and reviewed GitHub release records retain older versions. Do not rewrite history or use the Mac for backup storage.
