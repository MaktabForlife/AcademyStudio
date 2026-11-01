-- Expand only the reviewed display-key allowlist. Preserve every existing binding.
DROP TRIGGER programme_subject_insert;
DROP TRIGGER programme_subject_update;
DROP TRIGGER programme_subject_delete;
ALTER TABLE programme_subjects RENAME TO programme_subjects_baqarah;
CREATE TABLE programme_subjects(offering_id TEXT NOT NULL REFERENCES offerings(offering_id),display_key TEXT NOT NULL CHECK(display_key IN('surah-al-baqarah','riyadus-saaliheen','arbaeen-imam-nawawi','murshidul-qaari','madaarijus-saalikeen','al-adab-al-mufrad','ihya-ulumid-deen','taarikh-history-of-islam','kitabul-adhkar','shamail-of-nabi')),website_id TEXT NOT NULL UNIQUE REFERENCES websites(website_id),enabled INTEGER NOT NULL CHECK(enabled IN(0,1)),PRIMARY KEY(offering_id,display_key));
INSERT INTO programme_subjects SELECT * FROM programme_subjects_baqarah;
DROP TABLE programme_subjects_baqarah;
CREATE TRIGGER programme_subject_insert AFTER INSERT ON programme_subjects BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER programme_subject_update AFTER UPDATE ON programme_subjects BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER programme_subject_delete AFTER DELETE ON programme_subjects BEGIN INSERT INTO access_revisions VALUES(OLD.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
