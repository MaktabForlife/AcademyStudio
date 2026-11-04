# Reviewed hosting origins

Hosting addresses are explicit deployment configuration. No request Host, Origin, query value or forwarding header selects a trusted origin or upstream.

- WEBSITE_ORIGIN: Studio's canonical browser origin. Current: https://maktab4life.org.
- STUDIO_BACKEND_ORIGIN: fixed Studio Worker origin. Current: https://academy-studio-parallel.naidu-hajira.workers.dev.
- ACADEMY_ORIGIN: native academic tools origin. Current: https://academy-maktab4life.pages.dev.
- ACADEMY_PORTAL_ORIGIN: shared homepage/dashboard origin. Defaults to WEBSITE_ORIGIN, preserving the current deployment. The reviewed first-stage candidate is https://ummabbadacademy.app; it is NOT activated by this source change.
- WEBSITE_ALIAS_ORIGINS: JSON array of up to eight explicit HTTPS aliases. The existing root configuration retains https://www.maktab4life.org when omitted. Other website origins get no implicit aliases.

Origins must be exact HTTPS origins without paths, trailing slash, credentials, ports, query, fragments or wildcards. The router accepts only its configured canonical/alias origins. Sensitive browser actions accept only WEBSITE_ORIGIN, never ACADEMY_ORIGIN or ACADEMY_PORTAL_ORIGIN merely because they are configured navigation destinations.

When explicitly configured to a distinct portal, safe common homepage/dashboard/login GET/HEAD routes redirect there. Studio readers, API/auth endpoints and writes stay on Studio. Existing native tool aliases use ACADEMY_ORIGIN. This config does not change 43200/43200/60, cookies, grants, content, Hifz or hosted resources.

X-Maktab-Front-Door remains discovery/routing metadata only. It cannot authorize an account, action or Origin.

Source and synthetic tests are prepared remotely in GitHub. The production vars and current V109.18 public manifest are unchanged; a future reviewed paired package/release is required to activate changes.
