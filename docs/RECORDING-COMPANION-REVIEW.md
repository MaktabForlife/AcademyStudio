# Yaseen: recorded lessons with companion reading

Local work on `feature/preview-course-cards`, 29 October 2026. No deployment, source Academy changes, hosted database queries, R2 uploads or live publication.

## Reading experience

The website introduction is compact, followed immediately by the recorded-lesson overview. Each authorised video has a prominent “Watch the full video” button, a short transcript-based overview when available, and a link to the associated companion reading. Recordings remain the lessons; the sixteen existing Yaseen readings remain supporting material. No watched/completed state is inferred from opening a video or reading a page.

The player sits in a separate sticky column on desktop and remains visible above the reading on mobile. It stays outside the redrawn reading DOM, so changing readings does not recreate the iframe. Closing it, leaving the website, or signing out removes playback; a late media response cannot reopen it after leaving. Normal full-screen video controls remain available. Viewing APIs, paid-month/whole-Course rights and website-only restrictions are unchanged.

Only permission-filtered media rows generate recording buttons. A button resolves its existing attachment through `/api/media/:id` before an iframe is created. Content cannot supply a YouTube URL or turn a website-only grant into recording access. No copied videos or PDFs are created.

## Editable summaries

Summaries use the existing editable source-note-aside component, in a short new section at the beginning of the relevant companion reading. `sourceKey: recording:<stable original lesson ID>` identifies the source recording; its title is the note attribution and its text is the overview. The homepage derives its summary cards from those notes and joins them to authorised media using the stable original lesson ID. This adds no content fields or new Save/Publish service. Both existing editors can edit the same note text using the shared validator and normal private draft/publication flow.

The new summary sections are separate from the author’s PDF text. A local package-preparation tool verifies that every original Yaseen reading/section and its text remain byte-for-byte identical. Added note/section IDs are deterministic so repeat preparation updates the same source summary. Private teaching packages and recording inventory stay outside Git and public assets.

## Source review

The convenience transcript-export tool returned “No transcript is available”. That result was misleading: the human supplied a screenshot showing the visible Transcript panel. The five full transcripts were then retrieved from YouTube’s visible interface, with timestamps, and saved privately in the parent project output directory. Five 93–103-word summaries were prepared from these transcripts, with British spelling and the source’s practical teaching in view. They are editorial overviews, not substituted PDF wording or new verbatim quotations. Automatic-caption spelling is not copied blindly into the summaries.

The local output `outputs/yaseen-recording-companion-20261029` contains the private transcript sources, reviewed recording guides, revised Yaseen package, preservation audit and screenshots. `tools/prepare-recording-companion.mjs` prepares a separate package without changing its source. `tools/serve-recording-review.mjs` loads the existing saved preview copies and five recording references into a disposable local runtime, saves/publishes only that local Yaseen edition through the normal server service, and issues a synthetic local preview login. It never contacts hosted Academy or Cloudflare.

## Verification and handoff

Nine focused local tests pass for media discovery/rights, device reflections, private preview identity and recording overview/source-note bindings. Syntax/configuration checks pass. Local package validation and Save/Publish pass; all sixteen original readings/sections are preserved. Browser checks confirm five overview summaries, five video buttons, active YouTube playback, the same player remaining present while a linked reading opens, and no reading-completion control. The player is beside the desktop reading, and mobile widths 390px and 320px have no horizontal overflow. Signing out removes the iframe and hides the reader. Screenshots show desktop and mobile read-along.

Production video-progress tracking is still a separate pending task, as recorded in `LEARNING-AND-PROGRESS.md`. No completion percentages, time thresholds or cross-device watch records have been invented. Real recording mappings/import and deployment remain separate release decisions. This feature does not alter the already imported hosted preview editions. Do not overwrite another worktree or reimport reviewed content during runtime integration.
