# V110 compact Studio token — selected contract and independent proof

## Current Studio decision — 5 November 2026

The owner explicitly selected **one compact Studio access JWT**. This supersedes embedding every Studio grant and the proposed separate Tafseer/MOU/Course-cookie experiment. The split experiment was stopped before any remote commit or test run; there are no split-cookie results to report.

Studio keeps its own signing key, issuer/audience and access/opaque-refresh family. Existing Academy programme/role claims and Hifz's independent identity/live native checks are unchanged by this Studio choice. No live database, identity link, copied profile field, sync, authority, config or deployment change is authorised. The database/deployment holds remain controlling.

The access token contains existing user/family/parent/browser bindings, credential/unlock/policy versions, original sign-in/deadline, issued/expiry times and token ID, plus an exact identity-format marker. It contains **no Tafseer, Surah, MOU or Course grant list**. Studio uses the requested resource's current indexed native rights and metadata in the same Studio Worker flow. Existing Course FREE policy permits eligible signed-in readers without a paid grant; private/unpublished/admin/Source/class/Join checks retain their own rules.

Access remains at most15minutes; refresh ends at the original absolute7days; only that app's qualifying foreground refresh advances its independent90-minute lock. Logout/switch, reset/suspicious cancellation, versioned durable notifications and separate keys keep their agreed semantics. Compact selection does not approve a browser-switch mechanism or storage migration.


## What the prototype does

`src/auth/v110/compact-studio.mjs` composes the existing strict JOSE/configured-cookie engine with an exact compact marker. It rejects full-rights input/format, wrong app/key, unexpected claims and excessive/expired lifetimes. Its account-bound refresh derives identity/version/family fields from current local records; callers submit only an opaque refresh and foreground flag. It does not read or export material-grant lists.

The accepted prepare-before-CAS order is retained: current identity read, validate/sign/cookie/result preparation, then the final primary CAS/audit against the full selected family tuple, exact policy version, native account flags/epoch and current cancellation/expiry/idle gates. Bounded churn emits no cookies/writes; known failures before commitment preserve the original secret. Entirely lost successful responses retain the known unknown-outcome limitation.

`authenticateCompactStudio` verifies the compact JWT and reads current native account plus family/browser/credential/policy/parent/idle floors in one indexed identity query. It returns a trusted server-side actor; no material permission is inferred from that identity. Existing resource handlers enforce their current grants/publication/source/ownership/window/role rules. Low-level token/actor helpers are server-internal; HTTP adapters must allowlist output and keep private/auth responses uncached.

No new DDL, numbered migration, native grant writer, config or real handler import is introduced. Existing full-rights modules remain unimported historical proof. This is source-only work on the retained V109.23 feature base; future integration must preserve V109.24 or any later reviewed canonical pair.

## Independent test scope

Tests run only on disposable GitHub runners, including the selected production compatibility-date runtime:

- Strict compact shape and app/key/purpose/expiry checks, including rejection of the historical full-rights token format.
- Normal and maximum-supported identity lengths; exact Studio access/refresh and coexisting Academy-cookie header sizes, plus1024bytes reserved for unresolved browser/CSRF cookies. The parent cookie is tested with0and16 own-programme scopes; its separate capacity remains an Academy obligation. Byte calculation is not a full real-browser/privacy proof.
- One compact identity read and fixed token size with2000 additional native Course rows for the same synthetic person (1000PAID/1000FREE). This shows no grant export/scan during refresh; it does not remove per-resource permission reads.
- Matched retained full-rights versus compact issuance metrics, preserving row/statement/write distinctions and making no whole-flow or CPU savings claim.
- Policy-version re-prepare, credential cancellation, size/signer failures before CAS, independent90-minute equality, original7-day clipping and stale native Admin rejection despite a freshly signed identity token.
- An actual Worker-local refresh response issues only Studio's access/refresh cookies and no Academy cookie.
- Matched native versus compact GETs execute the same native website route, current material queries and published R2 response on synthetic local-owner data. Purchase revocation, another user's lack of paid access, FREE policy and withdrawal are checked with the same unchanged compact identity token. A known parent cancellation is denied before content.

The matched route test uses a **test-only source bridge**: it exports the current private route and moves its existing checkedActor branch ahead of legacy-cookie parsing, then supplies an actor only after compact signature and current-floor checks. The native business route body is unchanged. This bridge is compiled in memory on GitHub; production `src/worker.mjs` is untouched. It covers GET website reads in `AUTHORITY_MODE=WEBSITE`, not all routes, Source mode, writes, conditional304 recovery, media Range, browser CSRF/UI or provider-host transitions. GET/R2 metrics are measured separately from refresh/audit writes. The lab counts D1 round trips/statements/rows and R2 get/head calls, with blocked/zero Academy calls; observed harness wall time is not billed Worker CPU. These are not hosted-account measurements.

## Remaining authority and age mapping

The compact gate replaces the ordinary legacy account-status age checkpoint with the agreed local token/session/cancellation/idle checks. It does not write a newly verified native timestamp. Actual native fresh-Admin guards continue reading the existing `verified_at`; a newly minted JWT cannot turn stale Master authority into fresh authority.

Source-mode `accessGate` age/readiness behavior remains a separate integration gate. Map ordinary authentication-age refresh to eligible local original7-day/90-minute sessions without globally disabling Source readiness, generation, authority/COMMITTED, master-account fences, timed class/audience rules, fresh Admin or the exact Join window. Do not globally lengthen `boundedAge` or flip `AUTHORITY_MODE`. This proof's local-owner GETs do not establish the Source-mode/outage policy across all routes.

Material grants now remain current native decisions. Do not add per-person grant-version fanout merely to support the abandoned full-rights export. Identify which remaining security/identity/policy claims require a version fence. The owner's earlier subscription-triggered silent-replacement policy must be mapped explicitly to the chosen compact design; no writer/outbox effect for it is installed here. Credential/reset/browser/parent cancellation still needs durable, idempotent security receipts/floors and the agreed PIN behavior.

The accepted writer map and exact predicates in `JWT-V110-EXISTING-DATA-CONTRACT.md` still control MOU last-cohort/kind cleanup, conditional credential-write success, profile count versus cancellation receipts, existing counter domains and permanent ID links. No grant, copy, role owner or journal record is rewritten by compact selection.

## Activation hold

Complete the actual writer/security event map, remaining native route/Source/lifecycle/browser/CSRF/privacy integration, matched full-flow costs, hostname readiness, and concrete live storage/config/cutover/rollback effects. The owner must approve those concrete live DB effects before execution. This contract and isolated tests are not activation clearance. No V110 deployment is requested or performed.
