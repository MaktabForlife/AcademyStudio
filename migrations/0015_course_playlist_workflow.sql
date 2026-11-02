-- Course-only workflow. Existing playlists/websites remain unchanged.
CREATE TABLE course_playlist_workflows (
 playlist_id TEXT PRIMARY KEY REFERENCES mou_playlists(playlist_id),
 description_draft TEXT NOT NULL DEFAULT '',
 description_published TEXT,
 content_revision INTEGER NOT NULL DEFAULT 0,
 content_published_revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE course_playlist_placements (
 playlist_id TEXT NOT NULL REFERENCES course_playlist_workflows(playlist_id),
 stage TEXT NOT NULL CHECK(stage IN('DRAFT','PUBLISHED')),
 activity_key TEXT NOT NULL,
 offering_id TEXT NOT NULL,
 class_id TEXT NOT NULL DEFAULT '',
 title TEXT NOT NULL,
 class_name TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(playlist_id,stage,activity_key,class_id)
);
CREATE INDEX course_playlist_destination ON course_playlist_placements(offering_id,stage,class_id,playlist_id);
CREATE TABLE course_playlist_content (
 playlist_id TEXT NOT NULL REFERENCES course_playlist_workflows(playlist_id),
 stage TEXT NOT NULL CHECK(stage IN('DRAFT','PUBLISHED')),
 kind TEXT NOT NULL CHECK(kind IN('RECORDING','PDF','READING')),
 reference_id TEXT NOT NULL,
 position INTEGER NOT NULL CHECK(position>0),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 PRIMARY KEY(playlist_id,stage,kind,reference_id),
 UNIQUE(playlist_id,stage,position)
);
-- Old playlist tools cannot accidentally bypass the separate content release.
CREATE TABLE course_playlist_release_guards(playlist_id TEXT PRIMARY KEY REFERENCES course_playlist_workflows(playlist_id));
CREATE TRIGGER course_playlist_items_insert BEFORE INSERT ON mou_playlist_items
 WHEN EXISTS(SELECT 1 FROM course_playlist_workflows WHERE playlist_id=NEW.playlist_id)
 AND NOT EXISTS(SELECT 1 FROM course_playlist_release_guards WHERE playlist_id=NEW.playlist_id)
 BEGIN SELECT RAISE(ABORT,'COURSE_CONTENT_PUBLICATION_REQUIRED'); END;
CREATE TRIGGER course_playlist_items_delete BEFORE DELETE ON mou_playlist_items
 WHEN EXISTS(SELECT 1 FROM course_playlist_workflows WHERE playlist_id=OLD.playlist_id)
 AND NOT EXISTS(SELECT 1 FROM course_playlist_release_guards WHERE playlist_id=OLD.playlist_id)
 BEGIN SELECT RAISE(ABORT,'COURSE_CONTENT_PUBLICATION_REQUIRED'); END;
CREATE TRIGGER course_playlist_website_publish BEFORE UPDATE OF enabled,published_key ON websites
 WHEN EXISTS(SELECT 1 FROM course_playlist_workflows c JOIN mou_playlists p USING(playlist_id) WHERE p.website_id=NEW.website_id)
 AND NOT EXISTS(SELECT 1 FROM course_playlist_release_guards g JOIN mou_playlists p USING(playlist_id) WHERE p.website_id=NEW.website_id)
 BEGIN SELECT RAISE(ABORT,'COURSE_CARD_PUBLICATION_REQUIRED'); END;
