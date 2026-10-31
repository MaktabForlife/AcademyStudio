-- MOU is independent; the existing TAFSEER kind is only a monthly gate family.
-- No operational mapping, paid month, website, media or transfer is seeded.
CREATE TABLE programme_offerings(programme_key TEXT PRIMARY KEY CHECK(programme_key='mothers'),offering_id TEXT NOT NULL UNIQUE REFERENCES offerings(offering_id),access_model TEXT NOT NULL CHECK(access_model='MONTHLY'));
CREATE TABLE programme_subjects(offering_id TEXT NOT NULL REFERENCES offerings(offering_id),display_key TEXT NOT NULL CHECK(display_key='surah-al-baqarah'),website_id TEXT NOT NULL UNIQUE REFERENCES websites(website_id),enabled INTEGER NOT NULL CHECK(enabled IN(0,1)),PRIMARY KEY(offering_id,display_key));
CREATE TRIGGER programme_subject_insert AFTER INSERT ON programme_subjects BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER programme_subject_update AFTER UPDATE ON programme_subjects BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER programme_subject_delete AFTER DELETE ON programme_subjects BEGIN INSERT INTO access_revisions VALUES(OLD.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
-- Safe presentation facts accompany the exact signed timetable session.
CREATE TABLE source_session_details(session_id TEXT PRIMARY KEY REFERENCES timetable(session_id),timezone TEXT NOT NULL,classes_json TEXT NOT NULL CHECK(json_valid(classes_json)));
-- Immutable support indexes live in private R2. Only a native, guarded change
-- may select the index for an exact website edition.
CREATE TABLE website_recording_support(website_id TEXT NOT NULL REFERENCES websites(website_id),edition TEXT NOT NULL,object_key TEXT NOT NULL,PRIMARY KEY(website_id,edition));
CREATE INDEX attachments_website_lesson ON attachments(website_id,lesson_id,audience,asset_id);
