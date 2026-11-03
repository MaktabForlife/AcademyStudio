# V109.14

Repair the shared Academy Admin request wrapper used by Course Media. Permit only the existing signed Studio POST routes with exact Course/Program body scope and preserve current authority, origin, workspace/account-generation and response guards. Read-only Course bridge commands retain the existing account view; actual changes still invalidate it. Existing Program editors and all server permission checks remain.

Matching Academy API/Pages and Studio release. No backend/schema/data/rights/Hifz/DNS/coordinator changes. V109.13 Course workflow, caching and manual attachment/publication remain.
