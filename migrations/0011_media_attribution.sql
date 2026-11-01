-- Additive display metadata. No role, grant, media or companion is rewritten.
CREATE TABLE media_attributions(
 attachment_id TEXT PRIMARY KEY REFERENCES attachments(attachment_id),
 revision INTEGER NOT NULL CHECK(revision>0),
 draft_json TEXT NOT NULL,
 published_json TEXT
);
-- Exact optional supporting-file links, separate from the recording source.
CREATE TABLE media_supporting_files(
 recording_attachment_id TEXT NOT NULL REFERENCES attachments(attachment_id),
 support_attachment_id TEXT NOT NULL UNIQUE REFERENCES attachments(attachment_id),
 PRIMARY KEY(recording_attachment_id,support_attachment_id)
);
