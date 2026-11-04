# Circles homepage V108.2 — 30 October 2026

You asked to make Circles the new Academy homepage so you can sign in and check the connected flow. This release targets the existing real parallel site, https://academy-studio-parallel.naidu-hajira.workers.dev, using the established Academy ID/PIN endpoints and one-use Academy continuation. The original Academy remains available.

The prepared Circles design is `b8527a904507c254cf51dcaef8ca4965ab074839`. Root `/` and `/circles/` serve that design with the native sign-in adapter. `/studio/` serves the existing catalogue, reader and gated editing workspace. Tafseer and Courses select their respective catalogue tabs. Legacy root bookmarks retain their reader context through the Studio route. The withdrawn flyer-layout request is excluded.

Deploy from this integration branch with `wrangler.parallel.jsonc`, the dedicated `academy-studio` profile and the explicit target account `2b01ca929611669e032703ff19f7098f`. Override static assets with `local-content/circles-home-1082/public`; deploying the original `public/` directory alone would omit the Circles homepage. Keep existing secrets and configured Academy origins. No schema migration or D1 write is required by this release.

The V108.1 baseline is Cloudflare version `0398abc1-ce48-4a75-af17-63e0f31d94f4`, deployment `7d95c039-d6d8-4c9a-82cf-42f404aca24b`. Preserve `ACCOUNT_MAX_AGE_SECONDS=43200`, `LIVE_ACCESS_MAX_AGE_SECONDS=43200`, `ADMIN_MAX_AGE_SECONDS=60`, `AUTHORITY_MODE=ACADEMY`, and the current master-status, local permission, revocation, date and publication gates. This branch includes the deployed verification behavior; the release label is V108.2.

Public R2 publication is restricted to `public/circles/catalogue.json` and its one Kahf cover. The catalogue contains the nine existing website identities and the Fatir text-pending notice. Its SHA-256 is `c779e7b4a5d6dc52819ff1d0961f6a5ecf81c753ee51d58a794fce4066bea867`; the cover is `d096e1f35b401b5fc37abd45782b6b1af3b12772507710af50dec892e0dbb647`. Both keys were absent before this release. A bounded target check confirmed all nine websites enabled with their existing published editions (27 rows read, zero written). No teaching edition, new course draft, account or entitlement is imported. All 49 previously migrated media attachments remain unpublished.

Full local regression: 126 passed, zero skipped/failed. After the version-label change, both parallel-entry tests pass; 133-module syntax/configuration checks, generated binding types and the prepared-assets dry run also pass. PIN acceptance and permission/revocation tests use disposable local fixtures. A real user login remains for you to perform; no real PIN is collected or exercised by the release operator.

Private build, deployment, verification and recovery records are in the parent `outputs/circles-homepage-release-1082-20261030/`. If runtime verification fails, restore the V108.1 Worker version rather than resetting data or access state. The two newly introduced public metadata keys can be withdrawn separately if needed, retaining their exact local copies. Existing teaching editions and private media are outside this rollback.

No source Academy deployment, DNS cutover, old-screen retirement, Git push or offering-authority transfer is included.

## Completed release

Runtime commit `f26450b` deployed successfully at 2026-10-30 10:37 UTC. Cloudflare version `a2ec8e43-af2a-4785-a627-013e2c04910b`, deployment `f987142f-6dd2-42e2-bd2e-9f2e394ae641`, serves 100% of traffic. Post-deployment metadata confirms the same D1/R2 resources, both existing secret bindings, Academy origins, authority mode and 43200/43200/60 freshness settings.

Seven bounded unsigned checks passed: Circles root, native Studio entry, exact sign-in module, real-origin configuration, ten-card public catalogue, unsigned-account rejection and the original cover byte checksum. No private content or account was requested. The browser's old synthetic Academy handoff tab now shows the real hosted Circles homepage with its empty Academy ID/PIN form open. Screenshot: parent `outputs/circles-homepage-release-1082-20261030/live-login.png`. Actual user PIN acceptance and signed-in delivery remain for your check.
