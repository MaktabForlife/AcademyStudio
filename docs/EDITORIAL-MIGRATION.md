# Independent websites and shared editing — local handoff

Worktree: `Maktab-independent-websites`; branch: `feature/independent-course-websites`. The canonical remote is AcademyStudio. This work has not been pushed, deployed or published to a hosted service. Runtime configuration remains disabled. Academy source files and the existing live websites are unchanged by this editorial branch.

## Content and editions

`tools/prepare-websites.mjs` starts with the saved identity audit, not invented IDs, and reads the current reviewed draft separately from its saved published snapshot. Kahf was converted and checked first, then the other eight. Foundations uses its approved release as both source editions, solely for preservation/rehearsal while its migration location is undecided. Existing Academy public Foundations access remains untouched.

The output contains nine independent website identities and 91 lessons. Website identity and document identity remain distinct. Exact lesson, section, block, reflection and asset IDs, wording, Arabic/meaning pairs, quotations and graphic references survive conversion. The converter checks exact JSON, stable IDs, file checksums and conflicting asset identities. It rejects missing file mappings rather than guessing by title/date/filename.

R2 content uses `websites/<websiteId>/versions/<SHA256>.json`; D1 records select the current private draft and published object independently. Previous editions remain recoverable; there is no deletion policy. Content contains no account records, purchases, permissions, personal answers or raw meeting links. Media byte objects are separate and deduplicated by checksum, with authorisation attached to stable references.

The migration wrapper is `ACADEMY_WEBSITE_CONTENT_V1`; the R2 document itself stays the native `ACADEMY_COURSE_STUDIO_V1` JSON used by the common reader and editors. The wrapper, content manifests and actual teaching files remain private local outputs, outside tracked code. `src/website-package.mjs` is a local preparation/storage-contract helper; operational pointer transactions and authority remain in the platform publication service.

## Both editing modes

`public/shared/website-edit-session.mjs` is the single lifecycle used by the full desktop builder and on-page Admin editor. Both use `public/shared/content-schema.mjs`, re-exported by the server. Changes and redraws make no requests. Save creates a private draft; preview uses that loaded document. Publish requires an already-saved draft and explicit confirmation. Opening the publication review never silently saves.

Both editors show the selected website, private edition/revision and unsaved state. Learners keep the published edition during editing. Conflicts retain unsaved text for export; uncertain requests retain their exact operation ID for retry, including publication retries. Account changes invalidate pending results and clear private editor views. The full builder has a bounded Previous editions list and restores a selected edition privately.

Backend checks, not button visibility, enforce staff scope on edit, uploads, Save, Publish, history and withdrawal. Capabilities for assessments and journals remain outside the exact document; both displays mask unsupported assessments. Preview completion/reflections use isolated preview state. The reader's on-page preview disables personal completion and reflection controls.

## Media and timetable ownership

The builder can reuse authorised existing WEBSITE PDFs/images or upload a website-owned image. Reuse attaches an existing stable asset; no extra byte copy is made. Additional file pages are loaded on request. Monthly RECORDING PDFs and videos retain their own feed and gates and are never relabelled WEBSITE. A richer per-attachment reference type for those PDFs awaits the authorised media inventory and platform contract.

The reader uses exact website/lesson/session IDs for combined session/media cards and per-lesson recordings. It never matches by title or date. The bounded website media feed is loaded once when needed and reused through navigation; additional pages require Load more. PDFs download through Course materials; session notes lead there. MP4 video uses protected ranged streaming rather than fetching the whole recording into memory. Only the server returns a meeting destination after its timing and entitlement check. Header joining uses stored timetable facts and a local boundary timer, with no recurring Academy call.

The existing timetable titles, actual times, cancellations and Zoom settings remain backend-owned Academy publications. This editorial branch does not author them. Actual source PDF/recording references and historical mappings have not been re-invented or re-uploaded.

## Private device learning

Completion/reflection IDs are preserved. Export/import is bound to the signed-in account and selected website. Import filters unknown IDs and merges without replacing existing reflection answers. `exportAcademyDeviceLearning` is a tested source-side adapter for the old reader's already-selected storage prefix, including preserved `legacyNoteKey` values. It does not scan account storage, export session credentials, read journals or bypass browser origin boundaries. Installing its source-side export control in Academy needs a later approved release; actual users' device data has not been accessed or transferred.

## Local review and evidence

Prepare private content (explicit local paths):

```sh
node tools/prepare-websites.mjs --project-root ../.. --output ../../outputs/independent-websites-20261028
node tools/rehearse-websites.mjs --content ../../outputs/independent-websites-20261028 --report ../../outputs/independent-websites-20261028/native-rehearsal.json
PREVIEW_PORT=8801 PREVIEW_CONTENT_ROOT="<absolute prepared output directory>" node tools/preview.mjs
```

The preview binds loopback on 8801/8802 and resets when stopped. It uses synthetic accounts `separation-global` / `1234` and `separation-studentA` / `1234`, never real Academy users. It seeds the saved publication and reviewed private draft separately. Publishing within this disposable fixture is a test only, not hosted publication.

The output directory contains `preservation-report.json`, `native-rehearsal.json` and `browser/` proof images. Native rehearsal verifies all nine packages through actual local Workers/D1/R2 storage: exact draft/publication JSON and IDs, Save remaining private, explicit Publish, Restore remaining private, and no changes to peer websites. Native tests also cover permission removal, failed writes, stale saves, exact retries, ranged delivery and website-only grants not widening recording access.

Browser checks covered the shared draft between both editors, unsaved review rejection, explicit publication in the disposable fixture, previous-edition restoration, cross-tab sign-out clearing the builder, 320/390-pixel reading without horizontal overflow, fullscreen hiding app/course headers, and desktop builder layout. These are Chromium viewport checks; actual iPhone Safari Reader-mode acceptance remains separate. Source HTML retains a semantic article, heading structure, figures, Arabic language/direction and text, rather than a PDF canvas.

## Holds and limits

No production readiness claim: live identity/entitlement/media inventories and cutover/recovery still need approved coordination. Saved publications are saved snapshots, not a fresh live audit. Foundations learning-page location, final account/status fallback policy, full Academy Library return, source-side device export rollout, legacy recording/session mapping, complete aggregate traffic budgets and deployment approval remain open. No current journal data exists to migrate.

Read measurements are synthetic local row counts, including platform checks. Real image-rich packages cost more than the tiny fixture. Use the per-website report; do not extrapolate its figures into production totals or promise savings from merely moving text to R2. Ordinary reading in the rehearsal makes zero Academy requests; public homepage tests use zero D1 reads.
