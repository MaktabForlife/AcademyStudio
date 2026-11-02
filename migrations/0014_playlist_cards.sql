-- Decorative artwork is separate from protected recording/PDF assets.
CREATE TABLE playlist_cover_assets (
 asset_id TEXT PRIMARY KEY,
 offering_id TEXT NOT NULL REFERENCES offerings(offering_id),
 playlist_id TEXT NOT NULL,
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 mime_type TEXT NOT NULL CHECK(mime_type IN('image/png','image/jpeg','image/webp')),
 size INTEGER NOT NULL CHECK(size>0 AND size<=524288),
 content_key TEXT NOT NULL UNIQUE,
 UNIQUE(offering_id,playlist_id,sha256)
);
CREATE TABLE playlist_card_designs (
 playlist_id TEXT PRIMARY KEY REFERENCES mou_playlists(playlist_id) ON DELETE CASCADE,
 draft_json TEXT NOT NULL CHECK(json_valid(draft_json)),
 published_json TEXT CHECK(published_json IS NULL OR json_valid(published_json)),
 teacher_ids_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(teacher_ids_json)),
 published_title TEXT,
 image_required INTEGER NOT NULL CHECK(image_required IN(0,1)),
 first_published_at INTEGER
);
-- Keep previously published artwork/title and rights available, including
-- withdrawn playlists. Private never-published Courses use the new gate.
INSERT INTO playlist_card_designs
 SELECT p.playlist_id,'{"version":1,"style":"default","colour":"#759786","gradient":null,"image":null,"teacher":null}',
 CASE WHEN w.published_key IS NOT NULL THEN '{"version":1,"style":"default","colour":"#759786","gradient":null,"image":null,"teacher":null}' END,
 '[]',CASE WHEN w.published_key IS NOT NULL THEN w.title END,
 CASE WHEN o.kind='COURSE' THEN 1 ELSE 0 END,
 CASE WHEN w.published_key IS NOT NULL THEN p.created_at END
 FROM mou_playlists p JOIN websites w USING(website_id) JOIN offerings o ON o.offering_id=p.offering_id;
CREATE TRIGGER playlist_card_on_create AFTER INSERT ON mou_playlists BEGIN
 INSERT INTO playlist_card_designs
 SELECT NEW.playlist_id,'{"version":1,"style":"default","colour":"#759786","gradient":null,"image":null,"teacher":null}',
 CASE WHEN w.published_key IS NOT NULL THEN '{"version":1,"style":"default","colour":"#759786","gradient":null,"image":null,"teacher":null}' END,
 '[]',CASE WHEN w.published_key IS NOT NULL THEN w.title END,
 CASE WHEN o.kind='COURSE' THEN 1 ELSE 0 END,
 CASE WHEN w.published_key IS NOT NULL THEN NEW.created_at END
 FROM websites w JOIN offerings o USING(offering_id) WHERE w.website_id=NEW.website_id;
END;
-- Fence every website publication entrypoint, including the canonical editor.
-- A card snapshot must be set in the same guarded transaction before enabling.
CREATE TRIGGER playlist_card_first_publish BEFORE UPDATE OF enabled,published_key ON websites
 WHEN NEW.enabled=1 AND NEW.published_key IS NOT NULL BEGIN
 SELECT RAISE(ABORT,'COURSE_CARD_IMAGE_REQUIRED') WHERE EXISTS(
  SELECT 1 FROM mou_playlists p JOIN playlist_card_designs c USING(playlist_id)
  WHERE p.website_id=NEW.website_id AND c.image_required=1 AND c.first_published_at IS NULL
  AND NOT EXISTS(SELECT 1 FROM playlist_cover_assets a WHERE a.asset_id=json_extract(c.published_json,'$.image.assetId')
   AND a.playlist_id=p.playlist_id AND a.offering_id=p.offering_id AND a.sha256=json_extract(c.published_json,'$.image.sha256'))
 );
END;
CREATE TRIGGER playlist_card_published AFTER UPDATE OF enabled,published_key ON websites
 WHEN NEW.enabled=1 AND NEW.published_key IS NOT NULL BEGIN
 UPDATE playlist_card_designs SET first_published_at=COALESCE(first_published_at,unixepoch()*1000)
 WHERE playlist_id=(SELECT playlist_id FROM mou_playlists WHERE website_id=NEW.website_id);
END;
