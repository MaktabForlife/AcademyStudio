-- PROPOSED FIXTURE ONLY. Not an installed migration or deployable schema.
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
-- Minimal native retained-content receipt; no actor/session/transcript/model.
CREATE TABLE video_processing_committed_objects(
 object_key TEXT PRIMARY KEY,object_hash TEXT NOT NULL,attachment_id TEXT NOT NULL,created_at INTEGER NOT NULL
);
CREATE INDEX video_processing_committed_attachment ON video_processing_committed_objects(attachment_id,object_key);
