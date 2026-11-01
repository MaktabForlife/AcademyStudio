-- Generalise the existing independent playlist storage without adopting any
-- legacy website/recording, changing native IDs, or rewriting acquired rights.
DROP TRIGGER mou_retained_paid_removal;
DROP TRIGGER mou_retained_website_removal;
CREATE TRIGGER mou_retained_paid_removal AFTER DELETE ON paid_months
 WHEN NOT EXISTS(SELECT 1 FROM paid_months WHERE offering_id=OLD.offering_id AND account_id=OLD.account_id AND month=OLD.month)
 BEGIN DELETE FROM mou_playlist_retained WHERE offering_id=OLD.offering_id AND account_id=OLD.account_id AND source_month=OLD.month AND kind='PAID'; END;
CREATE TRIGGER mou_retained_website_removal AFTER DELETE ON website_months
 BEGIN DELETE FROM mou_playlist_retained WHERE offering_id=OLD.offering_id AND account_id=OLD.account_id AND source_month=OLD.month AND kind='WEBSITE'; END;

-- Separate positions retain compatibility with existing two-column membership
-- inserts. Initial order is the existing native attachment-ID order, never a
-- guessed session/date/title association. Replacing media keeps its position.
CREATE TABLE recording_playlist_positions(
 playlist_id TEXT NOT NULL,
 attachment_id TEXT NOT NULL,
 position INTEGER NOT NULL CHECK(position>0),
 PRIMARY KEY(playlist_id,attachment_id),
 FOREIGN KEY(playlist_id,attachment_id) REFERENCES mou_playlist_items(playlist_id,attachment_id) ON DELETE CASCADE
);
CREATE INDEX recording_playlist_order ON recording_playlist_positions(playlist_id,position,attachment_id);
INSERT INTO recording_playlist_positions SELECT playlist_id,attachment_id,row_number() OVER(PARTITION BY playlist_id ORDER BY attachment_id) FROM mou_playlist_items;
CREATE TRIGGER recording_playlist_position_create AFTER INSERT ON mou_playlist_items BEGIN
 INSERT INTO recording_playlist_positions SELECT NEW.playlist_id,NEW.attachment_id,COALESCE((SELECT position FROM recording_playlist_positions WHERE playlist_id=NEW.playlist_id ORDER BY position DESC,attachment_id DESC LIMIT 1),0)+1;
END;
CREATE TRIGGER recording_playlist_position_edit AFTER UPDATE OF position ON recording_playlist_positions WHEN OLD.position<>NEW.position BEGIN
 UPDATE mou_playlists SET revision=revision+1 WHERE playlist_id=NEW.playlist_id;
END;
