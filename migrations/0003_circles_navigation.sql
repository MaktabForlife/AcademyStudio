-- Signed presentation snapshot only, never consulted by content/media gates.
CREATE TABLE circles_navigation(account_id TEXT PRIMARY KEY REFERENCES accounts(account_id),epoch INTEGER NOT NULL,verified_at INTEGER NOT NULL,programmes_json TEXT NOT NULL);
