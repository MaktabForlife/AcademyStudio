# Copied Academy content in Circles · 30 October 2026

This supersedes the first styling pass's synthetic recording input at the primary review URL. The presentation remains the approved Circles family. Only disposable local state is created; neither live system nor any hosted edition is changed.

## Run and inspect

Worktree: `work/AcademyStudio-circles-theme`, branch `feature/circles-content-theme`.

Primary review: `http://localhost:8901/local-start`. Its local account is synthetic. Opening this entry renews only that fixture identity's freshness through the signed fixture bridge while retaining its current admission, epoch and role values. It does not restore removed permissions. Normal backend authorisation and freshness checks remain in place; reopening this entry is required if the local administrative proof expires.

Start from this worktree:

```
PREVIEW_PORT=8901 node tools/serve-circles-reconciled-review.mjs <project-root> <private-evidence-directory>
```

The earlier `serve-circles-content-review.mjs` remains a historical synthetic rehearsal and is not the primary review's input. Port 8890's Academy Teach/Admin workspace is separate and unchanged.

## Copied source, with boundaries preserved

Input is `outputs/academy-content-copy-20261030/circles-bundle/manifest.json`, provided by migration in the shared `outputs/website-circles-review-20261030/MIGRATION.md` handoff. Generic producer/alias modules and their focused tests are brought over from `work/Maktab-web-platform` commit `8142a0a` (following `c3013cd`). No private manifest, teaching JSON, asset bytes, source IDs or credentials are committed to public assets.

The bundle holds nine mapped websites, 103 readings and 45 recording companions. Eleven copied Academy PDFs exactly match the builder files. Thirty-two companions have resolved native recording identities. Thirteen remain unresolved: Sajdah two, Muzzammil one, Qasas ten. Six further Academy recording references remain retained and unassigned to websites. The review catalogue's transfer notes list them without guessing associations.

`seedReconciledFixture` runs only against a new disposable local fixture and creates no real users or entitlements. It preserves the original publication, original private draft and reviewed draft as separate editions. The review server does not publish reviewed drafts. Its nine-site check compares each saved draft and publication exactly with the bundled bytes.

For an authorised administrator, the local HTTP adapter obtains the reviewed draft through the normal private edit API. The actual reader then displays it with a clear **Private review draft** notice. **View published edition** compares the preserved original using the normal published read. Non-administrators never receive this private draft substitution or its review metadata. This adapter is a loopback-only review facility, not a production content endpoint or a proposed authority bypass.

Playback and PDF requests remain on the unchanged gated native media API. `bindRecordingGuides` joins an editorial guide only when its exact native lesson and asset are already in the current permitted feed. It cannot make a denied, hidden or missing recording playable. Original guide source keys remain intact for displayed introductions, topic lists and quotations; saved source documents are not renamed. Unresolved companions have reading links and an explicit pending label, with no playback action.

The canonical state is `status === MATCHED`, not an inherited `nativeMappingPending` flag. The resolved Foundations metadata is no longer labelled pending. Original source declarations and source manifests are retained separately by migration; identifying a hidden source still does not make it playable.

## Separate drafts and public policy

### Tafseer card design

The user requested standard Tafseer cards with traditional Arab patterns, Arabic calligraphy and smaller English names. The nine catalogue covers now share an ivory illuminated-book design, repeating eight-point geometric ornament and a fine double frame. Self-hosted Amiri renders the Arabic as selectable, correctly shaped text; English titles remain accessible links beneath. The current Arabic labels follow the supplied surah names, with Foundations' introductory wording taken from its source subtitle. These are catalogue cover labels, not changes to teaching documents or reader artwork.

Course pictures remain unchanged. Fatir remains non-clickable and pending. Browser checks at 320, 390, 768 and 1440px found no page overflow or Arabic names crossing the cover edges. All six existing course pictures remained present, with no Tafseer template applied to Courses; Yaseen's existing link still opened its five native recording entries. Evidence is in `outputs/academy-tafseer-cards-20261030/`.

The six guidance-course readers fetch their exact copied author wrappers and checksum-verified artwork from the bundle. A normal local administrator check protects these author-review routes. Only the existing renderer runtime/fonts come from the prepared previews; teaching JSON and artwork are no longer read from those earlier preview content directories. All author-export fields, original artwork and existing device-only editing tools remain intact. No course identity, purchase or grant is inferred.

Mothers of the Ummah's eleven-reading draft is retained in the same bundle and shown separately as an Academy draft. Its existing built page is not rebuilt or folded into Tafseer/Courses here. Six guidance drafts (53 web lessons) plus the nine mapped readers (103) are explorable in this review; Mothers' operational page/import remains separate. The bundle's full total is 167 readings, including those eleven retained Mothers entries.

Fatir is a non-clickable placeholder immediately before Yaseen, with no inferred date or access. Foundations' public-text policy is explicitly retained; its recordings keep their original gates. This older fixture does not prove the final anonymous Foundations flow or the deployed V108.0 source-authority acceptance.

## Verification and evidence

- 15 focused unit checks passed: reconciliation conflict preservation, canonical mapping metadata, exact gated aliases, non-playable pending states, podcast/content shape and recording companions.
- Fresh native rehearsal passed all nine exact private draft/original publication comparisons, private Save, idempotent retry, fixture-only Publish/Restore and peer preservation. Eleven PDF ranges and 32 native video/guide bindings resolve. Tested historical month/class access, website-only grant denial, immediate paid-month removal and retained whole-Course purchase pass. Maximum media read cost is five rows; private Save is 39 rows in this older fixture. No Academy requests or hosted calls occur.
- Browser: all nine mapped websites and six bundled guidance drafts render at 390px. Narrow 320px checks found a Qasas journey-card word overflow; the phone card layout was corrected and rechecked. Catalogue, Yaseen, Qasas and Tawakkul fit at 320, 768 and 1440px.
- The copied native Yaseen reference visibly played after selecting 19:05. Its companion reading showed the bound introduction, native play action, topic guide and original quotation. Published-edition comparison remained separately labelled. Qasas displayed ten pending companions and zero playback actions for those pending rows.
- Evidence is in `outputs/academy-circles-content-20261030/reconciled/` and `reconciled-private/`; the native rehearsal and focused test logs sit alongside them. The completion JSON records the exact branch/commit, bundle hash and primary review URL.

Audio, physical-device testing and browser PDF viewer rendering are not claimed. The final V108.0 + Circles merge, its complete authority/read-budget acceptance, native mapping of the thirteen unresolved recordings, association of six additional references and operational import of standalone author drafts remain pending. No deployment, DNS cutover, retirement, source deletion or hosted permission change is authorised by this work.
