-- Offering metadata only: no per-account free enrolment or grant rows.
CREATE TABLE course_policy_revisions(offering_id TEXT PRIMARY KEY REFERENCES offerings(offering_id),revision INTEGER NOT NULL);
CREATE TABLE course_policy_state(singleton INTEGER PRIMARY KEY CHECK(singleton=1),revision INTEGER NOT NULL);
INSERT INTO course_policy_state VALUES(1,1);
INSERT INTO course_policy_revisions SELECT offering_id,1 FROM course_access_models;
CREATE TRIGGER course_model_insert AFTER INSERT ON course_access_models BEGIN
 INSERT INTO course_policy_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
 UPDATE course_policy_state SET revision=revision+1 WHERE singleton=1;
 INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER course_model_update AFTER UPDATE OF access_model ON course_access_models WHEN OLD.access_model<>NEW.access_model BEGIN
 INSERT INTO course_policy_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
 UPDATE course_policy_state SET revision=revision+1 WHERE singleton=1;
 INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER course_model_delete AFTER DELETE ON course_access_models BEGIN
 UPDATE course_policy_state SET revision=revision+1 WHERE singleton=1;
 INSERT INTO access_revisions VALUES(OLD.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
