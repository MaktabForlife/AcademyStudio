# Unified learning pages — next release, local review

The owner's 1 November request treats Hifz, Studio and Academy as backend divisions only. Tafseer, Mothers of the Ummah and course pages should use the programme pages' shared presentation. All comments in this batch are for the next release. No deployment is authorised here.

This isolated feature starts at the combined V109.2 Target commit506c5a9. It changes only the learning-page presentation and the existing homepage switch-user entry. The V109.2 deployment checkout and frozen assets are untouched.

The learning pages now use the programme cream/plum palette, DM Sans/Libre Caslon fonts, shared identity/date bar, account colour, Home and Refresh icons, account menu and sign-out icon, Dashboard return row, programme-sized headings, tabs and cards. Existing course artwork, reading blocks and media remain. The account menu offers Switch user and Visit website; switching continues through the existing PIN-verified homepage account chooser. A header link respects the reader's unsaved-edit guard.

No access decision comes from the shell. It adds no account/navigation request or polling. The existing date helper keeps its validated Jamiat/Africa-Johannesburg data, cache and recovery policy; the programme variant only changes line order and date formatting. Existing current-account, publication, acquired material, monthly and Join checks remain;43200/43200/60 is unchanged.

`node tools/prepare-unified-pages.mjs` composes the reviewed166-file V109.2 tree with seven explicit changes, yielding168files:161existing hashes unchanged, fiveexisting assets changed and twonewshared assets. It fails on baseline drift, missing files, public symlinks or unreviewed additions. Raw `public/`, preview helpers and private author/media packages are excluded. No deployment configuration is provided for this draft. A future coordinated release must assign its final version/cache labels and combine separately reviewed UI work.

Local preview: http://localhost:9050/ and paired native programme pages on9051. The existing preview tool uses disposable synthetic accounts and native Worker/D1/R2 handlers, with outbound network blocked. Start with `PREVIEW_PORT=9050 PREVIEW_HOST=localhost PREVIEW_CIRCLES=1 PREVIEW_NAVIGATION=1 PREVIEW_PUBLIC_ROOT=local-content/unified-pages/public ACADEMY_SOURCE=../Academy-release-1092 MOU_BACKEND_ROOT=. node tools/preview.mjs`. This preview represents the new shell over sample data, not the complete hosted catalogue or the four real MOU attachment publications.

Checks:32date/MOU client/recording renderer/Admin dashboard checks,3native sign-in/continuation checks and1paired MOU runtime check pass. Initial native tests encountered the local port restriction; the same checks then passed with local listening allowed. Browser verification and screenshots are recorded in the parent review receipt when complete.
