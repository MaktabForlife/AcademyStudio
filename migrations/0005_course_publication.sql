-- No offering, purchase, audience or transfer is seeded.
CREATE TABLE course_publications(offering_id TEXT PRIMARY KEY REFERENCES offerings(offering_id),registration_id TEXT NOT NULL UNIQUE,activity_key TEXT NOT NULL UNIQUE,run_id TEXT NOT NULL,publication_id TEXT NOT NULL,access_model TEXT NOT NULL CHECK(access_model IN('FREE','PAID')),created_at INTEGER NOT NULL);
CREATE TABLE course_access_models(offering_id TEXT PRIMARY KEY REFERENCES offerings(offering_id),access_model TEXT NOT NULL CHECK(access_model IN('FREE','PAID')));
