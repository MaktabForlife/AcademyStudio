# Circles and Academy connection — local integration, 30 October 2026

The approved Circles presentation is integrated on `feature/circles-academy-linking` in `work/AcademyStudio-circles-integration`. The base includes the deployed target V108.0 documentation head `25c90da` (runtime `5183846`), the current local migration adapters through `8142a0a`, and UI handoff `d344a8680339ac121e045d4283be677252bb439a`. The original UI checkout and its port 8901 server are separate and unchanged. UI changes remain owned by the Circles chat.

Academy remains the enrolment/access authority during parallel running. The local connection does not enable WEBSITE authority, promote synthetic identities, replace the deployed release, publish content, import real access, push Git or change hosted resources.

## Connected behavior

- The standard application can render the approved card-only Tafseer/Courses catalogue from a separately prepared public snapshot. Patterned Arabic/English covers, Fatir's non-clickable **Text pending**, course pictures, recording detail pages, topic timestamps, explicit reading links, separate Read area and source editing are retained. With no prepared snapshot, the previous homepage remains available.
- `GET /api/public/circles` whitelists public card fields from `CONTENT:public/circles/catalogue.json`. Public cover requests accept only a SHA-256 key under `public/circles/covers/` and PNG/JPEG/WebP content types. Neither route reads D1 or accepts private bundle paths, author wrappers, access manifests or arbitrary file keys.
- `GET /api/circles/access?website=…` batches up to 50 exact website IDs through indexed account/website/source joins. Staff may open permitted content while the lock remains closed if there is no actual acquired right. Whole-Course purchases, Tafseer paid-month website rights and explicit website-only grants supply separate `accessBasis` values. A stale/disabled/missing source proof cannot display acquired access. Every later content/media request rechecks its normal gate; the catalogue is not an authority token.
- Card links and direct recording/reading URLs preserve their destination through Academy sign-in. The V108 one-use Academy/Library handoff remains in place; Library return retains the originating website and actual reading. No independent credentials are stored.
- A per-edition private recording-binding object joins editorial source keys to native assets. The existing media endpoint returns only bindings matching the exact asset and lesson in that response's already permitted video feed. Denied, withdrawn, mismatched, ambiguous and missing recordings cannot gain playback through a guide. Native PDF and recording delivery is unchanged.
- Private Save carries forward only still-declared recording links into an immutable edition object. It does not change the published document. Explicit Publish uses the existing authority, revision and file gates. Original document/mapping history remains retained; conflicting immutable mappings fail closed.
- Foundations retains its existing anonymous Academy text URL. The offline preparer derives the exact public reader path from the saved source programme/Surah mapping. A signed-in account with genuinely permitted target access can instead open its Circles website. A free-text card never creates recording rights or alters Academy's public policy.

## Offline preparation of the supplied copy

Run from this integration checkout, with a **new** destination directory:

```text
node tools/prepare-circles-connection.mjs <private-circles-bundle-directory> <new-output-directory>
```

The tool verifies source/document/cover checksums and writes only local files. It has no network calls, authentication, upload, content admission, identity or entitlement operation. Only an explicitly selected public catalogue and designated course covers are prepared as public objects. Its separate `private-connection-plan.json` must never be served as a public asset or uploaded with the public snapshot.

Actual preparation: parent `outputs/circles-academy-linking-20261030/prepared/`. The copied bundle remains SHA-256 `0089e4215af31005f065e4b385bf5a31939dd5f9163102b3b2aef57414fadd52`.

Prepared: 16 cards; seven course pictures backed by six unique unchanged image objects, including the renderer's original Kahf fallback; nine known websites; 32 exact source recording matches. Six standalone course cards remain operationally pending, with their original author schemas/text retained in the source bundle. Fatir stays pending. Mothers of the Ummah is excluded from the catalogue and stays with Academy.

No target asset ID is inferred from a source YouTube URL or from the older local fixture's generated IDs. The private plan records target media admission as pending. After an approved native media transfer, an explicit accepted source-asset/lesson → target-asset mapping and the exact published edition are required to prepare operational binding objects. This code is not a hosted importer.

## Local verification

The native tests use the deployed V108 Academy source checkout `work/Academy-parallel-access-release` at documentation head `4f693aa4` (runtime `313b6100`), and synthetic split Core/Admin databases, accounts, rights and media. No hosted query or write is made.

Five focused connection tests pass: public field isolation and cover bytes; private Save/explicit Publish and mapping history; acquired rights versus staff authority, live withdrawal and source revocation/expiry; exact permission-filtered guide/media delivery and PDF ranges; and bounded catalogue queries. The three requested catalogue identities read 17 target rows before and after 4,000 unrelated websites. Public card/cover requests read zero D1 rows. Routine target reading/media calls read zero Academy rows.

The source regression suite also covers retained whole-Course rights, historical month/cohort rights, website-only grant recording denial, staff removal, one-use sign-in/Library codes, source suspensions, out-of-order delivery, expiry, exact retries, raw authority-write rejection and query growth. Detailed results and final totals are recorded in the parent output directory.

Browser verification uses a separate disposable synthetic preview on ports 8910/8911 through the normal Worker APIs. It checks card → sign-in → selected Course; native recording list/detail and timed topic controls; explicitly linked and independent readings; direct navigation; genuine catalogue lock states; anonymous Foundations handoff; and Academy Library → unchanged original reading. No private-draft substitution or author-preview media injection is used. No real recording, physical device, audio audit or browser PDF rendering is claimed here. Existing Circles mobile evidence belongs to the UI handoff; this connection pass uses the desktop viewport.

Reproduce the separate preview:

```text
ACADEMY_SOURCE=../Academy-parallel-access-release PREVIEW_CIRCLES=1 PREVIEW_PORT=8910 node tools/preview.mjs
```

The printed sign-in identities are disposable test accounts. Closing the owned preview removes its in-memory data. The UI owner's port 8901 remains untouched.

## Remaining acceptance

Thirteen source recording associations remain unresolved (Sajdah two, Muzzammil one, Qasas ten). Six further source references await website association. Six guidance courses still require confirmed operational Course/access/media mappings and original-PDF connection. Mothers remains separate. The 32 known source matches are not proof of completed target media admission or real learner acceptance.

An authorised native transfer/import, exact deployed-resource/edition reconciliation, bounded hosted sign-in/media/Library checks, physical-device/audio/PDF-viewer checks and final status/outage policy remain release work. Existing Foundation public access remains at Academy while placement is undecided. Full-journey aggregate D1/R2/traffic/retry budgets and rollback/cutover acceptance remain required; the measured catalogue cost is not an aggregate production forecast. No new hosted action is authorised by these local results.
