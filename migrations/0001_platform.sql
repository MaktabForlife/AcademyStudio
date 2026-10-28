PRAGMA foreign_keys=ON;
CREATE TABLE accounts (
 account_id TEXT PRIMARY KEY, display_name TEXT NOT NULL,
 active INTEGER NOT NULL CHECK(active IN(0,1)), admitted INTEGER NOT NULL CHECK(admitted IN(0,1)),
 epoch INTEGER NOT NULL CHECK(epoch>=0), verified_at INTEGER NOT NULL, global_admin INTEGER NOT NULL DEFAULT 0 CHECK(global_admin IN(0,1))
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), epoch INTEGER NOT NULL,
 expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN(0,1)), source_ref TEXT
);
CREATE INDEX sessions_account ON sessions(account_id);
CREATE TABLE refresh_claims(account_id TEXT PRIMARY KEY,claim_id TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE handoffs (
 code_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(account_id), epoch INTEGER NOT NULL,
 challenge TEXT NOT NULL, state TEXT NOT NULL, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0 CHECK(used IN(0,1)),source_ref TEXT
);
CREATE INDEX handoffs_expiry ON handoffs(expires_at);
CREATE TABLE offerings (
 offering_id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN('COURSE','TAFSEER','ACADEMY')),
 title TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)), revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE participation (
 account_id TEXT NOT NULL REFERENCES accounts(account_id), offering_id TEXT NOT NULL REFERENCES offerings(offering_id),
 enrolled INTEGER NOT NULL DEFAULT 0 CHECK(enrolled IN(0,1)), live INTEGER NOT NULL DEFAULT 0 CHECK(live IN(0,1)),
 purchased INTEGER NOT NULL DEFAULT 0 CHECK(purchased IN(0,1)), cohort TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(account_id,offering_id)
);
CREATE INDEX participation_offering ON participation(offering_id,account_id);
CREATE TABLE staff (
 account_id TEXT NOT NULL REFERENCES accounts(account_id), offering_id TEXT NOT NULL REFERENCES offerings(offering_id),
 role TEXT NOT NULL CHECK(role IN('ADMIN','TEACHER')), can_create_account INTEGER NOT NULL DEFAULT 0 CHECK(can_create_account IN(0,1)),
 PRIMARY KEY(account_id,offering_id)
);
CREATE INDEX staff_offering ON staff(offering_id,account_id);
CREATE TABLE paid_months (
 account_id TEXT NOT NULL REFERENCES accounts(account_id), offering_id TEXT NOT NULL REFERENCES offerings(offering_id),
 month TEXT NOT NULL, cohort TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(account_id,offering_id,month,cohort)
);
CREATE TABLE websites (
 website_id TEXT PRIMARY KEY, offering_id TEXT NOT NULL REFERENCES offerings(offering_id), title TEXT NOT NULL,
 completion_month TEXT, draft_key TEXT, published_key TEXT, revision INTEGER NOT NULL DEFAULT 0,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),completion_date TEXT
);
CREATE INDEX websites_offering ON websites(offering_id,website_id);
CREATE TABLE website_history (website_id TEXT NOT NULL REFERENCES websites(website_id),revision INTEGER NOT NULL,action TEXT NOT NULL,object_key TEXT,created_at INTEGER NOT NULL,actor_id TEXT NOT NULL,PRIMARY KEY(website_id,revision));
CREATE TABLE published_assets (website_id TEXT NOT NULL REFERENCES websites(website_id),asset_id TEXT NOT NULL,PRIMARY KEY(website_id,asset_id));
CREATE TABLE surah_grants (
 account_id TEXT NOT NULL REFERENCES accounts(account_id), website_id TEXT NOT NULL REFERENCES websites(website_id), reason TEXT NOT NULL,
 PRIMARY KEY(account_id,website_id)
);
CREATE TABLE objects (
 asset_id TEXT PRIMARY KEY, object_key TEXT, mime_type TEXT NOT NULL, filename TEXT NOT NULL,
 byte_size INTEGER NOT NULL, sha256 TEXT, youtube_id TEXT,
 CHECK((object_key IS NOT NULL AND sha256 IS NOT NULL) OR youtube_id IS NOT NULL)
);
CREATE TABLE attachments (
 attachment_id TEXT PRIMARY KEY, offering_id TEXT NOT NULL REFERENCES offerings(offering_id),
 website_id TEXT REFERENCES websites(website_id), asset_id TEXT NOT NULL REFERENCES objects(asset_id),
 lesson_id TEXT NOT NULL, lesson_date TEXT NOT NULL, cohort TEXT NOT NULL DEFAULT '', title TEXT NOT NULL,
 audience TEXT NOT NULL CHECK(audience IN('WEBSITE','RECORDING')), published INTEGER NOT NULL DEFAULT 0 CHECK(published IN(0,1))
);
CREATE INDEX attachments_website ON attachments(website_id,attachment_id);
CREATE INDEX attachments_edition ON attachments(website_id,asset_id,audience,published DESC,attachment_id);
CREATE INDEX attachments_website_picker ON attachments(website_id,audience,attachment_id);
CREATE INDEX attachments_offering_picker ON attachments(offering_id,audience,attachment_id);
CREATE INDEX attachments_offering_file ON attachments(offering_id,audience,asset_id,published DESC,attachment_id);
CREATE INDEX attachments_offering ON attachments(offering_id,attachment_id);
CREATE INDEX attachments_asset ON attachments(asset_id,website_id);
CREATE INDEX attachments_feed ON attachments(offering_id,audience,published,attachment_id);
CREATE INDEX attachments_website_feed ON attachments(website_id,audience,published,attachment_id);
CREATE INDEX attachments_month ON attachments(offering_id,substr(lesson_date,1,7),cohort,audience,published,attachment_id);
CREATE TABLE asset_owners (asset_id TEXT NOT NULL REFERENCES objects(asset_id),offering_id TEXT NOT NULL REFERENCES offerings(offering_id),PRIMARY KEY(asset_id,offering_id));
CREATE TABLE uploads (asset_id TEXT PRIMARY KEY,offering_id TEXT NOT NULL REFERENCES offerings(offering_id),object_key TEXT NOT NULL,upload_id TEXT NOT NULL,filename TEXT NOT NULL,created_at INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN('OPEN','COMPLETE')));
CREATE TABLE timetable (
 session_id TEXT PRIMARY KEY, offering_id TEXT NOT NULL REFERENCES offerings(offering_id), title TEXT NOT NULL,
 starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL CHECK(ends_at>starts_at),
 zoom_url TEXT, cancelled INTEGER NOT NULL DEFAULT 0 CHECK(cancelled IN(0,1)), revision INTEGER NOT NULL
);
CREATE INDEX timetable_offering ON timetable(offering_id,starts_at,session_id);
CREATE INDEX timetable_public_offering ON timetable(offering_id,cancelled,starts_at,session_id);
CREATE INDEX timetable_upcoming ON timetable(starts_at);
CREATE TABLE cards (
 offering_id TEXT PRIMARY KEY REFERENCES offerings(offering_id), title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 display_label TEXT NOT NULL DEFAULT '', visible INTEGER NOT NULL DEFAULT 0 CHECK(visible IN(0,1)), revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE announcements (announcement_id TEXT PRIMARY KEY, text TEXT NOT NULL, visible INTEGER NOT NULL CHECK(visible IN(0,1)));
CREATE INDEX cards_public ON cards(visible,offering_id);
CREATE INDEX announcements_public ON announcements(visible,announcement_id);
CREATE TABLE operations (
 operation_id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, payload_hash TEXT NOT NULL, result_json TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE stream_heads (stream TEXT PRIMARY KEY, version INTEGER NOT NULL, payload_hash TEXT NOT NULL);
CREATE TABLE guards (guard_id TEXT PRIMARY KEY, accepted INTEGER NOT NULL CHECK(accepted=1));
CREATE TABLE enrolment_requests (
 request_id TEXT PRIMARY KEY, offering_id TEXT NOT NULL REFERENCES offerings(offering_id), requester_id TEXT NOT NULL REFERENCES accounts(account_id),
 note TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN('PENDING','APPROVED','REJECTED')), linked_account_id TEXT REFERENCES accounts(account_id), created_at INTEGER NOT NULL
);
CREATE INDEX enrolment_offering ON enrolment_requests(offering_id,request_id);
CREATE TABLE provisioning (
 operation_id TEXT PRIMARY KEY, offering_id TEXT NOT NULL REFERENCES offerings(offering_id), actor_id TEXT NOT NULL REFERENCES accounts(account_id),
 payload_hash TEXT NOT NULL, command_json TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN('PENDING_IDENTITY','IDENTITY_LINKED','COMPLETE')),
 account_id TEXT REFERENCES accounts(account_id), attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL, last_error TEXT,login_path TEXT
);
CREATE INDEX provisioning_pending ON provisioning(state,next_attempt,operation_id);
CREATE TABLE audit (event_id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, scope TEXT NOT NULL, occurred_at INTEGER NOT NULL,details_json TEXT NOT NULL);
CREATE TABLE publication_heads (scope TEXT PRIMARY KEY, revision INTEGER NOT NULL, object_key TEXT NOT NULL);
