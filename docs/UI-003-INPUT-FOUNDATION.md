# UI-003 — Offline input foundation only

Unreleased, not a complete Process video service or deployment component. Pure transcript/retention helpers are not imported by any current route, writer, issuer, UI or configuration.

The caption parser accepts bounded UTF-8 VTT/SRT with ordered starts, valid end times inside the actual checked recording duration and safe plain caption markup. It rejects missing/invalid/oversized/offset-mapped input instead of inventing timestamps or truncating the lesson. Parsed speech remains untrusted source evidence; an instruction appearing in speech is never an application instruction. No provider is called and the parser does not prove transcript completeness, audio fidelity or availability of YouTube/Zoom captions.

The UTC calendar helper computes the clamped calendar-month deadline and 14-day video deadline from an already-persisted original ingestion timestamp. Equality denies the temporary read. This is a calculation helper, not proof of immutable owning storage, native destination policy, lifecycle hooks, deletion, R2 enforcement or cross-app retention. Permanent Studio YouTube is a distinct trusted policy and cannot be chosen from an untrusted provider label.

Tests run only in disposable GitHub with synthetic text and no hosted application/DB/Worker/provider calls. Node evidence is not workerd, native Admin/source guard, job/candidate/provider/publication, real-host, production or full-workflow acceptance.

The concrete manual processing proposal is docs/UI-003-VIDEO-AUTOLINK-PROCESSING-PLAN.md in Academy commit 6798926e1700b92520c551d1bf0d53021ed628d8. Owning jobs/private transcript/candidate storage, current guard/CAS/outbox/unknown-provider-outcome handling, real provider configuration, authorised caption/Zoom acquisition, private review versus learner projection and explicit native publication remain integration gates. No schema/config/credential/rights/identity/media/publication/version/host/deployment effect is installed or approved by this foundation.
