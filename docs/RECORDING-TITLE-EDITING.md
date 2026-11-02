# Studio recording titles

The authorised Learn recording editor has Recording title, Save draft and a separate confirmed Publish. The new `media-text-save` command uses the same current Admin, source session, Studio ownership, checked Teacher and transaction guards as recording-text editing. The previous `media-companion-save` command remains compatible.

`attachments.title` remains the canonical published title. A pending title is kept as the optional `recordingTitle` member of the existing private `media_attributions.draft_json`. This is a recording metadata draft, not a companion/display-title projection. Admin media-detail returns the draft as `title` and the existing attachment title as `publishedTitle`. Learners continue to receive the existing attachment title and published attribution/companion only.

A title plus companion draft saves in one guarded D1 batch, fenced by attribution and companion revisions and the current media identity. Teacher corrections preserve the pending title. Explicit recording publication updates the canonical attachment title, attribution snapshot and exact companion publication together. No IDs, playlist membership/order, recording dates, source, Teacher, PDF references or access policies change. Exact operation retries retain their original body; the existing companion retry repairs an interrupted R2 write. Blank, control-character and over-240-character titles are rejected.

A title-only correction uses the same checked command with no companion body. It writes no R2 object, reads no R2 object and never fabricates a summary or topic guide. Existing new-recording publication requirements still apply. Recordings without a companion can retain that state after a title correction.

No database migration, new binding, scheduled task, per-recording read query or polling is added. Learner feeds still select `attachments.title` using their existing bounded queries. Local growth tests add 1,000 unrelated accounts and require the same feed read/query totals. Sensitive Admin operations retain fresh authority; ordinary verification remains 43,200 seconds, with the existing 60-second Admin exception.

Recovery must remain playlist/card-aware as required by V109.6. The prepared recovery keeps this backend and the prior editor appearance so pending titles and guarded publication survive a UI recovery. Actual content attachment/publication remains manual; releasing this code does not publish real lessons.
