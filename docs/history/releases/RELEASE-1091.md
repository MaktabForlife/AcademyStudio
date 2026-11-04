# V109.1 — Circles workspace presentation

Owner-authorised UI deployment, 31 October 2026. Based on the verified V109 release.

The signed-in root dashboard keeps its circle centred between two programme-button columns, with a clear gap on both sides. Smaller screens place the circle above the buttons. Existing account filtering and programme navigation remain in control; public homepage cards retain their previous composition.

Native Learn, Teach and Admin pages share the Circles cream/plum palette, local fonts, compact controls and focus styling. The signed-in Circles dashboard remains the common home, including the existing account-bound return from native pages.

Validation: 25 Target checks and 45 Source checks passed. The paired synthetic-account rehearsal exercised real PIN sign-in, native one-use continuation, account-bound return, and public/dashboard switching. Desktop geometry had a round 547.867px circle and 36px gaps; mobile had no horizontal overflow. Native teaching and management shells were reviewed locally.

Release scope: Target Worker assets and Source Pages frontend only. Source backend Worker, authentication contracts, all 42 Source/17 Target bindings, 43200/43200/60 verification policy, database schemas/records, R2 content, existing rights and inactive free-course cards remain intact. No domain/router/DNS change or Git push.

Target build uses tools/prepare-ui-1091.mjs and wrangler.ui-1091.jsonc: 162 public assets, 149 frozen V109 assets unchanged, only 13 changed paths including one new stylesheet. No private payload, local preview adapter, sample account or homepage editor is published. Source deployable Pages build contains 852 assets using the existing production API.

Previous release for rollback: Target Worker version 264c7f1c-3254-4da9-960f-6a8ec35f4d72; Source Pages production deployment 4559ae9b-132d-427b-b683-1f35cfea913e. No database rollback is required. Actual deployment IDs and bounded postflight checks are recorded in the project release receipt.
