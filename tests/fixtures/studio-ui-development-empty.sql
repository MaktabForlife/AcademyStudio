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
CREATE TABLE source_access_scopes(offering_id TEXT PRIMARY KEY REFERENCES offerings(offering_id),authority TEXT NOT NULL DEFAULT 'ACADEMY' CHECK(authority IN('ACADEMY','WEBSITE')),generation INTEGER NOT NULL,version INTEGER NOT NULL,enabled INTEGER NOT NULL,live_enabled INTEGER NOT NULL,timezone TEXT NOT NULL,classes_json TEXT NOT NULL);
CREATE TABLE source_access_people(account_id TEXT NOT NULL REFERENCES accounts(account_id),offering_id TEXT NOT NULL REFERENCES offerings(offering_id),generation INTEGER NOT NULL,version INTEGER NOT NULL,verified_at INTEGER NOT NULL,ready INTEGER NOT NULL,windows_json TEXT NOT NULL,has_allocation INTEGER NOT NULL,course INTEGER NOT NULL,PRIMARY KEY(account_id,offering_id));
CREATE TABLE source_access_websites(website_id TEXT PRIMARY KEY REFERENCES websites(website_id),offering_id TEXT NOT NULL REFERENCES offerings(offering_id),enabled INTEGER NOT NULL);
CREATE INDEX source_access_websites_scope ON source_access_websites(offering_id,website_id);
CREATE TABLE website_months(account_id TEXT NOT NULL REFERENCES accounts(account_id),offering_id TEXT NOT NULL REFERENCES offerings(offering_id),month TEXT NOT NULL,PRIMARY KEY(account_id,offering_id,month));
CREATE TABLE source_session_audiences(session_id TEXT PRIMARY KEY REFERENCES timetable(session_id),class_ids_json TEXT NOT NULL,teacher_ids_json TEXT NOT NULL);
CREATE TABLE circles_navigation(account_id TEXT PRIMARY KEY REFERENCES accounts(account_id),epoch INTEGER NOT NULL,verified_at INTEGER NOT NULL,programmes_json TEXT NOT NULL);
CREATE TABLE access_revisions(offering_id TEXT PRIMARY KEY REFERENCES offerings(offering_id),revision INTEGER NOT NULL DEFAULT 0);
CREATE TABLE access_members(offering_id TEXT NOT NULL REFERENCES offerings(offering_id),account_id TEXT NOT NULL REFERENCES accounts(account_id),PRIMARY KEY(offering_id,account_id));
CREATE TABLE access_handovers(offering_id TEXT PRIMARY KEY REFERENCES offerings(offering_id),transfer_id TEXT NOT NULL UNIQUE,phase TEXT NOT NULL CHECK(phase IN('PREPARING','COMMITTED','ABORTED')),generation INTEGER NOT NULL,source_version INTEGER NOT NULL,revision INTEGER NOT NULL,cursor TEXT NOT NULL DEFAULT '',checked INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
CREATE TABLE access_handover_cancellations(transfer_id TEXT PRIMARY KEY,offering_id TEXT NOT NULL REFERENCES offerings(offering_id),cancelled_at INTEGER NOT NULL);
CREATE INDEX paid_months_offering ON paid_months(offering_id,account_id,month,cohort);
CREATE INDEX website_months_offering ON website_months(offering_id,account_id,month);
CREATE INDEX source_people_offering ON source_access_people(offering_id,account_id);
CREATE INDEX surah_grants_website ON surah_grants(website_id,account_id);
CREATE TRIGGER access_revision_participation_insert AFTER INSERT ON participation BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(NEW.offering_id,NEW.account_id) ON CONFLICT DO NOTHING; END;
CREATE TRIGGER access_revision_participation_update AFTER UPDATE ON participation BEGIN INSERT INTO access_revisions VALUES(OLD.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(OLD.offering_id,OLD.account_id) ON CONFLICT DO NOTHING;INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(NEW.offering_id,NEW.account_id) ON CONFLICT DO NOTHING; END;
CREATE TRIGGER access_revision_participation_delete AFTER DELETE ON participation BEGIN INSERT INTO access_revisions VALUES(OLD.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(OLD.offering_id,OLD.account_id) ON CONFLICT DO NOTHING; END;
CREATE TRIGGER access_revision_staff_insert AFTER INSERT ON staff BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(NEW.offering_id,NEW.account_id) ON CONFLICT DO NOTHING; END;
CREATE TRIGGER access_revision_staff_update AFTER UPDATE ON staff BEGIN INSERT INTO access_revisions VALUES(OLD.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(OLD.offering_id,OLD.account_id) ON CONFLICT DO NOTHING;INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(NEW.offering_id,NEW.account_id) ON CONFLICT DO NOTHING; END;
CREATE TRIGGER access_revision_staff_delete AFTER DELETE ON staff BEGIN INSERT INTO access_revisions VALUES(OLD.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(OLD.offering_id,OLD.account_id) ON CONFLICT DO NOTHING; END;
CREATE TRIGGER access_revision_paid_months_insert AFTER INSERT ON paid_months BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(NEW.offering_id,NEW.account_id) ON CONFLICT DO NOTHING; END;
CREATE TRIGGER access_revision_paid_months_update AFTER UPDATE ON paid_months BEGIN INSERT INTO access_revisions VALUES(OLD.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(OLD.offering_id,OLD.account_id) ON CONFLICT DO NOTHING;INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(NEW.offering_id,NEW.account_id) ON CONFLICT DO NOTHING; END;
CREATE TRIGGER access_revision_paid_months_delete AFTER DELETE ON paid_months BEGIN INSERT INTO access_revisions VALUES(OLD.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(OLD.offering_id,OLD.account_id) ON CONFLICT DO NOTHING; END;
CREATE TRIGGER access_revision_website_months_insert AFTER INSERT ON website_months BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(NEW.offering_id,NEW.account_id) ON CONFLICT DO NOTHING; END;
CREATE TRIGGER access_revision_website_months_update AFTER UPDATE ON website_months BEGIN INSERT INTO access_revisions VALUES(OLD.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(OLD.offering_id,OLD.account_id) ON CONFLICT DO NOTHING;INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(NEW.offering_id,NEW.account_id) ON CONFLICT DO NOTHING; END;
CREATE TRIGGER access_revision_website_months_delete AFTER DELETE ON website_months BEGIN INSERT INTO access_revisions VALUES(OLD.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(OLD.offering_id,OLD.account_id) ON CONFLICT DO NOTHING; END;
CREATE TRIGGER access_revision_source_access_people_insert AFTER INSERT ON source_access_people BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(NEW.offering_id,NEW.account_id) ON CONFLICT DO NOTHING; END;
CREATE TRIGGER access_revision_source_access_people_update AFTER UPDATE ON source_access_people WHEN OLD.generation<>NEW.generation OR OLD.ready<>NEW.ready OR OLD.windows_json<>NEW.windows_json OR OLD.has_allocation<>NEW.has_allocation OR OLD.course<>NEW.course BEGIN INSERT INTO access_revisions VALUES(OLD.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(OLD.offering_id,OLD.account_id) ON CONFLICT DO NOTHING;INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(NEW.offering_id,NEW.account_id) ON CONFLICT DO NOTHING; END;
CREATE TRIGGER access_revision_source_access_people_delete AFTER DELETE ON source_access_people BEGIN INSERT INTO access_revisions VALUES(OLD.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES(OLD.offering_id,OLD.account_id) ON CONFLICT DO NOTHING; END;
CREATE TRIGGER access_revision_source_access_scopes_insert AFTER INSERT ON source_access_scopes BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER access_revision_source_access_scopes_update AFTER UPDATE ON source_access_scopes BEGIN INSERT INTO access_revisions VALUES(OLD.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER access_revision_source_access_scopes_delete AFTER DELETE ON source_access_scopes BEGIN INSERT INTO access_revisions VALUES(OLD.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER access_revision_websites_insert AFTER INSERT ON websites BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER access_revision_websites_update AFTER UPDATE ON websites BEGIN INSERT INTO access_revisions VALUES(OLD.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER access_revision_websites_delete AFTER DELETE ON websites BEGIN INSERT INTO access_revisions VALUES(OLD.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER access_revision_surah_grants_insert AFTER INSERT ON surah_grants BEGIN INSERT INTO access_revisions VALUES((SELECT offering_id FROM websites WHERE website_id=NEW.website_id),1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES((SELECT offering_id FROM websites WHERE website_id=NEW.website_id),NEW.account_id) ON CONFLICT DO NOTHING; END;
CREATE TRIGGER access_revision_surah_grants_update AFTER UPDATE ON surah_grants BEGIN INSERT INTO access_revisions VALUES((SELECT offering_id FROM websites WHERE website_id=OLD.website_id),1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES((SELECT offering_id FROM websites WHERE website_id=OLD.website_id),OLD.account_id) ON CONFLICT DO NOTHING;INSERT INTO access_revisions VALUES((SELECT offering_id FROM websites WHERE website_id=NEW.website_id),1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES((SELECT offering_id FROM websites WHERE website_id=NEW.website_id),NEW.account_id) ON CONFLICT DO NOTHING; END;
CREATE TRIGGER access_revision_surah_grants_delete AFTER DELETE ON surah_grants BEGIN INSERT INTO access_revisions VALUES((SELECT offering_id FROM websites WHERE website_id=OLD.website_id),1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1;INSERT INTO access_members VALUES((SELECT offering_id FROM websites WHERE website_id=OLD.website_id),OLD.account_id) ON CONFLICT DO NOTHING; END;
CREATE TRIGGER access_authority_guard BEFORE UPDATE OF authority ON source_access_scopes WHEN NEW.authority='WEBSITE' AND OLD.authority<>'WEBSITE' AND NOT EXISTS(SELECT 1 FROM access_handovers h WHERE h.offering_id=NEW.offering_id AND h.phase='COMMITTED' AND h.generation=NEW.generation) BEGIN SELECT RAISE(ABORT,'GUARDED_HANDOVER_REQUIRED'); END;
CREATE INDEX provisioning_pending_actor ON provisioning(offering_id,actor_id,operation_id) WHERE state<>'COMPLETE';
CREATE TRIGGER access_revision_provision AFTER UPDATE ON provisioning BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER access_revision_provision_insert AFTER INSERT ON provisioning BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TABLE source_session_revocations(source_ref TEXT PRIMARY KEY,revoked_at INTEGER NOT NULL);
CREATE INDEX access_members_account ON access_members(account_id,offering_id);
CREATE TRIGGER access_revision_master AFTER UPDATE ON accounts WHEN OLD.display_name<>NEW.display_name OR OLD.active<>NEW.active OR OLD.admitted<>NEW.admitted OR OLD.epoch<>NEW.epoch OR OLD.global_admin<>NEW.global_admin BEGIN UPDATE access_revisions SET revision=revision+1 WHERE offering_id IN(SELECT offering_id FROM access_members WHERE account_id=NEW.account_id); END;
CREATE TABLE source_access_master_fences(account_id TEXT NOT NULL,offering_id TEXT NOT NULL,epoch INTEGER NOT NULL,active INTEGER NOT NULL,admitted INTEGER NOT NULL,global_admin INTEGER NOT NULL,PRIMARY KEY(account_id,offering_id));
CREATE TABLE source_access_rights_snapshots(account_id TEXT NOT NULL,offering_id TEXT NOT NULL,payload_hash TEXT NOT NULL,PRIMARY KEY(account_id,offering_id));
CREATE TRIGGER access_authority_reverse_guard BEFORE UPDATE OF authority ON source_access_scopes WHEN OLD.authority='WEBSITE' AND NEW.authority='ACADEMY' BEGIN SELECT RAISE(ABORT,'REVERSE_MIGRATION_REQUIRED'); END;
CREATE TABLE course_publications(offering_id TEXT PRIMARY KEY REFERENCES offerings(offering_id),registration_id TEXT NOT NULL UNIQUE,activity_key TEXT NOT NULL UNIQUE,run_id TEXT NOT NULL,publication_id TEXT NOT NULL,access_model TEXT NOT NULL CHECK(access_model IN('FREE','PAID')),created_at INTEGER NOT NULL);
CREATE TABLE course_access_models(offering_id TEXT PRIMARY KEY REFERENCES offerings(offering_id),access_model TEXT NOT NULL CHECK(access_model IN('FREE','PAID')));
CREATE TABLE programme_offerings(programme_key TEXT PRIMARY KEY CHECK(programme_key='mothers'),offering_id TEXT NOT NULL UNIQUE REFERENCES offerings(offering_id),access_model TEXT NOT NULL CHECK(access_model='MONTHLY'));
CREATE TABLE source_session_details(session_id TEXT PRIMARY KEY REFERENCES timetable(session_id),timezone TEXT NOT NULL,classes_json TEXT NOT NULL CHECK(json_valid(classes_json)));
CREATE TABLE website_recording_support(website_id TEXT NOT NULL REFERENCES websites(website_id),edition TEXT NOT NULL,object_key TEXT NOT NULL,PRIMARY KEY(website_id,edition));
CREATE INDEX attachments_website_lesson ON attachments(website_id,lesson_id,audience,asset_id);
CREATE TABLE completed_course_registrations(
 offering_id TEXT PRIMARY KEY REFERENCES offerings(offering_id),
 registration_id TEXT NOT NULL UNIQUE,
 website_id TEXT NOT NULL UNIQUE,
 package_sha256 TEXT NOT NULL CHECK(length(package_sha256)=64)
);
CREATE TABLE course_policy_revisions(offering_id TEXT PRIMARY KEY REFERENCES offerings(offering_id),revision INTEGER NOT NULL);
CREATE TABLE course_policy_state(singleton INTEGER PRIMARY KEY CHECK(singleton=1),revision INTEGER NOT NULL);
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
CREATE TABLE recording_companions(
 attachment_id TEXT PRIMARY KEY REFERENCES attachments(attachment_id),
 source_revision TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0,
 draft_key TEXT NOT NULL,
 published_key TEXT,
 index_json TEXT,
 duration_seconds INTEGER NOT NULL CHECK(duration_seconds>=0 AND duration_seconds<=86400)
);
CREATE INDEX objects_youtube ON objects(youtube_id) WHERE youtube_id IS NOT NULL;
CREATE TABLE programme_subjects(offering_id TEXT NOT NULL REFERENCES offerings(offering_id),display_key TEXT NOT NULL CHECK(display_key IN('surah-al-baqarah','riyadus-saaliheen','arbaeen-imam-nawawi','murshidul-qaari','madaarijus-saalikeen','al-adab-al-mufrad','ihya-ulumid-deen','taarikh-history-of-islam','kitabul-adhkar','shamail-of-nabi')),website_id TEXT NOT NULL UNIQUE REFERENCES websites(website_id),enabled INTEGER NOT NULL CHECK(enabled IN(0,1)),PRIMARY KEY(offering_id,display_key));
CREATE TRIGGER programme_subject_insert AFTER INSERT ON programme_subjects BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER programme_subject_update AFTER UPDATE ON programme_subjects BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER programme_subject_delete AFTER DELETE ON programme_subjects BEGIN INSERT INTO access_revisions VALUES(OLD.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TABLE media_attributions(
 attachment_id TEXT PRIMARY KEY REFERENCES attachments(attachment_id),
 revision INTEGER NOT NULL CHECK(revision>0),
 draft_json TEXT NOT NULL,
 published_json TEXT
);
CREATE TABLE media_supporting_files(
 recording_attachment_id TEXT NOT NULL REFERENCES attachments(attachment_id),
 support_attachment_id TEXT NOT NULL UNIQUE REFERENCES attachments(attachment_id),
 PRIMARY KEY(recording_attachment_id,support_attachment_id)
);
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
CREATE TRIGGER mou_playlist_create AFTER INSERT ON mou_playlists BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER mou_playlist_edit AFTER UPDATE ON mou_playlists BEGIN INSERT INTO access_revisions VALUES(NEW.offering_id,1) ON CONFLICT(offering_id) DO UPDATE SET revision=revision+1; END;
CREATE TRIGGER mou_playlist_item_create AFTER INSERT ON mou_playlist_items BEGIN UPDATE mou_playlists SET recording_count=recording_count+1,published_count=published_count+(SELECT published FROM attachments WHERE attachment_id=NEW.attachment_id),revision=revision+1 WHERE playlist_id=NEW.playlist_id; END;
CREATE TRIGGER mou_playlist_item_remove AFTER DELETE ON mou_playlist_items BEGIN UPDATE mou_playlists SET recording_count=recording_count-1,published_count=published_count-(SELECT published FROM attachments WHERE attachment_id=OLD.attachment_id),revision=revision+1 WHERE playlist_id=OLD.playlist_id; END;
CREATE TRIGGER mou_playlist_recording_publication AFTER UPDATE OF published ON attachments WHEN OLD.published<>NEW.published BEGIN UPDATE mou_playlists SET published_count=published_count+NEW.published-OLD.published,revision=revision+1 WHERE playlist_id IN(SELECT playlist_id FROM mou_playlist_items WHERE attachment_id=NEW.attachment_id); END;
CREATE TRIGGER mou_retained_paid_removal AFTER DELETE ON paid_months
 WHEN NOT EXISTS(SELECT 1 FROM paid_months WHERE offering_id=OLD.offering_id AND account_id=OLD.account_id AND month=OLD.month)
 BEGIN DELETE FROM mou_playlist_retained WHERE offering_id=OLD.offering_id AND account_id=OLD.account_id AND source_month=OLD.month AND kind='PAID'; END;
CREATE TRIGGER mou_retained_website_removal AFTER DELETE ON website_months
 BEGIN DELETE FROM mou_playlist_retained WHERE offering_id=OLD.offering_id AND account_id=OLD.account_id AND source_month=OLD.month AND kind='WEBSITE'; END;
CREATE TABLE recording_playlist_positions(
 playlist_id TEXT NOT NULL,
 attachment_id TEXT NOT NULL,
 position INTEGER NOT NULL CHECK(position>0),
 PRIMARY KEY(playlist_id,attachment_id),
 FOREIGN KEY(playlist_id,attachment_id) REFERENCES mou_playlist_items(playlist_id,attachment_id) ON DELETE CASCADE
);
CREATE INDEX recording_playlist_order ON recording_playlist_positions(playlist_id,position,attachment_id);
CREATE TRIGGER recording_playlist_position_create AFTER INSERT ON mou_playlist_items BEGIN
 INSERT INTO recording_playlist_positions SELECT NEW.playlist_id,NEW.attachment_id,COALESCE((SELECT position FROM recording_playlist_positions WHERE playlist_id=NEW.playlist_id ORDER BY position DESC,attachment_id DESC LIMIT 1),0)+1;
END;
CREATE TRIGGER recording_playlist_position_edit AFTER UPDATE OF position ON recording_playlist_positions WHEN OLD.position<>NEW.position BEGIN
 UPDATE mou_playlists SET revision=revision+1 WHERE playlist_id=NEW.playlist_id;
END;
CREATE INDEX course_access_by_model ON course_access_models(access_model,offering_id);
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
CREATE TRIGGER playlist_card_on_create AFTER INSERT ON mou_playlists BEGIN
 INSERT INTO playlist_card_designs
 SELECT NEW.playlist_id,'{"version":1,"style":"default","colour":"#759786","gradient":null,"image":null,"teacher":null}',
 CASE WHEN w.published_key IS NOT NULL THEN '{"version":1,"style":"default","colour":"#759786","gradient":null,"image":null,"teacher":null}' END,
 '[]',CASE WHEN w.published_key IS NOT NULL THEN w.title END,
 CASE WHEN o.kind='COURSE' AND w.published_key IS NULL THEN 1 ELSE 0 END,
 CASE WHEN w.published_key IS NOT NULL THEN NEW.created_at END
 FROM websites w JOIN offerings o USING(offering_id) WHERE w.website_id=NEW.website_id;
END;
CREATE TRIGGER playlist_card_publish BEFORE UPDATE OF enabled,published_key ON websites
 WHEN NEW.enabled=1 AND NEW.published_key IS NOT NULL BEGIN
 SELECT RAISE(ABORT,'COURSE_CARD_IMAGE_REQUIRED') WHERE EXISTS(
  SELECT 1 FROM mou_playlists p JOIN playlist_card_designs c USING(playlist_id)
  WHERE p.website_id=NEW.website_id AND c.image_required=1
  AND NOT EXISTS(SELECT 1 FROM playlist_cover_assets a WHERE json_extract(c.published_json,'$.style')='image' AND a.asset_id=json_extract(c.published_json,'$.image.assetId')
   AND a.playlist_id=p.playlist_id AND a.offering_id=p.offering_id AND a.sha256=json_extract(c.published_json,'$.image.sha256')
   AND a.mime_type=json_extract(c.published_json,'$.image.type') AND a.size=json_extract(c.published_json,'$.image.size'))
 );
END;
CREATE TRIGGER playlist_card_published AFTER UPDATE OF enabled,published_key ON websites
 WHEN NEW.enabled=1 AND NEW.published_key IS NOT NULL BEGIN
 UPDATE playlist_card_designs SET first_published_at=COALESCE(first_published_at,unixepoch()*1000)
 WHERE playlist_id=(SELECT playlist_id FROM mou_playlists WHERE website_id=NEW.website_id);
END;
CREATE TABLE course_playlist_workflows (
 playlist_id TEXT PRIMARY KEY REFERENCES mou_playlists(playlist_id),
 description_draft TEXT NOT NULL DEFAULT '',
 description_published TEXT,
 content_revision INTEGER NOT NULL DEFAULT 0,
 content_published_revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE course_playlist_placements (
 playlist_id TEXT NOT NULL REFERENCES course_playlist_workflows(playlist_id),
 stage TEXT NOT NULL CHECK(stage IN('DRAFT','PUBLISHED')),
 activity_key TEXT NOT NULL,
 offering_id TEXT NOT NULL,
 class_id TEXT NOT NULL DEFAULT '',
 title TEXT NOT NULL,
 class_name TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(playlist_id,stage,activity_key,class_id)
);
CREATE INDEX course_playlist_destination ON course_playlist_placements(offering_id,stage,class_id,playlist_id);
CREATE TABLE course_playlist_content (
 playlist_id TEXT NOT NULL REFERENCES course_playlist_workflows(playlist_id),
 stage TEXT NOT NULL CHECK(stage IN('DRAFT','PUBLISHED')),
 kind TEXT NOT NULL CHECK(kind IN('RECORDING','PDF','READING')),
 reference_id TEXT NOT NULL,
 position INTEGER NOT NULL CHECK(position>0),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 PRIMARY KEY(playlist_id,stage,kind,reference_id),
 UNIQUE(playlist_id,stage,position)
);
CREATE TABLE course_playlist_release_guards(playlist_id TEXT PRIMARY KEY REFERENCES course_playlist_workflows(playlist_id));
CREATE TRIGGER course_playlist_items_insert BEFORE INSERT ON mou_playlist_items
 WHEN EXISTS(SELECT 1 FROM course_playlist_workflows WHERE playlist_id=NEW.playlist_id)
 AND NOT EXISTS(SELECT 1 FROM course_playlist_release_guards WHERE playlist_id=NEW.playlist_id)
 BEGIN SELECT RAISE(ABORT,'COURSE_CONTENT_PUBLICATION_REQUIRED'); END;
CREATE TRIGGER course_playlist_items_delete BEFORE DELETE ON mou_playlist_items
 WHEN EXISTS(SELECT 1 FROM course_playlist_workflows WHERE playlist_id=OLD.playlist_id)
 AND NOT EXISTS(SELECT 1 FROM course_playlist_release_guards WHERE playlist_id=OLD.playlist_id)
 BEGIN SELECT RAISE(ABORT,'COURSE_CONTENT_PUBLICATION_REQUIRED'); END;
CREATE TRIGGER course_playlist_website_publish BEFORE UPDATE OF enabled,published_key ON websites
 WHEN EXISTS(SELECT 1 FROM course_playlist_workflows c JOIN mou_playlists p USING(playlist_id) WHERE p.website_id=NEW.website_id)
 AND NOT EXISTS(SELECT 1 FROM course_playlist_release_guards g JOIN mou_playlists p USING(playlist_id) WHERE p.website_id=NEW.website_id)
 BEGIN SELECT RAISE(ABORT,'COURSE_CARD_PUBLICATION_REQUIRED'); END;
CREATE TABLE display_meta(singleton INTEGER PRIMARY KEY CHECK(singleton=1),revision INTEGER NOT NULL);
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
CREATE TABLE playlist_source_websites (
 playlist_id TEXT NOT NULL REFERENCES mou_playlists(playlist_id),
 website_id TEXT NOT NULL REFERENCES websites(website_id),
 PRIMARY KEY(playlist_id,website_id)
);
CREATE INDEX playlist_source_website ON playlist_source_websites(website_id,playlist_id);
CREATE TABLE video_processing_sources(
 source_id TEXT PRIMARY KEY,offering_id TEXT NOT NULL,
 attachment_id TEXT NOT NULL,asset_id TEXT NOT NULL,
 source_revision TEXT NOT NULL,transcript_key TEXT NOT NULL UNIQUE,transcript_hash TEXT NOT NULL,
 transcript_format TEXT NOT NULL CHECK(transcript_format IN('VTT','SRT')),duration_seconds INTEGER NOT NULL CHECK(duration_seconds BETWEEN 1 AND 86400),
 retention_policy TEXT NOT NULL CHECK(retention_policy='PERMANENT_STUDIO_RETAINED'),original_ingested_at INTEGER,
 private_expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,CHECK(original_ingested_at IS NULL)
);
CREATE INDEX video_processing_sources_expiry ON video_processing_sources(private_expires_at,source_id);
CREATE TRIGGER video_processing_source_immutable BEFORE UPDATE ON video_processing_sources
 BEGIN SELECT RAISE(ABORT,'PROCESSING_SOURCE_IMMUTABLE'); END;
CREATE TABLE video_processing_jobs(
 job_id TEXT PRIMARY KEY,source_id TEXT NOT NULL REFERENCES video_processing_sources(source_id),
 attachment_id TEXT NOT NULL,source_revision TEXT NOT NULL,
 offering_id TEXT NOT NULL,actor_id TEXT NOT NULL,
 actor_token_hash TEXT NOT NULL,actor_epoch INTEGER NOT NULL,actor_source_ref TEXT,
 authorised_at INTEGER NOT NULL,authorisation_expires_at INTEGER NOT NULL,private_expires_at INTEGER NOT NULL,
 quote_hash TEXT NOT NULL,native_fingerprint TEXT NOT NULL,material_fingerprint TEXT NOT NULL,base_companion_revision INTEGER NOT NULL,
 attribution_revision INTEGER NOT NULL,style TEXT NOT NULL CHECK(style IN('ACADEMIC','MOU')),
 model TEXT NOT NULL,profile TEXT NOT NULL,max_output_tokens INTEGER NOT NULL,max_request_bytes INTEGER NOT NULL,timeout_ms INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN('QUEUED','RUNNING','REVIEW_REQUIRED','CANDIDATE','ACCEPTED','CANCELLED')),
 attempt_id TEXT,request_hash TEXT,outcome_code TEXT,provider_receipt_json TEXT
);
CREATE UNIQUE INDEX video_processing_active_attachment ON video_processing_jobs(offering_id,attachment_id,source_revision) WHERE state IN('QUEUED','RUNNING');
CREATE INDEX video_processing_jobs_offering ON video_processing_jobs(offering_id,job_id);
CREATE INDEX video_processing_jobs_source ON video_processing_jobs(source_id);
CREATE INDEX video_processing_jobs_expiry ON video_processing_jobs(private_expires_at,job_id);
CREATE TRIGGER video_processing_job_grant_immutable BEFORE UPDATE OF source_id,attachment_id,source_revision,offering_id,actor_id,actor_token_hash,actor_epoch,actor_source_ref,authorised_at,authorisation_expires_at,private_expires_at,quote_hash,native_fingerprint,material_fingerprint,base_companion_revision,attribution_revision,style,model,profile,max_output_tokens,max_request_bytes,timeout_ms ON video_processing_jobs
 BEGIN SELECT RAISE(ABORT,'PROCESSING_AUTHORISATION_IMMUTABLE'); END;
CREATE TABLE video_processing_candidates(
 job_id TEXT PRIMARY KEY REFERENCES video_processing_jobs(job_id),attempt_id TEXT NOT NULL,
 object_key TEXT NOT NULL UNIQUE,object_hash TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,
 prepared_native_key TEXT,prepared_native_hash TEXT,prepared_operation_id TEXT,cleanup_state TEXT CHECK(cleanup_state IN('PREPARED','DELETING'))
);
CREATE TABLE video_processing_committed_objects(
 object_key TEXT PRIMARY KEY,object_hash TEXT NOT NULL,attachment_id TEXT NOT NULL,created_at INTEGER NOT NULL
);
CREATE INDEX video_processing_committed_attachment ON video_processing_committed_objects(attachment_id,object_key);
CREATE INDEX video_processing_jobs_attachment ON video_processing_jobs(offering_id,attachment_id,job_id);
