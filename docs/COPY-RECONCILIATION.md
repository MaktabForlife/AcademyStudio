# Academy copy and builder reconciliation — 30 October 2026

Current priority: migrate existing data only; new content/course creation and review-draft promotion are deferred. The existing-data package covers all 49 accepted source references, preserving six programme-only recordings without guessing website associations. See [EXISTING-DATA-MIGRATION.md](EXISTING-DATA-MIGRATION.md) for the current adapter, actual-copy rehearsal and live-import boundary. The original copy/reconciliation evidence below remains unchanged.

You authorised copying from Academy, then incorporating web build and new builder material. The resulting private local bundle is prepared for the Circles UI. Source originals, existing hosted draft/publication pointers, identities and permissions remain unchanged. Deployment, public publication, DNS, retirement and deletion stay with their existing approval holds.

## Actual copy

Two mapped source scopes were read with bounded SELECTs: the existing paid Course and Tafseer. The current accepted media components contain 45 lessons. Their 49 linked references comprise 38 YouTube references and 11 PDFs. All eleven original PDF objects were downloaded from Academy private R2, checked for size/signature/SHA-256 and retained privately: 42,636,883 bytes. YouTube references were copied; video bytes were not downloaded. Unattached assets and other Academy programmes/Library were outside the lesson-linked selection; they remain in Academy.

The accepted head/source write version matched before and after the copy. Source D1 use was 525 rows read, zero written: 36 preflight + 489 inventory/final-check rows. Eleven source R2 GETs retrieved the files. An earlier bounded target metadata check read nine rows and changed none. It showed the nine existing website draft/publication pointers; their matching prepared local content objects are retained with hash checks. This is not a fresh download of every target object or a claim about future edits.

The source session was refreshed through its existing operator profile. No credential, source account records, learner payments, real user session or meeting URL enters the copied teaching bundle. The private operator scripts reside outside tracked source and permit SELECT/object GET only. The new Cloudflare account was inspected through its connector; no hosted write or rollout occurred.

## Content incorporated

- Nine mapped website candidates: 103 readings, preserving the older saved publication and existing draft separately from the richer review draft.
- Forty-five reviewed recording companions: 32 match exact native lesson/video identity within their offering. Thirteen remain unmapped (two As-Sajdah, one Al-Muzzammil, ten Al-Qasas). Six additional Academy recording references are retained without guessing a website association.
- All eleven web-build PDFs match the Academy copies by SHA-256. They reuse those objects.
- Seven standalone private drafts: Mothers of the Ummah/Al-Baqarah, Tawakkul, Resilience, Qana’ah, Salaah, Imra’tun Mu’minah and Spending. Their 64 reading entries, original wrappers, declared artwork and Mothers' PDF are copied verbatim. Their operational course/access mappings remain pending; no one inherits another course's purchase.
- Fatir remains a catalogue placeholder before Yaseen, without an invented date, website/native identity or grant. Existing public Foundations in Academy remains available; its recordings retain their original separate gates.

The resulting bundle has 167 reading entries across nine mapped and seven standalone documents, plus the Fatir catalogue placeholder. Its 121 unique media objects include twelve PDFs (the eleven Academy copies plus Mothers' original full notes) and 109 artwork objects. Identical byte objects share checksum identities. Private source references/manifests stay outside Git and public assets.

New builder's author-export fields are preserved rather than dropped to satisfy the older native schema. Those standalone drafts need their course/access mapping and deliberate schema/presentation adapter before operational import. Their review-only authoring controls and trial quotation styles must not become authentication or global styling. Drafts and source recordings in those exports are not newly published by this reconciliation.

## Circles integration contract

Private project-root output: `outputs/academy-content-copy-20261030/circles-bundle/manifest.json` (`CIRCLES_RECONCILED_CONTENT_V1`). See the shared `outputs/website-circles-review-20261030/MIGRATION.md` for exact paths and current handoff.

`tools/reconciled-content.mjs` provides immutable content preparation, conservative draft conflict selection, exact recording matching, permission-callback-protected edition reads and a seeder for a **new disposable local fixture**. It rejects hosted/source-authority fixtures and pre-existing websites. It creates no users or entitlements. Saved publication, original draft and review draft occupy distinct immutable objects/history entries. It is not a hosted import/publish command.

`public/shared/media-bindings.mjs` offers `bindRecordingGuides(guides, permissionFilteredMedia, site.mediaBindings)`. Some builder summary keys use provisional editorial lesson identities while Academy already has the real lesson. This adapter joins presentation only when the exact native lesson **and asset** occur in the currently permitted media response. Stored teaching text/IDs remain unchanged, and an absent/withdrawn/denied media row cannot gain a playback button from an alias. URLs, cohorts and permissions do not come from the guide.

Resolved recording `status` is canonical for consumption: only `MATCHED` is eligible for the existing permitted-media binding. `nativeMappingPending` is derived from whether the native identity is unresolved; it is false for an identified hidden recording, whose status remains `SOURCE_HIDDEN`. `sourceNativeMappingPending` preserves the original source declaration for provenance and must not drive availability. Each site's `sourceManifest` retains the exact original recording-source JSON. In particular, both Foundations recordings now resolve to `MATCHED`, `nativeMappingPending=false`, with their historical source declaration retained as true. The metadata-only correction preserves the source package, teaching editions, IDs, totals and access. The next acceptance remains the actual V108.0 + Circles runtime, including protected document/guide responses and its own read budgets; no live check or deployment was added.

Use the existing `/api/websites/:id`, `/edit`, offering media feed and `/api/media/:id` services for operational permissions/delivery. Serve neither the private bundle directory nor raw source manifests as static assets. The data seeder is for fixture testing; Circles owns UI integration, and optimisation owns the combined runtime review. Preserve the deployed V108.0 authority implementation when integrating the newer UI branch.

## Local evidence and limits

Five focused reconciliation/binding tests and syntax/configuration checks on 74 modules pass. A native rehearsal using the Circles branch's actual backend and the copied files verifies all nine websites/103 draft readings, eleven PDF ranges and 32 native recording references/guide bindings. Private Save, exact retries, explicit publication **only in disposable memory**, recovery of the original draft and unchanged peer websites pass. Existing sample sites remain untouched.

Original paid month/class access opens the correct PDF; a website-only grant cannot open it; removing the month immediately denies it. A former whole-Course purchaser still opens the Course PDF. No real user or entitlement was imported. Media delivery used at most five rows in that older Circles fixture; private Save at most 39. Those counts are fixture-specific and exclude the newer V108.0 access projection checks, whose separate evidence remains authoritative. Routine rehearsal uses no Academy calls. It must not be presented as a complete V108.0 + Circles release acceptance.

Evidence: `outputs/academy-content-copy-20261030/academy-copy-report.json`, `bundle-summary.json` and `circles-native-rehearsal.json`. The rehearsal performs no hosted requests. Browser visual/mobile wrapping, actual playback/audio, account-switch UI and seven standalone operational imports have not been verified here. Circles' primary review link is owned by its UI chat; do not represent the older standalone previews as the final combined review.
