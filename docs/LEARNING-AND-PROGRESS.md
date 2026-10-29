# Lessons, companion reading and progress

Human guidance, 29 October 2026. Applies to Surah and Course websites, the reader, builder previews and course cards.

- The recordings are the lessons. The website is companion reading, with notes, graphics, references, reflection prompts and materials supporting those recorded lessons.
- Give recordings the primary action and companion reading a secondary action. Do not imply that each reading section is a separate recorded lesson; keep their associations explicit through stable references.
- Lesson progress is linked to watching videos. Reading a page, answering a reflection, downloading a PDF, opening a video link, previewing an edition or clicking a manual reading-completion button must not count as watching a lesson.
- Show reading sections as readings, without a lesson-completion counter. Reflection and journal storage remain separate from video progress.
- Preserve existing device-held reading flags and reflections. Legacy reading-completion flags must never be relabelled or imported as evidence of video watching.
- Viewing rights remain authoritative: website-only access must not grant recordings. Public Foundations remains open to all; do not invent video availability for it.

## Implementation status

The recording-first public cards are available in the separate homepage layout preview. The companion reader's manual completion action, reading-derived completion counter and completed badges are removed locally on `feature/preview-course-cards`; generated reading labels distinguish pages from recorded lessons. Saved device-state transfer remains compatible and retains old flags without displaying them as lesson progress. No deployments or hosted data writes were made for this guideline update.

Actual watched-video progress is not implemented yet. The real recording inventory remains disconnected from this preview. Player integration must record meaningful viewing progress against the recording's stable identity, distinguish watching from seeking/link opening, preserve resume position separately from completion, and avoid saving per playback tick. Completion thresholds and cross-device persistence must be defined when this integration is built; none is assumed here. Keep testing local and use bounded, coalesced saves consistent with the database-read budget.

Local verification passed: renderer checks confirm that both the reading index and reading page have no completion button, lesson-completion count or completed badge even with legacy completed flags loaded. Both account-bound device-transfer tests pass, preserving those saved flags and reflection answers. Syntax/configuration checks pass. No hosted calls were made.
