# Prepared Studio SaaS hosting — 4 November 2026

This is preparation on a GitHub feature branch, not an activated deployment or domain transfer. The verified V109.20 release remains active. The owner approved continuing with the revised SaaS arrangement and then changed Studio's public name to worshipuponbaseera (no final h).

## Agreed addresses

| Section | Visitor address | Provider/account |
| --- | --- | --- |
| Academy | https://ummabbadacademy.app | Existing Academy account |
| Hifz | https://mahadarwa-hifz.ummabbadacademy.app | Proposed ummabbadacademy.hifzhelper.app, existing Hifz account |
| Studio | https://worshipuponbaseera.ummabbadacademy.app | https://ummabbadacademy.maktab4life.org, Studio account 2b01ca929611669e032703ff19f7098f |

With the owner's explicit approval, the Studio provider zone maktab4life.org has been added to the Studio account on its Free plan and is pending (dc5a8932ae64e294ab53090de552324d). The empty pure-static Pages project academy-studio-public is also created (4a369706-6b02-48e9-ad7f-69abb4fd4ec4), without a deployment or Git auto-build. No source registration, nameserver, DNS record or Worker route has been changed. Transfer and DNS activation remain separate prerequisites. Hifz's new host/provider setup is not implemented by this branch.

## Request path

Cloudflare for SaaS accepts Studio's visitor hostname in the Studio provider zone. The existing academy-studio-parallel application Worker handles that request. Its current launch entry, signed Academy integration, cookie, account/session/epoch checks, scoped authority, access tables, Join gates and D1/R2 storage stay in use.

The new wrapper replaces only the public asset source with a pure-static Pages project. No Pages Function or additional authentication Worker is introduced. Static fetches use an explicit Pages origin and the reviewed public-file allowlist. They drop cookies, Authorization, Origin, query strings and forwarding metadata; preserve conditional/range headers; stream responses; reject redirects or unexpected HTML fallbacks; and never handle API/auth/internal paths.

Studio's website and API therefore remain on the same visitor hostname. Provider/old-domain browser GETs redirect to that visitor address; mutations there are rejected. Signed Academy deliveries continue using the existing fixed Worker backend address.

The public Pages project is a file source, not a sign-in or preview entry for users. It contains only the exact reviewed public bytes plus noindex headers and a real 404 page. It has no Functions, database/storage bindings, accounts, grants, teaching R2 content or secrets.

## Usage and privacy

- The wrapper adds no D1 reads, writes or R2 copies.
- Static requests through SaaS may invoke the existing Studio Worker. Pure-static Pages does not guarantee zero Worker invocations at the public SaaS hostname.
- Only known immutable files receive a long public cache lifetime. HTML is no-store; protected API/media responses remain under existing application rules.
- Hifz private data remains live and uncached. No Hifz repository or database changes are made here.
- Current deployed verification remains 43200/43200/60. The separately reviewed JWT design is not implemented here. Future shared-cookie JWT and Academy-only renewal need their own approved tests and release.

## GitHub preparation

Run the registered hosting-check.yml workflow against this feature branch, with exact reviewed Academy SHA dded14ffbfac5f27e157253e397b3b4e96bf6ecd. It prepares static Pages bytes and a complete Worker candidate, validates the actual Wrangler config/types and dry-run bundle, and tests the existing Academy/Studio implementation with synthetic data. It does not run the Academy portal importer, use production secrets, deploy, execute hosted SQL or write files to the owner's Mac.

Source settings: config/studio-saas.json. Current settings remain in wrangler.production.jsonc. The preparation derives unchanged D1/R2 bindings and existing verification limits from that file. It generates ignored artifacts under .build/studio-saas only on the disposable runner; do not commit generated website copies or release-specific Wrangler files.

The generated activation-plan.json is an inactive checklist, not an executable deployment. The production config/main entry are untouched by this branch.

## Domain-transfer bridge

config/maktab-domain-transfer.json records the five current public DNS entries and the existing two source-account Worker routes, read from Cloudflare management UI on 4 November. It contains no credentials. The source router will not move with registration.

The generated transition-worker.jsonc prepares the same Studio application entry in explicit worker-asset mode at the current maktab4life.org address. It keeps the existing reviewed ASSETS bundle, current cookie host and permissions, redirects www, and preserves native Academy aliases. There is no dependency on the new SaaS hostname or Pages asset origin during the domain transfer. It can be staged as a matching release before the move; it is not deployed by this preparation.

Target-zone root/www DNS should use the reviewed originless Worker records with routes to academy-studio-parallel, rather than relying on the old account’s Pages apex CNAME/router. Hifz and the two email-blocking TXT records are preserved. These are inactive proposed changes, not modifications to live DNS.

## Before activation

1. Review the exact tested commits, the generated plan, account IDs and public-file receipt. Rebuild from the then-current reviewed Academy/Studio release if either canonical branch changes.
2. Make the Studio provider zone active in the Studio account through the separately approved domain move. Preserve every required existing Hifz DNS connection and any unrelated records.
3. Give GitHub a limited Studio Pages Write deployment credential in its protected production environment; the existing individual Worker Editor token does not grant Pages Write. Do not put credentials in code or chat.
4. Publish the tested static files to the Pages project. Confirm its actual service address matches config/studio-saas.json; stage the complete Worker candidate without activating it.
5. Prepare Academy's matching config/hosting.json Studio destination and WEBSITE_PLATFORM_ORIGIN. Preserve WEBSITE_PLATFORM_SERVER_ORIGIN and the existing exact native Academy origin unless separately reviewed. Do not broaden global CORS merely because these are sibling hostnames.
6. Configure/verify the SaaS fallback origin, custom-hostname ownership, TLS certificate, precise Worker routes and matching customer CNAME in their correct accounts. Both hostname and SSL statuses must be active. No route covering unrelated hostnames or broad wildcard hostname trust is required.
7. Stage and test Academy and Studio as one release: sign-in/handover, cookie/CSRF/account switching, acquired monthly/Surah/Course rights, scoped Admin changes, protected PDFs/ranges, Join opening times and small read budgets. Keep media attachment/publication manual.
8. Activate only when the domain move and exact paired release are ready and authorised. Keep the current release and old routing available for recovery; update host configuration rather than rewriting app links.

## References

- [SaaS setup and ready states](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/getting-started/)
- [Existing Worker as the SaaS origin](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/advanced-settings/worker-as-origin/)
- [O2O compatibility and cache considerations](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/saas-customers/product-compatibility/)
- [Pages direct upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
