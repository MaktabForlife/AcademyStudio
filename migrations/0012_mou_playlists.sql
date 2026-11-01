-- Independent Studio playlists. No existing subject, media or right is moved.
CREATE TABLE mou_playlists(
 playlist_id TEXT PRIMARY KEY,
 offering_id TEXT NOT NULL REFERENCES offerings(offering_id),
 website_id TEXT NOT NULL UNIQUE REFERENCES websites(website_id),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
 recording_count INTEGER NOT NULL DEFAULT 0 CHECK(recording_count>=0),
 published_count INTEGER NOT NULL DEFAULT 0 CHECK(published_count>=0),
 created_at INTEGER NOT NULL,
 UNIQUE(playlist_id,offering_id)
);
CREATE INDEX mou_playlists_offering ON mou_playlists(offering_id,playlist_id);
CREATE TABLE mou_playlist_date_writes(playlist_id TEXT PRIMARY KEY REFERENCES mou_playlists(playlist_id));
CREATE TRIGGER mou_playlist_date_fence BEFORE UPDATE OF completion_date,completion_month ON websites
 WHEN (OLD.completion_date IS NOT NEW.completion_date OR OLD.completion_month IS NOT NEW.completion_month)
 AND EXISTS(SELECT 1 FROM mou_playlists p WHERE p.website_id=OLD.website_id)
 AND NOT EXISTS(SELECT 1 FROM mou_playlist_date_writes g JOIN mou_playlists p USING(playlist_id) WHERE p.website_id=OLD.website_id)
 BEGIN SELECT RAISE(ABORT,'PLAYLIST_DATE_REVIEW_REQUIRED'); END;
CREATE TABLE mou_playlist_items(
 playlist_id TEXT NOT NULL REFERENCES mou_playlists(playlist_id),
 attachment_id TEXT NOT NULL REFERENCES attachments(attachment_id),
 PRIMARY KEY(playlist_id,attachment_id)
);
CREATE INDEX mou_playlist_attachment ON mou_playlist_items(attachment_id,playlist_id);
-- Native parent lookup prevents one reading from scanning other websites'
-- entitled playlist memberships in the same programme. Delivery still checks
-- the current attachment parent and membership, not this index alone.
CREATE TABLE mou_playlist_item_parents(
 website_id TEXT NOT NULL REFERENCES websites(website_id),
 playlist_id TEXT NOT NULL,
 attachment_id TEXT NOT NULL,
 PRIMARY KEY(website_id,playlist_id,attachment_id),
 FOREIGN KEY(playlist_id,attachment_id) REFERENCES mou_playlist_items(playlist_id,attachment_id) ON DELETE CASCADE
);
CREATE INDEX mou_playlist_parent_attachment ON mou_playlist_item_parents(attachment_id);
CREATE TRIGGER mou_playlist_parent_insert AFTER INSERT ON mou_playlist_items BEGIN
 INSERT INTO mou_playlist_item_parents SELECT website_id,NEW.playlist_id,NEW.attachment_id FROM attachments WHERE attachment_id=NEW.attachment_id AND website_id IS NOT NULL;
END;
CREATE TRIGGER mou_playlist_parent_edit AFTER UPDATE OF website_id ON attachments WHEN OLD.website_id IS NOT NEW.website_id BEGIN
 DELETE FROM mou_playlist_item_parents WHERE attachment_id=NEW.attachment_id;
 INSERT INTO mou_playlist_item_parents SELECT NEW.website_id,playlist_id,NEW.attachment_id FROM mou_playlist_items WHERE attachment_id=NEW.attachment_id AND NEW.website_id IS NOT NULL;
END;
-- New recordings require the explicit playlist gate. Old recordings referenced
-- by a playlist keep their original endpoint rights and original parent.
CREATE TABLE mou_playlist_only_media(attachment_id TEXT PRIMARY KEY REFERENCES attachments(attachment_id));
CREATE TABLE mou_playlist_only_websites(website_id TEXT PRIMARY KEY REFERENCES websites(website_id));
CREATE TABLE mou_playlist_retained(
 playlist_id TEXT NOT NULL,
 offering_id TEXT NOT NULL,
 account_id TEXT NOT NULL REFERENCES accounts(account_id),
 source_month TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN('PAID','WEBSITE')),
 PRIMARY KEY(playlist_id,account_id,source_month,kind),
 FOREIGN KEY(playlist_id,offering_id) REFERENCES mou_playlists(playlist_id,offering_id)
);
CREATE INDEX mou_retained_revocation ON mou_playlist_retained(offering_id,account_id,source_month,kind);
CREATE INDEX mou_paid_month_holders ON paid_months(offering_id,month,account_id,cohort);
CREATE INDEX mou_website_month_holders ON website_months(offering_id,month,account_id);
CREATE TRIGGER mou_retained_paid_removal AFTER DELETE ON paid_months
 WHEN EXISTS(SELECT 1 FROM programme_offerings WHERE programme_key='mothers' AND offering_id=OLD.offering_id)
 AND NOT EXISTS(SELECT 1 FROM paid_months WHERE offering_id=OLD.offering_id AND account_id=OLD.account_id AND month=OLD.month)
 BEGIN DELETE FROM mou_playlist_retained WHERE offering_id=OLD.offering_id AND account_id=OLD.account_id AND source_month=OLD.month AND kind='PAID'; END;
CREATE TRIGGER mou_retained_website_removal AFTER DELETE ON website_months
 WHEN EXISTS(SELECT 1 FROM programme_offerings WHERE programme_key='mothers' AND offering_id=OLD.offering_id)
 BEGIN DELETE FROM mou_playlist_retained WHERE offering_id=OLD.offering_id AND account_id=OLD.account_id AND source_month=OLD.month AND kind='WEBSITE'; END;
CREATE TRIGGER mou_playlist_create AFTER INSERT ON mou_playlists BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER mou_playlist_edit AFTER UPDATE ON mou_playlists BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER mou_playlist_item_create AFTER INSERT ON mou_playlist_items BEGIN UPDATE mou_playlists SET recording_count=recording_count+1,published_count=published_count+(SELECT published FROM attachments WHERE attachment_id=NEW.attachment_id),revision=revision+1 WHERE playlist_id=NEW.playlist_id; END;
CREATE TRIGGER mou_playlist_item_remove AFTER DELETE ON mou_playlist_items BEGIN UPDATE mou_playlists SET recording_count=recording_count-1,published_count=published_count-(SELECT published FROM attachments WHERE attachment_id=OLD.attachment_id),revision=revision+1 WHERE playlist_id=OLD.playlist_id; END;
CREATE TRIGGER mou_playlist_recording_publication AFTER UPDATE OF published ON attachments WHEN OLD.published<>NEW.published BEGIN UPDATE mou_playlists SET published_count=published_count+NEW.published-OLD.published,revision=revision+1 WHERE playlist_id IN(SELECT playlist_id FROM mou_playlist_items WHERE attachment_id=NEW.attachment_id); END;
