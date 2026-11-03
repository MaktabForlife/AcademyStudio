# Existing recordings, PDFs and websites

Local implementation from the released Studio V109.15 commit `fa2c216`.
No schema, publication, ownership, entitlement, source binding or deployment
configuration changes are needed.

Course Media lists existing website collections alongside new playlists.
Opening an existing collection shows its original recordings, distinct PDF
references and reading/editor links together. It uses the existing scoped
`course-playlist-detail` read action; native Source proxy allowlists are unchanged.
Saved membership, attachment IDs, dates, cohorts and publication flags are never
rewritten. Existing collections are read-only projections, not newly created
playlist rows. The normal create/save/manual-publish workflow stays separate.

Tafseer/MOU existing collections are visible in the main Media view instead of a
collapsed historical disclosure. The held `8c5478f` MOU summary/PDF enrichment is
retained. Exact saved lesson/asset bindings supply summaries; a similarly named
recording cannot borrow another recording's summary. Private websites have only
their Admin editor link, and private recordings/files keep their original flags.

Unassigned means `website_id IS NULL` **and** no native playlist membership.
Previously the endpoint used only the second condition, so website-linked
historical recordings were also returned. Unassigned items have no website link
or Settings action. No destination is guessed.

The metadata count query uses the selected offering's attachment index and
groups by saved website association. Existing Course detail pages return at most
50 attachments with an explicit continuation cursor. PDFs are deduplicated by
asset for presentation and included on later pages. Every new read is behind the
existing Admin/ownership/current-account gates. No learner/public route is
broadened, no verification window changes, and no per-file Source calls occur.

Synthetic local example: Course list 16 D1 rows / 8 queries; opening its existing
collection 13 rows / 7 queries. These are fixture measurements, not a production
usage forecast. Native proxy, Teacher/student denial, account epoch, publication,
late replies, exact summary identity and pagination regressions are covered.

The loopback-only `tools/serve-existing-media-review.mjs` accepts private external
inventory/PDF manifests. It exposes no save/publish transport. Verified project
PDFs remain outside public assets and have allowlisted local review links.
Existing Studio attachment/website links retain their protected origin. Do not
ship the review helper or its input packets as public release assets. The browser
check blocks all external requests and checks desktop/390px layouts, all populated
Courses, private MOU, separate unassigned items and local PDF bytes.

Private native attachment/setup is a separate owner-authorised operation. Keep
its manifests and receipts outside public Git history; do not use operator D1/R2
writes instead of a current native Admin gate. New and existing card/content
publication remains manual. Deployment is held for owner review.
