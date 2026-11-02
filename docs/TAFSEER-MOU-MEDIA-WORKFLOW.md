# Tafseer and MOU media workflow — local candidate, 2 November 2026

This feature starts at Studio `881ef8764100b674ed7a7361da066c5000578c4d` and pairs with Source `2f07f2186aa786917242b90b79fea58bdf02b763`. Branches: `feature/studio-tafseer-media-workflow-20261102` and `feature/academy-tafseer-media-workflow-20261102`. It is not deployed, versioned for release, pushed or authorised to mutate real media.

## Organisation and ownership

Tafseer/MOU Media has one native playlist chooser followed by Settings and Recordings. Authorised Edit, Save draft and explicit Publish remain on that screen. Settings edit the canonical name, optional checked playlist Teachers and existing card design/image/colour/gradient. The supported Tafseer default artwork remains in use. Recordings retain their own checked Teacher, title, summary, topics, original source/date, publication and supporting material. Recording publication and playlist publication remain distinct. If a legacy recording has no checked Teacher attribution, its Edit action first offers the existing checked registered-Teacher selector and a private attribution save. No Teacher is guessed; its original source/date/class and published edition remain until the later explicit recording Publish.

Subscriptions, eligibility, additional grants and completion/close-date controls stay in the existing Participants surface. Studio Participants renders a scoped link without loading a roster, paid-month register or eligibility table. The existing checked Academy connector resolves the offering to its current native programme and opens `/programs/?program=<native ID>&tab=participants&participants=access`. The table is the existing native component and transport, embedded under Participants with the exact offering selected. No Access tab or duplicate editor was added. Its playlist table edits dates only; playlist building and card publication belong to Media. The existing general Admin Access destination remains compatible.

Academy Media first checks the current authoritative owner through a bounded `media-location` command. Studio-owned MOU/Tafseer and Courses reach their existing Studio destination with the offering preserved; ordinary Academy programmes keep the native creator. FROZEN, denied, expired and failed lookups fail closed with recovery text. The backend ownership guard is unchanged. Original Academy copies are an explicit historical read-only path. Course layout/redesign work remains excluded.

## Existing Baqarah: one manual attachment action

The saved root verification receipt confirms all 26 existing published Baqarah attachment/asset/YouTube/date identities against the reviewed V108.8 import. Website `111efc1d-9c72-4105-977a-5a5ef699ee8f`, MOU offering `PRG-656bcece-4310-49c7-87d7-ee06756f66c1`, has no independent native playlist yet. This implementation does not create that mapping or attach anything on a live system.

Create/select a private target playlist, choose **Attach existing playlist**, choose the existing registered MOU subject, and review the exact recordings, summaries/topics, reading IDs, original PDF and target. `existing-collection` resolves actual registered website/attachment identities and saved native reading bindings; it never guesses from a name, date, timetable or local review URL. It caps review at 50 recordings and 10 PDFs, verifies original protected PDF availability, and reports exact missing/ambiguous identities. Any unresolved item prevents attachment.

Before attachment, **Open existing recordings** opens the checked protected collection reader. Each lesson also has a **Review recording** link using the reader's existing exact recording-ID route. The review list shows saved source order as lesson numbers and original dates; opaque attachment IDs remain internal. Reader destinations must match the reviewed website exactly. No object key, public file URL or per-recording lookup is added; original PDF links retain the protected media route.

**Attach playlist** is one user action. Internally it references existing recordings in groups of at most eight using the existing guarded `mou-playlist-add` action, with checked revision continuation between writes. It preserves existing target positions and appends missing items in the saved source document's explicit recording order. Existing source recording/asset/lesson IDs, dates, classes, attribution, readings, source publication and prior rights do not change. Duplicate clicks coalesce; lost acknowledgements reuse the exact operation and command; known conflicts require current revision/source review. An interrupted action reports partial progress and resumes without duplicating references.

The original PDF is a website resource, so a recording-only reference would not make it usable in a newly published playlist. One additional **private website attachment** on the target references the same existing PDF asset/object, and the private target document names that resource. No PDF bytes, object, upload or per-recording file copy is created; the original attachment and website stay unchanged. Its guarded save checks current source publication/revision, target ownership/private state/revisions, actual file availability and current scoped Admin/session/epoch. The existing explicit playlist Publish confirmation now names its saved website/PDF resources and publishes those target website attachments in the same guarded transaction. It never publishes or rewrites source recordings. This resource publication addition is limited to MOU.

## Access rules retained

| Material | Existing rule retained |
| --- | --- |
| Legacy Tafseer website and website files | Saved completion month/date, website month or explicit website grant, plus current account/publication gates |
| Legacy recording | Original recording month and cohort; adding an existing playlist reference preserves that historical path |
| Native open monthly playlist | Current server month in the programme's native timezone |
| Native closed monthly playlist | Saved close date's month; original recording dates do not become access dates |
| Reviewed closed-month correction | Existing holder retention while the original paid/text rights remain; later payments to the old month do not acquire the playlist |
| Last paid-cohort removal and regrant | Existing recording retention revocation remains; regrant does not resurrect it |
| Website-only month/additional Surah grant | Text/website resources only, never recordings |
| Shared target PDF | Existing playlist website/text and publication gate; its original protected website/PDF rights remain unchanged |
| Course/Global Admin/scoped Admin | Existing perpetual purchase/free, inherited Admin and exact programme scope remain unchanged |

No timetable/session association, payment, grant, class, Teacher, date or rights update is inferred. Core0023/Admin0003/Studio0014 remain current; Admin0004 is unused. No schema file is added or replayed. Normal reads keep the existing 43,200-second proof; sensitive writes retain the existing 60-second freshness and atomic authority checks. Known revocations, account switches and late replies clear private state. No credential prompt, polling, focus refresh or roster scan is added to Media.

## Reads and invalidation

Catalogue/detail reads use bounded existing endpoints. Selected native rows and published summary indexes are projected together, not fetched once per recording. For an explicitly selected existing MOU source, one bounded source review supplies its existing summaries/reading bindings and shared file information. Private recording detail is fetched only when opened. A selected legacy Tafseer website reuses its bounded published reader/feed and exact saved guide bindings to keep its genuine summaries, topics, quotations, readings and website PDFs visible; no title/date inference or per-recording request is used. Successful empty results are cached, failures are not. Caches are scoped to account/generation/offering; writes and account/content events invalidate them. The scoped Media admission response carries the current playlist/access revision so an external date or playlist change invalidates cached presentation when returning. Permission checks remain server-side.

Local browser request counts: initial Media 4; select empty playlist 1; return to that successful empty result 0; ordinary return to Media 1 (2 after write invalidation); playlist Save 2; playlist Publish 2; complete synthetic 26-recording plus one-PDF attachment 34 requests, including checked writes and final verification. Individual write authority is retained. The evidence includes each request's local D1 rows/queries. The existing growth fixtures cover 4,000 unrelated rows and preserve bounded reads.

## Review and evidence

Run from this worktree:

```sh
node tools/serve-monthly-media-review.mjs
```

Open the printed loopback URL. It has disposable synthetic accounts, a private MOU target and 26 existing source recordings plus one original PDF. No real content is loaded or published. Stop with Ctrl-C. For automated browser checks, set `PLAYWRIGHT_MODULE` to an installed Playwright entry and use `tools/monthly-media-browser-check.mjs`; the paired Participants check also needs `ACADEMY_SOURCE=../Academy-tafseer-media-workflow`.

Evidence is in the parent `outputs/tafseer-media-workflow-local-20261102/`: regression logs, desktop/390px screenshots, per-request counts, Participants native paired runtime checks, syntax checks and final handoff JSON. Browser traffic is restricted to loopback and uses synthetic Worker/D1/R2 fixtures. All actual attachment/publication tests affect those fixtures only.

## Integration boundaries and limitations

Compose both commits and all new JS/CSS modules over the verified paired V109.8 frozen asset tree; do not deploy the raw public tree or previews. Include the Source connector allowlist, offering-to-native Participants resolver and actual shared-component copies on both sides. No coordinator schema change, version bump or independent release is requested. Keep V109.8 or another title/card/playlist-aware recovery pair.

Real Tafseer websites without a native playlist remain explicitly listed with their exact runtime IDs; this task has not performed a production mapping audit. The only provided real unresolved native-playlist mapping is the Baqarah website above. Runtime source review stops on any additional ambiguity. No live PDF byte/permission acceptance, real Teacher/class/date choice, real attachment or publication has been performed. The user still reviews MOU and other programme content; Course redesign and the separately owned Circles announcement/navigation tasks are outside this candidate.
