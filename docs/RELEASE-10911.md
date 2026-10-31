# V109.1.1 — visible homepage version

Adds the deployed version below the Academy name on the public homepage and signed-in Circles dashboard. The label uses a build version meta tag, so it appears after header redraws without an extra API request.

The owner requested this follow-up after reviewing the V109.1 public homepage. Existing separated dashboard columns remain visible after login; public homepage composition stays intact. Native Source Pages and API remain at their verified prior versions.

Prepared from the exact verified V109.1 composition: 162 assets, 158 unchanged, four reviewed changes (the two home entry HTML files, the existing header controller, and shared CSS). No private payload, preview adapter, content, permissions, binding, origin, router or DNS change. Validation uses the composition/navigation checks, deployment dry run and a local browser review.

Deploy with wrangler.ui-10911.jsonc. Previous Target version for rollback: cb1b49a0-83c3-403e-bc14-287e2ea237ad. Actual deployment and live check evidence is recorded in the project release receipt.
