# Deployed parallel checkpoint — V108.0, 29 October 2026

The deployment owner reports the authorised parallel activation complete at https://academy-studio-parallel.naidu-hajira.workers.dev. Source runtime commit: `313b6100`; target runtime commit: `5183846`. Release documentation heads are `4f693aa4` (source) and `25c90da` (target). Private release evidence is in the project output `outputs/academy-parallel-access-20261029/release-verification.json`.

Reported verification: 68 combined local tests and five bounded hosted version/config/denial checks passed. Initial recovery took 15 steps/17 deliveries with zero errors or unfinished/dirty/pending work, reading 886 source rows and writing 470. The target metadata check found nine sites, two Academy-authoritative scopes, eight Surah mappings, eight real accounts and 13 ready projections. All 33 prior source bindings/secrets were retained. These counts were reported by the deployment owner; this thread performed no hosted verification or operations.

Academy retains enrolment/access authority and all existing serving paths. The synthetic preview remains separate. PDF/recording inventory and bytes remain a separate migration stage, with Academy materials available. No DNS, Git push, retirement or destructive cleanup was included. The deployment approval is fulfilled; future changes remain local until separately authorised.

## Local alignment and remaining difference

Local inspection against the deployed source Git checkpoint confirms `recoverWebsite` is identical, including reserved bounded prerequisite candidates and indexed dependency guards. The `website_platform_unscoped_due` partial index definition also matches exactly. The access projector/importer and timetable module match the deployed source files.

Local source `68fff58d` additionally contains a sender check that fences a person snapshot while its scope metadata is still dirty/unprojected. That small local-only difference was not part of the reported deployed source checkpoint. Preserve it for later review; do not infer deployment approval for it or redeploy the older feature checkout wholesale. Release-version markers and actual hosting configuration belong to the clean V108.0 release branches, not this disabled local feature configuration.
