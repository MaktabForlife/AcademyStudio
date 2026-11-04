-- Admin navigation/provenance only. This relation grants no learner access,
-- publishes no source website and never enters published website JSON.
CREATE TABLE playlist_source_websites (
 playlist_id TEXT NOT NULL REFERENCES mou_playlists(playlist_id),
 website_id TEXT NOT NULL REFERENCES websites(website_id),
 PRIMARY KEY(playlist_id,website_id)
);
CREATE INDEX playlist_source_website ON playlist_source_websites(website_id,playlist_id);
