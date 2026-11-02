-- Bounded per-offering invalidation for checked private display validators.
-- No backfill, rights change, content copy or change to existing access revisions.
CREATE TABLE display_meta(singleton INTEGER PRIMARY KEY CHECK(singleton=1),revision INTEGER NOT NULL);
INSERT INTO display_meta VALUES(1,0);
CREATE TRIGGER display_account_name AFTER UPDATE OF display_name ON accounts WHEN OLD.display_name<>NEW.display_name BEGIN UPDATE display_meta SET revision=revision+1 WHERE singleton=1; END;
CREATE TABLE display_revisions(offering_id TEXT PRIMARY KEY REFERENCES offerings(offering_id),revision INTEGER NOT NULL);
CREATE TRIGGER display_attachments_insert AFTER INSERT ON attachments BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT NEW.offering_id offering_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_attachments_update AFTER UPDATE ON attachments BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT OLD.offering_id offering_id UNION SELECT NEW.offering_id offering_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_attachments_delete AFTER DELETE ON attachments BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT OLD.offering_id offering_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_objects_insert AFTER INSERT ON objects BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM asset_owners WHERE asset_id=NEW.asset_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_objects_update AFTER UPDATE ON objects BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM asset_owners WHERE asset_id=OLD.asset_id UNION SELECT offering_id FROM asset_owners WHERE asset_id=NEW.asset_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_objects_delete AFTER DELETE ON objects BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM asset_owners WHERE asset_id=OLD.asset_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_asset_owners_insert AFTER INSERT ON asset_owners BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT NEW.offering_id offering_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_asset_owners_update AFTER UPDATE ON asset_owners BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT OLD.offering_id offering_id UNION SELECT NEW.offering_id offering_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_asset_owners_delete AFTER DELETE ON asset_owners BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT OLD.offering_id offering_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_recording_companions_insert AFTER INSERT ON recording_companions BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM attachments WHERE attachment_id=NEW.attachment_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_recording_companions_update AFTER UPDATE ON recording_companions BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM attachments WHERE attachment_id=OLD.attachment_id UNION SELECT offering_id FROM attachments WHERE attachment_id=NEW.attachment_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_recording_companions_delete AFTER DELETE ON recording_companions BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM attachments WHERE attachment_id=OLD.attachment_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_media_attributions_insert AFTER INSERT ON media_attributions BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM attachments WHERE attachment_id=NEW.attachment_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_media_attributions_update AFTER UPDATE ON media_attributions BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM attachments WHERE attachment_id=OLD.attachment_id UNION SELECT offering_id FROM attachments WHERE attachment_id=NEW.attachment_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_media_attributions_delete AFTER DELETE ON media_attributions BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM attachments WHERE attachment_id=OLD.attachment_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_media_supporting_files_insert AFTER INSERT ON media_supporting_files BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM attachments WHERE attachment_id=NEW.recording_attachment_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_media_supporting_files_update AFTER UPDATE ON media_supporting_files BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM attachments WHERE attachment_id=OLD.recording_attachment_id UNION SELECT offering_id FROM attachments WHERE attachment_id=NEW.recording_attachment_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_media_supporting_files_delete AFTER DELETE ON media_supporting_files BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM attachments WHERE attachment_id=OLD.recording_attachment_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_published_assets_insert AFTER INSERT ON published_assets BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM websites WHERE website_id=NEW.website_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_published_assets_update AFTER UPDATE ON published_assets BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM websites WHERE website_id=OLD.website_id UNION SELECT offering_id FROM websites WHERE website_id=NEW.website_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_published_assets_delete AFTER DELETE ON published_assets BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM websites WHERE website_id=OLD.website_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_website_recording_support_insert AFTER INSERT ON website_recording_support BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM websites WHERE website_id=NEW.website_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_website_recording_support_update AFTER UPDATE ON website_recording_support BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM websites WHERE website_id=OLD.website_id UNION SELECT offering_id FROM websites WHERE website_id=NEW.website_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_website_recording_support_delete AFTER DELETE ON website_recording_support BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM websites WHERE website_id=OLD.website_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_timetable_insert AFTER INSERT ON timetable BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT NEW.offering_id offering_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_timetable_update AFTER UPDATE ON timetable BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT OLD.offering_id offering_id UNION SELECT NEW.offering_id offering_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_timetable_delete AFTER DELETE ON timetable BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT OLD.offering_id offering_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_source_session_audiences_insert AFTER INSERT ON source_session_audiences BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM timetable WHERE session_id=NEW.session_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_source_session_audiences_update AFTER UPDATE ON source_session_audiences BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM timetable WHERE session_id=OLD.session_id UNION SELECT offering_id FROM timetable WHERE session_id=NEW.session_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_source_session_audiences_delete AFTER DELETE ON source_session_audiences BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM timetable WHERE session_id=OLD.session_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_source_session_details_insert AFTER INSERT ON source_session_details BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM timetable WHERE session_id=NEW.session_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_source_session_details_update AFTER UPDATE ON source_session_details BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM timetable WHERE session_id=OLD.session_id UNION SELECT offering_id FROM timetable WHERE session_id=NEW.session_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_source_session_details_delete AFTER DELETE ON source_session_details BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM timetable WHERE session_id=OLD.session_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_mou_playlist_only_media_insert AFTER INSERT ON mou_playlist_only_media BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM attachments WHERE attachment_id=NEW.attachment_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_mou_playlist_only_media_update AFTER UPDATE ON mou_playlist_only_media BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM attachments WHERE attachment_id=OLD.attachment_id UNION SELECT offering_id FROM attachments WHERE attachment_id=NEW.attachment_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_mou_playlist_only_media_delete AFTER DELETE ON mou_playlist_only_media BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM attachments WHERE attachment_id=OLD.attachment_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_mou_playlist_only_websites_insert AFTER INSERT ON mou_playlist_only_websites BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM websites WHERE website_id=NEW.website_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_mou_playlist_only_websites_update AFTER UPDATE ON mou_playlist_only_websites BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM websites WHERE website_id=OLD.website_id UNION SELECT offering_id FROM websites WHERE website_id=NEW.website_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_mou_playlist_only_websites_delete AFTER DELETE ON mou_playlist_only_websites BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT offering_id FROM websites WHERE website_id=OLD.website_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_mou_playlist_retained_insert AFTER INSERT ON mou_playlist_retained BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT NEW.offering_id offering_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_mou_playlist_retained_update AFTER UPDATE ON mou_playlist_retained BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT OLD.offering_id offering_id UNION SELECT NEW.offering_id offering_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER display_mou_playlist_retained_delete AFTER DELETE ON mou_playlist_retained BEGIN
 INSERT INTO display_revisions SELECT offering_id,1 FROM (SELECT OLD.offering_id offering_id) WHERE offering_id IS NOT NULL
 ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;
END;
