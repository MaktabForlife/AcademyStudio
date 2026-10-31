-- Metadata arrives only through a signed, natively authorised Source setup.
-- It creates no material access, publication, purchase or live session.
CREATE TABLE completed_course_registrations(
 offering_id TEXT PRIMARY KEY REFERENCES offerings(offering_id),
 registration_id TEXT NOT NULL UNIQUE,
 website_id TEXT NOT NULL UNIQUE,
 package_sha256 TEXT NOT NULL CHECK(length(package_sha256)=64)
);
