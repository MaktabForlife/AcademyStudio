-- Local candidate only. No access or existing media rows are rewritten.
CREATE TABLE recording_companions(
 attachment_id TEXT PRIMARY KEY REFERENCES attachments(attachment_id),
 source_revision TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0,
 draft_key TEXT NOT NULL,
 published_key TEXT,
 index_json TEXT,
 duration_seconds INTEGER NOT NULL CHECK(duration_seconds>=0 AND duration_seconds<=86400)
);

CREATE INDEX objects_youtube ON objects(youtube_id) WHERE youtube_id IS NOT NULL;
