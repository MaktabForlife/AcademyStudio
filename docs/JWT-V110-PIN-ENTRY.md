# V110 native Academy PIN entry — feature-only UI follow-up

The native Academy workspace sign-in form submits when its fourth PIN digit arrives, with a valid native account ID and an open, enabled login form. It calls requestSubmit() through the existing native validation, busy and rate-limited login handler. The change is conditional on the opt-in M4L_V110 adapter. The legacy disabled path is unchanged. No PIN value, credential hash, signing key or session token is recorded in this report.

Explicit public sign-in also releases a stale initial-restore busy state after clearing the old display context. It keeps the previous private workspace masked. The old restore cannot reveal a prior account or leave this public form disabled.

The runtime source is Academy `75c3088408aa9f9b0a22ca8b40c8d4c346951fc2`, file js/m4l-academy-login.js. The scoped browser fixture/workflow is AcademyStudio `3e00daa6b9a4cb7360c75a10cca927b451686216`; Hifz checkout is `becb310d18fc899562c1d76cea583cea801af809`.

[GitHub Actions run42148490517](https://github.com/MaktabForlife/AcademyStudio/actions/runs/42148490517), job127665657699, passed one real Chrome156.0.8078.79 case with zero failures, cancellations or skips. It waits until the delayed initial context request is actually pending and the PIN control is disabled before exercising explicit public sign-in. It then verifies enabled controls, no submission after three digits, one submission on digit four and no second submission while busy. It also checks empty/blocked entry, prior workspace masking and the affected existing cross-app browser controls. Shared source copies and native PIN syntax pass.

[Artifact13470923848](https://github.com/MaktabForlife/AcademyStudio/actions/runs/42148490517/artifacts/13470923848) was downloaded and SHA256-verified entirely in RAM: `d306767aab48e72de4a8757687bff05a83192d81bed439520b4b57171a25b605`. It contains source pins, shared hashes, TAP and credential-free browser diagnostics.

This uses the real Academy workspace sign-in controller and markup, with other Academy controllers excluded, Studio reader scripts and Hifz native scripts across three loopback origins. HTTP and context replies are synthetic; the PIN POST is not a real verification/issuer. It does not establish first-time PIN setup, the standalone account-page form, full native JWT resource authentication, real foreground qualification, remote cancellation/ACK, late Set-Cookie, arbitrary media rendering, real SaaS hosts/storage or production cutover. Hifz was already hidden and cleared before freezing; first resumed paint/visible freeze and a measured BFCache restoration are not proven.

No hosted requests, hosted SQL, existing database changes, deployment, merge or production change occurred in this follow-up. The Feature database/seed/binding work is coordinated separately with optimisation. This is a scoped review submission, not full JWT activation readiness.
