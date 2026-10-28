# Disposable local preview

Run `npm run dev` from this repository. It starts the website at `http://localhost:8791` and the Academy handoff connector at `http://localhost:8792`, bound only to loopback. It runs the current Academy authentication implementation and new connector with synthetic split Core/Admin databases, plus the target's local D1/R2. Stopping the process discards the data. No hosted resources or real credentials are used.

Synthetic accounts: `separation-global` / PIN `1234` (Admin), `separation-studentA` / PIN `1234` (Learner with the sample Course purchase/live right). The homepage uses the single Academy sign-in. The popup opens a deliberately minimal local Academy landing page that confirms the handoff; it does not claim acceptance of the full Academy or Library interface.

`PREVIEW_PORT` changes the website port; Academy uses the next port. `PREVIEW_PUBLIC_ROOT` selects a content/editor worktree's `public` directory for integration, while keeping the backend here. The preview adapter rewrites only local origins; the committed runtime configuration remains disabled. Normal deployment must not use this adapter, synthetic fixtures or test-only service bindings.

The independent platform's canonical remote is `https://github.com/MaktabForlife/AcademyStudio.git`. The local `origin` is configured; no push/fetch/deployment is implied. All hosted changes still need separate approval.

Browser checks on the synthetic baseline passed in headless Chrome: desktop/390px homepage layout, existing Academy PIN login and Secure HttpOnly website cookie, entitled reader, one-use Academy popup, sign-out/revocation, scoped administration and full-builder draft Save. No page errors or external browser requests occurred. `tools/browser-check.mjs` uses `PLAYWRIGHT_MODULE`/`CHROME_PATH` when the runtime is supplied externally and writes screenshots plus `outputs/browser/result.json`. These checks precede the separate content/editor branch integration; they do not accept all nine websites or the on-page editor.
