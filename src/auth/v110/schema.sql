-- Synthetic prototype schema only. Not a numbered migration and never applied remotely.
PRAGMA foreign_keys = ON;
CREATE TABLE jwt_v110_accounts (
 account_id TEXT PRIMARY KEY, credential_epoch INTEGER NOT NULL,
 permission_version INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE jwt_v110_browser_heads (
 browser_id TEXT PRIMARY KEY, generation INTEGER NOT NULL
);
CREATE TABLE jwt_v110_parent_tombstones (
 parent_session_id TEXT PRIMARY KEY, expires_at_s INTEGER NOT NULL
);
CREATE TABLE jwt_v110_families (
 family_id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES jwt_v110_accounts(account_id),
 parent_session_id TEXT NOT NULL, browser_id TEXT NOT NULL REFERENCES jwt_v110_browser_heads(browser_id),
 browser_generation INTEGER NOT NULL, credential_epoch INTEGER NOT NULL, permission_version INTEGER NOT NULL,
 unlock_generation INTEGER NOT NULL DEFAULT 0, refresh_generation INTEGER NOT NULL DEFAULT 0,
 refresh_fp TEXT NOT NULL UNIQUE, previous_fp TEXT,
 original_signed_in_at_s INTEGER NOT NULL, original_expires_at_s INTEGER NOT NULL,
 last_fg_refresh_s INTEGER NOT NULL,
 rotated_at_s INTEGER NOT NULL, rotation_operation_id TEXT NOT NULL DEFAULT '',
 revoked INTEGER NOT NULL DEFAULT 0,
 CHECK(typeof(original_signed_in_at_s)='integer' AND typeof(original_expires_at_s)='integer' AND original_signed_in_at_s>=0 AND original_expires_at_s>original_signed_in_at_s AND original_expires_at_s-original_signed_in_at_s<=604800)
);
CREATE INDEX jwt_v110_previous_fp ON jwt_v110_families(previous_fp);
CREATE TABLE jwt_v110_security_audit (
 operation_id TEXT PRIMARY KEY, family_id TEXT NOT NULL,
 event_type TEXT NOT NULL, occurred_at_s INTEGER NOT NULL
);

-- A renewal/PIN/migration may never rebind an old refresh family to new identity
-- or authority floors. Revoke it and create a new family with a new secret.
CREATE TRIGGER jwt_v110_family_binding_immutable BEFORE UPDATE OF account_id,parent_session_id,browser_id,browser_generation,credential_epoch,original_signed_in_at_s,original_expires_at_s ON jwt_v110_families
WHEN NEW.account_id IS NOT OLD.account_id OR NEW.parent_session_id IS NOT OLD.parent_session_id OR NEW.browser_id IS NOT OLD.browser_id OR NEW.browser_generation IS NOT OLD.browser_generation OR NEW.credential_epoch IS NOT OLD.credential_epoch OR NEW.original_signed_in_at_s IS NOT OLD.original_signed_in_at_s OR NEW.original_expires_at_s IS NOT OLD.original_expires_at_s
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_REFRESH_FAMILY_BINDING'); END;
